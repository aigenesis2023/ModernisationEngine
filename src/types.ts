/**
 * Shared types for Preact SSR components.
 * These mirror the data shapes from course-layout.json and design-tokens.json.
 */

// ─── Course Layout Types ─────────────────────────────────────────────

export interface CourseLayout {
  course: { title: string; description?: string };
  metadata?: { archetype?: string };
  sections: Section[];
}

export interface Section {
  title?: string;
  sectionId?: string;
  sectionWidth?: 'narrow' | 'standard' | 'wide' | 'full';
  sectionBg?: 'default' | 'accent';
  showIf?: Record<string, string>;
  components: Component[];
}

export interface Component {
  type: string;
  variant?: string;
  displayTitle?: string;
  body?: string;
  instruction?: string;
  _items?: Item[];
  _graphic?: Graphic;
  _imageAlign?: 'left' | 'right';
  _feedback?: Feedback;
  showIf?: Record<string, string>;
  requiredItems?: number;
  drawMetadata?: DrawMetadata;
  columns?: Column[];
  rows?: any[];
  _rows?: any[];
}

export interface Item {
  title?: string;
  text?: string;
  body?: string;
  label?: string;
  prefix?: string;
  placeholder?: string;
  correct?: boolean;
  _shouldBeSelected?: boolean;
  variable?: string;
  _graphic?: Graphic;
  value?: string | number;
  suffix?: string;
  front?: string;
  back?: string;
  date?: string;
  icon?: string;
}

export interface Graphic {
  large?: string;
  alt?: string;
}

export interface Feedback {
  correct?: string;
  _incorrect?: { final?: string };
}

export interface DrawMetadata {
  drawCount?: number;
  poolSize?: number;
  shuffle?: boolean;
}

export interface Column {
  title?: string;
}

// ─── Design Tokens Types ─────────────────────────────────────────────

export interface DesignTokens {
  colors: Record<string, string>;
  fonts: { headline?: string; body?: string; label?: string };
  isDark: boolean;
  typography?: Record<string, string>;
  archetype?: { name?: string; confidence?: number };
}

// ─── Archetype Recipe Types ──────────────────────────────────────────

export interface ArchetypeRecipe {
  hero?: Record<string, string>;
  surface?: { style?: string; card?: string };
  borderRadius?: { card?: string; cardLarge?: string; button?: string; pill?: string };
  mcq?: Record<string, string>;
  tabs?: Record<string, string>;
  flashcard?: Record<string, string>;
  bento?: { cardBgs?: string[]; cardShadows?: string[]; imgHover?: string };
  branching?: Record<string, string>;
  timeline?: Record<string, string>;
  comparison?: Record<string, string>;
  checklist?: Record<string, string>;
  narrative?: Record<string, string>;
  [key: string]: any;
}

// ─── Render Context (replaces globals AR, IS_DARK) ───────────────────

export interface ColorStrategy {
  accentSectionBg: boolean;
  cardsOnAccentBg: boolean;
  textDirectlyOnAccent: boolean;
  accentSectionFrequency: number;
  primaryForIcons: boolean;
  primaryForStatNumbers: boolean;
  primaryForButtons: boolean;
}

export interface RenderContext {
  AR: ArchetypeRecipe;
  isDark: boolean;
  embedImage: (imagePath: string) => string;
  colorStrategy?: ColorStrategy | null;
}
