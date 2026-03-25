/**
 * generate-course-html.js — V5 Stitch Component Kit Generator
 *
 * Sends Stitch TWO things:
 *   1. brand-design.md — DESIGN.md format brief (how it should look)
 *   2. representative-course.md — all 25 component types (what to design)
 *
 * Stitch designs a complete, branded page experience — navigation, sections,
 * every component type, transitions, footer. We then EXTRACT:
 *   - Page shell (nav, section wrappers, footer)
 *   - Component patterns (one HTML fragment per type, identified by data-component-type)
 *   - Design tokens (Tailwind config, colour system, fonts)
 *
 * This is a REUSABLE DESIGN ASSET — the future authoring layer can re-render
 * courses with different content or swapped components without re-calling Stitch.
 *
 * CRITICAL: DesignTheme is OUTPUT-only in the Stitch API. There is no theme
 * input parameter. The DESIGN.md content goes INSIDE the text prompt parameter.
 * Stitch understands it there because it's trained on the DESIGN.md format.
 *
 * Input:  v5/output/brand-design.md + v5/prompts/representative-course.md
 * Output: v5/output/stitch-course-raw.html
 *         v5/output/stitch-course-meta.json
 *         v5/output/stitch-course-screenshot.png
 *         v5/output/component-patterns/*.html
 *         v5/output/design-tokens.json
 *
 * Requires: STITCH_API_KEY environment variable
 * Model: GEMINI_3_1_PRO (Deep Think — significantly better for design reasoning)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { StitchToolClient } from '@google/stitch-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
config({ path: join(ROOT, '.env') });
const OUTPUT_DIR = join(ROOT, 'v5/output');
const PATTERNS_DIR = join(OUTPUT_DIR, 'component-patterns');

const API_KEY = process.env.STITCH_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set STITCH_API_KEY environment variable');
  process.exit(1);
}

// ─── Build the Stitch prompt ────────────────────────────────────────

/** Detect colorMode from brand brief text — prevents Stitch from guessing wrong */
function detectColorMode(designMd) {
  const lower = designMd.toLowerCase();
  // Count dark vs light indicators
  const darkSignals = ['dark background', 'deep black', 'near-black', 'dark surface', 'dark charcoal',
    'dark theme', 'dark aesthetic', 'moody', 'dark, sleek', 'dark and '].filter(s => lower.includes(s)).length;
  const lightSignals = ['light background', 'white background', 'cream background', 'light theme',
    'airy', 'bright background', 'warm pink', 'light, clean', 'light and '].filter(s => lower.includes(s)).length;
  // Also check the explicit Background description for dark terms
  const bgSection = lower.match(/background[:\s]+(.*?)(?:\n|$)/);
  if (bgSection && /deep|black|dark|charcoal|midnight/.test(bgSection[1])) return 'DARK';
  if (bgSection && /white|cream|light|bright|pale/.test(bgSection[1])) return 'LIGHT';
  if (darkSignals > lightSignals) return 'DARK';
  if (lightSignals > darkSignals) return 'LIGHT';
  // Default: check if gradient-based (typically light)
  if (lower.includes('gradient') && !lower.includes('dark')) return 'LIGHT';
  return 'LIGHT'; // safe default
}

function buildStitchPrompt(designMd, representativeCourse) {
  const colorMode = detectColorMode(designMd);
  return `You are designing a complete, premium e-learning course page.

IMPORTANT: This design MUST use a ${colorMode} color mode. ${colorMode === 'DARK' ? 'Use dark backgrounds (near-black, dark charcoal) with light text.' : 'Use light backgrounds (white, cream, light gray) with dark text.'}

=== DESIGN SYSTEM BRIEF ===

${designMd}

=== COURSE CONTENT TO DESIGN ===

${representativeCourse}

=== CRITICAL REQUIREMENTS ===

1. Platform: Web Desktop (responsive — must also work on mobile)
2. Single deep-scroll page with flowing sections, smooth transitions, and visual rhythm
3. EVERY component MUST be wrapped in a container with data-component-type="typename" attribute
4. Interactive elements MUST include these exact data attributes for JavaScript hydration:
   - Quizzes: data-quiz on container, data-correct="N" (zero-indexed), data-choice on each option
   - Accordions: Native <details><summary> HTML elements
   - Tabs: data-tabs on container, data-tab-trigger on buttons, data-tab-panel on panels
   - Flashcards: data-flashcard on card container
   - Checklists: data-checklist on container, native <input type="checkbox">
   - Carousels: data-carousel on container, data-slide on slides, data-prev/data-next on nav
   - Text inputs: Native <form> with <input> elements
5. Use Google Material Symbols for icons: <span class="material-symbols-outlined">icon_name</span>
6. Design this to feel like a $50,000 custom-built learning platform — not a template
7. The design must be unmistakably on-brand using the colour palette and typography above
8. Include a fixed navigation bar, section transitions, and a footer`;
}

