import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  SlideIR, SlideType, SlideElement, TextElement, ImageElement, VideoElement,
  AudioElement, ButtonElement, ShapeElement, QuizElement, FormElement,
  FormFieldIR, QuestionIR, ChoiceIR, QuestionBankIR, TimelineIR, TimelineEvent,
  TransitionIR, SlideLayerIR, TextRole, ImageRole, AssetManifest, AssetEntry,
  NavigationMap, NavigationLink, CourseVariable, TriggerIR, TriggerActionIR,
  TriggerConditionIR, ObjectStateIR, LayerAudioIR, InteractionElement,
  ExtractionReport, SlideExtractionReport,
} from '../ir/types';

// Storyline wraps JSON in: window.globalProvideData('type', 'JSON_STRING')
// The JSON is wrapped in single quotes and may contain escaped single quotes (\')
// which are valid in JS strings but not in JSON. We eval in a sandbox to let
// the JS engine handle the unescaping.
function parseStorylineJs(filePath: string): any {
  const raw = readFileSync(filePath, 'utf8');
  let captured: any = null;
  const fakeWindow = {
    globalProvideData: (_type: string, jsonStr: string) => {
      captured = JSON.parse(jsonStr);
    },
  };
  // Use Function constructor to safely evaluate the script
  const fn = new Function('window', raw);
  fn(fakeWindow);
  if (!captured) throw new Error(`Cannot parse Storyline data from ${filePath}`);
  return captured;
}

export interface StorylineData {
  courseId: string;
  entryPoint: string;
  slideMap: any;
  scenes: any[];
  quizzes: any[];
  assetLib: any[];
  variables: any[];
  slideBank: any;
  slidesById: Map<string, any>;
}

export function parseDataJs(scormDir: string): StorylineData {
  const dataJsPath = join(scormDir, 'html5', 'data', 'js', 'data.js');
  const data = parseStorylineJs(dataJsPath);

  // Parse all individual slide JS files
  const jsDir = join(scormDir, 'html5', 'data', 'js');
  const slideFiles = readdirSync(jsDir).filter(f =>
    f.endsWith('.js') && !['data.js', 'frame.js', 'paths.js'].includes(f)
  );

  const slidesById = new Map<string, any>();
  for (const file of slideFiles) {
    const slideId = file.replace('.js', '');
    try {
      const slideData = parseStorylineJs(join(jsDir, file));
      slidesById.set(slideId, slideData);
    } catch {
      // Skip unparseable files
    }
  }

  return {
    courseId: data.courseId,
    entryPoint: data.entryPoint,
    slideMap: data.slideMap,
    scenes: data.scenes || [],
    quizzes: data.quizzes || [],
    assetLib: data.assetLib || [],
    variables: data.variables || [],
    slideBank: data.slideBank,
    slidesById,
  };
}

// ---- Variable Extraction ----

export function parseVariables(rawVars: any[]): CourseVariable[] {
  return rawVars.map(v => ({
    id: v.id || v.name || '',
    type: v.type === 'boolean' || v.type === 'tf' ? 'boolean' as const :
          v.type === 'number' ? 'number' as const : 'text' as const,
    defaultValue: v.val ?? v.defaultVal ?? v.defaultValue ?? '',
  }));
}

// ---- Trigger / Action Group Extraction ----

function parseTriggers(timelineData: any, objects: any[]): TriggerIR[] {
  const triggers: TriggerIR[] = [];

  // Extract from timeline events
  const events = timelineData?.events || [];
  for (const evt of events) {
    const actions: TriggerActionIR[] = [];
    for (const a of evt.actions || []) {
      actions.push({
        kind: a.kind || 'unknown',
        targetId: a.objRef?.value || a.layerRef?.value || a.slideRef?.value || undefined,
        variable: a.variable || undefined,
        value: a.value != null ? String(a.value) : undefined,
        operator: a.operator || undefined,
      });
    }
    if (actions.length > 0) {
      triggers.push({
        id: evt.id || `trigger_${triggers.length}`,
        event: evt.kind || 'ontimelinetick',
        actions,
        conditions: parseConditions(evt.conditions),
        targetObjectId: evt.objRef?.value || undefined,
      });
    }
  }

  // Extract from object-level triggers (useHandCursor buttons, etc.)
  collectObjectTriggers(objects, triggers);

  return triggers;
}

