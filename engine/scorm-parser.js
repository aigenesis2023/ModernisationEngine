/**
 * Browser-compatible SCORM/Storyline Parser
 * Reads from a Map<relativePath, File> built from the uploaded folder.
 * Uses browser DOMParser for XML (replaces fast-xml-parser).
 * Uses Function constructor for Storyline JS data files (same approach as Node version).
 */
window.SCORMParser = (function () {
  'use strict';

  // Track unknown object kinds across the parse
  const unknownKinds = new Set();

  // ---- File reading helpers ----

  async function readFileText(fileMap, relativePath) {
    // Try exact path first, then search case-insensitively
    let file = fileMap.get(relativePath);
    if (!file) {
      const lower = relativePath.toLowerCase();
      for (const [key, val] of fileMap) {
        if (key.toLowerCase() === lower || key.toLowerCase().endsWith('/' + lower)) {
          file = val;
          break;
        }
      }
    }
    if (!file) {
      // Last resort: match just the filename portion
      const fileName = relativePath.split('/').pop().toLowerCase();
      for (const [key, val] of fileMap) {
        if (key.split('/').pop().toLowerCase() === fileName) {
          file = val;
          break;
        }
      }
    }
    if (!file) {
      // Log available keys for debugging
      const available = Array.from(fileMap.keys()).slice(0, 20).join(', ');
      throw new Error('File not found: ' + relativePath + ' (available: ' + available + '...)');
    }
    return await file.text();
  }

  function findFilesInDir(fileMap, dirPath, extension) {
    const results = [];
    const dirLower = dirPath.toLowerCase().replace(/\/$/, '') + '/';
    for (const [key, file] of fileMap) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes(dirLower) && keyLower.endsWith(extension)) {
        // Only direct children (no deeper nesting)
        const after = keyLower.split(dirLower).pop() || '';
        if (!after.includes('/')) {
          results.push({ name: key.split('/').pop(), path: key, file });
        }
      }
    }
    return results;
  }

  // ---- Storyline JS parser ----
  // Storyline wraps JSON in: window.globalProvideData('type', 'JSON_STRING')

  function parseStorylineJs(rawContent) {
    let captured = null;
    const fakeWindow = {
      globalProvideData: function (_type, jsonStr) {
        captured = JSON.parse(jsonStr);
      },
    };
    const fn = new Function('window', rawContent);
    fn(fakeWindow);
    if (!captured) throw new Error('Cannot parse Storyline data');
    return captured;
  }

  // ---- Manifest parser (XML) ----

  function parseManifest(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const title =
      getElementText(doc, 'item > title') ||
      getElementText(doc, 'title') ||
      'Untitled Course';

    const manifest = doc.querySelector('manifest');
    const courseId = manifest ? manifest.getAttribute('identifier') || 'unknown' : 'unknown';

    const schemaVersion = getElementText(doc, 'schemaversion') || '1.2';
    const scormVersion = schemaVersion.includes('2004') ? '2004' : '1.2';

    const masteryEl = doc.querySelector('masteryscore');
    const masteryScore = masteryEl ? parseInt(masteryEl.textContent || '80', 10) : 80;

    return { title, courseId, scormVersion, masteryScore };
  }

  function getElementText(doc, selector) {
    const el = doc.querySelector(selector);
    return el ? el.textContent?.trim() || '' : '';
  }

  // ---- Text extraction from Storyline objects ----

  function extractTextFromObj(obj) {
    const result = { text: '' };
    if (obj.textLib && obj.textLib.length > 0) {
      const textData = obj.textLib[0];
      const blocks = textData.vartext?.blocks || [];
      const spans = blocks.flatMap(b => (b.spans || []).map(s => s.text));
      result.text = spans.join('').trim();
      const firstSpan = blocks[0]?.spans?.[0]?.style;
      if (firstSpan) {
        result.fontSize = firstSpan.fontSize;
        result.fontFamily = (firstSpan.fontFamily || '').split(',')[0].replace(/"/g, '').trim();
        result.color = firstSpan.foregroundColor;
      }
      const blockStyle = textData.vartext?.defaultBlockStyle;
      if (blockStyle?.justification) result.textAlign = blockStyle.justification;
    }
    if (!result.text) {
      result.text = obj.data?.vectorData?.altText || '';
    }
    return result;
  }

  function isDecorativeShapeName(text) {
    if (!text) return true;
    const lower = text.toLowerCase();
    return lower.startsWith('rectangle') || lower.startsWith('oval') ||
      lower.startsWith('round') || lower.startsWith('freeform') ||
      lower.startsWith('rectangular hotspot');
  }

  // ---- Role detection ----

  /**
   * Classify text role using Storyline's universal visual properties.
   *
   * In Storyline, text role is encoded visually, not semantically:
   * - fontSize: larger = heading (typically 18-36px), smaller = body (10-16px)
   * - text length: headings are short (<80 chars), body text is longer
   * - accType: already classified by Storyline (text, button, radio, etc.)
   *
   * We combine fontSize and length since either alone can be misleading
   * (a short body text could look like a heading by length alone).
   */
  function extractTextRole(text, accType, depth, fontSize) {
    if (!text) return 'unknown';
    var len = text.length;
    var size = fontSize || 14;

    // Large font (>=20px) and short text = heading
    if (size >= 20 && len < 80) return 'heading';

    // Large font and longer text = still a heading/subheading if under ~150 chars
    if (size >= 20 && len < 150) return 'heading';

    // Medium font (15-19px) and short text = could be subheading or callout
    if (size >= 15 && len < 60) return 'callout';

    // Long text at any size = body
    if (len > 100) return 'body';

    // Short text at small font = label or body
    return 'body';
  }

  /**
   * Classify an image's role based on its characteristics relative to the slide.
   *
   * Universal Storyline image roles:
   * - background: fills most/all of the slide, positioned at origin, low depth
   *   → these are decorative backgrounds behind text/interactive content
   * - hero: large prominent image (>50% of slide area) but not quite full-slide
   *   → feature images meant to be seen alongside content
   * - content: medium-sized image positioned alongside text
   *   → diagrams, photos, illustrations that are part of the learning
   * - icon: small image (<100px in either dimension)
   *   → navigation markers, decorative icons, badges
   * - decorative: Shape-based images (Shape*.png pattern) that are UI decoration
   *   → gradients, overlays, borders, shadows
   *
   * @param {string} altText - image alt text or original filename
   * @param {number} objWidth - display width on slide
   * @param {number} objHeight - display height on slide
   * @param {number} depth - z-order depth
   * @param {number} slideWidth - slide width (typically 960)
   * @param {number} slideHeight - slide height (typically 540)
   * @param {string} imgUrl - original image file path
   */
  function extractImageRole(altText, objWidth, objHeight, depth, slideWidth, slideHeight, imgUrl) {
    slideWidth = slideWidth || 960;
    slideHeight = slideHeight || 540;
    const lower = (altText || '').toLowerCase();
    const url = (imgUrl || '').toLowerCase();

    // Shape-based decorative images (universal Storyline pattern: "Shape" + hash)
    if (/\/shape[a-z0-9]+\./i.test(url)) return 'decorative';

    // Logo detection
    if (lower.includes('logo')) return 'logo';

    // Icon: very small images
    if (objWidth < 80 || objHeight < 80) return 'icon';

    // Calculate coverage: what % of the slide does this image fill?
    var slideArea = slideWidth * slideHeight;
    var imgArea = objWidth * objHeight;
    var coverage = imgArea / slideArea;

    // Background: covers >85% of slide, positioned near origin, low depth
    if (coverage > 0.85 && depth <= 3) return 'background';

    // Hero: covers >40% of slide — large feature image
    if (coverage > 0.4) return 'hero';

    // Content: everything else that's reasonably sized
    return 'content';
  }

  // ---- State extraction ----

  function extractStates(obj) {
    const states = [];
    if (obj.kind !== 'stategroup' || !obj.states) return states;
    for (const state of obj.states) {
      const name = state.name || state.id || '';
      if (name === '_default_Normal' || name === 'Normal') continue;
      const label = state.objects?.[0] ? extractTextFromObj(state.objects[0]).text : undefined;
      states.push({ name, label: label || undefined, altText: state.altText || undefined });
    }
    return states;
  }

  // ---- Audio extraction ----

  function extractLayerAudio(objects) {
    const audio = [];
    collectAudio(objects, audio);
    return audio;
  }

  function collectAudio(objects, audio) {
    for (const obj of objects) {
      if (obj.kind === 'audio') {
        audio.push({
          assetId: obj.audiodata?.assetId ?? obj.assetId ?? -1,
          originalPath: obj.audiodata?.url || obj.url || '',
          durationMs: obj.audiodata?.duration || obj.duration || 0,
        });
      }
      if (obj.objects) collectAudio(obj.objects, audio);
    }
  }

  // ---- Slide type detection ----

  /**
   * Detect slide type from structural elements, not title keywords.
   *
   * Storyline slide types are determined by what objects are on the slide:
   * - Quiz: has stategroups with radio/checkbox accType, OR title matches
   *   Storyline's quiz type labels ("Pick One", "True/False", etc.)
   * - Form: has textinput kind objects
   * - Results: contains text referencing score/result variables
   * - Title: first slide in course, or has minimal text with large imagery
   * - Branching: has 3+ buttons without radio/checkbox (selection options)
   * - Content: everything else
   *
   * Title keywords from specific courses (e.g., "Role Selector", "Pre-knowledge")
   * are NOT used — those are course-specific, not structural.
   */
  function detectSlideType(title, objects, slideNumber) {
    const t = (title || '').toLowerCase();

    // Structural detection: quiz elements (radio buttons, checkboxes)
    const hasRadio = objects.some(o =>
      o.kind === 'stategroup' && o.objects?.some(so => so.accType === 'radio')
    );
    const hasCheckbox = objects.some(o =>
      o.kind === 'stategroup' && o.objects?.some(so =>
        so.accType === 'checkbox' || (so.referenceName || '').toLowerCase().includes('checkbox')
      )
    );
    if (hasRadio || hasCheckbox) return 'quiz';

    // Storyline's quiz type labels as slide titles (universal across all exports)
    const quizTitlePatterns = [
      'pick one', 'pick many', 'pick all', 'true/false', 'true false',
      'matching', 'sequence', 'fill in', 'fill in the blank',
      'drag and drop', 'freeform', 'word bank'
    ];
    if (quizTitlePatterns.some(p => t === p || t.startsWith(p + ' '))) return 'quiz';

    // Structural detection: form inputs
    if (objects.some(o => o.kind === 'textinput')) return 'form';

    // Structural detection: results — text containing score variable patterns
    const allText = objects
      .filter(o => o.kind === 'vectorshape')
      .map(o => extractTextFromObj(o).text)
      .join(' ');
    if (allText.includes('%_player.Score') || allText.includes('%_player.Percent') ||
        t.includes('result')) return 'results';

    // Structural detection: title slide — first slide with minimal interactive elements
    if (slideNumber === 1) return 'title';

    // Structural detection: branching — 3+ non-nav buttons without quiz elements
    // Buttons may be top-level or inside stategroups (Storyline's universal pattern
    // for interactive buttons with hover/selected states)
    const meaningfulButtons = [];
    function findButtons(objs) {
      for (const o of objs) {
        if (o.kind === 'vectorshape' && o.accType === 'button') {
          const label = extractTextFromObj(o).text || '';
          if (label.length > 1 && !/^(<|>|prev|next|back|continue|submit)$/i.test(label.trim())) {
            meaningfulButtons.push(o);
          }
        }
        if (o.objects) findButtons(o.objects);
      }
    }
    findButtons(objects);
    if (meaningfulButtons.length >= 3) return 'branching';

    // Structural detection: objectives — "objectives" or "learning" in title
    // (this is a common e-learning convention, not specific to one course)
    if (t.includes('objective') || t.includes('learning outcome')) return 'objectives';

    return 'content';
  }

  // ---- Element extraction (recursive) ----

  function parseElements(objects, slideWidth, slideHeight) {
    const elements = [];
    extractElementsRecursive(objects, elements, slideWidth || 960, slideHeight || 540);
    return elements;
  }

  function extractElementsRecursive(objects, elements, slideWidth, slideHeight) {
    for (const obj of objects) {
      const base = {
        id: obj.id || obj.referenceName || '',
        x: obj.xPos || 0, y: obj.yPos || 0,
        width: obj.width || 0, height: obj.height || 0,
        depth: obj.depth || 0, rotation: obj.rotation || 0,
        alpha: obj.alpha || 100,
      };

      if (obj.kind === 'vectorshape') {
        const extracted = extractTextFromObj(obj);
        const altText = obj.data?.vectorData?.altText || '';

        if (obj.accType === 'image' && obj.imagelib?.length > 0) {
          const img = obj.imagelib[0];
          const role = extractImageRole(img.altText || altText, base.width, base.height, base.depth, slideWidth, slideHeight, img.url);
          elements.push({ ...base, type: 'image', assetId: img.assetId ?? -1,
            originalPath: img.url || '', altText: img.altText || altText,
            instructionalRole: role,
            originalWidth: img.width || base.width,
            originalHeight: img.height || base.height });
        } else if (obj.accType === 'button') {
          const label = extracted.text || altText;
          if (label && !isDecorativeShapeName(label)) {
            elements.push({ ...base, type: 'button', label, action: { kind: 'navigate' }, states: [] });
          }
        } else if (obj.accType === 'text' || obj.accType === 'radio') {
          const content = extracted.text;
          if (isDecorativeShapeName(content)) {
            elements.push({ ...base, type: 'shape', role: base.depth <= 3 ? 'overlay' : 'decorative' });
          } else if (content) {
            elements.push({ ...base, type: 'text', content, role: extractTextRole(content, obj.accType, base.depth, extracted.fontSize),
              fontSize: extracted.fontSize, fontFamily: extracted.fontFamily, color: extracted.color, textAlign: extracted.textAlign });
          }
        }
      } else if (obj.kind === 'video') {
        elements.push({ ...base, type: 'video', assetId: obj.videodata?.assetId ?? -1,
          originalPath: obj.videodata?.url || '', durationMs: obj.videodata?.duration || 0,
          posterPath: obj.videodata?.posterUrl });
      } else if (obj.kind === 'textinput') {
        const extracted = extractTextFromObj(obj);
        if (extracted.text) {
          elements.push({ ...base, type: 'text', content: extracted.text, role: 'label' });
        }
      } else if (obj.kind === 'audio') {
        elements.push({ ...base, type: 'audio', assetId: obj.audiodata?.assetId ?? obj.assetId ?? -1,
          originalPath: obj.audiodata?.url || obj.url || '', durationMs: obj.audiodata?.duration || obj.duration || 0 });
      } else if (obj.kind === 'stategroup') {
        const states = extractStates(obj);
        const refName = (obj.referenceName || '').toLowerCase();
        if (refName.includes('slider') || refName.includes('dial') || refName.includes('marker')) {
          elements.push({ ...base, type: 'interaction',
            interactionType: refName.includes('slider') ? 'slider' : refName.includes('dial') ? 'dial' : 'marker',
            label: extractTextFromObj(obj).text || obj.referenceName || '',
            variableName: obj.bindto?.replace('_player.', '') || undefined, children: [] });
        }
        if (obj.objects) {
          const childElements = [];
          extractElementsRecursive(obj.objects, childElements, slideWidth, slideHeight);
          for (const child of childElements) {
            if (child.type === 'button' && states.length > 0) child.states = states;
            elements.push(child);
          }
        }
      } else if (obj.kind === 'objgroup') {
        const refName = (obj.referenceName || '').toLowerCase();
        if (refName.includes('scrolling panel')) {
          const children = [];
          if (obj.objects) extractElementsRecursive(obj.objects, children, slideWidth, slideHeight);
          elements.push({ ...base, type: 'interaction', interactionType: 'scrolling-panel',
            label: obj.referenceName || '', children });
        } else if (refName.includes('hotspot')) {
          elements.push({ ...base, type: 'interaction', interactionType: 'hotspot',
            label: obj.referenceName || '', children: [] });
        } else if (obj.objects) {
          extractElementsRecursive(obj.objects, elements, slideWidth, slideHeight);
        }
      } else {
        if (obj.kind) unknownKinds.add(obj.kind);
        if (obj.objects) extractElementsRecursive(obj.objects, elements, slideWidth, slideHeight);
      }
    }
  }

  // ---- Form fields ----

  function parseFormFields(objects) {
    const fields = [];
    collectFormFields(objects, fields);
    return fields;
  }

  function collectFormFields(objects, fields) {
    for (const o of objects) {
      if (o.kind === 'textinput') {
        fields.push({ id: o.id || o.referenceName || '', label: extractTextFromObj(o).text || o.placeholder || '',
          fieldType: o.numeric ? 'number' : 'text', variableName: o.bindto?.replace('_player.', '') || '', required: false });
      }
      if (o.objects) collectFormFields(o.objects, fields);
    }
  }

  // ---- Quiz question parsing ----

  function findQuestionText(objects) {
    const textObjects = objects.filter(o => {
      if (o.kind !== 'vectorshape' || o.accType !== 'text') return false;
      const text = extractTextFromObj(o).text;
      return text && !isDecorativeShapeName(text) && text !== 'Question' &&
        text !== 'Correct' && text !== 'Incorrect' && text.length > 10;
    });
    return textObjects.length > 0 ? extractTextFromObj(textObjects[0]).text : 'Unknown question';
  }

  function findFeedback(objects) {
    const correctObj = objects.find(o => o.id?.includes('CorrectReview'));
    const incorrectObj = objects.find(o => o.id?.includes('IncorrectReview'));
    return {
      correct: correctObj ? extractTextFromObj(correctObj).text || 'Correct!' : 'Correct!',
      incorrect: incorrectObj ? extractTextFromObj(incorrectObj).text || 'Incorrect.' : 'Incorrect.',
    };
  }

  function parseQuizQuestion(objects) {
    const radioGroups = objects.filter(o =>
      o.kind === 'stategroup' && o.objects?.some(so => so.accType === 'radio'));
    const checkboxGroups = objects.filter(o =>
      o.kind === 'stategroup' && o.objects?.some(so =>
        so.accType === 'checkbox' || (so.referenceName || '').toLowerCase().includes('checkbox')));
    const textInputs = objects.filter(o => o.kind === 'textinput');

    const isTrueFalse = radioGroups.length === 2 && radioGroups.every(sg => {
      const text = (sg.objects?.find(o => o.accType === 'radio') ?
        extractTextFromObj(sg.objects.find(o => o.accType === 'radio')).text : '').toLowerCase();
      return text === 'true' || text === 'false';
    });

    let questionType, choices = [], stateGroups = [];
    if (isTrueFalse) { questionType = 'true-false'; stateGroups = radioGroups; }
    else if (checkboxGroups.length > 0) { questionType = 'pick-many'; stateGroups = checkboxGroups; }
    else if (radioGroups.length > 0) { questionType = 'pick-one'; stateGroups = radioGroups; }
    else if (textInputs.length > 0) {
      return { id: (textInputs[0].id || 'textentry') + '_q', questionText: findQuestionText(objects),
        questionType: 'text-entry', choices: [], correctFeedback: findFeedback(objects).correct,
        incorrectFeedback: findFeedback(objects).incorrect, points: 10, shuffleChoices: false };
    } else { return null; }

    const questionText = findQuestionText(objects);
    const feedback = findFeedback(objects);
    choices = stateGroups.map(sg => {
      const choiceObj = sg.objects?.find(o => o.accType === 'radio' || o.accType === 'checkbox');
      const choiceText = choiceObj ? extractTextFromObj(choiceObj).text : '';
      const isCorrect = choiceText.endsWith('*');
      return { id: sg.id, text: choiceText.replace(/\*$/, '').trim(), isCorrect };
    });

    return { id: stateGroups[0].id + '_q', questionText, questionType, choices,
      correctFeedback: feedback.correct, incorrectFeedback: feedback.incorrect, points: 10, shuffleChoices: false };
  }

  // ---- Trigger parsing ----

  function parseTriggers(timelineData, objects) {
    const triggers = [];
    const events = timelineData?.events || [];
    for (const evt of events) {
      const actions = (evt.actions || []).map(a => ({
        kind: a.kind || 'unknown',
        targetId: a.objRef?.value || a.layerRef?.value || a.slideRef?.value || undefined,
        variable: a.variable || undefined,
        value: a.value != null ? String(a.value) : undefined,
        operator: a.operator || undefined,
      }));
      if (actions.length > 0) {
        triggers.push({ id: evt.id || 'trigger_' + triggers.length, event: evt.kind || 'ontimelinetick',
          actions, conditions: parseConditions(evt.conditions), targetObjectId: evt.objRef?.value || undefined });
      }
    }
    collectObjectTriggers(objects, triggers);
    return triggers;
  }

  function collectObjectTriggers(objects, triggers) {
    for (const obj of objects) {
      if (obj.actionGroups && Array.isArray(obj.actionGroups)) {
        for (const ag of obj.actionGroups) {
          const actions = (ag.actions || []).map(a => ({
            kind: a.kind || 'unknown',
            targetId: a.objRef?.value || a.layerRef?.value || a.slideRef?.value || undefined,
            variable: a.variable || undefined,
            value: a.value != null ? String(a.value) : undefined,
            operator: a.operator || undefined,
          }));
          if (actions.length > 0) {
            triggers.push({ id: ag.id || 'obj_trigger_' + triggers.length, event: ag.event || 'onclick',
              actions, conditions: parseConditions(ag.conditions), targetObjectId: obj.id || obj.referenceName || undefined });
          }
        }
      }
      if (obj.objects) collectObjectTriggers(obj.objects, triggers);
    }
  }

  function parseConditions(raw) {
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map(c => ({ variable: c.variable || undefined, operator: c.operator || 'eq',
      value: c.value != null ? String(c.value) : undefined }));
  }

  // ---- Slide parser ----

  function parseSlide(slideId, slideData, slideNumber) {
    const layer0 = slideData.slideLayers?.[0];
    const objects = layer0?.objects || [];
    const slideType = detectSlideType(slideData.title, objects, slideNumber);
    const slideWidth = slideData.width || 960;
    const slideHeight = slideData.height || 540;
    const elements = parseElements(objects, slideWidth, slideHeight);

    if (slideType === 'quiz') {
      const question = parseQuizQuestion(objects);
      if (question) {
        elements.push({ id: question.id, type: 'quiz', x: 0, y: 0, width: 960, height: 540,
          depth: 100, rotation: 0, alpha: 100, question });
      }
    }
    if (slideType === 'form') {
      const fields = parseFormFields(objects);
      if (fields.length > 0) {
        elements.push({ id: slideId + '_form', type: 'form', x: 0, y: 0, width: 960, height: 540,
          depth: 100, rotation: 0, alpha: 100, fields });
      }
    }

    const timelineData = layer0?.timeline;
    const timeline = {
      durationMs: timelineData?.duration || 5000,
      events: (timelineData?.events || []).flatMap(evt =>
        (evt.actions || []).filter(a => a.kind === 'show').map(a => ({
          timeMs: evt.time || 0, elementId: a.objRef?.value || '', action: 'show',
          animation: a.transition !== 'appear' ? a.animationId : undefined,
        }))
      ),
    };

    const transition = {
      type: slideData.transition || 'appear',
      durationMs: slideData.transDuration || 0,
      direction: slideData.transDir,
    };

    const triggers = parseTriggers(timelineData, objects);

    const layers = (slideData.slideLayers || []).slice(1).map((layer, i) => ({
      id: layer.id || 'layer_' + (i + 1), name: layer.name || 'Layer ' + (i + 1),
      elements: parseElements(layer.objects || [], slideWidth, slideHeight),
      timeline: { durationMs: layer.timeline?.duration || 5000, events: [] },
      audio: extractLayerAudio(layer.objects || []),
      triggers: parseTriggers(layer.timeline, layer.objects || []),
      // Storyline layer properties that inform presentation
      isModal: layer.modal || false,
      pausesParent: layer.pauseParent || false,
    }));

    // Detect navigation restrictions from Storyline's universal patterns:
    // - slideLock: author explicitly locked this slide
    // - NavigationRestrictionNextSlide_*: custom next-button behaviour
    // - resume: whether slide state persists (indicates important interaction)
    const hasNavRestriction = slideData.slideLock ||
      (slideData.actionGroups && Object.keys(slideData.actionGroups).some(
        k => k.startsWith('NavigationRestrictionNextSlide_')
      ));

    return { id: slideId, title: slideData.title, type: slideType, slideNumber,
      elements, layers, timeline, transitions: transition,
      audioNarrationId: slideData.globalAudioId || undefined, triggers,
      locked: slideData.slideLock || false,
      hasNavRestriction: hasNavRestriction || false,
      resume: slideData.resume || false };
  }

  // ---- Asset manifest builder ----

  function buildAssetManifest(assetLib) {
    const images = [], videos = [], audio = [];
    for (const asset of assetLib) {
      const entry = { id: asset.id, originalPath: asset.url || '',
        mimeType: guessMimeType(asset), sizeBytes: asset.fileSize };
      if (asset.videoType) videos.push(entry);
      else if (asset.duration && !asset.videoType) audio.push(entry);
      else if (asset.imageType || (asset.url || '').match(/\.(jpg|jpeg|png|gif|svg)$/i)) images.push(entry);
    }
    return { images, videos, audio, fonts: [] };
  }

  function guessMimeType(asset) {
    const url = asset.url || '';
    if (url.endsWith('.mp4')) return 'video/mp4';
    if (url.endsWith('.mp3')) return 'audio/mpeg';
    if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
    if (url.endsWith('.png')) return 'image/png';
    if (url.endsWith('.gif')) return 'image/gif';
    if (url.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
  }

  // ---- Navigation map builder ----

  function buildNavigationMap(slideMap, scenes) {
    const slideRefs = slideMap?.slideRefs || [];
    const links = [];
    const entrySlideId = scenes[0]?.startingSlide?.replace('_player.', '')?.split('.').pop() || '';
    for (const ref of slideRefs) {
      if (!ref.linksTo) continue;
      const fromId = ref.id.split('.').pop() || ref.id;
      for (const link of ref.linksTo) {
        const toId = link.id.split('.').pop() || link.id;
        links.push({ fromSlideId: fromId, toSlideId: toId,
          type: link.type === 'slidedraw' ? 'draw' : ref.type === 'slidebank' ? 'draw' : 'next' });
      }
    }
    return { entrySlideId, links };
  }

  // ---- Variables parser ----

  function parseVariables(rawVars) {
    return (rawVars || []).map(v => ({
      id: v.id || v.name || '',
      type: v.type === 'boolean' || v.type === 'tf' ? 'boolean' : v.type === 'number' ? 'number' : 'text',
      defaultValue: v.val ?? v.defaultVal ?? v.defaultValue ?? '',
    }));
  }

  // ---- Extraction report builder ----

  function buildExtractionReport(slides, variables) {
    let totalObjectsFound = 0, totalObjectsExtracted = 0, totalText = 0, totalButtons = 0;
    let totalImages = 0, totalVideos = 0, totalAudio = 0, totalInteractions = 0;
    let totalLayers = 0, totalLayersWithAudio = 0, totalTriggers = 0;

    for (const slide of slides) {
      const allElements = [...slide.elements, ...slide.layers.flatMap(l => l.elements)];
      totalLayers += slide.layers.length;
      totalLayersWithAudio += slide.layers.filter(l => l.audio && l.audio.length > 0).length;
      totalTriggers += slide.triggers.length + slide.layers.reduce((s, l) => s + l.triggers.length, 0);
      for (const el of allElements) {
        totalObjectsExtracted++;
        if (el.type === 'text') totalText++;
        else if (el.type === 'button') totalButtons++;
        else if (el.type === 'image') totalImages++;
        else if (el.type === 'video') totalVideos++;
        else if (el.type === 'audio') totalAudio++;
        else if (el.type === 'interaction') totalInteractions++;
      }
    }
    totalObjectsFound = totalObjectsExtracted + unknownKinds.size;
    return {
      totalObjectsFound, totalObjectsExtracted, totalObjectsSkipped: totalObjectsFound - totalObjectsExtracted,
      totalTextContent: totalText, totalButtons, totalImages, totalVideos, totalAudio, totalInteractions,
      totalLayers, totalLayersWithAudio, totalVariables: variables.length, totalTriggers,
      unknownObjectKinds: Array.from(unknownKinds), warnings: [],
      coveragePercent: totalObjectsFound > 0 ? Math.round((totalObjectsExtracted / totalObjectsFound) * 100) : 100,
    };
  }

  // ---- Question bank builder ----

  function buildQuestionBanks(scenes, slidesById) {
    const banks = [];
    for (const scene of scenes) {
      if (!scene.slidedraws) continue;
      for (const draw of scene.slidedraws) {
        const questions = [];
        for (const ref of draw.sliderefs || []) {
          const slideData = slidesById.get(ref.id);
          if (!slideData) continue;
          const layer0 = slideData.slideLayers?.[0];
          if (!layer0) continue;
          const question = parseQuizQuestion(layer0.objects || []);
          if (question) { question.id = ref.id + '_q'; questions.push(question); }
        }
        if (questions.length > 0) {
          const exitTarget = draw.exitaction?.objRef?.value || '';
          // Use exit target slide ID as the group — this universally links
          // quiz banks to their results slides without hardcoded IDs
          const group = exitTarget ? exitTarget.split('.').pop() : 'general';
          banks.push({ id: draw.lmsId || 'bank_' + banks.length,
            title: draw.lmsId || 'Question Bank ' + (banks.length + 1),
            drawCount: draw.shufflecount || questions.length, questions, group });
        }
      }
    }
    return banks;
  }

  // ---- Main extraction function ----

  async function extractCourse(fileMap, log) {
    unknownKinds.clear();
    log('Parsing SCORM manifest...');

    // Find and parse imsmanifest.xml
    const manifestXml = await readFileText(fileMap, 'imsmanifest.xml');
    const manifest = parseManifest(manifestXml);
    log('Course: ' + manifest.title + ' (SCORM ' + manifest.scormVersion + ')');

    // Parse Storyline data.js
    log('Parsing Storyline data files...');
    const dataJsContent = await readFileText(fileMap, 'html5/data/js/data.js');
    const data = parseStorylineJs(dataJsContent);

    // Parse individual slide JS files
    const slideFiles = findFilesInDir(fileMap, 'html5/data/js', '.js');
    const excludeFiles = ['data.js', 'frame.js', 'paths.js'];
    const slidesById = new Map();

    for (const sf of slideFiles) {
      if (excludeFiles.includes(sf.name)) continue;
      const slideId = sf.name.replace('.js', '');
      try {
        const content = await sf.file.text();
        const slideData = parseStorylineJs(content);
        slidesById.set(slideId, slideData);
      } catch (e) { /* skip unparseable */ }
    }

    log('Found ' + slidesById.size + ' slide files');

    // Build asset manifest
    const assets = buildAssetManifest(data.assetLib || []);

    // Build navigation map
    const navigation = buildNavigationMap(data.slideMap, data.scenes || []);

    // Filter content scenes using isMessageScene flag (universal in all Storyline exports)
    // Message scenes contain system dialogs (resume prompts, error messages), not course content
    const contentScenes = (data.scenes || []).filter(s => !s.isMessageScene);
    const contentSceneIds = new Set(contentScenes.map(s => s.id || ''));

    // Parse main slides — filter by content scenes, not by ID pattern matching
    const slideRefs = data.slideMap?.slideRefs || [];
    const mainSlideRefs = slideRefs.filter(ref => {
      if (ref.type !== 'slide') return false;
      // Use scene ID from the slide ref (format: sceneId.slideId)
      const sceneId = ref.id.includes('.') ? ref.id.split('.')[0] : '';
      // If we have scene data, use isMessageScene flag; otherwise fall back to ID check
      if (contentSceneIds.size > 0 && sceneId) return contentSceneIds.has(sceneId);
      return !ref.id.includes('Prompt') && !ref.id.includes('Msg');
    });

    const slides = mainSlideRefs.map((ref, index) => {
      const slideId = ref.id.split('.').pop() || ref.id;
      const sceneId = ref.id.includes('.') ? ref.id.split('.')[0] : '';
      const slideData = slidesById.get(slideId);
      if (!slideData) return null;
      const slide = parseSlide(slideId, slideData, index + 1);
      slide.sceneId = sceneId;
      return slide;
    }).filter(s => s !== null);

    // Build question banks
    const questionBanks = buildQuestionBanks(data.scenes || [], slidesById);

    // Compute durations
    const assetLib = data.assetLib || [];
    const totalAudioDurationMs = assetLib.filter(a => a.duration && !a.videoType).reduce((s, a) => s + (a.duration || 0), 0);
    const totalVideoDurationMs = assetLib.filter(a => a.videoType).reduce((s, a) => s + (a.duration || 0), 0);

    // Variables
    const variables = parseVariables(data.variables);

    // Extraction report
    const extractionReport = buildExtractionReport(slides, variables);

    // Extract scoring configuration from data.js (more authoritative than manifest)
    // scorings[] contains the actual pass/fail thresholds and status labels
    const scorings = (data.scorings || []).map(s => ({
      type: s.type || 'quiz',
      passPercent: s.passPercent || manifest.masteryScore || 80,
      passStatus: s.passStatus || 'pass',
      failStatus: s.failStatus || 'incomplete',
      viewThreshold: s.viewThreshold || 0,
    }));
    const primaryScoring = scorings[0] || {};
    const masteryScore = primaryScoring.passPercent || manifest.masteryScore || 80;

    // Extract quiz metadata from quizzes[] (survey flag, scoring type)
    const quizMeta = (data.quizzes || []).map(q => ({
      id: q.id,
      title: q.lmstext || '',
      isSurvey: q.issurvey || false,
      passPercent: q.passPercent || masteryScore,
      scoreType: q.scoretype || 'all',
      submitUnanswered: q.submitunanswered || 'viewed',
    }));

    // Extract project color palette from colorGroups[] (fallback for brand scraping)
    const projectColors = (data.colorGroups || []).reduce(function (colors, group) {
      if (group.colors) {
        group.colors.forEach(function (c) {
          if (c.name && c.val) colors[c.name] = c.val;
        });
      }
      return colors;
    }, {});

    // Extract font library
    const projectFonts = (data.fontLib || []).map(f => f.name || f.family || '').filter(f => f);

    const meta = { title: manifest.title, courseId: manifest.courseId, scormVersion: manifest.scormVersion,
      masteryScore: masteryScore, totalSlides: slides.length, totalAudioDurationMs, totalVideoDurationMs,
      passStatus: primaryScoring.passStatus, failStatus: primaryScoring.failStatus };

    log('Extracted: ' + slides.length + ' slides, ' + questionBanks.length + ' question banks');
    log('Coverage: ' + extractionReport.coveragePercent + '%');
    if (quizMeta.some(q => q.isSurvey)) log('  Contains survey questions (ungraded)');

    return { meta, slides, questionBanks, assets, navigation, variables, extractionReport,
      quizMeta, projectColors, projectFonts, scorings };
  }

  return { extractCourse };
})();