// ─── Extract component patterns from Stitch HTML ─────────────────────

function extractComponentPatterns(html) {
  const patterns = {};

  // Match all data-component-type containers
  // Strategy: find each opening tag with data-component-type, then extract
  // the complete element including all children
  const componentTypes = [
    'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
    'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
    'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
    'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
    'image-gallery', 'full-bleed', 'video-transcript',
  ];

  for (const type of componentTypes) {
    // Find the data-component-type attribute in the HTML
    const marker = `data-component-type="${type}"`;
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) continue;

    // Walk back to find the opening tag
    let tagStart = startIdx;
    while (tagStart > 0 && html[tagStart] !== '<') tagStart--;

    // Determine the tag name
    const tagMatch = html.substring(tagStart).match(/^<(\w+)/);
    if (!tagMatch) continue;
    const tagName = tagMatch[1];

    // Find the matching closing tag by counting nesting depth
    let depth = 0;
    let pos = tagStart;
    let foundEnd = false;

    while (pos < html.length) {
      const nextOpen = html.indexOf(`<${tagName}`, pos + 1);
      const nextClose = html.indexOf(`</${tagName}>`, pos + 1);

      if (nextClose === -1) break; // malformed HTML

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Another opening tag of same type before closing
        depth++;
        pos = nextOpen;
      } else {
        if (depth === 0) {
          // This is our matching close tag
          const endIdx = nextClose + `</${tagName}>`.length;
          patterns[type] = html.substring(tagStart, endIdx);
          foundEnd = true;
          break;
        } else {
          depth--;
          pos = nextClose;
        }
      }
    }

    if (!foundEnd) {
      // Try self-closing or single-line pattern as fallback
      const selfClose = html.substring(tagStart).match(new RegExp(`^<${tagName}[^>]*\\/>`));
      if (selfClose) {
        patterns[type] = selfClose[0];
      }
    }
  }

  return patterns;
}

// ─── Extract design tokens from Stitch HTML ──────────────────────────

function extractDesignTokens(html) {
  const tokens = {
    colors: {},
    fonts: {},
    borderRadius: {},
    spacing: {},
    tailwindConfig: null,
  };

  // Extract Tailwind config — find the script block containing tailwind.config
  const configScriptMatch = html.match(/<script[^>]*id="tailwind-config"[^>]*>([\s\S]*?)<\/script>/i) ||
                            html.match(/tailwind\.config\s*=\s*([\s\S]*?)\s*<\/script>/);
  if (configScriptMatch) {
    const configText = configScriptMatch[1];
    tokens.tailwindConfig = configText;

    // Parse ALL color tokens using a simple regex on key-value pairs
    // This works regardless of nesting depth
    for (const cm of configText.matchAll(/"([\w-]+)"\s*:\s*"(#[0-9a-fA-F]{3,8})"/g)) {
      tokens.colors[cm[1]] = cm[2];
    }

    // Fonts
    for (const fm of configText.matchAll(/"(headline|body|label|display|title)"\s*:\s*\["([^"]+)"/g)) {
      tokens.fonts[fm[1]] = fm[2];
    }

    // Border radius
    const radiusMatch = configText.match(/"borderRadius"\s*:\s*\{([^}]+)\}/);
    if (radiusMatch) {
      for (const rm of radiusMatch[1].matchAll(/"(\w+)"\s*:\s*"([^"]+)"/g)) {
        tokens.borderRadius[rm[1]] = rm[2];
      }
    }
  }

  // Extract background color for theme detection
  if (tokens.colors.background) {
    tokens.isDark = isColorDark(tokens.colors.background);
  } else {
    const bgMatch = html.match(/"background"\s*:\s*"(#[0-9a-fA-F]{3,8})"/);
    if (bgMatch) tokens.isDark = isColorDark(bgMatch[1]);
  }

  return tokens;
}

function isColorDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.4;
}

// ─── Extract page shell ──────────────────────────────────────────────