function collectObjectTriggers(objects: any[], triggers: TriggerIR[]): void {
  for (const obj of objects) {
    if (obj.actionGroups && Array.isArray(obj.actionGroups)) {
      for (const ag of obj.actionGroups) {
        const actions: TriggerActionIR[] = (ag.actions || []).map((a: any) => ({
          kind: a.kind || 'unknown',
          targetId: a.objRef?.value || a.layerRef?.value || a.slideRef?.value || undefined,
          variable: a.variable || undefined,
          value: a.value != null ? String(a.value) : undefined,
          operator: a.operator || undefined,
        }));
        if (actions.length > 0) {
          triggers.push({
            id: ag.id || `obj_trigger_${triggers.length}`,
            event: ag.event || 'onclick',
            actions,
            conditions: parseConditions(ag.conditions),
            targetObjectId: obj.id || obj.referenceName || undefined,
          });
        }
      }
    }
    // Recurse into nested objects
    if (obj.objects) collectObjectTriggers(obj.objects, triggers);
  }
}

function parseConditions(raw: any): TriggerConditionIR[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((c: any) => ({
    variable: c.variable || undefined,
    operator: c.operator || 'eq',
    value: c.value != null ? String(c.value) : undefined,
  }));
}

// ---- State Extraction from stategroups ----

function extractStates(obj: any): ObjectStateIR[] {
  const states: ObjectStateIR[] = [];
  if (obj.kind !== 'stategroup' || !obj.states) return states;

  for (const state of obj.states) {
    const name = state.name || state.id || '';
    // Skip the default state — it's just the normal appearance
    if (name === '_default_Normal' || name === 'Normal') continue;
    const label = state.objects?.[0] ? extractTextFromObj(state.objects[0]).text : undefined;
    states.push({
      name,
      label: label || undefined,
      altText: state.altText || undefined,
    });
  }
  return states;
}

// ---- Audio Extraction ----

function extractLayerAudio(objects: any[]): LayerAudioIR[] {
  const audio: LayerAudioIR[] = [];
  collectAudio(objects, audio);
  return audio;
}

function collectAudio(objects: any[], audio: LayerAudioIR[]): void {
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

// ---- Slide Type Detection ----

function detectSlideType(title: string, objects: any[], slideRef: any): SlideType {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('opening') || titleLower === 'title') return 'title';
  if (titleLower.includes('learning objective')) return 'objectives';
  if (titleLower.includes('result')) return 'results';
  if (titleLower.includes('text entry')) return 'form';
  if (titleLower.includes('role selector') || titleLower.includes('branch')) return 'branching';
  if (titleLower.includes('pre-knowledge') || titleLower.includes('pre knowledge')) return 'branching';

  // Check for quiz elements (stategroups with radio buttons or checkboxes)
  const hasRadio = objects.some(o =>
    o.kind === 'stategroup' && o.objects?.some((so: any) => so.accType === 'radio')
  );
  const hasCheckbox = objects.some(o =>
    o.kind === 'stategroup' && o.objects?.some((so: any) =>
      so.accType === 'checkbox' || (so.referenceName || '').toLowerCase().includes('checkbox')
    )
  );
  if (hasRadio || hasCheckbox || titleLower.includes('pick one') ||
      titleLower.includes('pick many') || titleLower.includes('true/false') ||
      titleLower.includes('true false') || titleLower.includes('matching') ||
      titleLower.includes('sequence') || titleLower.includes('fill in')) return 'quiz';

  // Check for text inputs
  if (objects.some(o => o.kind === 'textinput')) return 'form';

  return 'content';
}

// ---- Text Extraction from textLib ----

