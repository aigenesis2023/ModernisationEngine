#!/usr/bin/env node
/**
 * V5 SCORM Extractor — Content + Logic
 *
 * Reads a Storyline SCORM package from disk and produces content-bucket.json.
 * Extracts:
 *   - Educational content: text, quizzes, media, form fields, tables
 *   - Interactive logic: variables, triggers, conditions, navigation
 *   - Layer content: click-to-reveal panels tagged with trigger info
 *   - State content: hover/click text tagged with state names
 *   - Question banks: bank slides associated with slidedraws
 *   - Complexity assessment: pattern detection and scope signals
 *
 * See v5/LOGIC-EXTRACTION.md for the complete architecture spec.
 *
 * Usage: node v5/scripts/extract.js <scorm-folder>
 * Output: v5/output/content-bucket.json
 */

const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────
const NOISE_PATTERNS = {
  shapeFile: /^shape[a-z0-9]+\./i,
  textAsImage: /^txt__default_/i,
  autoLabel: /^(rectangle|oval|round|freeform|hotspot|group)\s*\d*/i,
  iconAlt: /^(arrow|check|close|icon|bullet)\s*(icon)?\s*\d*/i,
  playerText: /^(%|_player\.|slide\s+\d|layer\s+\d|scene\s+\d)/i,
  shortJunk: (t) => t.length < 3,
};

function isNoise(text) {
  if (!text) return true;
  const t = text.trim();
  if (NOISE_PATTERNS.shortJunk(t)) return true;
  if (NOISE_PATTERNS.autoLabel.test(t)) return true;
  if (NOISE_PATTERNS.iconAlt.test(t)) return true;
  if (NOISE_PATTERNS.playerText.test(t)) return true;
  if (t === 'Question' || t === 'Correct' || t === 'Incorrect') return true;
  return false;
}

function isShapeFile(filename) {
  return NOISE_PATTERNS.shapeFile.test(filename) || NOISE_PATTERNS.textAsImage.test(filename);
}

// System-generated variable patterns — filter these out to find custom author vars
const SYSTEM_VAR_PATTERNS = [
  /^CurrentQuiz_/,
  /_RetryModeInteractionIncompleteOnLoad$/,
  /^ReviewMode_/,
  /^RetryMode_/,
  /^LastSlideViewed_/,
  /^QuizAdvanceModeWarningShown$/,
];

function isSystemVariable(name) {
  return SYSTEM_VAR_PATTERNS.some(p => p.test(name));
}

// Object state property patterns — these are NOT custom course logic variables.
// They're internal Storyline object state references that appear in triggers.
function isObjectStateRef(name) {
  if (!name) return true;
  // Object state properties: _checked, _state, _hover, _disabled, _visited, etc.
  if (/^_(checked|state|hover|disabled|visited|dropcorrect|dropincorrect|savechecked|savevisited|children)/.test(name)) return true;
  // _parent.ObjectId.#_checked — object property references
  if (name.startsWith('_parent.') || name.startsWith('_this.') || name.startsWith('_playerVars.')) return true;
  // Any dot-path that starts with a hash-style object ID (5+ alphanum chars followed by a dot)
  // e.g. 6QzwW2n1HL0.#_state, 6eXSadR8ZxQ.6TtzGksQxGU.#_state, 6Cy0jDsIHT8.#ItemWasDragged
  if (/^[A-Za-z0-9]{5,}\./.test(name)) return true;
  // Direct _property references (but not _player which is a namespace)
  if (/^_[a-z]/.test(name) && !name.startsWith('_player')) return true;
  // ItemWasDragged and similar one-off internal refs
  if (name === 'ItemWasDragged') return true;
  return false;
}

// ─── Storyline JS parser ─────────────────────────────────────────────
function parseStorylineJs(rawContent) {
  let captured = null;
  const fakeWindow = {
    globalProvideData(_type, jsonStr) {
      captured = JSON.parse(jsonStr);
    },
  };
  const fn = new Function('window', rawContent);
  fn(fakeWindow);
  if (!captured) throw new Error('Cannot parse Storyline data');
  return captured;
}

// Variant that also captures the data type
function parseStorylineJsTyped(rawContent) {
  let captured = null;
  let dataType = null;
  const fakeWindow = {
    globalProvideData(type, jsonStr) {
      dataType = type;
      captured = JSON.parse(jsonStr);
    },
    globalLoadJsAsset(path, jsonStr) {
      // Some files use globalLoadJsAsset for embedded assets
      dataType = 'asset';
      captured = jsonStr; // raw string, not JSON
    },
  };
  try {
    const fn = new Function('window', rawContent);
    fn(fakeWindow);
  } catch (e) {
    // Fallback: try extracting JSON from the raw content
    const match = rawContent.match(/globalProvideData\s*\(\s*'(\w+)'\s*,\s*'([\s\S]*)'\s*\)/);
    if (match) {
      dataType = match[1];
      captured = JSON.parse(match[2]);
    }
  }
  return { type: dataType, data: captured };
}

// ─── XML parser ──────────────────────────────────────────────────────
function parseManifest(xmlContent) {
  const titleMatch = xmlContent.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Course';

  const idMatch = xmlContent.match(/identifier="([^"]+)"/);
  const courseId = idMatch ? idMatch[1] : 'unknown';

  const versionMatch = xmlContent.match(/<schemaversion>([^<]+)<\/schemaversion>/);
  const scormVersion = versionMatch && versionMatch[1].includes('2004') ? '2004' : '1.2';

  return { title, courseId, scormVersion };
}