function extractPageShell(html) {
  const shell = { head: '', nav: '', footer: '', trailingStyles: '' };

  // Head content
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) shell.head = headMatch[1];

  // Nav — look for <nav> or <header> element
  const navMatch = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/i) ||
                   html.match(/<header[^>]*>[\s\S]*?<\/header>/i);
  if (navMatch) shell.nav = navMatch[0];

  // Footer
  const footerMatch = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/i);
  if (footerMatch) shell.footer = footerMatch[0];

  // Trailing styles (perspective, backface, etc.)
  const afterMain = html.split('</main>')[1] || html.split('</body>')[0]?.split('</footer>')[1] || '';
  const trailingStyles = [];
  for (const m of afterMain.matchAll(/<style>([\s\S]*?)<\/style>/gi)) {
    trailingStyles.push(m[1]);
  }
  if (trailingStyles.length > 0) {
    shell.trailingStyles = `<style>\n${trailingStyles.join('\n')}\n</style>`;
  }

  return shell;
}

// ─── Retry prompt for missing components ─────────────────────────────

function buildRetryPrompt(designMd, missingTypes) {
  const componentDescriptions = {
    'hero': 'Hero section with full-viewport background image, large title, subtitle, and CTA button',
    'text': 'Text section with heading and body paragraphs',
    'graphic': 'Full-width image with optional caption',
    'graphic-text': 'Side-by-side layout: text content on one side, image on the other',
    'accordion': 'Expandable panels using native <details><summary> elements',
    'mcq': 'Multiple choice quiz with radio-style options, data-quiz container, data-choice on each option, data-correct attribute',
    'narrative': 'Carousel/slideshow with prev/next buttons, data-carousel container, data-slide on each slide, data-prev/data-next buttons',
    'bento': 'Multi-card grid layout with mixed card sizes (one large, several small)',
    'data-table': 'Data table with thead and tbody, styled headers',
    'media': 'Video player placeholder with play button overlay',
    'textinput': 'Form with labeled text inputs and submit button',
    'branching': 'Selection cards — clickable option cards with title and description',
    'timeline': 'Numbered sequential steps with connecting line and dots',
    'comparison': 'Side-by-side or multi-column comparison table',
    'stat-callout': 'Large stat numbers with labels in a grid',
    'pullquote': 'Emphasized quote text with decorative accent',
    'key-term': 'Vocabulary term cards with term and definition',
    'checklist': 'Checkable items with checkboxes, data-checklist container, native input checkboxes',
    'tabs': 'Tabbed content panels, data-tabs container, data-tab-trigger buttons, data-tab-panel panels',
    'flashcard': 'Flip cards with front/back, data-flashcard on each card, 3D CSS transform',
    'labeled-image': 'Image with positioned hotspot markers/labels',
    'process-flow': 'Connected workflow nodes with arrows between them',
    'image-gallery': 'Grid of images',
    'full-bleed': 'Edge-to-edge background image with text overlay',
    'video-transcript': 'Video area with expandable transcript below using <details>',
  };

  const componentList = missingTypes.map(type => {
    const desc = componentDescriptions[type] || type;
    return `### ${type}\n${desc}\nWrap in: <section data-component-type="${type}">`;
  }).join('\n\n');

  return `You are designing additional components for an existing e-learning course page.

=== DESIGN SYSTEM BRIEF ===

${designMd}

=== COMPONENTS TO DESIGN ===

Design ONLY these ${missingTypes.length} component types. Each must be wrapped with the exact data-component-type attribute shown.

${componentList}

=== REQUIREMENTS ===

1. Use the SAME design language as the main page — same colours, fonts, spacing, glass effects
2. Each component MUST have data-component-type="typename" on its wrapper
3. Include interactive data attributes: data-quiz, data-choice, data-correct, data-tabs, data-tab-trigger, data-tab-panel, data-flashcard, data-checklist, data-carousel, data-slide, data-prev, data-next
4. Use Google Material Symbols: <span class="material-symbols-outlined">icon_name</span>
5. Use example content — this is a design template, not real content`;
}

// ─── Fallback patterns (semantic token classes, work with any Stitch Tailwind config) ──