// Storyline stores rich text in textLib[].vartext.blocks[].spans[].text
// The data.vectorData.altText is a fallback accessibility string that is
// often a shape name like "Rectangle 9 1". Always prefer textLib spans.
function extractTextFromObj(obj: any): { text: string; fontSize?: number; fontFamily?: string; color?: string; textAlign?: string } {
  const result: { text: string; fontSize?: number; fontFamily?: string; color?: string; textAlign?: string } = { text: '' };

  if (obj.textLib?.length > 0) {
    const textData = obj.textLib[0];
    const blocks = textData.vartext?.blocks || [];
    const spans = blocks.flatMap((b: any) => b.spans?.map((s: any) => s.text) || []);
    result.text = spans.join('').trim();

    // Extract style from first span
    const firstSpan = blocks[0]?.spans?.[0]?.style;
    if (firstSpan) {
      result.fontSize = firstSpan.fontSize;
      result.fontFamily = firstSpan.fontFamily?.split(',')[0]?.replace(/"/g, '').trim();
      result.color = firstSpan.foregroundColor;
    }
    // Extract alignment from block style
    const blockStyle = textData.vartext?.defaultBlockStyle;
    if (blockStyle?.justification) {
      result.textAlign = blockStyle.justification;
    }
  }

  // Fall back to altText if textLib didn't produce content
  if (!result.text) {
    result.text = obj.data?.vectorData?.altText || '';
  }

  return result;
}

// ---- Element Extraction ----

function extractTextRole(text: string, accType: string, depth: number): TextRole {
  const lower = text.toLowerCase();
  if (lower === '') return 'unknown';
  if (lower.includes('question')) return 'heading';
  if (depth <= 3 && text.length < 50) return 'heading';
  if (text.length > 100) return 'body';
  if (lower.includes('click') || lower.includes('select') || lower.includes('choose')) return 'callout';
  return 'body';
}

function extractImageRole(altText: string, width: number, height: number, depth: number): ImageRole {
  const lower = altText.toLowerCase();
  if (lower.includes('logo')) return 'logo';
  if (width >= 900 && height >= 400) return 'hero';
  if (depth <= 2 && width >= 800) return 'background';
  if (width < 100 || height < 100) return 'icon';
  return 'content';
}

// Check if an altText/text is a decorative shape name that should be skipped as text
function isDecorativeShapeName(text: string): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return lower.startsWith('rectangle') ||
    lower.startsWith('oval') ||
    lower.startsWith('round') ||
    lower.startsWith('freeform') ||
    lower.startsWith('rectangular hotspot');
}

// Recursively extract elements from any Storyline object tree.
// Storyline nests content deeply: stategroup → objgroup → vectorshape.
// The old parser only looked at the top-level objects array which missed
// all content inside stategroups (buttons, hover text, quiz choices) and
// objgroups (grouped text/icon combos).
function parseElements(objects: any[]): SlideElement[] {
  const elements: SlideElement[] = [];
  extractElementsRecursive(objects, elements);
  return elements;
}