function parseFrameXml(xmlContent) {
  const scenes = [];
  const lines = xmlContent.split('\n');
  let currentScene = null;

  for (const line of lines) {
    const topMatch = line.match(/slidelink\s+slideid="([^"]*)"[^>]*displaytext="([^"]*)"[^>]*expand="true"/);
    if (topMatch) {
      if (currentScene) scenes.push(currentScene);
      const sceneId = topMatch[1].replace('_player.', '');
      const title = topMatch[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      currentScene = { sceneId, title, slideIds: [] };
      continue;
    }

    const childMatch = line.match(/slidelink\s+slideid="([^"]*)"[^>]*displaytext="([^"]*)"[^>]*type="slide"\s*\//);
    if (childMatch && currentScene) {
      const slideId = childMatch[1].replace('_player.', '');
      const displayText = childMatch[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      currentScene.slideIds.push({ slideId, displayText });
    }
  }
  if (currentScene) scenes.push(currentScene);

  return scenes;
}

// ─── Text extraction from Storyline objects ──────────────────────────
function extractText(obj) {
  if (obj.textLib && obj.textLib.length > 0) {
    const textData = obj.textLib[0];
    const blocks = textData.vartext?.blocks || [];
    const spans = blocks.flatMap(b => (b.spans || []).map(s => s.text));
    const text = spans.join('').trim();
    const firstSpan = blocks[0]?.spans?.[0]?.style;
    return {
      text,
      fontSize: firstSpan?.fontSize || 14,
    };
  }
  return { text: obj.data?.vectorData?.altText || '', fontSize: 14 };
}

function classifyText(text, fontSize) {
  if (!text || isNoise(text)) return null;
  const len = text.length;
  const size = fontSize || 14;

  if (size >= 20 && len < 150) return 'heading';
  if (size >= 15 && len < 60) return 'callout';
  return 'body';
}

// ═══════════════════════════════════════════════════════════════════════
// CONTENT EXTRACTION (existing, enhanced with state awareness)
// ═══════════════════════════════════════════════════════════════════════

function extractSlideContent(objects, stateName) {
  const blocks = [];
  const mediaRefs = [];

  function walk(objs) {
    for (const obj of objs) {
      // Text content
      if (obj.kind === 'vectorshape') {
        if (obj.accType === 'image' && obj.imagelib?.length > 0) {
          const img = obj.imagelib[0];
          const filename = (img.url || '').split('/').pop();
          if (filename && !isShapeFile(filename)) {
            const altText = img.altText || obj.data?.vectorData?.altText || '';
            mediaRefs.push({
              type: 'media-ref',
              mediaRef: {
                filename,
                mediaType: 'image',
                altText: isNoise(altText) ? '' : altText,
                context: (obj.width * obj.height) / (960 * 540) > 0.5 ? 'background' : 'inline',
              },
            });
          }
        } else if (obj.accType === 'text' || obj.accType === 'radio' || obj.accType === 'checkbox') {
          const { text, fontSize } = extractText(obj);
          const role = classifyText(text, fontSize);
          if (role) {
            const block = { type: role, text };
            if (stateName) block.state = stateName;
            blocks.push(block);
          }
        } else if (obj.accType === 'button') {
          const { text } = extractText(obj);
          if (text && text.length > 3 && !/^(prev|next|back|continue|submit|close|menu|replay)$/i.test(text.trim())) {
            const block = { type: 'callout', text: text.trim() };
            if (stateName) block.state = stateName;
            blocks.push(block);
          }
        }
      }

      // Video
      if (obj.kind === 'video') {
        const vdata = obj.data?.videodata || obj.videodata || {};
        const url = vdata.url || '';
        const filename = url.split('/').pop();
        if (filename) {
          mediaRefs.push({
            type: 'media-ref',
            mediaRef: { filename, mediaType: 'video', altText: vdata.altText || '', context: 'inline' },
          });
        }
      }

      // Standalone image
      if (obj.kind === 'image' && obj.imagelib?.length > 0) {
        const img = obj.imagelib[0];
        const filename = (img.url || '').split('/').pop();
        if (filename && !isShapeFile(filename)) {
          mediaRefs.push({
            type: 'media-ref',
            mediaRef: { filename, mediaType: 'image', altText: img.altText || '', context: 'inline' },
          });
        }
      }

      // Text input (form field)
      if (obj.kind === 'textinput') {
        const { text } = extractText(obj);
        blocks.push({
          type: 'form-field',
          formField: {
            label: text || obj.placeholder || 'Text input',
            fieldType: obj.numeric ? 'number' : 'text',
            placeholder: obj.placeholder || '',
          },
        });
      }

      // Table
      if (obj.kind === 'table') {
        const cellTexts = [];
        if (obj.objects) {
          for (const cell of obj.objects) {
            const { text } = extractText(cell);
            if (text && !isNoise(text)) cellTexts.push(text);
          }
        }
        if (cellTexts.length > 0) {
          const cols = obj.colsCount || 2;
          const rows = [];
          for (let i = 0; i < cellTexts.length; i += cols) {
            rows.push(cellTexts.slice(i, i + cols));
          }
          blocks.push({
            type: 'table',
            table: {
              headers: rows.length > 0 && obj.headerRows > 0 ? rows[0] : undefined,
              rows: obj.headerRows > 0 ? rows.slice(1) : rows,
            },
          });
        }
      }

      // Recurse into children
      if (obj.kind === 'objgroup' || obj.kind === 'scrollarea') {
        if (obj.objects) walk(obj.objects);
      }
      // For stategroups: extract default content, then state-specific content
      if (obj.kind === 'stategroup') {
        if (obj.objects) walk(obj.objects);
        // Extract content from non-default states (hover, selected, custom)
        if (obj.states) {
          for (const state of obj.states) {
            if (state.objects && state.name !== '_default') {
              const stateContent = extractSlideContent(state.objects, state.name);
              // Only include state content that differs from what we already have
              for (const sb of stateContent.blocks) {
                const isDuplicate = blocks.some(b => b.text === sb.text);
                if (!isDuplicate && sb.text) {
                  blocks.push(sb);
                }
              }
              mediaRefs.push(...stateContent.mediaRefs);
            }
          }
        }
      }
    }
  }

  walk(objects);
  return { blocks, mediaRefs };
}

// ─── Quiz extraction ─────────────────────────────────────────────────
function extractQuiz(objects) {
  const radioGroups = objects.filter(o =>
    o.kind === 'stategroup' && o.objects?.some(so => so.accType === 'radio'));
  const checkboxGroups = objects.filter(o =>
    o.kind === 'stategroup' && o.objects?.some(so =>
      so.accType === 'checkbox' || (so.referenceName || '').toLowerCase().includes('checkbox')));

  const stateGroups = checkboxGroups.length > 0 ? checkboxGroups : radioGroups;
  if (stateGroups.length === 0) return null;

  const textObjects = objects
    .filter(o => o.kind === 'vectorshape' && o.accType === 'text')
    .map(o => ({ text: extractText(o).text, fontSize: extractText(o).fontSize }))
    .filter(t => t.text && !isNoise(t.text) && t.text.length > 10);

  const questionText = textObjects.length > 0 ? textObjects[0].text : 'Question';

  const choices = stateGroups.map(sg => {
    const choiceObj = sg.objects?.find(o => o.accType === 'radio' || o.accType === 'checkbox');
    const text = choiceObj ? extractText(choiceObj).text : '';
    const isCorrect = text.endsWith('*');
    return {
      text: text.replace(/\*$/, '').trim(),
      correct: isCorrect,
    };
  });

  const isTrueFalse = choices.length === 2 &&
    choices.every(c => c.text.toLowerCase() === 'true' || c.text.toLowerCase() === 'false');

  let questionType = 'multiple-choice';
  if (isTrueFalse) questionType = 'true-false';
  else if (checkboxGroups.length > 0) questionType = 'multiple-select';

  const correctObj = objects.find(o => o.id?.includes('CorrectReview'));
  const incorrectObj = objects.find(o => o.id?.includes('IncorrectReview'));

  return {
    type: 'quiz',
    quiz: {
      question: questionText,
      questionType,
      choices,
      feedback: {
        correct: correctObj ? extractText(correctObj).text || 'Correct!' : 'Correct!',
        incorrect: incorrectObj ? extractText(incorrectObj).text || 'Incorrect.' : 'Incorrect.',
      },
    },
  };
}

// ─── Detect slide type ───────────────────────────────────────────────
function detectSlideType(slideData) {
  const objects = slideData.slideLayers?.[0]?.objects || [];

  const hasRadio = objects.some(o =>
    o.kind === 'stategroup' && o.objects?.some(so => so.accType === 'radio'));
  const hasCheckbox = objects.some(o =>
    o.kind === 'stategroup' && o.objects?.some(so =>
      so.accType === 'checkbox' || (so.referenceName || '').toLowerCase().includes('checkbox')));
  if (hasRadio || hasCheckbox) return 'quiz';

  if (objects.some(o => o.kind === 'textinput')) return 'form';

  const allText = objects
    .filter(o => o.kind === 'vectorshape')
    .map(o => extractText(o).text)
    .join(' ');
  if (allText.includes('%_player.Score') || allText.includes('%_player.Percent')) return 'results';

  return 'content';
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIC EXTRACTION (new)
// ═══════════════════════════════════════════════════════════════════════

// ─── Parse data.js for global course data ────────────────────────────
function parseGlobalData(scormDir) {
  const dataPath = path.join(scormDir, 'html5', 'data', 'js', 'data.js');
  if (!fs.existsSync(dataPath)) return null;

  const raw = fs.readFileSync(dataPath, 'utf-8');
  try {
    return parseStorylineJs(raw);
  } catch (e) {
    console.log(`  Warning: Could not parse data.js: ${e.message}`);
    return null;
  }
}

// ─── Extract and classify variables ──────────────────────────────────
function extractVariables(globalData) {
  if (!globalData?.variables) return { custom: [], system: [], all: [] };

  const custom = [];
  const system = [];

  for (const v of globalData.variables) {
    const name = v.name || '';
    const entry = {
      name,
      type: typeof v.value === 'boolean' ? 'boolean' : typeof v.value === 'number' ? 'number' : 'string',
      default: v.value,
    };

    if (isSystemVariable(name)) {
      system.push(entry);
    } else {
      custom.push(entry);
    }
  }

  // Also check playervars for completeness (all system, but record them)
  // playervars are always system — no need to add to custom

  return { custom, system, all: [...custom, ...system] };
}

// ─── Extract triggers/actions from a slide ───────────────────────────
function extractSlideTriggers(slideData) {
  const triggers = [];
  const varsRead = new Set();
  const varsWritten = new Set();
  const navTargets = [];
  const layerOps = [];
  const stateChanges = [];

  // Walk an action array recursively
  function walkActions(actions, source) {
    if (!actions || !Array.isArray(actions)) return;

    for (const action of actions) {
      if (!action || !action.kind) continue;

      switch (action.kind) {
        case 'if_action':
          // Extract variable references from conditions
          extractConditionVars(action.condition, varsRead);
          walkActions(action.thenActions, source);
          walkActions(action.elseActions, source);
          break;

        case 'adjustvar': {
          const varName = cleanVarRef(action.variable || '');
          if (varName) varsWritten.add(varName);
          break;
        }

        case 'gotoplay': {
          const target = action.objRef?.value || action.objRef || '';
          const windowType = action.window || '_current';
          navTargets.push({ target: cleanSlideRef(target), windowType, source });
          break;
        }

        case 'show_slidelayer':
        case 'hide_slidelayer': {
          const layerRef = action.objRef?.value || action.objRef || '';
          layerOps.push({
            op: action.kind === 'show_slidelayer' ? 'show' : 'hide',
            layerRef: cleanLayerRef(layerRef),
            hideOthers: action.hideOthers || false,
            source,
          });
          break;
        }

        case 'setobjstate': {
          const stateRef = action.stateRef?.value || action.stateRef || '';
          const objRef = action.objRef?.value || action.objRef || '';
          // Only track custom states (not built-in hover/selected)
          if (stateRef && !stateRef.startsWith('_default')) {
            stateChanges.push({ state: stateRef, objRef, source });
          }
          break;
        }

        case 'exe_actiongroup': {
          // Resolve named action groups (handled separately below)
          break;
        }

        default:
          // Track other action types for complexity assessment
          triggers.push({ kind: action.kind, source });
          break;
      }
    }
  }

  // Extract variable references from condition tree
  function extractConditionVars(condition, varSet) {
    if (!condition) return;
    const stmt = condition.statement || condition;

    if (stmt.kind === 'compare') {
      if (stmt.typea === 'var' && stmt.valuea) varSet.add(cleanVarRef(stmt.valuea));
      if (stmt.typeb === 'var' && stmt.valueb) varSet.add(cleanVarRef(stmt.valueb));
    } else if (stmt.kind === 'and' || stmt.kind === 'or') {
      for (const sub of (stmt.statements || [])) {
        extractConditionVars(sub, varSet);
      }
    }
  }

  // 1. Slide-level events
  for (const event of (slideData.events || [])) {
    walkActions(event.actions, `slide.${event.kind}`);
  }

  // 2. Slide-level action groups
  for (const [groupName, group] of Object.entries(slideData.actionGroups || {})) {
    walkActions(group.actions, `actionGroup.${groupName}`);
  }

  // 3. Object events (all layers)
  for (const layer of (slideData.slideLayers || [])) {
    for (const obj of (layer.objects || [])) {
      walkObjectEvents(obj, walkActions);
    }
  }

  // 4. Timeline events (all layers)
  for (const layer of (slideData.slideLayers || [])) {
    if (layer.timeline?.events) {
      for (const event of layer.timeline.events) {
        walkActions(event.actions, `timeline.${event.kind}`);
      }
    }
  }

  return { triggers, varsRead: [...varsRead], varsWritten: [...varsWritten], navTargets, layerOps, stateChanges };
}

// Walk object tree for events
function walkObjectEvents(obj, walkActions) {
  if (obj.events) {
    for (const event of obj.events) {
      walkActions(event.actions, `object.${obj.id || obj.referenceName || 'unknown'}.${event.kind}`);
    }
  }
  // Action groups on objects
  if (obj.actionGroups) {
    for (const [name, group] of Object.entries(obj.actionGroups)) {
      walkActions(group.actions, `object.${obj.id || 'unknown'}.actionGroup.${name}`);
    }
  }
  // Recurse into child objects
  if (obj.objects) {
    for (const child of obj.objects) {
      walkObjectEvents(child, walkActions);
    }
  }
}

// ─── Variable reference cleaning ─────────────────────────────────────
function cleanVarRef(ref) {
  if (!ref) return '';
  // _player.#VarName → VarName
  // _player.VarName → VarName
  return ref.replace(/^_player\.#?/, '').replace(/^#/, '');
}

function cleanSlideRef(ref) {
  if (!ref) return '';
  // _player.sceneId.slideId → sceneId.slideId
  return ref.replace(/^_player\./, '');
}

function cleanLayerRef(ref) {
  if (!ref) return '';
  // _parent._parent.layerId → layerId (take last segment)
  const parts = ref.split('.');
  return parts[parts.length - 1];
}

// ─── Extract layer structure ─────────────────────────────────────────
function extractLayers(slideData) {
  const layers = [];
  const slideLayers = slideData.slideLayers || [];

  for (let i = 0; i < slideLayers.length; i++) {
    const layer = slideLayers[i];
    if (layer.isBaseLayer) continue; // skip base layer

    const layerId = layer.id || `layer-${i}`;
    const { blocks, mediaRefs } = extractSlideContent(layer.objects || []);

    if (blocks.length === 0 && mediaRefs.length === 0) continue;

    layers.push({
      layerId,
      modal: layer.modal || false,
      contentBlocks: [...blocks, ...mediaRefs],
    });
  }

  return layers;
}

// ─── Extract navigation from action groups + canvas objects ──────────
function extractNavigation(slideData) {
  const nav = {};

  // Source 1: Player-level navigation (ActGrpOnNextButtonClick)
  // These may be phantom if the default player is disabled.
  const nextGroup = slideData.actionGroups?.ActGrpOnNextButtonClick;
  if (nextGroup?.actions?.length > 0) {
    const playerNext = extractNavActions(nextGroup.actions);
    if (playerNext) nav.next = playerNext;
  }

  const prevGroup = slideData.actionGroups?.ActGrpOnPrevButtonClick;
  if (prevGroup?.actions?.length > 0) {
    const playerPrev = extractNavActions(prevGroup.actions);
    if (playerPrev) nav.prev = playerPrev;
  }

  // Source 2: Canvas-level navigation (onrelease → gotoplay on objects)
  // This is the REAL navigation when the default player is disabled.
  // Check ALL layers — navigation buttons can live on overlay layers too.
  const canvasNavs = [];
  function walkForNav(obj) {
    if (obj.events) {
      for (const ev of obj.events) {
        if (ev.kind === 'onrelease') {
          const navActions = extractNavActions(ev.actions || []);
          if (navActions) {
            for (const na of navActions) {
              canvasNavs.push({ ...na, source: 'canvas' });
            }
          }
        }
      }
    }
    if (obj.objects) obj.objects.forEach(walkForNav);
  }
  for (const layer of (slideData.slideLayers || [])) {
    (layer.objects || []).forEach(walkForNav);
  }

  if (canvasNavs.length > 0) {
    // If player nav is empty but canvas nav exists, canvas is the real nav
    if (!nav.next && canvasNavs.length > 0) {
      nav.next = canvasNavs;
    } else if (nav.next && canvasNavs.length > 0) {
      // Both exist — merge, marking source
      // Player nav is marked as 'player', canvas nav as 'canvas'
      nav.next = nav.next.map(n => ({ ...n, source: 'player' }));
      // Only add canvas navs that go to different targets than player nav
      const playerTargets = new Set(nav.next.map(n => n.target));
      for (const cn of canvasNavs) {
        if (!playerTargets.has(cn.target)) {
          nav.next.push(cn);
        }
      }
    }
  }

  return Object.keys(nav).length > 0 ? nav : null;
}

function extractNavActions(actions) {
  const navEntries = [];

  for (const action of actions) {
    if (action.kind === 'gotoplay') {
      const target = cleanSlideRef(action.objRef?.value || action.objRef || '');
      const windowType = action.window || '_current';
      navEntries.push({ target, windowType });
    } else if (action.kind === 'if_action') {
      // Check if this is a completion gate — condition checks object states
      const isCompletionGate = detectCompletionGate(action.condition);

      if (isCompletionGate) {
        // Completion gate: navigation requires all items to be visited/completed
        const thenNavs = extractNavActions(action.thenActions || []) || [];
        for (const tn of thenNavs) {
          navEntries.push({ ...tn, completionGate: true, requiredItems: isCompletionGate.itemCount });
        }
      } else {
        // Regular conditional navigation (path branching)
        const condition = simplifyCondition(action.condition);
        const thenNavs = extractNavActions(action.thenActions || []) || [];
        const elseNavs = extractNavActions(action.elseActions || []) || [];
        for (const tn of thenNavs) {
          navEntries.push({ ...tn, condition });
        }
        for (const en of elseNavs) {
          navEntries.push({ ...en, condition: negateCondition(condition) });
        }
      }
    } else if (action.kind === 'exe_actiongroup') {
      // Try to resolve the action group
      // (would need slide context — skip for now, resolved at higher level)
    }
  }

  return navEntries.length > 0 ? navEntries : undefined;
}

// Detect if a condition is a "completion gate" — checks that objects have been
// visited/completed before allowing navigation. Common patterns:
//   - ObjectId.#_state == "Visited" / "DONE" / "SEEN" / "complete"
//   - ObjectId.$Status == "correct"
//   - AND combinator of multiple such checks
function detectCompletionGate(condition) {
  if (!condition) return false;
  const stmt = condition.statement || condition;

  if (stmt.kind === 'compare') {
    return isCompletionCheck(stmt) ? { itemCount: 1 } : false;
  }

  if (stmt.kind === 'and') {
    const checks = (stmt.statements || []).filter(s => {
      if (s.kind === 'compare') return isCompletionCheck(s);
      if (s.kind === 'and') return (s.statements || []).every(sub => sub.kind === 'compare' && isCompletionCheck(sub));
      return false;
    });
    if (checks.length > 0 && checks.length === (stmt.statements || []).length) {
      // All conditions are completion checks
      const itemCount = (stmt.statements || []).reduce((sum, s) => {
        if (s.kind === 'compare') return sum + 1;
        if (s.kind === 'and') return sum + (s.statements || []).length;
        return sum;
      }, 0);
      return { itemCount };
    }
  }

  return false;
}

function isCompletionCheck(compare) {
  if (!compare || compare.kind !== 'compare') return false;
  const ref = (compare.valuea || '') + '|' + (compare.valueb || '');
  const lower = ref.toLowerCase();
  // Check if it references object state/status properties with completion values
  return (
    lower.includes('_state') || lower.includes('_visited') || lower.includes('$status') ||
    lower.includes('visited') || lower.includes('done') || lower.includes('seen') ||
    lower.includes('complete') || lower.includes('correct')
  ) && (
    // Must be checking an object property, not a custom variable
    (compare.typea === 'property' || (compare.valuea || '').includes('.') || (compare.valuea || '').includes('#_'))
  );
}

// Simplify a condition tree to a portable format
function simplifyCondition(condition) {
  if (!condition) return null;
  const stmt = condition.statement || condition;

  if (stmt.kind === 'compare') {
    return {
      var: cleanVarRef(stmt.valuea || ''),
      op: stmt.operator || 'eq',
      val: stmt.valueb,
    };
  } else if (stmt.kind === 'and' || stmt.kind === 'or') {
    const subs = (stmt.statements || []).map(s => simplifyCondition(s)).filter(Boolean);
    if (subs.length === 1) return subs[0];
    return { [stmt.kind]: subs };
  }
  return null;
}

function negateCondition(condition) {
  if (!condition) return null;
  if (condition.op) {
    const negOps = { eq: 'ne', ne: 'eq', gte: 'lt', lt: 'gte' };
    return { ...condition, op: negOps[condition.op] || condition.op };
  }
  return condition;
}

// ═══════════════════════════════════════════════════════════════════════
// QUESTION BANK EXTRACTION (new)
// ═══════════════════════════════════════════════════════════════════════

function extractQuestionBanks(globalData, scormDir) {
  if (!globalData) return { banks: [], draws: [] };

  const jsDir = path.join(scormDir, 'html5', 'data', 'js');
  const banks = [];
  const draws = [];

  // Extract slidedraw configurations from scenes
  for (const scene of (globalData.scenes || [])) {
    for (const draw of (scene.slidedraws || [])) {
      const drawEntry = {
        drawId: draw.id,
        lmsId: draw.lmsId || '',
        sceneId: scene.id,
        shuffle: draw.shuffle || false,
        drawCount: draw.shufflecount || 0,
        poolSize: (draw.sliderefs || []).length,
        slideRefs: (draw.sliderefs || []).map(r => r.id),
        exitSlide: cleanSlideRef(draw.exitaction?.objRef?.value || ''),
      };
      draws.push(drawEntry);
    }
  }

  // Extract bank slide content
  const bankSlides = globalData.slideBank?.slides || [];
  for (const bankSlide of bankSlides) {
    const slideId = bankSlide.id;
    const html5url = bankSlide.html5url || '';
    const jsFile = html5url.split('/').pop();

    if (!jsFile) continue;

    const jsPath = path.join(jsDir, jsFile);
    if (!fs.existsSync(jsPath)) continue;

    try {
      const raw = fs.readFileSync(jsPath, 'utf-8');
      const slideData = parseStorylineJs(raw);
      const objects = slideData.slideLayers?.[0]?.objects || [];

      // Extract question content
      const quiz = extractQuiz(objects);
      if (quiz) {
        // Also try to get correct answer from interactions in data.js
        const interaction = bankSlide.interactions?.[0];
        let correctFromLms = null;
        if (interaction?.answers) {
          const correctAnswer = interaction.answers.find(a => a.status === 'correct');
          if (correctAnswer?.evaluate?.statements) {
            correctFromLms = correctAnswer.evaluate.statements.map(s => s.choiceid);
          }
        }

        // Get choice text from LMS data if available
        if (interaction?.choices) {
          for (let i = 0; i < interaction.choices.length; i++) {
            const lmsText = interaction.choices[i]?.lmstext || '';
            if (lmsText && quiz.quiz.choices[i]) {
              // lmstext may have * suffix for correct
              const clean = lmsText.replace(/\*$/, '').trim();
              if (clean) quiz.quiz.choices[i].text = clean;
              if (lmsText.endsWith('*')) quiz.quiz.choices[i].correct = true;
            }
          }
        }

        banks.push({
          slideId,
          question: quiz.quiz.question,
          questionType: quiz.quiz.questionType,
          choices: quiz.quiz.choices,
          feedback: quiz.quiz.feedback,
          // Which draws include this slide
          inDraws: draws.filter(d => d.slideRefs.includes(slideId)).map(d => d.drawId),
        });
      }
    } catch (e) {
      console.log(`  Warning: Could not parse bank slide ${jsFile}: ${e.message}`);
    }
  }

  return { banks, draws };
}

// ═══════════════════════════════════════════════════════════════════════
// PATTERN DETECTION (new)
// ═══════════════════════════════════════════════════════════════════════

function detectPatterns(variables, allTriggerData, draws, processedScenes) {
  const patterns = [];
  const pathGroups = [];
  const sectionGating = [];

  // ── Path-selection detection (BEHAVIORAL, not name-based) ──
  // A path-selection group is: multiple boolean vars SET on the same slide,
  // READ on multiple downstream slides in conditions that gate navigation.
  // Works regardless of variable naming convention.
  const boolVars = variables.custom.filter(v => v.type === 'boolean');
  const boolVarNames = new Set(boolVars.map(v => v.name));

  // Build per-slide write/read maps for custom boolean vars only
  const writesBySlide = new Map(); // slideId → [varNames written]
  const readSlides = new Map();    // varName → [slideIds that read it]

  for (const scene of processedScenes) {
    for (const slide of scene.slides) {
      if (!slide.logic) continue;
      const writes = slide.logic.varsWritten.filter(v => boolVarNames.has(v));
      if (writes.length > 0) {
        writesBySlide.set(slide.slideId, writes);
      }
      for (const v of slide.logic.varsRead) {
        if (boolVarNames.has(v)) {
          if (!readSlides.has(v)) readSlides.set(v, []);
          readSlides.get(v).push(slide.slideId);
        }
      }
    }
  }

  // Find "selector slides" — slides that SET 2+ boolean vars and those vars
  // are READ on 2+ other slides each. That's a path-selection pattern.
  for (const [slideId, writes] of writesBySlide) {
    if (writes.length < 2) continue;

    // Check if these vars are read downstream
    const varsReadDownstream = writes.filter(v => {
      const readers = readSlides.get(v) || [];
      return readers.filter(r => r !== slideId).length >= 2;
    });

    if (varsReadDownstream.length >= 2) {
      patterns.push('path-selection');
      pathGroups.push({
        name: inferGroupName(varsReadDownstream),
        type: 'user-choice',
        selectorSlide: slideId,
        options: varsReadDownstream.map(v => ({
          variable: v,
          label: formatVarAsLabel(v),
        })),
      });
    }
  }

  // ── Section-gating detection (BEHAVIORAL) ──
  // Boolean vars that are WRITTEN on exactly one slide each and READ to gate
  // navigation on other slides. Typically named *complete but detect by behavior.
  const completionVars = boolVars.filter(v => {
    const writers = [];
    for (const [sid, writes] of writesBySlide) {
      if (writes.includes(v.name)) writers.push(sid);
    }
    const readers = readSlides.get(v.name) || [];
    // Written on 1-2 slides, read on 1+ other slides = completion tracking
    return writers.length >= 1 && writers.length <= 2 && readers.length >= 1
      && !pathGroups.some(pg => pg.options.some(o => o.variable === v.name));
  });
  if (completionVars.length >= 2) {
    patterns.push('section-gating');
    // Build sectionGating array: map each completion variable to the scene
    // where it's written (that scene is the one it marks as complete)
    for (const cv of completionVars) {
      for (const scene of processedScenes) {
        for (const slide of scene.slides) {
          if (slide.logic?.varsWritten?.includes(cv.name)) {
            sectionGating.push({
              variable: cv.name,
              sceneId: scene.sceneId,
              sceneTitle: scene.title || '',
              writtenOnSlide: slide.slideId,
            });
            break; // One scene per variable is enough
          }
        }
        if (sectionGating.some(sg => sg.variable === cv.name)) break;
      }
    }
  }

  // ── Drag-drop detection (BEHAVIORAL) ──
  // Drag events (ondragconnect, ondragout, ondragstart) in trigger data
  const hasDragEvents = allTriggerData.some(t =>
    t.triggers.some(tr => tr.kind && /drag/i.test(tr.kind)));
  if (hasDragEvents) {
    patterns.push('drag-drop');
  }

  // ── Explore-track detection (BEHAVIORAL) ──
  // Explore-track requires number variables that are both WRITTEN and READ.
  // A variable written on one slide and read on the same or another slide
  // (for comparison) indicates a counter being tracked against a threshold.
  const numberVars = variables.custom.filter(v => v.type === 'number');
  if (numberVars.length >= 2) {
    const numberVarNames = new Set(numberVars.map(v => v.name));
    const numberVarsWritten = new Set();
    const numberVarsRead = new Set();
    for (const scene of processedScenes) {
      for (const slide of scene.slides) {
        if (!slide.logic) continue;
        slide.logic.varsWritten.filter(v => numberVarNames.has(v)).forEach(v => numberVarsWritten.add(v));
        slide.logic.varsRead.filter(v => numberVarNames.has(v)).forEach(v => numberVarsRead.add(v));
      }
    }
    // Only flag if at least one number var is both written AND read (counter pattern)
    const counterVars = [...numberVarsWritten].filter(v => numberVarsRead.has(v));
    if (counterVars.length >= 1) {
      patterns.push('explore-track');
    }
  }

  // ── Question banks ──
  if (draws.length > 0) {
    patterns.push('question-banks');
  }

  // ── Layer-based interactivity ──
  const totalLayers = allTriggerData.reduce((sum, t) => sum + (t.layerOps?.length || 0), 0);
  if (totalLayers > 0) {
    patterns.push('layer-reveal');
  }

  // ── State-based content ──
  const totalStateChanges = allTriggerData.reduce((sum, t) => sum + (t.stateChanges?.length || 0), 0);
  if (totalStateChanges > 0) {
    patterns.push('state-content');
  }

  // ── Lightbox usage ──
  const hasLightbox = allTriggerData.some(t =>
    t.navTargets?.some(n => n.windowType === 'LightboxWnd'));
  if (hasLightbox) {
    patterns.push('lightbox');
  }

  return { patterns: [...new Set(patterns)], pathGroups, sectionGating };
}

// Infer a group name from variable names (generic, not hardcoded to any naming convention)
function inferGroupName(varNames) {
  // Find the longest common prefix
  if (varNames.length === 0) return 'path';
  const sorted = [...varNames].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  let prefix = '';
  for (let i = 0; i < Math.min(first.length, last.length); i++) {
    if (first[i] === last[i]) prefix += first[i];
    else break;
  }
  // Clean up: remove trailing numbers, underscores, camelCase transitions
  prefix = prefix.replace(/[\d_]+$/, '').replace(/[A-Z]$/, '');
  if (prefix.length >= 3) return prefix.toLowerCase();

  // Fallback: look for common keywords in the variable names
  const joined = varNames.join(' ').toLowerCase();
  if (joined.includes('difficult') || joined.includes('level')) return 'difficulty';
  if (joined.includes('role') || joined.includes('audience')) return 'role';
  if (joined.includes('path') || joined.includes('track') || joined.includes('route')) return 'path';
  if (joined.includes('department') || joined.includes('team') || joined.includes('dept')) return 'department';
  // Default: generic name — the AI layout engine will interpret from context
  return 'path';
}

// Convert a variable name to a readable label (generic, handles various naming conventions)
function formatVarAsLabel(name) {
  return name
    // Remove common prefixes: Group1, Path_, Role_, Level_, Track_
    .replace(/^(Group|Path|Role|Level|Track|Type|Dept|Department|Difficulty|Category)\s*\d*/i, '')
    // Remove underscores and split on camelCase
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/^\s+/, '')
    .trim() || name;
}

// ═══════════════════════════════════════════════════════════════════════
// BUILD MEDIA INVENTORY (existing)
// ═══════════════════════════════════════════════════════════════════════

function buildMediaInventory(scormDir) {
  const images = [];
  const videos = [];
  const audio = [];

  const storyContent = path.join(scormDir, 'story_content');
  if (!fs.existsSync(storyContent)) return { images, videos, audio };

  function walk(dir, relBase) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relBase, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      const basename = entry.name;

      if (isShapeFile(basename)) continue;
      if (basename === 'thumbnail.jpg' || basename === 'zoomIcon.png') continue;

      if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) {
        images.push({ filename: basename, originalPath: relPath });
      } else if (['.mp4', '.webm', '.ogv', '.mov'].includes(ext)) {
        videos.push({ filename: basename, originalPath: relPath });
      } else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) {
        audio.push({ filename: basename, originalPath: relPath });
      }
    }
  }

  walk(storyContent, 'story_content');
  return { images, videos, audio };
}