function getFallbackPattern(type) {
  const fallbacks = {
    'hero': `<section class="relative min-h-[80vh] flex items-center justify-center overflow-hidden px-8" data-component-type="hero">
<div class="absolute inset-0 z-0"><div class="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background"></div></div>
<div class="relative z-10 text-center max-w-4xl">
<h1 class="font-headline text-6xl md:text-8xl font-extrabold tracking-tighter mb-6 text-on-background">Title</h1>
<p class="text-xl md:text-2xl text-on-surface-variant mb-12 max-w-2xl mx-auto leading-relaxed">Subtitle text</p>
<button class="bg-primary text-on-primary px-10 py-5 rounded-full font-headline font-bold text-lg shadow-xl">Begin Course</button>
</div></section>`,

    'text': `<section class="py-24 px-8 max-w-4xl mx-auto" data-component-type="text">
<h2 class="font-headline text-4xl font-bold mb-8">Section Title</h2>
<div class="space-y-6 text-lg text-on-surface-variant leading-relaxed"><p>Body text</p></div>
</section>`,

    'graphic': `<section class="py-16 px-8 max-w-7xl mx-auto" data-component-type="graphic">
<h2 class="font-headline text-3xl font-bold mb-8 text-center">Image Title</h2>
<img class="w-full rounded-3xl" src="" alt=""/>
</section>`,

    'graphic-text': `<section class="py-32 px-8 max-w-7xl mx-auto grid md:grid-cols-2 gap-20 items-center" data-component-type="graphic-text">
<div>
<h2 class="font-headline text-4xl font-bold mb-8">Title</h2>
<p class="text-lg text-on-surface-variant leading-relaxed mb-6">Body text</p>
</div>
<div class="bg-surface-container rounded-3xl p-8"><img class="rounded-2xl w-full" src="" alt=""/></div>
</section>`,

    'accordion': `<section class="py-24 px-8 max-w-4xl mx-auto" data-component-type="accordion">
<h3 class="font-headline text-2xl font-bold mb-12 text-center">Accordion Title</h3>
<div class="space-y-4">
<details class="group bg-surface-container rounded-2xl p-6"><summary class="flex justify-between items-center cursor-pointer font-headline font-bold text-lg">Item 1<span class="material-symbols-outlined group-open:rotate-180 transition-transform">expand_more</span></summary><div class="mt-4 text-on-surface-variant leading-relaxed">Content</div></details>
</div></section>`,

    'mcq': `<section class="py-32 px-8 max-w-3xl mx-auto" data-component-type="mcq" data-quiz data-correct="0">
<div class="bg-surface-container p-12 rounded-[2rem]">
<div class="text-secondary font-bold text-sm mb-4">KNOWLEDGE CHECK</div>
<h3 class="font-headline text-2xl font-bold mb-8">Question text</h3>
<div class="space-y-4">
<div class="flex items-center p-5 rounded-xl bg-surface-variant/30 hover:bg-surface-variant cursor-pointer transition-all border border-transparent hover:border-secondary/30" data-choice="0"><div class="w-6 h-6 rounded-full border-2 border-outline-variant mr-4"></div><span>Choice A</span></div>
<div class="flex items-center p-5 rounded-xl bg-surface-variant/30 hover:bg-surface-variant cursor-pointer transition-all border border-transparent hover:border-secondary/30" data-choice="1"><div class="w-6 h-6 rounded-full border-2 border-outline-variant mr-4"></div><span>Choice B</span></div>
</div>
<div class="mt-8 hidden" data-quiz-feedback></div>
</div></section>`,

    'narrative': `<section class="py-32 px-8 max-w-5xl mx-auto" data-component-type="narrative" data-carousel>
<h2 class="font-headline text-3xl font-bold mb-12">Carousel Title</h2>
<div class="bg-surface-container rounded-3xl p-12 relative">
<div data-slide="1"><div class="text-secondary font-bold mb-4">01 / 03</div><h4 class="font-headline text-2xl font-bold mb-4">Slide Title</h4><p class="text-on-surface-variant">Slide content</p></div>
<div class="flex gap-4 mt-8">
<button class="w-12 h-12 rounded-full border border-outline-variant flex items-center justify-center" data-prev><span class="material-symbols-outlined">chevron_left</span></button>
<button class="w-12 h-12 rounded-full bg-secondary text-on-secondary flex items-center justify-center" data-next><span class="material-symbols-outlined">chevron_right</span></button>
</div></div></section>`,

    'bento': `<section class="py-32 px-8 max-w-7xl mx-auto" data-component-type="bento">
<h2 class="font-headline text-4xl font-bold mb-16">Bento Title</h2>
<div class="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-6">
<div class="md:col-span-2 md:row-span-2 bg-surface-container rounded-3xl p-8 flex flex-col justify-end"><span class="material-symbols-outlined text-secondary text-4xl mb-4">bolt</span><h4 class="font-headline text-2xl font-bold mb-2">Card Title</h4><p class="text-on-surface-variant">Description</p></div>
<div class="md:col-span-2 bg-surface-container rounded-3xl p-8 flex items-center gap-8"><div class="bg-secondary-container p-4 rounded-2xl"><span class="material-symbols-outlined text-secondary text-4xl">speed</span></div><div><h4 class="font-headline text-xl font-bold mb-1">Card Title</h4><p class="text-on-surface-variant">Description</p></div></div>
<div class="bg-surface-container rounded-3xl p-8"><span class="material-symbols-outlined text-secondary text-3xl mb-4">shield</span><h4 class="font-headline text-lg font-bold mb-1">Card</h4><p class="text-sm text-on-surface-variant">Description</p></div>
<div class="bg-surface-container rounded-3xl p-8"><span class="material-symbols-outlined text-secondary text-3xl mb-4">memory</span><h4 class="font-headline text-lg font-bold mb-1">Card</h4><p class="text-sm text-on-surface-variant">Description</p></div>
</div></section>`,

    'data-table': `<section class="py-24 px-8 max-w-6xl mx-auto" data-component-type="data-table">
<h2 class="font-headline text-3xl font-bold mb-12">Table Title</h2>
<div class="overflow-x-auto bg-surface-container rounded-3xl">
<table class="w-full text-left"><thead class="bg-surface-container-high border-b border-outline-variant"><tr><th class="p-6 font-headline font-bold">Header</th></tr></thead>
<tbody class="divide-y divide-outline-variant/30"><tr><td class="p-6">Data</td></tr></tbody></table>
</div></section>`,

    'media': `<section class="py-24 px-8 max-w-5xl mx-auto" data-component-type="media">
<div class="relative bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center">
<span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span>
</div></section>`,

    'textinput': `<section class="py-24 px-8 bg-surface-container-low" data-component-type="textinput">
<div class="max-w-3xl mx-auto bg-surface-container p-12 rounded-[2rem]">
<h2 class="font-headline text-3xl font-bold mb-8">Form Title</h2>
<div class="space-y-8">
<div><label class="block text-sm font-bold text-on-surface-variant mb-3 uppercase tracking-wider">Label</label><input class="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50" placeholder="" type="text"/></div>
<button class="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold w-full">Submit</button>
</div></div></section>`,

    'branching': `<section class="py-32 px-8 max-w-4xl mx-auto" data-component-type="branching">
<div class="bg-surface-container p-12 rounded-3xl border-l-8 border-secondary">
<h3 class="font-headline text-2xl font-bold mb-6">Choose a Path</h3>
<p class="text-lg text-on-surface-variant mb-10 italic">Select an option</p>
<div class="grid gap-4">
<button class="p-6 rounded-2xl bg-surface-variant/30 text-left hover:bg-surface-variant transition-all border border-transparent hover:border-secondary/30"><div class="font-bold mb-1">Option A</div><div class="text-sm text-on-surface-variant">Description</div></button>
</div></div></section>`,

    'timeline': `<section class="py-32 px-8 max-w-4xl mx-auto" data-component-type="timeline">
<h2 class="font-headline text-4xl font-bold mb-20 text-center">Timeline Title</h2>
<div class="relative border-l-2 border-outline-variant ml-4 space-y-16">
<div class="relative pl-12"><div class="absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-secondary"></div><div class="font-headline text-xl font-bold text-secondary mb-2">01. Step Title</div><p class="text-on-surface-variant">Step content</p></div>
</div></section>`,

    'comparison': `<section class="py-24 px-8 max-w-6xl mx-auto" data-component-type="comparison">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">Comparison Title</h2>
<div class="overflow-x-auto bg-surface-container rounded-3xl">
<table class="w-full text-left"><thead class="bg-surface-container-high border-b border-outline-variant"><tr><th class="p-6 font-headline font-bold">Feature</th><th class="p-6 font-headline font-bold">Option A</th><th class="p-6 font-headline font-bold">Option B</th></tr></thead>
<tbody class="divide-y divide-outline-variant/30"><tr><td class="p-6">Item</td><td class="p-6">✓</td><td class="p-6">—</td></tr></tbody></table>
</div></section>`,

    'stat-callout': `<section class="py-24 px-8 bg-surface-container-low" data-component-type="stat-callout">
<div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-center">
<div class="space-y-2"><div class="text-5xl font-headline font-extrabold text-secondary">99%</div><p class="text-on-surface-variant text-sm uppercase tracking-widest font-bold">Stat Label</p></div>
</div></section>`,

    'pullquote': `<section class="py-24 px-8 max-w-4xl mx-auto" data-component-type="pullquote">
<blockquote class="border-l-4 border-secondary pl-8"><p class="text-2xl italic text-on-surface leading-relaxed">Quote text here</p></blockquote>
</section>`,

    'key-term': `<section class="py-24 px-8 max-w-6xl mx-auto" data-component-type="key-term">
<h2 class="font-headline text-3xl font-bold mb-16">Key Terms</h2>
<div class="grid md:grid-cols-3 gap-8">
<div class="bg-surface-container p-8 rounded-2xl"><div class="text-secondary font-headline font-bold text-xl mb-3">Term</div><p class="text-on-surface-variant text-sm">Definition</p></div>
</div></section>`,

    'checklist': `<section class="py-24 px-8 max-w-3xl mx-auto" data-component-type="checklist">
<div class="bg-surface-container p-12 rounded-3xl" data-checklist>
<h2 class="font-headline text-2xl font-bold mb-8">Checklist Title</h2>
<div class="space-y-4">
<label class="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-variant/50 cursor-pointer"><input class="w-6 h-6 rounded border-outline-variant text-secondary" type="checkbox"/><span class="text-on-surface-variant">Item</span></label>
</div></div></section>`,

    'tabs': `<section class="py-32 px-8 bg-surface-container-low" data-component-type="tabs">
<div class="max-w-5xl mx-auto">
<h2 class="font-headline text-4xl font-bold mb-16 text-center">Tabs Title</h2>
<div class="flex flex-wrap justify-center gap-4 mb-12" data-tabs>
<button class="px-8 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm uppercase tracking-wider" data-tab-trigger="0">Tab 1</button>
<button class="px-8 py-3 rounded-full bg-surface-container hover:bg-surface-variant text-on-surface-variant font-bold text-sm uppercase tracking-wider" data-tab-trigger="1">Tab 2</button>
</div>
<div class="bg-surface-container rounded-3xl p-12 min-h-[300px]" data-tab-panel="0"><h4 class="font-headline text-2xl font-bold mb-4">Tab Title</h4><div class="text-on-surface-variant leading-relaxed">Tab content</div></div>
<div class="bg-surface-container rounded-3xl p-12 min-h-[300px]" data-tab-panel="1" style="display:none"><h4 class="font-headline text-2xl font-bold mb-4">Tab Title</h4><div class="text-on-surface-variant leading-relaxed">Tab content</div></div>
</div></section>`,

    'flashcard': `<section class="py-24 px-8 bg-surface-container-low overflow-hidden" data-component-type="flashcard">
<div class="max-w-7xl mx-auto">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">Flashcards</h2>
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
<div class="perspective-1000 h-64 group cursor-pointer" data-flashcard>
<div class="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]">
<div class="absolute inset-0 flex items-center justify-center p-8 bg-surface-container rounded-3xl [backface-visibility:hidden]"><div class="text-center"><div class="material-symbols-outlined text-secondary text-4xl mb-4">info</div><div class="font-headline font-bold text-xl">Front</div></div></div>
<div class="absolute inset-0 flex items-center justify-center p-8 bg-secondary-container rounded-3xl [backface-visibility:hidden] [transform:rotateY(180deg)] text-center"><p class="text-on-secondary-container font-medium">Back</p></div>
</div></div>
</div></div></section>`,

    'labeled-image': `<section class="py-24 px-8 max-w-5xl mx-auto" data-component-type="labeled-image">
<h2 class="font-headline text-3xl font-bold mb-12">Labeled Image</h2>
<div class="relative bg-surface-container rounded-3xl overflow-hidden"><img class="w-full rounded-3xl" src="" alt=""/></div>
</section>`,

    'process-flow': `<section class="py-24 px-8 bg-surface-container-low" data-component-type="process-flow">
<div class="max-w-6xl mx-auto">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">Process Flow</h2>
<div class="flex flex-col md:flex-row items-center justify-center gap-8">
<div class="bg-surface-container px-8 py-6 rounded-2xl text-center w-full max-w-xs"><div class="font-headline font-bold">Step 1</div></div>
<span class="material-symbols-outlined text-outline-variant">arrow_forward</span>
<div class="bg-surface-container px-8 py-6 rounded-2xl text-center w-full max-w-xs"><div class="font-headline font-bold">Step 2</div></div>
</div></div></section>`,

    'image-gallery': `<section class="py-24 px-8 max-w-7xl mx-auto" data-component-type="image-gallery">
<h2 class="font-headline text-3xl font-bold mb-12">Gallery</h2>
<div class="grid grid-cols-2 md:grid-cols-3 gap-6">
<div class="bg-surface-container rounded-2xl aspect-square flex items-center justify-center"><span class="material-symbols-outlined text-4xl text-on-surface-variant">image</span></div>
</div></section>`,

    'full-bleed': `<section class="relative min-h-[60vh] flex items-end overflow-hidden" data-component-type="full-bleed">
<div class="absolute inset-0 z-0"><div class="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div></div>
<div class="relative z-10 p-16 max-w-4xl">
<h2 class="font-headline text-5xl font-bold mb-6">Title</h2>
<p class="text-xl text-on-surface-variant leading-relaxed">Body text</p>
</div></section>`,

    'video-transcript': `<section class="py-24 px-8 max-w-5xl mx-auto" data-component-type="video-transcript">
<div class="bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center mb-6"><span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span></div>
<details class="bg-surface-container-low rounded-2xl"><summary class="p-6 cursor-pointer font-bold flex justify-between items-center"><span>Transcript</span><span class="material-symbols-outlined">expand_more</span></summary><div class="p-8 text-on-surface-variant">Transcript content</div></details>
</section>`,
  };

  return fallbacks[type] || fallbacks['text'].replace('data-component-type="text"', `data-component-type="${type}"`);
}