function extractElementsRecursive(objects: any[], elements: SlideElement[]): void {
  for (const obj of objects) {
    const base = {
      id: obj.id || obj.referenceName || '',
      x: obj.xPos || 0,
      y: obj.yPos || 0,
      width: obj.width || 0,
      height: obj.height || 0,
      depth: obj.depth || 0,
      rotation: obj.rotation || 0,
      alpha: obj.alpha || 100,
    };

    if (obj.kind === 'vectorshape') {
      const extracted = extractTextFromObj(obj);
      const altText = obj.data?.vectorData?.altText || '';

      if (obj.accType === 'image' && obj.imagelib?.length > 0) {
        const img = obj.imagelib[0];
        elements.push({
          ...base,
          type: 'image',
          assetId: img.assetId ?? -1,
          originalPath: img.url || '',
          altText: img.altText || altText,
          instructionalRole: extractImageRole(img.altText || altText, base.width, base.height, base.depth),
        } as ImageElement);
      } else if (obj.accType === 'button') {
        const label = extracted.text || altText;
        if (label && !isDecorativeShapeName(label)) {
          elements.push({
            ...base,
            type: 'button',
            label,
            action: { kind: 'navigate' },
          } as ButtonElement);
        }
      } else if (obj.accType === 'text' || obj.accType === 'radio') {
        const content = extracted.text;
        if (isDecorativeShapeName(content)) {
          elements.push({
            ...base,
            type: 'shape',
            role: base.depth <= 3 ? 'overlay' : 'decorative',
          } as ShapeElement);
        } else if (content) {
          elements.push({
            ...base,
            type: 'text',
            content,
            role: extractTextRole(content, obj.accType, base.depth),
            fontSize: extracted.fontSize,
            fontFamily: extracted.fontFamily,
            color: extracted.color,
            textAlign: extracted.textAlign,
          } as TextElement);
        }
      }
    } else if (obj.kind === 'video') {
      // Video objects were previously ignored entirely
      elements.push({
        ...base,
        type: 'video',
        assetId: obj.videodata?.assetId ?? -1,
        originalPath: obj.videodata?.url || '',
        durationMs: obj.videodata?.duration || 0,
        posterPath: obj.videodata?.posterUrl,
      } as VideoElement);
    } else if (obj.kind === 'textinput') {
      // Form fields — extracted separately by parseFormFields, but also
      // extract the label text so it appears in the element list
      const extracted = extractTextFromObj(obj);
      if (extracted.text) {
        elements.push({
          ...base,
          type: 'text',
          content: extracted.text,
          role: 'label' as TextRole,
        } as TextElement);
      }
    } else if (obj.kind === 'audio') {
      elements.push({
        ...base,
        type: 'audio',
        assetId: obj.audiodata?.assetId ?? obj.assetId ?? -1,
        originalPath: obj.audiodata?.url || obj.url || '',
        durationMs: obj.audiodata?.duration || obj.duration || 0,
      } as AudioElement);
    } else if (obj.kind === 'stategroup') {
      // Extract states (hover, selected, disabled, custom)
      const states = extractStates(obj);

      // Check if this is an interactive object (slider, dial, marker, etc.)
      const refName = (obj.referenceName || '').toLowerCase();
      if (refName.includes('slider') || refName.includes('dial') || refName.includes('marker')) {
        elements.push({
          ...base,
          type: 'interaction',
          interactionType: refName.includes('slider') ? 'slider' :
                           refName.includes('dial') ? 'dial' : 'marker',
          label: extractTextFromObj(obj).text || obj.referenceName || '',
          variableName: obj.bindto?.replace('_player.', '') || undefined,
          children: [],
        } as InteractionElement);
      }

      // Recurse into sub-objects for nested content (radio buttons, text, etc.)
      if (obj.objects) {
        // For buttons within stategroups, attach states
        const childElements: SlideElement[] = [];
        extractElementsRecursive(obj.objects, childElements);
        for (const child of childElements) {
          if (child.type === 'button' && states.length > 0) {
            (child as ButtonElement).states = states;
          }
          elements.push(child);
        }
      }
    } else if (obj.kind === 'objgroup') {
      // Check for scrolling panels or hotspots
      const refName = (obj.referenceName || '').toLowerCase();
      if (refName.includes('scrolling panel')) {
        const children: SlideElement[] = [];
        if (obj.objects) extractElementsRecursive(obj.objects, children);
        elements.push({
          ...base,
          type: 'interaction',
          interactionType: 'scrolling-panel',
          label: obj.referenceName || '',
          children,
        } as InteractionElement);
      } else if (refName.includes('hotspot')) {
        elements.push({
          ...base,
          type: 'interaction',
          interactionType: 'hotspot',
          label: obj.referenceName || '',
          children: [],
        } as InteractionElement);
      } else {
        // Regular object group — recurse to extract all nested content
        if (obj.objects) {
          extractElementsRecursive(obj.objects, elements);
        }
      }
    } else {
      // Track unknown kinds for the extraction report
      if (obj.kind) {
        unknownKinds.add(obj.kind);
      }
      // Still recurse into unknown objects in case they contain nested content
      if (obj.objects) {
        extractElementsRecursive(obj.objects, elements);
      }
    }
  }
}

// Track unknown object kinds across the parse
const unknownKinds = new Set<string>();

function parseFormFields(objects: any[]): FormFieldIR[] {
  const fields: FormFieldIR[] = [];
  collectFormFields(objects, fields);
  return fields;
}

function collectFormFields(objects: any[], fields: FormFieldIR[]): void {
  for (const o of objects) {
    if (o.kind === 'textinput') {
      const text = extractTextFromObj(o).text;
      fields.push({
        id: o.id || o.referenceName || '',
        label: text || o.placeholder || '',
        fieldType: o.numeric ? 'number' as const : 'text' as const,
        variableName: o.bindto?.replace('_player.', '') || '',
        required: false,
      });
    }
    // Recurse into nested objects
    if (o.objects) collectFormFields(o.objects, fields);
  }
}

