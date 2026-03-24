#!/usr/bin/env node
/**
 * V4 SCORM Extractor
 *
 * Reads a Storyline SCORM package from disk and produces content-bucket.json.
 * Extracts raw educational content — no layout, no coordinates, no interaction logic.
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

// ─── XML parser (built-in via regex for Node — no DOMParser) ─────────
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
  // Extract scene/slide hierarchy from frame.xml
  // Top-level slidelinks with expand="true" are scenes; their children are slides
  const scenes = [];

  // Match top-level slidelinks (scenes) by finding expand="true" entries
  const topLevelRegex = /<slidelink\s+slideid="([^"]*)"[^>]*displaytext="([^"]*)"[^>]*expand="true"[^>]*type="slide"[^>]*>/g;
  const childRegex = /<slidelink\s+slideid="([^"]*)"[^>]*displaytext="([^"]*)"[^>]*type="slide"\s*\/>/g;

  // Simple approach: split by top-level slidelinks and collect children
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

// ─── Recursive content extraction from a slide ──────────────────────
function extractSlideContent(objects) {
  const blocks = [];
  const mediaRefs = [];

  function walk(objs) {
    for (const obj of objs) {
      // Text content
      if (obj.kind === 'vectorshape') {
        if (obj.accType === 'image' && obj.imagelib?.length > 0) {
          // Image
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
            blocks.push({ type: role, text });
          }
        } else if (obj.accType === 'button') {
          // Skip navigation buttons, but extract meaningful labeled buttons
          const { text } = extractText(obj);
          if (text && text.length > 3 && !/^(prev|next|back|continue|submit|close|menu|replay)$/i.test(text.trim())) {
            blocks.push({ type: 'callout', text: text.trim() });
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
            mediaRef: {
              filename,
              mediaType: 'video',
              altText: vdata.altText || '',
              context: 'inline',
            },
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
            mediaRef: {
              filename,
              mediaType: 'image',
              altText: img.altText || '',
              context: 'inline',
            },
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
        const rows = [];
        const cellTexts = [];
        if (obj.objects) {
          for (const cell of obj.objects) {
            const { text } = extractText(cell);
            if (text && !isNoise(text)) cellTexts.push(text);
          }
        }
        if (cellTexts.length > 0) {
          // Group into rows based on colsCount
          const cols = obj.colsCount || 2;
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
      if (obj.kind === 'stategroup' || obj.kind === 'objgroup' || obj.kind === 'scrollarea') {
        if (obj.objects) walk(obj.objects);
      }
      // For stategroups, also check states for hidden content
      if (obj.kind === 'stategroup' && obj.states) {
        for (const state of obj.states) {
          if (state.objects) walk(state.objects);
        }
      }
    }
  }

  walk(objects);
  return { blocks, mediaRefs };
}

// ─── Quiz extraction ─────────────────────────────────────────────────
function extractQuiz(objects) {
  // Find radio/checkbox groups
  const radioGroups = objects.filter(o =>
    o.kind === 'stategroup' && o.objects?.some(so => so.accType === 'radio'));
  const checkboxGroups = objects.filter(o =>
    o.kind === 'stategroup' && o.objects?.some(so =>
      so.accType === 'checkbox' || (so.referenceName || '').toLowerCase().includes('checkbox')));

  const stateGroups = checkboxGroups.length > 0 ? checkboxGroups : radioGroups;
  if (stateGroups.length === 0) return null;

  // Find question text
  const textObjects = objects
    .filter(o => o.kind === 'vectorshape' && o.accType === 'text')
    .map(o => ({ text: extractText(o).text, fontSize: extractText(o).fontSize }))
    .filter(t => t.text && !isNoise(t.text) && t.text.length > 10);

  const questionText = textObjects.length > 0 ? textObjects[0].text : 'Question';

  // Extract choices
  const choices = stateGroups.map(sg => {
    const choiceObj = sg.objects?.find(o => o.accType === 'radio' || o.accType === 'checkbox');
    const text = choiceObj ? extractText(choiceObj).text : '';
    const isCorrect = text.endsWith('*');
    return {
      text: text.replace(/\*$/, '').trim(),
      correct: isCorrect,
    };
  });

  // Detect question type
  const isTrueFalse = choices.length === 2 &&
    choices.every(c => c.text.toLowerCase() === 'true' || c.text.toLowerCase() === 'false');

  let questionType = 'multiple-choice';
  if (isTrueFalse) questionType = 'true-false';
  else if (checkboxGroups.length > 0) questionType = 'multiple-select';

  // Find feedback
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

// ─── Build media inventory ───────────────────────────────────────────
function buildMediaInventory(scormDir) {
  const images = [];
  const videos = [];
  const audio = [];

  const storyContent = path.join(scormDir, 'story_content');
  if (!fs.existsSync(storyContent)) return { images, videos, audio };

  // Walk story_content for media files
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

      // Skip shapes and text-as-image
      if (isShapeFile(basename)) continue;
      // Skip thumbnails and zoom icons
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

// ─── Process a single slide ─────────────────────────────────────────
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

  // Extract content blocks
  const { blocks, mediaRefs } = extractSlideContent(layer0Objects);

  // Also extract from additional layers (Storyline puts content in layers)
  const additionalLayers = (slideData.slideLayers || []).slice(1);
  for (const layer of additionalLayers) {
    const layerContent = extractSlideContent(layer.objects || []);
    blocks.push(...layerContent.blocks);
    mediaRefs.push(...layerContent.mediaRefs);
  }

  // Extract quiz if applicable
  if (slideType === 'quiz') {
    const quiz = extractQuiz(layer0Objects);
    if (quiz) blocks.push(quiz);
  }

  // Combine all content blocks
  const contentBlocks = [...blocks, ...mediaRefs];

  // Skip slides with no meaningful content
  if (contentBlocks.length === 0) return null;

  return {
    slideId,
    slideIndex,
    title: slideData.title || undefined,
    contentBlocks,
  };
}

// ─── Main extraction pipeline ────────────────────────────────────────
function extract(scormDir) {
  console.log(`\nExtracting from: ${scormDir}\n`);

  // 1. Parse manifest
  const manifestPath = path.join(scormDir, 'imsmanifest.xml');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('imsmanifest.xml not found in ' + scormDir);
  }
  const manifest = parseManifest(fs.readFileSync(manifestPath, 'utf-8'));
  console.log(`Course: ${manifest.title} (${manifest.scormVersion})`);

  // 2. Parse frame.xml for scene/slide structure
  const framePath = path.join(scormDir, 'story_content', 'frame.xml');
  let scenes = [];
  if (fs.existsSync(framePath)) {
    scenes = parseFrameXml(fs.readFileSync(framePath, 'utf-8'));
    console.log(`Scenes: ${scenes.length}`);
  }

  // 3. Find all slide JS data files
  const jsDir = path.join(scormDir, 'html5', 'data', 'js');
  if (!fs.existsSync(jsDir)) {
    throw new Error('html5/data/js/ not found — is this a Storyline HTML5 export?');
  }
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  console.log(`Slide data files: ${jsFiles.length}`);

  // 4. Build a map of slideId → JS file content
  // Storyline's slideId hash matches the JS filename
  const slideDataMap = new Map();
  for (const jsFile of jsFiles) {
    const hash = path.basename(jsFile, '.js');
    const content = fs.readFileSync(path.join(jsDir, jsFile), 'utf-8');
    slideDataMap.set(hash, content);
  }

  // 5. Process slides organized by scenes
  let slideIndex = 0;
  const processedScenes = [];

  if (scenes.length > 0) {
    for (const scene of scenes) {
      const processedSlides = [];

      for (const slideInfo of scene.slideIds) {
        slideIndex++;
        // Extract hash from slideId (last segment after the last dot)
        const hash = slideInfo.slideId.split('.').pop();
        const jsContent = slideDataMap.get(hash);

        if (!jsContent) {
          console.log(`  [${slideIndex}] ${slideInfo.displayText} — no data file`);
          continue;
        }

        const slide = processSlide(hash, jsContent, slideIndex);
        if (slide) {
          // Use frame.xml display text as title if slide has no title
          if (!slide.title && slideInfo.displayText) {
            slide.title = slideInfo.displayText;
          }
          processedSlides.push(slide);
          const blockCount = slide.contentBlocks.length;
          console.log(`  [${slideIndex}] ${slide.title || '(untitled)'} — ${blockCount} blocks`);
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
    // No frame.xml scene structure — process all JS files sequentially
    const allSlides = [];
    for (const jsFile of jsFiles) {
      slideIndex++;
      const hash = path.basename(jsFile, '.js');
      const content = slideDataMap.get(hash);
      const slide = processSlide(hash, content, slideIndex);
      if (slide) {
        allSlides.push(slide);
        console.log(`  [${slideIndex}] ${slide.title || '(untitled)'} — ${slide.contentBlocks.length} blocks`);
      }
    }
    if (allSlides.length > 0) {
      processedScenes.push({
        sceneId: 'scene-1',
        title: manifest.title,
        slides: allSlides,
      });
    }
  }

  // 6. Build media inventory
  const mediaInventory = buildMediaInventory(scormDir);
  console.log(`\nMedia: ${mediaInventory.images.length} images, ${mediaInventory.videos.length} videos, ${mediaInventory.audio.length} audio`);

  // 7. Assemble content bucket
  const contentBucket = {
    courseTitle: manifest.title,
    courseId: manifest.courseId,
    scormVersion: manifest.scormVersion,
    totalSlides: slideIndex,
    scenes: processedScenes,
    mediaInventory,
    extractedAt: new Date().toISOString(),
  };

  return contentBucket;
}

// ─── CLI entry point ─────────────────────────────────────────────────
const scormDir = process.argv[2] || 'EV';
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
console.log('Done.');