// ─── Main ────────────────────────────────────────────────────────────

// Read inputs
const designMdPath = join(ROOT, 'v5/output/brand-design.md');
const repCoursePath = join(ROOT, 'v5/prompts/representative-course.md');

if (!existsSync(designMdPath)) {
  console.error('ERROR: brand-design.md not found. Run scrape-brand.js first.');
  process.exit(1);
}
if (!existsSync(repCoursePath)) {
  console.error('ERROR: representative-course.md not found.');
  process.exit(1);
}

const designMd = readFileSync(designMdPath, 'utf8');
const representativeCourse = readFileSync(repCoursePath, 'utf8');

console.log('=== V5 STITCH COMPONENT KIT GENERATOR ===\n');
console.log(`Design brief: ${designMd.length} chars`);
console.log(`Representative course: ${representativeCourse.length} chars`);

const prompt = buildStitchPrompt(designMd, representativeCourse);
console.log(`Total prompt: ${prompt.length} chars\n`);

// Save prompt for reference
writeFileSync(join(OUTPUT_DIR, 'stitch-course-prompt.txt'), prompt);

console.log('─── Calling Stitch with GEMINI_3_1_PRO (Deep Think — may take 3-5 minutes)... ───\n');

const client = new StitchToolClient({ apiKey: API_KEY, timeout: 600000 });