function findQuestionText(objects: any[]): string {
  const textObjects = objects.filter(o => {
    if (o.kind !== 'vectorshape' || o.accType !== 'text') return false;
    const text = extractTextFromObj(o).text;
    return text &&
      !isDecorativeShapeName(text) &&
      text !== 'Question' &&
      text !== 'Correct' &&
      text !== 'Incorrect' &&
      text.length > 10;
  });
  return textObjects.length > 0 ? extractTextFromObj(textObjects[0]).text : 'Unknown question';
}

function findFeedback(objects: any[]): { correct: string; incorrect: string } {
  const correctObj = objects.find(o => o.id?.includes('CorrectReview'));
  const incorrectObj = objects.find(o => o.id?.includes('IncorrectReview'));
  return {
    correct: correctObj ? extractTextFromObj(correctObj).text || 'Correct!' : 'Correct!',
    incorrect: incorrectObj ? extractTextFromObj(incorrectObj).text || 'Incorrect.' : 'Incorrect.',
  };
}

function parseQuizQuestion(objects: any[]): QuestionIR | null {
  // Detect radio buttons (pick-one)
  const radioGroups = objects.filter(o =>
    o.kind === 'stategroup' && o.objects?.some((so: any) => so.accType === 'radio')
  );

  // Detect checkboxes (pick-many / multiple response)
  const checkboxGroups = objects.filter(o =>
    o.kind === 'stategroup' && o.objects?.some((so: any) =>
      so.accType === 'checkbox' || (so.referenceName || '').toLowerCase().includes('checkbox')
    )
  );

  // Detect text inputs (text-entry / fill-in-the-blank)
  const textInputs = objects.filter(o => o.kind === 'textinput');

  // Detect true/false by checking if there are exactly 2 radio choices with true/false text
  const isTrueFalse = radioGroups.length === 2 && radioGroups.every(sg => {
    const text = (sg.objects?.find((o: any) => o.accType === 'radio') ?
      extractTextFromObj(sg.objects.find((o: any) => o.accType === 'radio')).text : '').toLowerCase();
    return text === 'true' || text === 'false';
  });

  // Determine question type and extract choices
  let questionType: QuestionIR['questionType'];
  let choices: ChoiceIR[] = [];
  let stateGroups: any[] = [];

  if (isTrueFalse) {
    questionType = 'true-false';
    stateGroups = radioGroups;
  } else if (checkboxGroups.length > 0) {
    questionType = 'pick-many';
    stateGroups = checkboxGroups;
  } else if (radioGroups.length > 0) {
    questionType = 'pick-one';
    stateGroups = radioGroups;
  } else if (textInputs.length > 0) {
    questionType = 'text-entry';
    const questionText = findQuestionText(objects);
    const feedback = findFeedback(objects);
    return {
      id: (textInputs[0].id || 'textentry') + '_q',
      questionText,
      questionType,
      choices: [],
      correctFeedback: feedback.correct,
      incorrectFeedback: feedback.incorrect,
      points: 10,
      shuffleChoices: false,
    };
  } else {
    return null;
  }

  const questionText = findQuestionText(objects);
  const feedback = findFeedback(objects);

  choices = stateGroups.map(sg => {
    const choiceObj = sg.objects?.find((o: any) =>
      o.accType === 'radio' || o.accType === 'checkbox'
    );
    const choiceText = choiceObj ? extractTextFromObj(choiceObj).text : '';
    const isCorrect = choiceText.endsWith('*');
    return {
      id: sg.id,
      text: choiceText.replace(/\*$/, '').trim(),
      isCorrect,
    };
  });

  return {
    id: stateGroups[0].id + '_q',
    questionText,
    questionType,
    choices,
    correctFeedback: feedback.correct,
    incorrectFeedback: feedback.incorrect,
    points: 10,
    shuffleChoices: false,
  };
}

// ---- Main Slide Parser ----

