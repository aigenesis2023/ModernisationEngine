// ============================================================
// Evolution Engine — Intermediate Representation Types
// Every module reads from or writes to these structures.
// ============================================================

// ---- Course IR (output of extractor, input to generator) ----

export interface CourseIR {
  meta: CourseMeta;
  slides: SlideIR[];
  questionBanks: QuestionBankIR[];
  assets: AssetManifest;
  navigation: NavigationMap;
  variables: CourseVariable[];
  extractionReport: ExtractionReport;
}

export interface CourseMeta {
  title: string;
  courseId: string;
  scormVersion: '1.2' | '2004';
  masteryScore: number;
  totalSlides: number;
  totalAudioDurationMs: number;
  totalVideoDurationMs: number;
  publishedDate?: string;
  author?: string;
}

export type SlideType =
  | 'title'
  | 'objectives'
  | 'content'
  | 'form'
  | 'branching'
  | 'quiz'
  | 'results'
  | 'interstitial';

export interface SlideIR {
  id: string;
  title: string;
  type: SlideType;
  slideNumber: number;
  elements: SlideElement[];
  layers: SlideLayerIR[];
  timeline: TimelineIR;
  transitions: TransitionIR;
  audioNarrationId?: number;        // global audio asset for this slide
  triggers: TriggerIR[];            // action groups / event triggers
}

export interface SlideLayerIR {
  id: string;
  name: string;
  elements: SlideElement[];
  timeline: TimelineIR;
  audio: LayerAudioIR[];            // narration / SFX attached to this layer
  triggers: TriggerIR[];            // action groups / event triggers on this layer
}

export type SlideElement =
  | TextElement
  | ImageElement
  | VideoElement
  | AudioElement
  | ButtonElement
  | ShapeElement
  | QuizElement
  | FormElement
  | InteractionElement;

export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number; // z-order
  rotation: number;
  alpha: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;          // raw text content
  htmlContent?: string;     // rich text HTML
  role: TextRole;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  textAlign?: string;
}

export type TextRole =
  | 'heading'
  | 'subheading'
  | 'body'
  | 'caption'
  | 'callout'
  | 'label'
  | 'button-label'
  | 'list-item'
  | 'unknown';

export interface ImageElement extends BaseElement {
  type: 'image';
  assetId: number;
  originalPath: string;
  altText: string;
  instructionalRole: ImageRole;
}

export type ImageRole =
  | 'hero'
  | 'background'
  | 'illustration'
  | 'icon'
  | 'decorative'
  | 'content'
  | 'logo';

export interface VideoElement extends BaseElement {
  type: 'video';
  assetId: number;
  originalPath: string;
  durationMs: number;
  posterPath?: string;
  autoplay?: boolean;
  loop?: boolean;
  showControls?: boolean;
}

export interface AudioElement extends BaseElement {
  type: 'audio';
  assetId: number;
  originalPath: string;
  durationMs: number;
}

export interface ButtonElement extends BaseElement {
  type: 'button';
  label: string;
  action: ButtonAction;
  states: ObjectStateIR[];          // hover, selected, disabled etc.
}

export interface ButtonAction {
  kind: 'navigate' | 'submit' | 'external' | 'custom';
  targetSlideId?: string;
  url?: string;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  role: 'overlay' | 'divider' | 'container' | 'decorative';
  backgroundColor?: string;
  borderRadius?: number;
}

export interface QuizElement extends BaseElement {
  type: 'quiz';
  question: QuestionIR;
}

export interface FormElement extends BaseElement {
  type: 'form';
  fields: FormFieldIR[];
}

export interface FormFieldIR {
  id: string;
  label: string;
  fieldType: 'text' | 'email' | 'number' | 'textarea';
  variableName: string;
  required: boolean;
  placeholder?: string;
  maxChars?: number;
  multiline?: boolean;
}

// ---- Interaction Element (sliders, dials, drag-drop, hotspots, 360°, etc.) ----

export interface InteractionElement extends BaseElement {
  type: 'interaction';
  interactionType: string;          // 'slider' | 'dial' | 'drag-drop' | 'hotspot' | '360-image' | 'scrolling-panel' | 'marker' | string
  label?: string;
  variableName?: string;            // variable this interaction binds to
  children: SlideElement[];         // nested content within the interaction
}

// ---- Object States (hover, selected, disabled, custom) ----

export interface ObjectStateIR {
  name: string;                     // e.g. '_default_Hover', '_default_Selected', 'ON'
  label?: string;                   // different text content in this state
  altText?: string;
}

// ---- Layer Audio ----

export interface LayerAudioIR {
  assetId: number;
  originalPath: string;
  durationMs?: number;
}

// ---- Triggers / Action Groups ----

export interface TriggerIR {
  id: string;
  event: string;                    // e.g. 'onclick', 'onhover', 'ontimelinereached', 'onload'
  actions: TriggerActionIR[];
  conditions: TriggerConditionIR[];
  targetObjectId?: string;          // which object triggers this
}

export interface TriggerActionIR {
  kind: string;                     // 'show', 'hide', 'adjustvar', 'navigate', 'exe_actiongroup', etc.
  targetId?: string;                // object/layer/slide being acted on
  variable?: string;                // variable being adjusted
  value?: string;                   // value being set
  operator?: string;                // 'set', 'add', 'toggle', etc.
}

export interface TriggerConditionIR {
  variable?: string;
  operator: string;                 // 'eq', 'neq', 'gt', 'lt', etc.
  value?: string;
}