const project = await client.callTool('create_project', {
  title: 'Brand Component Kit — V5',
});
const projectId = project.name?.replace('projects/', '') || project.projectId;
console.log(`Project created: ${projectId}`);

const result = await client.callTool('generate_screen_from_text', {
  projectId,
  prompt,
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_1_PRO',
});

// Save raw API response
writeFileSync(join(OUTPUT_DIR, 'stitch-course-meta.json'), JSON.stringify(result, null, 2));
console.log('Saved: stitch-course-meta.json');

// Download HTML + screenshot
let htmlContent = '';
let htmlSaved = false;
let screenshotSaved = false;

if (result.outputComponents) {
  for (const comp of result.outputComponents) {
    if (comp.design?.screens) {
      for (const screen of comp.design.screens) {
        if (screen.htmlCode?.downloadUrl && !htmlSaved) {
          console.log('Downloading HTML...');
          const resp = await fetch(screen.htmlCode.downloadUrl);
          htmlContent = await resp.text();
          writeFileSync(join(OUTPUT_DIR, 'stitch-course-raw.html'), htmlContent);
          console.log(`Saved: stitch-course-raw.html (${htmlContent.length} chars)`);
          htmlSaved = true;
        }
        if (screen.screenshot?.downloadUrl && !screenshotSaved) {
          console.log('Downloading screenshot...');
          const resp = await fetch(screen.screenshot.downloadUrl);
          const buf = Buffer.from(await resp.arrayBuffer());
          writeFileSync(join(OUTPUT_DIR, 'stitch-course-screenshot.png'), buf);
          console.log(`Saved: stitch-course-screenshot.png (${buf.length} bytes)`);
          screenshotSaved = true;
        }
      }
    }
  }
}