export function parseSlide(
  slideId: string,
  slideData: any,
  slideNumber: number,
  slideRef: any,
): SlideIR {
  const layer0 = slideData.slideLayers?.[0];
  const objects = layer0?.objects || [];

  const slideType = detectSlideType(slideData.title, objects, slideRef);
  const elements = parseElements(objects);

  // Add quiz element if detected
  if (slideType === 'quiz') {
    const question = parseQuizQuestion(objects);
    if (question) {
      elements.push({
        id: question.id,
        type: 'quiz',
        x: 0, y: 0, width: 960, height: 540,
        depth: 100, rotation: 0, alpha: 100,
        question,
      } as QuizElement);
    }
  }

  // Add form element if detected
  if (slideType === 'form') {
    const fields = parseFormFields(objects);
    if (fields.length > 0) {
      elements.push({
        id: slideId + '_form',
        type: 'form',
        x: 0, y: 0, width: 960, height: 540,
        depth: 100, rotation: 0, alpha: 100,
        fields,
      } as FormElement);
    }
  }

  // Parse timeline
  const timelineData = layer0?.timeline;
  const timeline: TimelineIR = {
    durationMs: timelineData?.duration || 5000,
    events: (timelineData?.events || []).flatMap((evt: any) =>
      (evt.actions || []).filter((a: any) => a.kind === 'show').map((a: any) => ({
        timeMs: evt.time || 0,
        elementId: a.objRef?.value || '',
        action: 'show' as const,
        animation: a.transition !== 'appear' ? a.animationId : undefined,
      }))
    ),
  };

  const transition: TransitionIR = {
    type: (slideData.transition || 'appear') as TransitionIR['type'],
    durationMs: slideData.transDuration || 0,
    direction: slideData.transDir,
  };

  // Parse triggers from timeline and objects
  const triggers = parseTriggers(timelineData, objects);

  // Parse additional layers (with audio and triggers)
  const layers: SlideLayerIR[] = (slideData.slideLayers || []).slice(1).map((layer: any, i: number) => ({
    id: layer.id || `layer_${i + 1}`,
    name: layer.name || `Layer ${i + 1}`,
    elements: parseElements(layer.objects || []),
    timeline: {
      durationMs: layer.timeline?.duration || 5000,
      events: [],
    },
    audio: extractLayerAudio(layer.objects || []),
    triggers: parseTriggers(layer.timeline, layer.objects || []),
  }));

  return {
    id: slideId,
    title: slideData.title,
    type: slideType,
    slideNumber,
    elements,
    layers,
    timeline,
    transitions: transition,
    audioNarrationId: slideData.globalAudioId || undefined,
    triggers,
  };
}

// ---- Asset Manifest Builder ----

export function buildAssetManifest(assetLib: any[], scormDir: string): AssetManifest {
  const images: AssetEntry[] = [];
  const videos: AssetEntry[] = [];
  const audio: AssetEntry[] = [];

  for (const asset of assetLib) {
    const entry: AssetEntry = {
      id: asset.id,
      originalPath: asset.url || '',
      mimeType: guessMimeType(asset),
      sizeBytes: asset.fileSize,
    };

    if (asset.videoType) {
      videos.push(entry);
    } else if (asset.duration && !asset.videoType) {
      audio.push(entry);
    } else if (asset.imageType || asset.url?.match(/\.(jpg|jpeg|png|gif|svg)$/i)) {
      images.push(entry);
    }
  }

  return { images, videos, audio, fonts: [] };
}

function guessMimeType(asset: any): string {
  const url = asset.url || '';
  if (url.endsWith('.mp4')) return 'video/mp4';
  if (url.endsWith('.mp3')) return 'audio/mpeg';
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.gif')) return 'image/gif';
  if (url.endsWith('.svg')) return 'image/svg+xml';
  if (url.endsWith('.woff')) return 'font/woff';
  return 'application/octet-stream';
}

// ---- Navigation Map Builder ----

export function buildNavigationMap(slideMap: any, scenes: any[]): NavigationMap {
  const slideRefs = slideMap?.slideRefs || [];
  const links: NavigationLink[] = [];

  // Extract the entry slide from the first scene
  const entrySlideId = scenes[0]?.startingSlide?.replace('_player.', '')?.split('.').pop() || '';

  for (const ref of slideRefs) {
    if (!ref.linksTo) continue;
    const fromId = ref.id.split('.').pop() || ref.id;

    for (const link of ref.linksTo) {
      const toId = link.id.split('.').pop() || link.id;
      const linkType: NavigationLink['type'] =
        link.type === 'slidedraw' ? 'draw' :
        ref.type === 'slidebank' ? 'draw' : 'next';

      links.push({
        fromSlideId: fromId,
        toSlideId: toId,
        type: linkType,
      });
    }
  }

  return { entrySlideId, links };
}