// ═══════════════════════════════════════════════════════════════════════
// PROCESS SLIDE (enhanced)
// ═══════════════════════════════════════════════════════════════════════

function processSlide(slideId, jsContent, slideIndex) {
  let slideData;
  try {
    slideData = parseStorylineJs(jsContent);
  } catch (e) {
    console.log(`  Skipping ${slideId}: ${e.message}`);
    return null;
  }

  const slideType = detectSlideType(slideData);
  const layer0Objects = slideData.slideLayers?.[0]?.objects || [];

  // Extract content blocks from base layer
  const { blocks, mediaRefs } = extractSlideContent(layer0Objects);

  // Extract quiz if applicable
  if (slideType === 'quiz') {
    const quiz = extractQuiz(layer0Objects);
    if (quiz) blocks.push(quiz);
  }

  // Extract layer content (NEW — tagged with layer info)
  const layers = extractLayers(slideData);

  // Extract triggers/logic (NEW)
  const triggerData = extractSlideTriggers(slideData);

  // Extract navigation (NEW)
  const navigation = extractNavigation(slideData);

  // Combine base layer content
  const contentBlocks = [...blocks, ...mediaRefs];

  // Skip slides with no meaningful content AND no logic
  if (contentBlocks.length === 0 && layers.length === 0 && !navigation) return null;

  const result = {
    slideId,
    slideIndex,
    title: slideData.title || undefined,
    contentBlocks,
  };

  // Add layer content if present
  if (layers.length > 0) {
    result.layers = layers;
  }

  // Add navigation if custom
  if (navigation) {
    result.navigation = navigation;
  }

  // Add logic metadata if present — filter out system vars AND object state properties
  if (triggerData.varsRead.length > 0 || triggerData.varsWritten.length > 0) {
    result.logic = {
      varsRead: triggerData.varsRead.filter(v => !isSystemVariable(v) && !isObjectStateRef(v)),
      varsWritten: triggerData.varsWritten.filter(v => !isSystemVariable(v) && !isObjectStateRef(v)),
    };
    if (result.logic.varsRead.length === 0 && result.logic.varsWritten.length === 0) {
      delete result.logic;
    }
  }

  // Add layer operations summary
  if (triggerData.layerOps.length > 0) {
    result.layerTriggers = triggerData.layerOps;
  }

  return { slide: result, triggerData };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXTRACTION PIPELINE (enhanced)
// ═══════════════════════════════════════════════════════════════════════

function extract(scormDir) {
  console.log(`\nExtracting from: ${scormDir}\n`);

  // 1. Parse manifest
  const manifestPath = path.join(scormDir, 'imsmanifest.xml');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('imsmanifest.xml not found in ' + scormDir);
  }
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Course: ${manifest.title} (${manifest.scormVersion})`);

  // 2. Parse data.js for global data (NEW)
  console.log('\n── Global Data ──');
  const globalData = parseGlobalData(scormDir);
  const variables = globalData ? extractVariables(globalData) : { custom: [], system: [], all: [] };
  console.log(`Variables: ${variables.custom.length} custom, ${variables.system.length} system`);

  // 3. Extract question banks (NEW)
  const { banks, draws } = extractQuestionBanks(globalData, scormDir);
  console.log(`Question banks: ${banks.length} questions in ${draws.length} draws`);

  // 4. Parse frame.xml for scene/slide structure
  const framePath = path.join(scormDir, 'story_content', 'frame.xml');
  let scenes = [];
  if (fs.existsSync(framePath)) {
    scenes = parseFrameXml(fs.readFileSync(framePath, 'utf-8'));
    console.log(`Scenes: ${scenes.length}`);
  }

  // 5. Find all slide JS data files
  const jsDir = path.join(scormDir, 'html5', 'data', 'js');
  if (!fs.existsSync(jsDir)) {
    throw new Error('html5/data/js/ not found — is this a Storyline HTML5 export?');
  }
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && f !== 'data.js' && f !== 'paths.js');
  console.log(`Slide data files: ${jsFiles.length}`);

  // 6. Build a map of slideId → JS file content
  const slideDataMap = new Map();
  for (const jsFile of jsFiles) {
    const hash = path.basename(jsFile, '.js');
    const content = fs.readFileSync(path.join(jsDir, jsFile), 'utf-8');
    slideDataMap.set(hash, content);
  }

  // 7. Process slides organized by scenes
  console.log('\n── Slide Extraction ──');
  let slideIndex = 0;
  const processedScenes = [];
  const allTriggerData = [];

  if (scenes.length > 0) {
    for (const scene of scenes) {
      const processedSlides = [];

      for (const slideInfo of scene.slideIds) {
        slideIndex++;
        const hash = slideInfo.slideId.split('.').pop();
        const jsContent = slideDataMap.get(hash);

        if (!jsContent) {
          console.log(`  [${slideIndex}] ${slideInfo.displayText} — no data file`);
          continue;
        }

        const result = processSlide(hash, jsContent, slideIndex);
        if (result) {
          const slide = result.slide;
          if (!slide.title && slideInfo.displayText) {
            slide.title = slideInfo.displayText;
          }
          processedSlides.push(slide);
          allTriggerData.push(result.triggerData);

          const blockCount = slide.contentBlocks.length;
          const layerCount = slide.layers?.length || 0;
          const logicInfo = slide.logic ? ` [vars: R=${slide.logic.varsRead.length} W=${slide.logic.varsWritten.length}]` : '';
          const layerInfo = layerCount > 0 ? ` [${layerCount} layers]` : '';
          console.log(`  [${slideIndex}] ${slide.title || '(untitled)'} — ${blockCount} blocks${layerInfo}${logicInfo}`);
        } else {
          console.log(`  [${slideIndex}] ${slideInfo.displayText} — empty`);
        }
      }

      if (processedSlides.length > 0) {
        processedScenes.push({
          sceneId: scene.sceneId,
          title: scene.title,
          slides: processedSlides,
        });
      }
    }
  } else {
    const allSlides = [];
    for (const jsFile of jsFiles) {
      slideIndex++;
      const hash = path.basename(jsFile, '.js');
      const content = slideDataMap.get(hash);
      const result = processSlide(hash, content, slideIndex);
      if (result) {
        allSlides.push(result.slide);
        allTriggerData.push(result.triggerData);
        console.log(`  [${slideIndex}] ${result.slide.title || '(untitled)'} — ${result.slide.contentBlocks.length} blocks`);
      }
    }
    if (allSlides.length > 0) {
      processedScenes.push({ sceneId: 'scene-1', title: manifest.title, slides: allSlides });
    }
  }

  // 8. Detect logic patterns (NEW)
  console.log('\n── Pattern Detection ──');
  const { patterns, pathGroups, sectionGating } = detectPatterns(variables, allTriggerData, draws, processedScenes);
  console.log(`Patterns: ${patterns.length > 0 ? patterns.join(', ') : 'none detected'}`);
  if (pathGroups.length > 0) {
    for (const pg of pathGroups) {
      console.log(`  Path group "${pg.name}": ${pg.options.map(o => o.label).join(', ')}`);
    }
  }
  if (sectionGating.length > 0) {
    console.log(`  Section gating: ${sectionGating.map(sg => `${sg.variable} → ${sg.sceneTitle}`).join(', ')}`);
  }

  // 9. Build media inventory
  const mediaInventory = buildMediaInventory(scormDir);
  console.log(`\nMedia: ${mediaInventory.images.length} images, ${mediaInventory.videos.length} videos, ${mediaInventory.audio.length} audio`);

  // 10. Build complexity assessment (NEW)
  const totalTriggers = allTriggerData.reduce((sum, t) => sum + t.triggers.length, 0);
  const totalLayers = processedScenes.reduce((sum, s) =>
    sum + s.slides.reduce((sum2, sl) => sum2 + (sl.layers?.length || 0), 0), 0);

  const outOfScope = [];
  if (patterns.includes('drag-drop')) outOfScope.push('drag-drop-simulation');

  const complexity = {
    customVariables: variables.custom.length,
    triggerCount: totalTriggers,
    layerCount: totalLayers,
    questionBankSlides: banks.length,
    questionDraws: draws.length,
    patterns,
    outOfScope,
  };

  console.log('\n── Complexity ──');
  console.log(`  Custom variables: ${complexity.customVariables}`);
  console.log(`  Triggers: ${complexity.triggerCount}`);
  console.log(`  Layers: ${complexity.layerCount}`);
  console.log(`  Question banks: ${complexity.questionBankSlides} questions, ${complexity.questionDraws} draws`);
  if (outOfScope.length > 0) console.log(`  Out of scope: ${outOfScope.join(', ')}`);

  // 11. Filter variables to only those actually used in triggers
  const allUsedVars = new Set();
  for (const scene of processedScenes) {
    for (const slide of scene.slides) {
      if (slide.logic) {
        slide.logic.varsRead.forEach(v => allUsedVars.add(v));
        slide.logic.varsWritten.forEach(v => allUsedVars.add(v));
      }
    }
  }
  const usedCustomVars = variables.custom.filter(v => allUsedVars.has(v.name));
  const unusedCount = variables.custom.length - usedCustomVars.length;
  if (unusedCount > 0) {
    console.log(`  Filtered out ${unusedCount} unused variables`);
  }

  // 12. Trace path conditions onto question bank draws
  // A draw's condition comes from two sources:
  //   A) Direct conditional navigation: if_action → gotoplay to draw
  //   B) Layer-gated navigation: condition → show_slidelayer → layer contains button → gotoplay to draw
  // Both must be traced.
  if (draws.length > 0) {
    console.log('\n── Question Bank Path Tracing ──');

    // Build a map: layerId → conditions under which it's shown
    // AND a map: layerId → navigation targets from buttons on that layer
    const layerConditions = new Map(); // layerId → condition
    const layerNavTargets = new Map(); // layerId → [targets]

    // Parse all slides to find layer-show conditions and layer navigation
    for (const scene of processedScenes) {
      for (const slide of scene.slides) {
        // Get layer conditions from layerTriggers
        if (slide.layerTriggers) {
          for (const lt of slide.layerTriggers) {
            if (lt.op === 'show' && lt.layerRef) {
              // The condition on this layer show comes from the if_action wrapping it
              // We already track this in the trigger data — but we need to re-parse
              // to get the condition. For now, use the slide's logic.varsRead as a hint.
            }
          }
        }
        // Get navigation targets per layer from the navigation entries with source=canvas
        if (slide.navigation?.next) {
          for (const nav of slide.navigation.next) {
            // All canvas navs are already extracted; we need to associate them with layers
            // This requires re-parsing — handled below
          }
        }
      }
    }

    // Re-parse slides that contain draw navigation to trace layer conditions
    const jsDir = path.join(scormDir, 'html5', 'data', 'js');
    for (const draw of draws) {
      const conditions = [];

      // Method A: Direct conditional navigation
      for (const scene of processedScenes) {
        for (const slide of scene.slides) {
          if (!slide.navigation?.next) continue;
          for (const nav of slide.navigation.next) {
            if (nav.target && nav.target.includes(draw.drawId)) {
              if (nav.condition) {
                conditions.push(nav.condition);
              }
            }
          }
        }
      }

      // Method B: Layer-gated navigation
      // Find slides whose raw data has gotoplay to this draw, then trace the layer condition
      if (conditions.length === 0) {
        for (const scene of processedScenes) {
          for (const slide of scene.slides) {
            const jsPath = path.join(jsDir, slide.slideId + '.js');
            if (!fs.existsSync(jsPath)) continue;

            try {
              const raw = fs.readFileSync(jsPath, 'utf-8');
              if (!raw.includes(draw.drawId)) continue;

              const slideData = parseStorylineJs(raw);
              // Find which layers contain navigation to this draw
              const layersWithDraw = new Set();
              for (let li = 1; li < (slideData.slideLayers || []).length; li++) {
                const layer = slideData.slideLayers[li];
                const layerJson = JSON.stringify(layer.objects || []);
                if (layerJson.includes(draw.drawId)) {
                  layersWithDraw.add(layer.id);
                }
              }

              if (layersWithDraw.size === 0) continue;

              // Find conditions that show those layers (in onslidestart or object events)
              function findLayerShowConditions(actions, parentCondition) {
                for (const action of (actions || [])) {
                  if (action.kind === 'if_action') {
                    const cond = simplifyCondition(action.condition);
                    // Check if thenActions show one of our target layers
                    for (const ta of (action.thenActions || [])) {
                      if (ta.kind === 'show_slidelayer') {
                        const ref = cleanLayerRef(ta.objRef?.value || ta.objRef || '');
                        if (layersWithDraw.has(ref) && cond) {
                          // Filter to only custom variable conditions
                          const filtered = filterToCustomVarCondition(cond);
                          if (filtered) conditions.push(filtered);
                        }
                      }
                      if (ta.kind === 'if_action') {
                        findLayerShowConditions([ta], cond);
                      }
                    }
                    // Also check else branch
                    findLayerShowConditions(action.elseActions, parentCondition);
                  } else if (action.kind === 'show_slidelayer') {
                    const ref = cleanLayerRef(action.objRef?.value || action.objRef || '');
                    if (layersWithDraw.has(ref) && parentCondition) {
                      const filtered = filterToCustomVarCondition(parentCondition);
                      if (filtered) conditions.push(filtered);
                    }
                  }
                }
              }

              for (const ev of (slideData.events || [])) {
                findLayerShowConditions(ev.actions, null);
              }
              // Also check base layer object events
              const baseObjects = slideData.slideLayers?.[0]?.objects || [];
              function walkObjForLayerConds(obj) {
                if (obj.events) {
                  for (const ev of obj.events) {
                    findLayerShowConditions(ev.actions, null);
                  }
                }
                if (obj.actionGroups) {
                  for (const [, g] of Object.entries(obj.actionGroups)) {
                    findLayerShowConditions(g.actions, null);
                  }
                }
                if (obj.objects) obj.objects.forEach(walkObjForLayerConds);
              }
              baseObjects.forEach(walkObjForLayerConds);

            } catch (e) { /* skip parse errors */ }
          }
        }
      }

      // Method C: Infer from slide logic — if the slide that reaches this draw
      // reads path-selection variables, those variables likely gate this draw.
      // This handles multi-hop chains (condition → show object → click → layer → gotoplay).
      if (conditions.length === 0 && pathGroups.length > 0) {
        for (const scene of processedScenes) {
          for (const slide of scene.slides) {
            if (!slide.navigation?.next) continue;
            const reachesDraw = slide.navigation.next.some(n => n.target && n.target.includes(draw.drawId));
            if (!reachesDraw) continue;

            // This slide reaches the draw — check if it reads path variables
            if (slide.logic?.varsRead) {
              for (const pg of pathGroups) {
                const pathVarsRead = pg.options.filter(o => slide.logic.varsRead.includes(o.variable));
                if (pathVarsRead.length > 0) {
                  // The slide reads path variables and navigates to this draw
                  // We can't trace the exact condition, but we know the draw is path-dependent
                  // Check which specific path var this draw likely belongs to by counting
                  // how many other draws share this slide — if there are N draws from one slide
                  // and N path options, they likely correspond 1:1
                  draw.inferredPathDependent = true;
                  draw.reachableFromSlide = slide.slideId;
                  console.log(`  Draw ${draw.drawId} (${draw.lmsId}): path-dependent (inferred from ${slide.title} reading ${pathVarsRead.map(v => v.variable).join(', ')})`);
                }
              }
            }
          }
        }
      }

      if (conditions.length > 0) {
        draw.conditions = conditions.length === 1 ? conditions[0] : { or: conditions };
        console.log(`  Draw ${draw.drawId} (${draw.lmsId}): ${JSON.stringify(draw.conditions)}`);
      } else if (!draw.inferredPathDependent) {
        console.log(`  Draw ${draw.drawId} (${draw.lmsId}): unconditional (all paths)`);
      }
    }

    // Propagate draw conditions to their questions
    for (const question of banks) {
      const drawConditions = question.inDraws
        .map(dId => draws.find(d => d.drawId === dId)?.conditions)
        .filter(Boolean);
      if (drawConditions.length > 0) {
        question.conditions = drawConditions.length === 1 ? drawConditions[0] : { or: drawConditions };
      }
    }
  }

  // Helper: filter a condition to only include custom variable comparisons
  function filterToCustomVarCondition(cond) {
    if (!cond) return null;
    if (cond.var) {
      // Simple comparison — keep if it references a custom var
      return (!isSystemVariable(cond.var) && !isObjectStateRef(cond.var)) ? cond : null;
    }
    if (cond.and) {
      const filtered = cond.and.map(filterToCustomVarCondition).filter(Boolean);
      return filtered.length > 0 ? (filtered.length === 1 ? filtered[0] : { and: filtered }) : null;
    }
    if (cond.or) {
      const filtered = cond.or.map(filterToCustomVarCondition).filter(Boolean);
      return filtered.length > 0 ? (filtered.length === 1 ? filtered[0] : { or: filtered }) : null;
    }
    return null;
  }

  // 13. Assemble content bucket
  const contentBucket = {
    courseTitle: manifest.title,
    courseId: manifest.courseId,
    scormVersion: manifest.scormVersion,
    totalSlides: slideIndex,
    // Logic metadata — only variables actually referenced in slide triggers
    variables: usedCustomVars,
    pathGroups: pathGroups.length > 0 ? pathGroups : undefined,
    sectionGating: sectionGating.length > 0 ? sectionGating : undefined,
    questionBanks: draws.length > 0 ? { draws, questions: banks } : undefined,
    complexity,
    // Existing
    scenes: processedScenes,
    mediaInventory,
    extractedAt: new Date().toISOString(),
  };

  return contentBucket;
}

// ─── CLI entry point ─────────────────────────────────────────────────
const scormDir = process.argv[2];
if (!scormDir) {
  console.error('Usage: node v5/scripts/extract.js <scorm-folder>');
  console.error('Example: node v5/scripts/extract.js EV');
  process.exit(1);
}
const resolvedDir = path.resolve(scormDir);

if (!fs.existsSync(resolvedDir)) {
  console.error(`Error: SCORM folder not found: ${resolvedDir}`);
  process.exit(1);
}

const result = extract(resolvedDir);

// Write output
const outputDir = path.resolve('v5/output');
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const outputPath = path.join(outputDir, 'content-bucket.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log(`\nOutput: ${outputPath}`);
console.log(`Scenes: ${result.scenes.length}`);
const totalBlocks = result.scenes.reduce((sum, s) =>
  sum + s.slides.reduce((sum2, sl) => sum2 + sl.contentBlocks.length, 0), 0);
console.log(`Total content blocks: ${totalBlocks}`);
if (result.variables?.length > 0) console.log(`Custom variables: ${result.variables.length}`);
if (result.pathGroups?.length > 0) console.log(`Path groups: ${result.pathGroups.length}`);
if (result.questionBanks) console.log(`Question bank questions: ${result.questionBanks.questions.length}`);
console.log('Done.');