if (!htmlSaved) {
  console.error('ERROR: No HTML found in Stitch response');
  console.log('Response keys:', Object.keys(result || {}));
  process.exit(1);
}

// ─── Extract component patterns ──────────────────────────────────────

console.log('\n─── Extracting component patterns... ───\n');

const patterns = extractComponentPatterns(htmlContent);
const patternTypes = Object.keys(patterns);

// Save each pattern as individual HTML file
mkdirSync(PATTERNS_DIR, { recursive: true });
for (const [type, html] of Object.entries(patterns)) {
  writeFileSync(join(PATTERNS_DIR, `${type}.html`), html);
}

console.log(`Extracted ${patternTypes.length}/25 component patterns:`);
console.log(`  Found: ${patternTypes.join(', ')}`);

const missing = [
  'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
  'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
  'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
  'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
  'image-gallery', 'full-bleed', 'video-transcript',
].filter(t => !patternTypes.includes(t));

if (missing.length > 0) {
  console.log(`  Missing: ${missing.join(', ')}`);
}

// ─── Extract design tokens ───────────────────────────────────────────

console.log('\n─── Extracting design tokens... ───\n');

const tokens = extractDesignTokens(htmlContent);
writeFileSync(join(OUTPUT_DIR, 'design-tokens.json'), JSON.stringify(tokens, null, 2));
console.log(`Saved: design-tokens.json`);
console.log(`  Colors: ${Object.keys(tokens.colors).length} tokens`);
console.log(`  Fonts: ${Object.keys(tokens.fonts).length} families`);
console.log(`  Border radius: ${Object.keys(tokens.borderRadius).length} values`);
console.log(`  Theme: ${tokens.isDark ? 'dark' : 'light'}`);