// ---- Extraction Report Builder ----

export function buildExtractionReport(slides: SlideIR[], variables: CourseVariable[]): ExtractionReport {
  let totalObjectsFound = 0;
  let totalObjectsExtracted = 0;
  let totalText = 0;
  let totalButtons = 0;
  let totalImages = 0;
  let totalVideos = 0;
  let totalAudio = 0;
  let totalInteractions = 0;
  let totalLayers = 0;
  let totalLayersWithAudio = 0;
  let totalTriggers = 0;
  const slideReports: SlideExtractionReport[] = [];

  for (const slide of slides) {
    const allElements = [...slide.elements, ...slide.layers.flatMap(l => l.elements)];
    const layerAudioCount = slide.layers.filter(l => l.audio && l.audio.length > 0).length;

    totalLayers += slide.layers.length;
    totalLayersWithAudio += layerAudioCount;
    totalTriggers += slide.triggers.length + slide.layers.reduce((s, l) => s + l.triggers.length, 0);

    for (const el of allElements) {
      totalObjectsExtracted++;
      switch (el.type) {
        case 'text': totalText++; break;
        case 'button': totalButtons++; break;
        case 'image': totalImages++; break;
        case 'video': totalVideos++; break;
        case 'audio': totalAudio++; break;
        case 'interaction': totalInteractions++; break;
      }
    }

    slideReports.push({
      slideId: slide.id,
      slideTitle: slide.title,
      objectsFound: allElements.length,
      objectsExtracted: allElements.length,
      layersFound: slide.layers.length,
      layersWithContent: slide.layers.filter(l => l.elements.length > 0).length,
      warnings: [],
    });
  }

  totalObjectsFound = totalObjectsExtracted + unknownKinds.size;
  const coveragePercent = totalObjectsFound > 0
    ? Math.round((totalObjectsExtracted / totalObjectsFound) * 100)
    : 100;

  return {
    totalObjectsFound,
    totalObjectsExtracted,
    totalObjectsSkipped: totalObjectsFound - totalObjectsExtracted,
    totalTextContent: totalText,
    totalButtons,
    totalImages,
    totalVideos,
    totalAudio,
    totalInteractions,
    totalLayers,
    totalLayersWithAudio,
    totalVariables: variables.length,
    totalTriggers,
    unknownObjectKinds: Array.from(unknownKinds),
    warnings: unknownKinds.size > 0
      ? [`Unknown object kinds encountered: ${Array.from(unknownKinds).join(', ')}`]
      : [],
    coveragePercent,
    slideReports,
  };
}

// ---- Question Bank Builder ----

export function buildQuestionBanks(
  scenes: any[],
  slidesById: Map<string, any>,
  quizzes: any[],
): QuestionBankIR[] {
  const banks: QuestionBankIR[] = [];

  for (const scene of scenes) {
    if (!scene.slidedraws) continue;

    for (const draw of scene.slidedraws) {
      const questions: QuestionIR[] = [];

      for (const ref of draw.sliderefs || []) {
        const slideData = slidesById.get(ref.id);
        if (!slideData) continue;

        const layer0 = slideData.slideLayers?.[0];
        if (!layer0) continue;

        const question = parseQuizQuestion(layer0.objects || []);
        if (question) {
          question.id = ref.id + '_q';
          questions.push(question);
        }
      }

      if (questions.length > 0) {
        // Determine group based on exit action destination
        const exitTarget = draw.exitaction?.objRef?.value || '';
        const group = exitTarget.includes('6gVJ6ioVtxh') ? 'non-technical' as const :
                      exitTarget.includes('6ikVHG8x6rz') ? 'technical' as const :
                      'general' as const;

        banks.push({
          id: draw.lmsId || `bank_${banks.length}`,
          title: draw.lmsId || `Question Bank ${banks.length + 1}`,
          drawCount: draw.shufflecount || questions.length,
          questions,
          group,
        });
      }
    }
  }

  return banks;
}