// ---- Course Variables ----

export interface CourseVariable {
  id: string;
  type: 'boolean' | 'number' | 'text';
  defaultValue: string | number | boolean;
}

// ---- Extraction Report (self-diagnosis) ----

export interface ExtractionReport {
  totalObjectsFound: number;
  totalObjectsExtracted: number;
  totalObjectsSkipped: number;
  totalTextContent: number;
  totalButtons: number;
  totalImages: number;
  totalVideos: number;
  totalAudio: number;
  totalInteractions: number;
  totalLayers: number;
  totalLayersWithAudio: number;
  totalVariables: number;
  totalTriggers: number;
  unknownObjectKinds: string[];     // any kind values we didn't recognise
  warnings: string[];               // human-readable extraction warnings
  coveragePercent: number;          // objectsExtracted / objectsFound * 100
  slideReports: SlideExtractionReport[];
}

export interface SlideExtractionReport {
  slideId: string;
  slideTitle: string;
  objectsFound: number;
  objectsExtracted: number;
  layersFound: number;
  layersWithContent: number;
  warnings: string[];
}

// ---- Quiz / Assessment IR ----

export interface QuestionBankIR {
  id: string;
  title: string;
  drawCount: number; // how many questions to draw from this bank
  questions: QuestionIR[];
  group: 'technical' | 'non-technical' | 'general';
}

export interface QuestionIR {
  id: string;
  questionText: string;
  questionType: 'pick-one' | 'pick-many' | 'true-false' | 'text-entry' | 'matching' | 'sequence';
  choices: ChoiceIR[];
  correctFeedback?: string;
  incorrectFeedback?: string;
  points: number;
  shuffleChoices: boolean;
}

export interface ChoiceIR {
  id: string;
  text: string;
  isCorrect: boolean;
}

// ---- Navigation ----

export interface NavigationMap {
  entrySlideId: string;
  links: NavigationLink[];
}

export interface NavigationLink {
  fromSlideId: string;
  toSlideId: string;
  condition?: string; // e.g., "role === 'technical'"
  type: 'next' | 'branch' | 'draw';
}

// ---- Timeline / Transitions ----

export interface TimelineIR {
  durationMs: number;
  events: TimelineEvent[];
}

export interface TimelineEvent {
  timeMs: number;
  elementId: string;
  action: 'show' | 'hide' | 'play';
  animation?: string;
}

export interface TransitionIR {
  type: 'appear' | 'fade' | 'slide' | 'wipe';
  durationMs: number;
  direction?: number;
}

// ---- Asset Manifest ----

export interface AssetManifest {
  images: AssetEntry[];
  videos: AssetEntry[];
  audio: AssetEntry[];
  fonts: AssetEntry[];
}

export interface AssetEntry {
  id: number;
  originalPath: string;
  mimeType: string;
  sizeBytes?: number;
}

// ---- Brand Profile (output of brand scanner) ----

export interface BrandProfile {
  sourceUrl: string;
  colors: BrandColors;
  typography: BrandTypography;
  style: BrandStyle;
  logo?: BrandLogo;
}

export interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  success: string;
  error: string;
  warning: string;
  gradient?: string; // CSS gradient if detected
}

export interface BrandTypography {
  headingFont: string;
  bodyFont: string;
  fontImportUrl?: string; // Google Fonts or similar CDN URL
  baseSize: number;       // px
  headingSizes: {
    h1: number;
    h2: number;
    h3: number;
  };
  lineHeight: number;
  headingWeight: number;
  bodyWeight: number;
}

export interface BrandStyle {
  borderRadius: string;
  cardStyle: 'flat' | 'elevated' | 'outlined' | 'glass';
  buttonStyle: 'solid' | 'outline' | 'ghost' | 'gradient';
  imageStyle: 'sharp' | 'rounded' | 'circular';
  mood: 'corporate' | 'friendly' | 'technical' | 'creative' | 'elegant';
  spacing: {
    unit: number;  // base spacing unit in px (e.g. 8)
    section: number;
    element: number;
  };
}

export interface BrandLogo {
  url: string;
  width: number;
  height: number;
  alt: string;
}

// ---- Image Intelligence (output of image analyzer) ----

export interface ImageManifest {
  entries: ImageIntelligenceEntry[];
}

export interface ImageIntelligenceEntry {
  originalAssetId: number;
  originalPath: string;
  description: string;          // what the image depicts
  instructionalRole: string;    // why it's in the course
  generationPrompt: string;     // optimized prompt for AI image gen
  generatedPath?: string;       // path to the new image
  status: 'pending' | 'generating' | 'generated' | 'failed';
  error?: string;
}

// ---- Engine Configuration ----

export interface EvolutionConfig {
  scormInputDir: string;
  brandUrl: string;
  outputDir: string;
  imageGenProvider: 'pollinations' | 'stability' | 'dalle' | 'none';
  skipImageGen: boolean;
  verbose: boolean;
  brandJsonPath?: string;        // path to pre-extracted brand profile JSON
  imageManifestPath?: string;    // path to pre-sourced image manifest JSON
}

// ---- Pipeline Phase Results ----

export interface PipelineResult {
  config: EvolutionConfig;
  course: CourseIR;
  brand: BrandProfile;
  images: ImageManifest;
  outputPath: string;
  stats: PipelineStats;
}

export interface PipelineStats {
  totalSlides: number;
  totalQuestions: number;
  imagesProcessed: number;
  imagesGenerated: number;
  imagesFailed: number;
  durationMs: number;
}