// ─── Extract page shell ──────────────────────────────────────────────

console.log('\n─── Extracting page shell... ───\n');

const shell = extractPageShell(htmlContent);
writeFileSync(join(PATTERNS_DIR, '_page-shell.json'), JSON.stringify(shell, null, 2));
console.log(`Saved: component-patterns/_page-shell.json`);
console.log(`  Head: ${shell.head.length} chars`);
console.log(`  Nav: ${shell.nav.length} chars`);
console.log(`  Footer: ${shell.footer.length} chars`);

// ─── Retry for missing patterns ─────────────────────────────────────

if (missing.length > 0) {
  console.log(`\n─── Retrying for ${missing.length} missing component types... ───\n`);

  const retryPrompt = buildRetryPrompt(designMd, missing);
  console.log(`Retry prompt: ${retryPrompt.length} chars`);

  try {
    const retryProject = await client.callTool('create_project', {
      title: 'Brand Component Kit — V5 (retry)',
    });
    const retryProjectId = retryProject.name?.replace('projects/', '') || retryProject.projectId;

    const retryResult = await client.callTool('generate_screen_from_text', {
      projectId: retryProjectId,
      prompt: retryPrompt,
      deviceType: 'DESKTOP',
      modelId: 'GEMINI_3_1_PRO',
    });

    // Download retry HTML
    let retryHtml = '';
    if (retryResult.outputComponents) {
      for (const comp of retryResult.outputComponents) {
        if (comp.design?.screens) {
          for (const screen of comp.design.screens) {
            if (screen.htmlCode?.downloadUrl && !retryHtml) {
              const resp = await fetch(screen.htmlCode.downloadUrl);
              retryHtml = await resp.text();
            }
          }
        }
      }
    }

    if (retryHtml) {
      const retryPatterns = extractComponentPatterns(retryHtml);
      const retryFound = Object.keys(retryPatterns);
      console.log(`  Retry extracted: ${retryFound.length} patterns (${retryFound.join(', ')})`);

      for (const [type, html] of Object.entries(retryPatterns)) {
        if (!patterns[type]) {
          patterns[type] = html;
          writeFileSync(join(PATTERNS_DIR, `${type}.html`), html);
        }
      }
    }
  } catch (err) {
    console.log(`  Retry failed: ${err.message} — will use fallbacks`);
  }
}

// ─── Fallback patterns for any still-missing types ──────────────────

const ALL_TYPES = [
  'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
  'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
  'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
  'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
  'image-gallery', 'full-bleed', 'video-transcript',
];

const stillMissing = ALL_TYPES.filter(t => !patterns[t]);

if (stillMissing.length > 0) {
  console.log(`\n─── Writing fallback patterns for ${stillMissing.length} types: ${stillMissing.join(', ')} ───\n`);

  for (const type of stillMissing) {
    const fallback = getFallbackPattern(type);
    patterns[type] = fallback;
    writeFileSync(join(PATTERNS_DIR, `${type}.html`), fallback);
  }
}

const finalCount = Object.keys(patterns).length;

// ─── Extract design contract from patterns ───────────────────────────
// This runs extract-contract.js (cheerio-based) to produce design-contract.json
// from the component patterns. build-course.js reads ONLY the contract, never raw HTML.

console.log('\n─── Extracting design contract... ───\n');

const { execSync } = await import('child_process');
try {
  const contractOutput = execSync(`node "${join(__dirname, 'extract-contract.js')}"`, { encoding: 'utf8' });
  console.log(contractOutput);
} catch (err) {
  console.error('WARNING: extract-contract.js failed:', err.message);
  console.log('build-course.js will fail without design-contract.json');
}

console.log('\n=== Stitch Component Kit generation complete ===');
console.log(`\nSummary:`);
console.log(`  Component patterns: ${finalCount}/25 (${finalCount - patternTypes.length} from retry/fallback)`);
console.log(`  Design tokens: ${Object.keys(tokens.colors).length} colors, ${Object.keys(tokens.fonts).length} fonts`);
console.log(`  Page shell: nav + footer extracted`);
console.log(`  Design contract: extracted via cheerio`);
console.log(`  Model: GEMINI_3_1_PRO (Deep Think)`);
