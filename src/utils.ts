/**
 * Shared utilities — direct ports of helpers from build-course.js.
 * These produce identical output to the original string functions.
 */

/** HTML-escape a string (same as esc() in build-course.js) */
export function esc(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Strip all HTML tags (same as stripTags() in build-course.js) */
export function stripTags(html: string | undefined | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

/** Standardise section classes: py-16 spacing + brand bg-* only */
export function sectionOnly(cls: string): string {
  const bgs = cls.split(/\s+/)
    .filter(t => /^(?:(?:sm|md|lg|xl|2xl):)?bg-/.test(t))
    .join(' ');
  return bgs ? `py-16 ${bgs}` : 'py-16';
}

/** Merge class strings, filtering empty/null, deduplicating */
export function mc(...parts: (string | undefined | null | false)[]): string {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

// ─── Section widths ──────────────────────────────────────────────────

export const SECTION_WIDTHS: Record<string, string> = {
  narrow:   'max-w-3xl',
  standard: 'max-w-6xl',
  wide:     'max-w-[90rem]',
  full:     'max-w-6xl',
};

export function getSectionMaxW(sectionWidth: string): string {
  return SECTION_WIDTHS[sectionWidth] || SECTION_WIDTHS.standard;
}

// ─── Component width ─────────────────────────────────────────────────
// With container queries (Round 3), components respond to their container
// width instead of the viewport. BOOST/CAP maps are no longer needed —
// components stack/expand naturally via @3xl: breakpoints.
// getComponentMaxW now simply returns the section width.

export function getComponentMaxW(_type: string, _variant: string, sectionMaxW: string): string {
  return sectionMaxW;
}

// ─── Component needs-standard check ──────────────────────────────────

export const NEEDS_STANDARD = new Set([
  'mcq', 'branching', 'flashcard', 'bento', 'comparison', 'data-table',
  'tabs', 'checklist', 'narrative', 'process-flow', 'image-gallery',
  'labeled-image', 'timeline', 'key-term', 'accordion', 'stat-callout',
]);

export const INTERACTIVE_TYPES = new Set([
  'mcq', 'accordion', 'tabs', 'flashcard', 'narrative', 'checklist', 'textinput',
]);

// ─── Category map ────────────────────────────────────────────────────

export const CATEGORY_MAP: Record<string, string> = {
  'hero': 'Structure', 'path-selector': 'Structure', 'divider': 'Structure',
  'text': 'Content', 'graphic': 'Content', 'graphic-text': 'Content',
  'full-bleed': 'Content', 'pullquote': 'Content', 'stat-callout': 'Content',
  'key-term': 'Content', 'callout': 'Content',
  'accordion': 'Explore', 'tabs': 'Explore', 'narrative': 'Explore',
  'flashcard': 'Explore', 'labeled-image': 'Explore',
  'mcq': 'Assess', 'branching': 'Assess', 'textinput': 'Assess', 'checklist': 'Assess',
  'bento': 'Layout', 'comparison': 'Layout', 'data-table': 'Layout',
  'timeline': 'Layout', 'process-flow': 'Layout', 'image-gallery': 'Layout',
  'media': 'Media', 'video-transcript': 'Media',
};

// ─── Variant map ─────────────────────────────────────────────────────

export const VARIANT_MAP: Record<string, string[]> = {
  'hero':         ['centered-overlay', 'split-screen', 'minimal-text'],
  'graphic-text': ['split', 'overlap', 'full-overlay'],
  'bento':        ['grid-4', 'wide-2', 'featured'],
  'accordion':    ['standard', 'accent-border'],
  'mcq':          ['stacked', 'grid'],
  'stat-callout': ['centered', 'card-row'],
  'timeline':     ['vertical', 'centered-alternating'],
  'comparison':   ['columns', 'stacked-rows'],
  'tabs':         ['horizontal', 'vertical'],
  'pullquote':    ['accent-bar', 'centered', 'minimal'],
  'full-bleed':   ['center', 'left', 'right'],
  'process-flow': ['vertical', 'horizontal'],
  'graphic':      ['standard', 'captioned-card'],
  'divider':      ['line', 'spacing', 'icon'],
  'callout':      ['info', 'warning', 'tip', 'success'],
  'text':         ['standard', 'two-column', 'highlight-box'],
  'narrative':    ['image-focused', 'text-focused'],
  'flashcard':    ['grid', 'single-large'],
  'checklist':    ['standard', 'card-style', 'numbered'],
  'key-term':     ['list', 'card-grid'],
  'labeled-image':['numbered-dots', 'side-panel'],
  'data-table':   ['standard', 'striped-card'],
  'branching':    ['cards', 'list'],
};

// ─── Bento card text helpers ─────────────────────────────────────────

export function bentoCardTextClass(bgClass: string): string {
  if (!bgClass) return 'text-on-surface';
  const b = bgClass.toLowerCase();
  if (b.includes('primary-container'))   return 'text-on-primary-container';
  if (b.includes('secondary-container')) return 'text-on-secondary-container';
  if (b.includes('tertiary-container'))  return 'text-on-tertiary-container';
  if (b.includes('error-container'))     return 'text-on-error-container';
  if (b.includes('primary'))   return 'text-on-primary';
  if (b.includes('secondary')) return 'text-on-secondary';
  if (b.includes('tertiary'))  return 'text-on-tertiary';
  if (b.includes('error'))     return 'text-on-error';
  if (b.includes('on-background') || b.includes('on-surface') || b.includes('inverse-surface')) {
    return 'text-inverse-on-surface';
  }
  return 'text-on-surface';
}

export function bentoCardSubtextClass(bgClass: string): string {
  if (!bgClass) return 'text-on-surface-variant';
  const b = bgClass.toLowerCase();
  if (b.includes('primary-container'))   return 'text-on-primary-container/80';
  if (b.includes('secondary-container')) return 'text-on-secondary-container/80';
  if (b.includes('tertiary-container'))  return 'text-on-tertiary-container/80';
  if (b.includes('error-container'))     return 'text-on-error-container/80';
  if (b.includes('primary'))   return 'text-on-primary/80';
  if (b.includes('secondary')) return 'text-on-secondary/80';
  if (b.includes('tertiary'))  return 'text-on-tertiary/80';
  if (b.includes('error'))     return 'text-on-error/80';
  if (b.includes('on-background') || b.includes('on-surface') || b.includes('inverse-surface')) {
    return 'text-inverse-on-surface/80';
  }
  return 'text-on-surface-variant';
}
