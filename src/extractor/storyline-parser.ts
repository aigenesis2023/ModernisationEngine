import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type {
  SlideIR, SlideType, SlideElement, TextElement, ImageElement, VideoElement,
  AudioElement, ButtonElement, ShapeElement, QuizElement, FormElement,
  FormFieldIR, QuestionIR, ChoiceIR, QuestionBankIR, TimelineIR, TimelineEvent,
  TransitionIR, SlideLayerIR, TextRole, ImageRole, AssetManifest, AssetEntry,
  NavigationMap, NavigationLink,
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

// ---- Slide Type Detection ----

function detectSlideType(title: string, objects: any[], slideRef: any): SlideType {
  const titleLower = title.toLowerCase();
  if (titleLower.includes('opening') || titleLower === 'title') return 'title';
  if (titleLower.includes('learning objective')) return 'objectives';
  if (titleLower.includes('result')) return 'results';
  if (titleLower.includes('text entry')) return 'form';
  if (titleLower.includes('role selector') || titleLower.includes('branch')) return 'branching';
  if (titleLower.includes('pre-knowledge') || titleLower.includes('pre knowledge')) return 'branching';

  // Check for quiz elements (stategroups with radio buttons)
  const hasRadio = objects.some(o =>
    o.kind === 'stategroup' && o.objects?.some((so: any) => so.accType === 'radio')
  );
  if (hasRadio || titleLower.includes('pick one') || titleLower.includes('pick many')) return 'quiz';

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
    } else if (obj.kind === 'stategroup') {
      // Stategroups contain interactive objects: quiz radio buttons, role
      // selector buttons, tabbed panels, etc. Recurse into sub-objects to
      // extract buttons, text, and images that were previously skipped.
      if (obj.objects) {
        extractElementsRecursive(obj.objects, elements);
      }
    } else if (obj.kind === 'objgroup') {
      // Object groups bundle related elements (e.g. icon + description text).
      // Recurse to extract all nested content.
      if (obj.objects) {
        extractElementsRecursive(obj.objects, elements);
      }
    }
  }
}

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

function parseQuizQuestion(objects: any[]): QuestionIR | null {
  const stateGroups = objects.filter(o =>
    o.kind === 'stategroup' && o.objects?.some((so: any) => so.accType === 'radio')
  );
  if (stateGroups.length === 0) return null;

  // Find question text: top-level text object that isn't a decorative shape or label
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

  const questionText = textObjects.length > 0
    ? extractTextFromObj(textObjects[0]).text
    : 'Unknown question';

  const choices: ChoiceIR[] = stateGroups.map(sg => {
    const radio = sg.objects?.find((o: any) => o.accType === 'radio');
    const choiceText = radio ? extractTextFromObj(radio).text : (radio?.data?.vectorData?.altText || '');
    const isCorrect = choiceText.endsWith('*');
    return {
      id: sg.id,
      text: choiceText.replace(/\*$/, '').trim(),
      isCorrect,
    };
  });

  // Find feedback text
  const correctFeedbackObj = objects.find(o => o.id?.includes('CorrectReview'));
  const correctFeedback = correctFeedbackObj ? extractTextFromObj(correctFeedbackObj).text || 'Correct!' : 'Correct!';

  const incorrectFeedbackObj = objects.find(o => o.id?.includes('IncorrectReview'));
  const incorrectFeedback = incorrectFeedbackObj ? extractTextFromObj(incorrectFeedbackObj).text || 'Incorrect.' : 'Incorrect.';

  return {
    id: stateGroups[0].id + '_q',
    questionText,
    questionType: 'pick-one',
    choices,
    correctFeedback,
    incorrectFeedback,
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

  // Parse additional layers
  const layers: SlideLayerIR[] = (slideData.slideLayers || []).slice(1).map((layer: any, i: number) => ({
    id: layer.id || `layer_${i + 1}`,
    name: layer.name || `Layer ${i + 1}`,
    elements: parseElements(layer.objects || []),
    timeline: {
      durationMs: layer.timeline?.duration || 5000,
      events: [],
    },
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
