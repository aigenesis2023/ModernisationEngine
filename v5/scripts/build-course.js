#!/usr/bin/env node
/**
 * V5 Course Builder — Stitch Pattern Fill
 *
 * Uses Stitch's actual component patterns (extracted from the designed page)
 * and fills them with real SCORM content. The visual design is 100% Stitch's.
 * The content is 100% from the SCORM.
 *
 * For each component in course-layout.json:
 *   1. Load the matching pattern from component-patterns/
 *   2. Fill it with real content (title, body, items, quiz answers, etc.)
 *   3. Handle interactive data attributes for hydrate.js
 *
 * Layout rules enforced by every fill function:
 *   1. Containment: max-w-6xl mx-auto px-8 — no content touches screen edges
 *   2. Grids/flex: explicit gap-* and min column widths — no collapsed layouts
 *   3. Typography: h2=text-3xl, h3=text-2xl, h4=text-xl — consistent scale
 *
 * Usage: node v5/scripts/build-course.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PATTERNS_DIR = path.resolve(ROOT, 'v5/output/component-patterns');
const SHELL_PATH = path.resolve(PATTERNS_DIR, '_page-shell.json');
const TOKENS_PATH = path.resolve(ROOT, 'v5/output/design-tokens.json');
const LAYOUT_PATH = path.resolve(ROOT, 'v5/output/course-layout.json');
const HYDRATE_PATH = path.resolve(ROOT, 'v5/scripts/hydrate.js');
const OUTPUT_PATH = path.resolve(ROOT, 'v5/output/course.html');
const PAGES_PATH = path.resolve(ROOT, 'index.html');

// ─── HTML helpers ────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripTags(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

function embedImage(imagePath) {
  if (!imagePath) return '';
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) return imagePath;
  const fullPath = path.resolve(ROOT, 'v5/output', imagePath);
  if (!fs.existsSync(fullPath)) return imagePath;
  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  return `data:${mimeMap[ext] || 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

// ─── Generate <head> from design-tokens.json ─────────────────────────
// CRITICAL: We build our own <head> instead of copying Stitch's raw <head>.
// Stitch controls DESIGN (colours, fonts, shadows). We control LAYOUT.
// This ensures layout is consistent across all brands — only colours/fonts change.
function generateHead(tokens, courseTitle) {
  const colors = tokens.colors || {};
  const fonts = tokens.fonts || {};
  const isDark = tokens.isDark !== false;

  // Build Tailwind color config from tokens
  const colorEntries = Object.entries(colors)
    .map(([k, v]) => `                        "${k}": "${v}"`)
    .join(',\n');

  // Font families
  const headlineFont = fonts.headline || 'Inter';
  const bodyFont = fonts.body || 'Inter';
  const labelFont = fonts.label || bodyFont;

  // Google Fonts URL — request both font families with useful weights
  const fontFamilies = [...new Set([headlineFont, bodyFont, labelFont])];
  const googleFontsUrl = 'https://fonts.googleapis.com/css2?' +
    fontFamilies.map(f => `family=${f.replace(/ /g, '+')}:wght@300;400;500;600;700`).join('&') +
    '&display=swap';

  // Derive key colours for custom CSS definitions
  const bg = colors['background'] || '#131313';
  const onSurface = colors['on-surface'] || '#e2e2e2';
  const surfaceContainer = colors['surface-container'] || '#1f1f1f';
  const outlineVariant = colors['outline-variant'] || '#474747';
  const primary = colors['primary'] || '#ffffff';
  const primaryContainer = colors['primary-container'] || '#d4d4d4';
  const onPrimaryContainer = colors['on-primary-container'] || '#000000';
  const secondary = colors['secondary'] || '#adc6ff';
  const tertiary = colors['tertiary'] || '#e9ddff';
  const surfaceContainerHigh = colors['surface-container-high'] || '#2a2a2a';

  return `<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>${esc(courseTitle)}</title>

<!-- Tailwind CDN -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Google Fonts -->
<link href="${googleFontsUrl}" rel="stylesheet"/>

<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>

<!-- Tailwind Config — colours + fonts from design-tokens.json -->
<script>
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
${colorEntries}
                },
                fontFamily: {
                    "headline": ["${headlineFont}"],
                    "body": ["${bodyFont}"],
                    "label": ["${labelFont}"]
                },
                borderRadius: {"DEFAULT": "1rem", "lg": "2rem", "xl": "3rem", "full": "9999px"},
            },
        },
    }
</script>

<!-- Custom classes — WE define these, not Stitch -->
<style>
    /* Base */
    body { background-color: ${bg}; color: ${onSurface}; font-family: '${bodyFont}', sans-serif; }
    .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }

    /* Glass card — frosted surface panel */
    .glass-card {
        background: ${surfaceContainer}cc;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid ${outlineVariant}26;
    }

    /* Glass — lighter variant for tables/containers */
    .glass {
        background: ${surfaceContainer}99;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    /* Glass nav */
    .glass-nav {
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border-bottom: 1px solid ${outlineVariant}26;
    }

    /* Text gradient — brand gradient on text */
    .text-gradient {
        background: linear-gradient(135deg, ${primary}, ${secondary}, ${tertiary});
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    /* Primary button */
    .btn-primary {
        background: ${primaryContainer};
        color: ${onPrimaryContainer};
        transition: opacity 0.2s, transform 0.2s;
    }
    .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }

    /* Scroll progress bar */
    #scroll-progress {
        position: fixed; top: 0; left: 0; height: 3px; z-index: 9999;
        background: linear-gradient(90deg, ${secondary}, ${primary});
        transition: width 0.1s;
    }

    /* Utility: hide details marker */
    details summary::-webkit-details-marker { display: none; }

    /* Custom scrollbar */
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: ${colors['surface-container-lowest'] || '#0e0e0e'}; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: ${colors['surface-variant'] || '#353535'}; border-radius: 10px; }

    /* Layout: smooth scroll */
    html { scroll-behavior: smooth; }

    /* Layout: containment safety net */
    img, video, iframe { max-width: 100%; }
</style>`;
}

// ─── Load patterns ───────────────────────────────────────────────────
function loadPattern(type) {
  const p = path.resolve(PATTERNS_DIR, `${type}.html`);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  return null;
}

function loadPageShell() {
  if (fs.existsSync(SHELL_PATH)) return JSON.parse(fs.readFileSync(SHELL_PATH, 'utf-8'));
  return null;
}

// ─── Simple DOM-like helpers (no library needed) ─────────────────────
// These do targeted string replacements on the pattern HTML.

/** Replace the text inside the first matching tag */
function replaceFirstTag(html, tag, newContent) {
  const re = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`, 'i');
  return html.replace(re, `$1${newContent}$3`);
}

/** Get all matches of a regex, returning array of { match, index } */
function findAll(html, re) {
  const results = [];
  let m;
  const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = regex.exec(html)) !== null) {
    results.push({ match: m[0], groups: m, index: m.index });
  }
  return results;
}

/** Strip containment classes from a section class string.
 *  Section handles spacing (py-*) and background (bg-*).
 *  Containment (max-w, mx-auto, px-*) goes in an inner div. */
function sectionOnly(cls) {
  return cls
    .replace(/max-w-\S+/g, '')
    .replace(/\bmx-auto\b/g, '')
    .replace(/\bpx-\d+\b/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'py-24';
}

// ─── Stitch Visual Extraction ────────────────────────────────────────
// Extract visual-only classes from Stitch patterns (shadows, hovers,
// transitions, gradients, rings, border colours). NEVER layout classes.
// Stitch controls DESIGN. We control LAYOUT.

/** Merge class strings, filtering empty/null, deduplicating */
function mc(...parts) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Extract the class string from the first element matching a simple selector in HTML */
function getClasses(html, selector) {
  let re;
  if (selector.startsWith('[')) {
    // data attribute selector e.g. [data-quiz]
    const attr = selector.slice(1, -1);
    re = new RegExp(`<[^>]+${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*class="([^"]*)"`, 'i');
    // Also try class before attr
    const re2 = new RegExp(`class="([^"]*)"[^>]*${attr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    return (html.match(re)?.[1] || html.match(re2)?.[1] || '');
  }
  if (selector.includes('[')) {
    // tag[attr] e.g. button[data-choice]
    const [tag, rest] = selector.split('[');
    const attr = rest.replace(']', '');
    re = new RegExp(`<${tag}[^>]*class="([^"]*)"[^>]*${attr}`, 'i');
    const re2 = new RegExp(`<${tag}[^>]*${attr}[^>]*class="([^"]*)"`, 'i');
    return (html.match(re)?.[1] || html.match(re2)?.[1] || '');
  }
  // Simple tag selector
  re = new RegExp(`<${selector}[^>]*class="([^"]*)"`, 'i');
  return (html.match(re)?.[1] || '');
}

/** Extract nth occurrence of a tag's class string */
function getClassesNth(html, tag, n) {
  const re = new RegExp(`<${tag}[^>]*class="([^"]*)"`, 'gi');
  let m, i = 0;
  while ((m = re.exec(html)) !== null) {
    if (i === n) return m[1];
    i++;
  }
  return '';
}

// Visual class patterns that are SAFE to extract (no layout impact)
const VISUAL_RE = /^(shadow-|hover:|group-hover:|transition-?|duration-|ring-|scale-|opacity-|mix-blend-|backdrop-blur|bg-gradient|from-|to-|via-)/;
const VISUAL_BORDER_COLOR_RE = /^border-(primary|secondary|tertiary|outline|error|surface|on-|transparent|white|black)/;
const VISUAL_BG_RE = /^bg-(primary|secondary|tertiary|error|surface|on-|white|black)/;

/** Extract only visual classes from a class string */
function visualOnly(cls) {
  if (!cls) return '';
  return cls.split(/\s+/).filter(c =>
    VISUAL_RE.test(c) || VISUAL_BORDER_COLOR_RE.test(c)
  ).join(' ');
}

/** Extract background colour class from a class string (for card theming) */
function bgOnly(cls) {
  if (!cls) return '';
  return cls.split(/\s+/).filter(c => VISUAL_BG_RE.test(c)).join(' ');
}

/** Extract a full HTML element matching a regex, or return fallback */
function extractElement(html, re) {
  const m = html.match(re);
  return m ? m[0] : '';
}

// ═══════════════════════════════════════════════════════════════════════
// FILL FUNCTIONS — one per component type
// Each takes the Stitch pattern HTML and real content, returns filled HTML
//
// Layout contract:
//   - Section tag: spacing + background only (via sectionOnly())
//   - Inner div: max-w-6xl mx-auto px-8 (containment)
//   - Grids: explicit gap-* + min-w on columns
//   - Headings: h2=text-3xl, h3=text-2xl, h4=text-xl
//
// Visual contract (NEW):
//   - Shadows, hovers, transitions, gradients, rings → extracted from Stitch
//   - Card backgrounds → extracted from Stitch (brand-specific)
//   - Decorative elements → extracted from Stitch where safe
//   - All with safe fallbacks to current hardcoded defaults
// ═══════════════════════════════════════════════════════════════════════

function fillHero(pattern, comp) {
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'relative min-h-screen flex items-center justify-center overflow-hidden';
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  // Extract Stitch visuals
  const overlayDiv = getClassesNth(pattern, 'div', 1); // gradient overlay div
  const overlayGradient = overlayDiv.split(/\s+/).filter(c => /^(bg-gradient|from-|to-|via-)/.test(c)).join(' ')
    || 'bg-gradient-to-t from-surface-dim via-surface-dim/80 to-surface-dim/40';
  const imgVisuals = visualOnly(getClasses(pattern, 'img'));
  const imgClass = mc('w-full h-full object-cover', imgVisuals || 'mix-blend-overlay opacity-40');
  const btn1 = getClassesNth(pattern, 'button', 0);
  const btn1Visual = visualOnly(btn1);
  const btn1Bg = bgOnly(btn1) || 'bg-primary';
  const btn1Gradient = btn1.split(/\s+/).filter(c => /^(bg-gradient|from-|to-|via-)/.test(c)).join(' ');
  const btn1Round = btn1.match(/rounded-\S+/)?.[0] || 'rounded-xl';
  const btn2 = getClassesNth(pattern, 'button', 1);
  const btn2Visual = visualOnly(btn2);
  const btn2Bg = bgOnly(btn2) || '';
  const btn2Round = btn2.match(/rounded-\S+/)?.[0] || 'rounded-xl';

  return `<section class="${sectionClass}" data-component-type="hero">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 ${imgClass}" src="${imgSrc}"/>` : ''}
<div class="absolute inset-0 ${overlayGradient}"></div>
<div class="relative z-10 text-center max-w-6xl mx-auto px-8">
<h1 class="font-headline text-6xl md:text-8xl font-black tracking-tighter mb-8">${title}</h1>
<p class="text-xl text-on-surface-variant max-w-2xl mx-auto mb-12">${bodyText}</p>
<div class="flex gap-4 justify-center flex-wrap">
<button class="px-8 py-4 ${btn1Gradient || btn1Bg} text-on-primary ${btn1Round} font-bold ${btn1Visual}">Begin Course</button>
<button class="px-8 py-4 ${btn2Bg || 'border border-outline-variant'} ${btn2Round} font-bold ${btn2Visual || 'hover:bg-surface-variant transition-colors'}">Explore Modules</button>
</div>
</div>
</section>`;
}

function fillText(pattern, comp) {
  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);

  return `<section class="${secClass}" data-component-type="text">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-8">${title}</h2>
<div class="space-y-6 text-lg text-on-surface-variant leading-relaxed">
${comp.body || ''}
</div>
</div>
</section>`;
}

function fillAccordion(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);

  const detailsClass = pattern.match(/<details[^>]*class="([^"]*)"/)?.[1] || 'group glass-card rounded-2xl p-6 transition-all duration-300';
  const bodyClass = pattern.match(/<div class="(mt-4[^"]*)"/)?.[1] || 'mt-4 text-on-surface-variant leading-relaxed';

  const newDetails = items.map(item =>
    `<details class="${detailsClass}">
<summary class="flex justify-between items-center cursor-pointer font-headline font-bold text-lg">
${esc(item.title || '')}
<span class="material-symbols-outlined group-open:rotate-180 transition-transform">expand_more</span>
</summary>
<div class="${bodyClass}">
${item.body || ''}
</div>
</details>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="accordion">
<div class="max-w-6xl mx-auto px-8">
<h3 class="font-headline text-2xl font-bold mb-12 text-center">${title}</h3>
<div class="space-y-4">
${newDetails}
</div>
</div>
</section>`;
}

function fillMCQ(pattern, comp) {
  const items = comp._items || [];
  const feedback = comp._feedback || {};
  const correctFeedback = stripTags(feedback.correct || 'Correct!');
  const incorrectFeedback = stripTags((feedback._incorrect && feedback._incorrect.final) || 'Not quite. Try again.');

  let correctIdx = items.findIndex(i => i.correct || i._shouldBeSelected);
  if (correctIdx < 0) correctIdx = 0;

  const questionText = stripTags(comp.instruction || comp.body || '');
  const title = esc(comp.displayTitle || 'Knowledge Check');

  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32';
  const secClass = sectionOnly(rawClass);

  // Extract Stitch's quiz card styling
  const quizCardClass = getClasses(pattern, '[data-quiz]');
  const cardBg = bgOnly(quizCardClass) || '';
  const cardVisuals = quizCardClass.split(/\s+/).filter(c => /^(shadow-|border|rounded-)/.test(c)).join(' ');
  const cardClass = mc(
    cardBg || 'glass-card',
    'p-6 md:p-12',
    cardVisuals || 'rounded-[2rem]'
  );

  // Extract label styling
  const labelMatch = pattern.match(/<span[^>]*class="([^"]*font-bold[^"]*tracking[^"]*)"[^>]*>/i)
    || pattern.match(/<span[^>]*class="([^"]*uppercase[^"]*)"[^>]*>/i);
  const labelClass = labelMatch?.[1] || 'text-secondary font-bold text-sm uppercase tracking-widest';

  // Extract Stitch's choice button styling
  const choiceBtnClass = getClasses(pattern, 'button[data-choice]') || getClasses(pattern, '[data-choice]');
  const choiceVisuals = visualOnly(choiceBtnClass);
  const choiceRound = choiceBtnClass.match(/rounded-\S+/)?.[0] || 'rounded-xl';
  // Detect radio icon on hover
  const hasRadioIcon = pattern.includes('radio_button_unchecked');

  const newChoices = items.map((item, i) => {
    const choiceTag = choiceBtnClass.includes('w-full') ? 'button' : 'div';
    return `<${choiceTag} class="${mc(
      choiceTag === 'button' ? 'w-full text-left' : 'group flex items-center cursor-pointer',
      'p-5', choiceRound,
      choiceVisuals || 'bg-surface-container/80 hover:bg-surface-container transition-all border border-outline-variant/20 hover:border-secondary/50',
      hasRadioIcon ? 'flex justify-between items-center group' : ''
    )}" data-choice="${i}">
<span class="text-on-surface">${esc(item.text || '')}</span>
${hasRadioIcon ? '<span class="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">radio_button_unchecked</span>' : ''}
</${choiceTag}>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="mcq" data-quiz data-correct="${correctIdx}" data-feedback-correct="${esc(correctFeedback)}" data-feedback-incorrect="${esc(incorrectFeedback)}">
<div class="max-w-6xl mx-auto px-8">
<div class="${cardClass}">
<span class="${labelClass}">${title}</span>
<h3 class="font-headline text-2xl font-bold mt-2 mb-8">${questionText}</h3>
<div class="space-y-4">
${newChoices}
</div>
<div class="mt-8 hidden" data-quiz-feedback></div>
</div>
</div>
</section>`;
}

function fillGraphicText(pattern, comp, index) {
  const title = esc(comp.displayTitle || '');
  const bodyText = comp.body || '';
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || '';
  const secClass = sectionOnly(rawClass.replace(/grid\b/g, '').replace(/md:grid-cols-\d/g, '').replace(/gap-\d+/g, '')) || 'py-24';
  const align = comp._imageAlign || (index % 2 === 0 ? 'right' : 'left');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  // Extract Stitch's image glow wrapper (absolute gradient blur behind image)
  const glowMatch = pattern.match(/<div[^>]*class="(absolute[^"]*blur[^"]*)"[^>]*>/i);
  const glowClass = glowMatch?.[1] || '';
  // Extract image container shadow
  const imgContainerMatch = pattern.match(/<div[^>]*class="(relative[^"]*shadow[^"]*)"[^>]*>/i);
  const imgShadow = imgContainerMatch?.[1]?.split(/\s+/).filter(c => /^shadow-/.test(c)).join(' ') || '';

  const imageDiv = `<div class="w-full md:w-1/2 min-w-[280px] flex-shrink-0${align === 'left' ? ' order-2 md:order-1' : ''}">
<div class="relative group">
${glowClass ? `<div class="${glowClass}"></div>` : ''}
<div class="relative rounded-2xl overflow-hidden aspect-[4/3] ${imgShadow}">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-full object-cover rounded-2xl" src="${imgSrc}"/>` : '<div class="w-full h-full bg-surface-container rounded-2xl"></div>'}
</div>
</div>
</div>`;

  const textDiv = `<div class="w-full md:w-1/2 min-w-[280px] flex-shrink-0${align === 'left' ? ' order-1 md:order-2' : ''} flex flex-col justify-center">
<h2 class="font-headline text-3xl font-bold tracking-tight mb-6 leading-tight">${title}</h2>
<div class="text-lg text-on-surface-variant leading-relaxed space-y-4">${bodyText}</div>
</div>`;

  return `<section class="${secClass}" data-component-type="graphic-text">
<div class="max-w-6xl mx-auto px-8">
<div class="flex flex-col md:flex-row gap-12 items-center">
${align === 'left' ? imageDiv + textDiv : textDiv + imageDiv}
</div>
</div>
</section>`;
}

function fillBento(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32';
  const secClass = sectionOnly(rawClass);

  const icons = ['bolt', 'speed', 'shield', 'memory', 'hub', 'star', 'lightbulb', 'science'];

  // Extract per-card backgrounds from Stitch pattern (brand-specific colour variety)
  const cardDivs = findAll(pattern, /<div[^>]*class="([^"]*(?:col-span|row-span)[^"]*)"[^>]*>/gi);
  const cardBgs = cardDivs.map(m => bgOnly(m.groups[1]));
  // Extract image hover from Stitch
  const imgHover = pattern.includes('group-hover:scale') ? 'group-hover:scale-105 transition-transform duration-700' : 'group-hover:scale-110 transition-transform duration-700';

  const newCards = items.map((item, i) => {
    if (i === 0) {
      const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
      const bg0 = cardBgs[0] || 'glass-card';
      return `<div class="md:col-span-2 md:row-span-2 ${bg0} rounded-3xl p-8 flex flex-col justify-end relative overflow-hidden group min-h-[200px]">
${imgSrc ? `<img alt="" class="absolute inset-0 w-full h-full object-cover opacity-20 ${imgHover}" src="${imgSrc}"/>` : ''}
<div class="relative z-10">
<span class="material-symbols-outlined text-secondary text-4xl mb-4">${icons[0]}</span>
<h4 class="font-headline text-xl font-bold mb-2">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }
    if (i <= 2 && items.length > 3) {
      const bgI = cardBgs[i] || 'glass-card';
      return `<div class="${i === 1 ? 'md:col-span-1' : 'md:col-span-1'} ${bgI} rounded-3xl p-8 flex flex-col justify-between min-h-[100px]">
<span class="material-symbols-outlined text-primary text-4xl mb-4">${icons[i % icons.length]}</span>
<div class="min-w-0">
<h4 class="font-headline text-xl font-bold mb-1">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant text-sm">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }
    const bgN = cardBgs[i] || cardBgs[cardBgs.length - 1] || 'glass-card';
    const bgShadow = cardDivs[i]?.groups[1]?.split(/\s+/).filter(c => /^(shadow-|border)/.test(c)).join(' ') || '';
    return `<div class="${i >= 3 && items.length > 4 ? 'md:col-span-2' : ''} ${bgN} rounded-3xl p-8 flex flex-col justify-center min-h-[100px] ${bgShadow}">
<span class="material-symbols-outlined text-secondary text-3xl mb-4">${icons[i % icons.length]}</span>
<h4 class="font-headline text-xl font-bold mb-1">${esc(item.title || '')}</h4>
<p class="text-sm text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="bento">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-16">${title}</h2>
<div class="grid grid-cols-1 md:grid-cols-4 gap-6 auto-rows-auto">
${newCards}
</div>
</div>
</section>`;
}

function fillDataTable(pattern, comp) {
  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);
  const body = comp.body || '';

  const columns = comp.columns || [];
  const rows = comp.rows || comp._rows || [];

  let headerHtml = '';
  let bodyHtml = '';

  if (columns.length > 0) {
    headerHtml = columns.map(c => `<th class="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">${esc(c.title || '')}</th>`).join('');
    bodyHtml = rows.map(row => {
      const label = row.label || '';
      const vals = row.values || [];
      const cells = vals.map(v => {
        if (v === true || v === 'true') return '<td class="px-8 py-4 text-secondary">&#10003;</td>';
        if (v === false || v === 'false') return '<td class="px-8 py-4 text-error">&#10007;</td>';
        return `<td class="px-8 py-4 text-on-surface-variant">${esc(String(v))}</td>`;
      }).join('');
      return `<tr class="hover:bg-on-surface/5 transition-colors"><td class="px-8 py-4 font-medium">${esc(label)}</td>${cells}</tr>`;
    }).join('\n');
    headerHtml = `<th class="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest"></th>` + headerHtml;
  } else if (rows.length > 0 && Array.isArray(rows[0])) {
    const headers = rows[0];
    headerHtml = headers.map(h => `<th class="px-8 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-widest">${esc(h)}</th>`).join('');
    bodyHtml = rows.slice(1).map(row =>
      `<tr class="hover:bg-on-surface/5 transition-colors">${row.map(cell => `<td class="px-8 py-4">${esc(cell)}</td>`).join('')}</tr>`
    ).join('\n');
  }

  return `<section class="${secClass}" data-component-type="data-table">
<div class="max-w-6xl mx-auto px-8">
${body ? `<div class="mb-8 text-on-surface-variant">${body}</div>` : ''}
<div class="overflow-hidden rounded-xl border border-on-surface/5 glass">
<div class="px-8 py-6 border-b border-on-surface/5">
<h3 class="text-2xl font-bold tracking-tight">${title}</h3>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left border-collapse">
<thead><tr class="bg-on-surface/5">${headerHtml}</tr></thead>
<tbody class="divide-y divide-on-surface/5">${bodyHtml}</tbody>
</table>
</div>
</div>
</div>
</section>`;
}

function fillTextInput(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 bg-surface-container-low';
  const secClass = sectionOnly(rawClass);
  const cardClassRaw2 = pattern.match(/<div[^>]*class="([^"]*glass-card[^"]*)"/)?.[1] || 'glass-card p-12 rounded-[2rem]';
  const cardClass = cardClassRaw2.replace(/\bp-12\b/, 'p-6 md:p-12');
  const inputClass = pattern.match(/<input[^>]*class="([^"]*)"/)?.[1] || 'w-full bg-surface-container-lowest border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50 focus:border-secondary';

  const newInputs = items.map(item =>
    `<div>
<label class="block text-sm font-bold text-on-surface-variant mb-3 uppercase tracking-wider">${esc(item.prefix || item.label || '')}</label>
<input class="${inputClass}" placeholder="${esc(item.placeholder || '')}" type="text"/>
</div>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="textinput">
<div class="max-w-6xl mx-auto px-8">
<div class="${cardClass}">
<h2 class="font-headline text-3xl font-bold mb-8">${title}</h2>
<div class="space-y-8">
${newInputs}
<button class="btn-primary px-8 py-4 rounded-xl font-bold text-on-primary-container w-full">Submit</button>
</div>
</div>
</div>
</section>`;
}

function fillBranching(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32';
  const secClass = sectionOnly(rawClass);

  // Extract Stitch's button styling
  const btnClass = getClasses(pattern, 'button');
  const btnVisuals = visualOnly(btnClass);
  const btnBg = bgOnly(btnClass);
  const btnRound = btnClass.match(/rounded-\S+/)?.[0] || 'rounded-2xl';
  // Detect arrow animation element
  const hasArrow = pattern.includes('group-hover:translate-x');
  const arrowSpanMatch = pattern.match(/<span[^>]*class="([^"]*group-hover:translate[^"]*)"[^>]*>/);
  const arrowClass = arrowSpanMatch?.[1] || 'mt-6 inline-flex items-center gap-2 text-primary font-bold group-hover:translate-x-2 transition-transform';

  const newButtons = items.map(item =>
    `<button class="group p-6 md:p-8 ${btnBg || 'bg-surface-variant/30'} ${btnRound} text-left ${btnVisuals || 'hover:bg-surface-variant transition-all border border-transparent hover:border-secondary/30'}">
<div class="font-bold mb-1">${esc(item.title || '')}</div>
<div class="text-sm text-on-surface-variant">${stripTags(item.body || '')}</div>
${hasArrow ? `<span class="${arrowClass}">Choose <span class="material-symbols-outlined">arrow_forward</span></span>` : ''}
</button>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="branching">
<div class="max-w-6xl mx-auto px-8">
<h3 class="font-headline text-2xl font-bold mb-6 text-center">${title}</h3>
${bodyText ? `<p class="text-lg text-on-surface-variant mb-10 text-center italic">${bodyText}</p>` : ''}
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
${newButtons}
</div>
</div>
</section>`;
}

function fillTimeline(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32';
  const secClass = sectionOnly(rawClass);

  // Detect Stitch's numbered-circle style (w-12 h-12 bg-primary rounded-full with ring)
  const stepDotClass = getClasses(pattern, 'div').match(/w-12[^"]*rounded-full/) ? '' : null;
  const hasNumberedCircles = pattern.includes('ring-') && pattern.includes('rounded-full');

  // Extract the circle styling from Stitch
  const circleMatch = pattern.match(/class="(w-\d+\s+h-\d+\s+[^"]*rounded-full[^"]*)"/);
  const circleClass = circleMatch?.[1] || '';
  const circleVisuals = circleClass.split(/\s+/).filter(c => /^(ring-|shadow-|bg-primary|bg-secondary|text-white|text-on)/.test(c)).join(' ');

  if (hasNumberedCircles && circleClass) {
    // Use Stitch's numbered circle + connector layout
    const connectorClass = pattern.match(/class="(w-0[^"]*bg-outline[^"]*)"/)?.[1] || 'w-0.5 h-full bg-outline-variant/20 mt-4';
    const newSteps = items.map((item, i) => {
      const num = i + 1;
      const isLast = i === items.length - 1;
      return `<div class="flex gap-8">
<div class="flex flex-col items-center">
<div class="${circleClass} flex items-center justify-center font-bold">${num}</div>
${!isLast ? `<div class="${connectorClass}"></div>` : ''}
</div>
<div class="${isLast ? '' : 'pb-12'}">
<h4 class="font-headline text-xl font-bold mb-2">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="timeline">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">${title}</h2>
<div class="space-y-0">
${newSteps}
</div>
</div>
</section>`;
  }

  // Fallback: border-l dot layout (original)
  const activeDotClass = pattern.match(/class="(absolute[^"]*bg-secondary[^"]*)"/)?.[1] || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-secondary shadow-[0_0_10px_rgba(37,216,252,0.5)]';
  const inactiveDotClass = pattern.match(/class="(absolute[^"]*bg-outline-variant[^"]*)"/)?.[1] || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-outline-variant';

  const newSteps = items.map((item, i) => {
    const num = String(i + 1).padStart(2, '0');
    const dotClass = i === 0 ? activeDotClass : inactiveDotClass;
    const titleClass = i === 0 ? 'font-headline text-xl font-bold text-secondary mb-2' : 'font-headline text-xl font-bold mb-2';
    return `<div class="relative pl-12">
<div class="${dotClass}"></div>
<div class="${titleClass}">${num}. ${esc(item.title || '')}</div>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="timeline">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-20 text-center">${title}</h2>
<div class="relative border-l-2 border-outline-variant ml-4 space-y-16">
${newSteps}
</div>
</div>
</section>`;
}

function fillComparison(pattern, comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);

  const columns = comp.columns || comp._columns || [];
  const rows = comp.rows || [];

  if (columns.length === 0) return pattern;

  const headerHtml = `<th class="p-6 font-bold uppercase tracking-widest text-xs text-on-surface-variant"></th>` +
    columns.map(c => `<th class="p-6 font-bold uppercase tracking-widest text-xs text-primary">${esc(c.title || '')}</th>`).join('');

  const rowsHtml = rows.map(row => {
    const label = row.label || '';
    const vals = (row.values || []).map(v => {
      if (v === true || v === 'true') return '<td class="p-6 text-center text-secondary text-xl">&#10003;</td>';
      if (v === false || v === 'false') return '<td class="p-6 text-center text-error text-xl">&#10007;</td>';
      return `<td class="p-6 text-on-surface-variant">${esc(String(v))}</td>`;
    }).join('');
    return `<tr class="hover:bg-on-surface/5 transition-colors"><td class="p-6 font-bold">${esc(label)}</td>${vals}</tr>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="comparison">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-4 text-center">${title}</h2>
${body ? `<p class="text-center text-on-surface-variant mb-12">${stripTags(body)}</p>` : ''}
<div class="overflow-x-auto glass rounded-3xl border border-on-surface/5">
<table class="w-full text-left">
<thead class="bg-on-surface/5"><tr>${headerHtml}</tr></thead>
<tbody class="divide-y divide-on-surface/5">${rowsHtml}</tbody>
</table>
</div>
</div>
</section>`;
}

function fillStatCallout(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 bg-surface-container-low';
  const secClass = sectionOnly(rawClass);

  // Extract per-stat styling from Stitch (each stat div may have different colours)
  const statDivs = findAll(pattern, /<div[^>]*class="([^"]*)"[^>]*>\s*<div[^>]*class="([^"]*text-\d+xl[^"]*)"[^>]*>/gi);
  const statStyles = statDivs.map(m => ({
    cardClass: m.groups[1] || '',
    numClass: m.groups[2] || ''
  }));

  // Extract sublabel if present (font-bold text-lg between number and description)
  const hasSublabel = pattern.includes('font-bold text-lg');

  const colCount = Math.min(items.length, 4);
  const gridCols = `grid-cols-2 md:grid-cols-${colCount}`;

  const newStats = items.map((item, i) => {
    const style = statStyles[i] || statStyles[0] || {};
    const cardBg = bgOnly(style.cardClass);
    const cardShadow = style.cardClass.split(/\s+/).filter(c => /^shadow-/.test(c)).join(' ');
    const cardRound = style.cardClass.match(/rounded-\S+/)?.[0] || 'rounded-lg';
    const numColor = style.numClass.split(/\s+/).filter(c => /^text-(primary|secondary|tertiary|error|gradient)/.test(c)).join(' ')
      || 'text-gradient';
    const numWeight = style.numClass.split(/\s+/).filter(c => /^font-(black|extrabold|bold)/.test(c)).join(' ')
      || 'font-extrabold';
    return `<div class="${mc('p-8', cardRound, cardBg, cardShadow, 'min-w-[120px]')}">
<div class="text-5xl font-headline ${numWeight} ${numColor} mb-2">${esc(item.stat || item.value || '')}</div>
${hasSublabel ? `<div class="text-on-surface font-bold text-lg mb-1">${esc(item.label || '')}</div>` : ''}
<p class="text-on-surface-variant ${hasSublabel ? 'font-light text-sm' : 'text-sm uppercase tracking-widest font-bold'}">${esc(item.sublabel || (hasSublabel ? '' : item.label) || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="stat-callout">
<div class="max-w-6xl mx-auto px-8">
<div class="grid ${gridCols} gap-8 text-center">
${newStats}
</div>
</div>
</section>`;
}

function fillPullquote(pattern, comp) {
  const quote = stripTags(comp.body || '');
  const attribution = esc(comp.attribution || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);

  // Extract Stitch's decorative quote mark (the giant " character)
  const decorativeSpan = extractElement(pattern, /<span[^>]*class="[^"]*text-\[?\d+[^"]*pointer-events-none[^"]*"[^>]*>[^<]*<\/span>/i);
  const hasDecorativeQuote = !!decorativeSpan;

  // Extract blockquote styling from Stitch
  const bqClass = getClasses(pattern, 'blockquote');
  const bqStyle = bqClass.split(/\s+/).filter(c => /^(text-\d|md:text-|font-|italic|leading-)/.test(c)).join(' ')
    || 'text-2xl font-headline font-bold leading-relaxed';

  // Extract citation styling
  const citeClass = getClasses(pattern, 'cite');
  const citeStyle = citeClass || 'text-on-surface-variant';

  if (hasDecorativeQuote) {
    // Use Stitch's centre-aligned decorative layout
    return `<section class="${secClass} relative" data-component-type="pullquote">
${decorativeSpan}
<div class="max-w-6xl mx-auto px-8 text-center relative z-10">
<blockquote class="${mc('font-headline', bqStyle)}">${quote}</blockquote>
${attribution ? `<cite class="${mc('mt-6 block not-italic', citeStyle)}">— ${attribution}</cite>` : ''}
</div>
</section>`;
  }

  // Fallback: border-l accent bar layout
  return `<section class="${secClass}" data-component-type="pullquote">
<div class="max-w-6xl mx-auto px-8">
<div class="relative pl-8 border-l-4 border-primary">
<span class="material-symbols-outlined text-primary/30 text-6xl absolute -top-4 -left-2">format_quote</span>
<blockquote class="${mc('font-headline', bqStyle)}">${quote}</blockquote>
${attribution ? `<p class="mt-4 text-on-surface-variant">— ${attribution}</p>` : ''}
</div>
</div>
</section>`;
}

function fillChecklist(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);

  // Extract Stitch's card styling
  const checklistCard = getClasses(pattern, '[data-checklist]');
  const cardBg = bgOnly(checklistCard);
  const cardShadow = checklistCard.split(/\s+/).filter(c => /^shadow-/.test(c)).join(' ');
  const cardRound = checklistCard.match(/rounded-\S+/)?.[0] || 'rounded-3xl';
  const cardClass = mc(cardBg || 'glass-card', 'p-6 md:p-12', cardRound, cardShadow);

  // Extract input styling
  const inputClass = pattern.match(/<input[^>]*class="([^"]*)"/)?.[1] || 'w-6 h-6 rounded border-outline-variant text-secondary focus:ring-secondary bg-transparent';

  // Extract label hover from Stitch
  const labelSpan = pattern.match(/<span[^>]*class="([^"]*group-hover[^"]*)"[^>]*>/i);
  const labelHover = labelSpan?.[1]?.split(/\s+/).filter(c => /^(group-hover:|transition-)/.test(c)).join(' ')
    || 'hover:bg-surface-variant/50 transition-colors';

  const newLabels = items.map(item =>
    `<label class="flex items-center gap-4 p-4 rounded-xl cursor-pointer group ${labelHover}">
<input class="${inputClass}" type="checkbox"/>
<span class="text-on-surface-variant ${labelSpan ? 'group-hover:text-primary transition-colors' : ''}">${esc(item.text || item.title || '')}</span>
</label>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="checklist">
<div class="max-w-6xl mx-auto px-8">
<div class="${cardClass}" data-checklist>
<h2 class="font-headline text-3xl font-bold mb-8">${title}</h2>
<div class="space-y-2">
${newLabels}
</div>
<div class="mt-6 text-sm text-on-surface-variant font-bold" data-checklist-progress>0 / ${items.length} complete</div>
</div>
</div>
</section>`;
}

function fillTabs(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32 bg-surface-container-low';
  const secClass = sectionOnly(rawClass);

  const activeBtn = pattern.match(/<button[^>]*class="([^"]*bg-secondary[^"]*)"[^>]*data-tab-trigger/)?.[1]
    || 'px-8 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm uppercase tracking-wider';
  const inactiveBtn = pattern.match(/<button[^>]*class="([^"]*glass-card[^"]*)"[^>]*data-tab-trigger/)?.[1]
    || 'px-8 py-3 rounded-full glass-card hover:bg-surface-variant transition-all text-on-surface-variant font-bold text-sm uppercase tracking-wider';

  const triggers = items.map((item, i) =>
    `<button class="${i === 0 ? activeBtn : inactiveBtn}" data-tab-trigger="${i}">${esc(item.title || `Tab ${i + 1}`)}</button>`
  ).join('\n');

  const panels = items.map((item, i) =>
    `<div class="glass-card rounded-3xl p-6 md:p-12 min-h-[300px]" data-tab-panel="${i}"${i > 0 ? ' style="display:none"' : ''}>
<h4 class="font-headline text-xl font-bold mb-4">${esc(item.title || '')}</h4>
<div class="text-on-surface-variant leading-relaxed">${item.body || ''}</div>
</div>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="tabs">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">${title}</h2>
<div data-tabs>
<div class="flex flex-wrap justify-center gap-4 mb-12">
${triggers}
</div>
${panels}
</div>
</div>
</section>`;
}

function fillFlashcard(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 bg-surface-container-low overflow-hidden';
  const secClass = sectionOnly(rawClass);
  const icons = ['info', 'local_fire_department', 'pan_tool', 'bolt', 'shield', 'warning', 'speed', 'memory'];

  // Extract Stitch's front/back face styling
  const frontMatch = pattern.match(/class="([^"]*)"[^>]*style="[^"]*backface/i);
  const frontClass = frontMatch?.[1] || '';
  const frontBg = bgOnly(frontClass) || '';
  const frontShadow = frontClass.split(/\s+/).filter(c => /^shadow-/.test(c)).join(' ') || 'shadow-md';
  const frontRound = frontClass.match(/rounded-\S+/)?.[0] || 'rounded-3xl';
  // Detect if Stitch uses solid primary bg (bold style) vs glass-card (subtle style)
  const useBoldFront = frontBg.includes('bg-primary');

  const backMatch = pattern.match(/class="([^"]*)"[^>]*style="[^"]*rotateY/i);
  const backClass = backMatch?.[1] || '';
  const backBg = bgOnly(backClass) || 'bg-secondary-container';
  const backBorder = backClass.split(/\s+/).filter(c => /^border-/.test(c)).join(' ');
  const backRound = backClass.match(/rounded-\S+/)?.[0] || 'rounded-3xl';

  const newCards = items.map((item, i) => {
    const front = esc(item.front || item.title || item.term || '');
    const back = item.back || item.definition || item.body || '';
    const frontFaceClass = useBoldFront
      ? mc(frontBg, 'text-white', frontRound, frontShadow, 'p-6 md:p-8')
      : mc('glass-card', frontRound, frontShadow, 'border border-outline-variant/10 p-6 md:p-8');
    const backFaceClass = mc(backBg, backBorder, backRound, 'p-6 md:p-8 text-center');
    return `<div class="h-48 group cursor-pointer" style="perspective:1000px" data-flashcard>
<div class="relative w-full h-full transition-transform duration-500" style="transform-style:preserve-3d">
<div class="absolute inset-0 flex items-center justify-center ${frontFaceClass}" style="backface-visibility:hidden">
<div class="text-center">
<div class="material-symbols-outlined ${useBoldFront ? 'text-white/80' : 'text-secondary'} text-4xl mb-4">${icons[i % icons.length]}</div>
<div class="font-headline font-bold text-xl">${front}</div>
</div>
</div>
<div class="absolute inset-0 flex items-center justify-center ${backFaceClass}" style="backface-visibility:hidden;transform:rotateY(180deg)">
<p class="${useBoldFront ? 'text-on-secondary-container' : 'text-on-secondary-container'} font-medium">${back}</p>
</div>
</div>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="flashcard">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">${title}</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 ${items.length === 4 ? '' : 'md:grid-cols-3'} gap-8">
${newCards}
</div>
</div>
</section>`;
}

function fillNarrative(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32';
  const secClass = sectionOnly(rawClass);

  const newSlides = items.map((item, i) => {
    const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    return `<div data-slide="${i + 1}"${i > 0 ? ' style="display:none"' : ''}>
<div class="text-secondary font-bold mb-4">${counter}</div>
<h4 class="font-headline text-xl font-bold mb-4">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="narrative" data-carousel>
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-12">${title}</h2>
<div class="glass-card rounded-[2.5rem] p-6 md:p-12 relative">
${newSlides}
<div class="flex gap-4 mt-8">
<button class="w-12 h-12 rounded-full border border-outline-variant flex items-center justify-center hover:bg-secondary/20 transition-colors" data-prev>
<span class="material-symbols-outlined">chevron_left</span>
</button>
<button class="w-12 h-12 rounded-full bg-secondary text-on-secondary flex items-center justify-center" data-next>
<span class="material-symbols-outlined">chevron_right</span>
</button>
</div>
</div>
</div>
</section>`;
}

function fillKeyTerm(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);

  const cols = items.length <= 2 ? items.length : items.length === 4 ? 2 : 3;
  const newCards = items.map(item =>
    `<div class="glass-card p-8 rounded-2xl overflow-hidden">
<div class="text-secondary font-headline font-bold text-xl mb-3">${esc(item.term || item.title || '')}</div>
<p class="text-on-surface-variant">${esc(item.definition || item.body || '')}</p>
</div>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="key-term">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-16">${title}</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 ${cols === 3 ? 'md:grid-cols-3' : ''} gap-10">
${newCards}
</div>
</div>
</section>`;
}

function fillFullBleed(pattern, comp) {
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'relative h-[60vh] flex items-center justify-center overflow-hidden';
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');
  const pos = comp.overlayPosition || 'center';
  const alignClass = pos === 'left' ? 'text-left items-start' : pos === 'right' ? 'text-right items-end' : 'text-center items-center';

  return `<section class="${sectionClass}" data-component-type="full-bleed">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover" src="${imgSrc}"/>` : ''}
<div class="absolute inset-0 bg-gradient-to-t from-surface-dim via-surface-dim/70 to-surface-dim/30"></div>
<div class="relative z-10 max-w-6xl mx-auto px-8 flex flex-col ${alignClass}">
<h2 class="font-headline text-3xl font-bold tracking-tight mb-4">${title}</h2>
${bodyText ? `<p class="text-xl text-on-surface-variant">${bodyText}</p>` : ''}
</div>
</section>`;
}

function fillGraphic(pattern, comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24';
  const secClass = sectionOnly(rawClass);
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  return `<section class="${secClass}" data-component-type="graphic">
<div class="max-w-6xl mx-auto px-8">
${title ? `<h2 class="font-headline text-3xl font-bold mb-8">${title}</h2>` : ''}
<div class="rounded-2xl overflow-hidden">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-auto max-h-[60vh] object-cover" src="${imgSrc}"/>` : '<div class="w-full h-64 bg-surface-container rounded-2xl"></div>'}
</div>
${body ? `<div class="mt-4 text-on-surface-variant">${body}</div>` : ''}
</div>
</section>`;
}

function fillProcessFlow(pattern, comp) {
  const items = comp._items || comp._nodes || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const rawClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 bg-surface-container-low';
  const secClass = sectionOnly(rawClass);

  const useVertical = items.length > 4;

  const newNodes = items.map((item, i) => {
    const isFirst = i === 0;
    const isLast = i === items.length - 1;
    const borderClass = isFirst ? 'border-l-4 border-secondary' : isLast ? 'border-l-4 border-primary' : '';
    return `<div class="glass-card px-8 py-6 rounded-2xl ${borderClass} ${useVertical ? 'w-full' : 'flex-1 min-w-[200px]'}">
<div class="font-headline font-bold text-lg mb-2">${esc(item.title || '')}</div>
${item.body ? `<div class="text-sm text-on-surface-variant leading-relaxed">${stripTags(item.body)}</div>` : ''}
</div>`;
  });

  const arrowIcon = useVertical ? 'arrow_downward' : 'arrow_forward';
  const arrowEl = `<div class="flex justify-center"><span class="material-symbols-outlined text-outline-variant">${arrowIcon}</span></div>`;

  const withArrows = newNodes.flatMap((n, i) =>
    i < newNodes.length - 1 ? [n, arrowEl] : [n]
  ).join('\n');

  const flexDir = useVertical ? 'flex-col' : 'flex-col md:flex-row';

  return `<section class="${secClass}" data-component-type="process-flow">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">${title}</h2>
<div class="flex ${flexDir} items-stretch gap-6">
${withArrows}
</div>
</div>
</section>`;
}

function fillMedia(pattern, comp) {
  let inner = pattern;
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    inner = inner.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
  }
  // Pattern uses relative/absolute positioning — wrap in containment, don't inject inside
  inner = inner.replace(/^<section/, '<div').replace(/<\/section>\s*$/, '</div>');
  return `<section class="py-24" data-component-type="media">
<div class="max-w-6xl mx-auto px-8">
${inner}
</div>
</section>`;
}

function fillVideoTranscript(pattern, comp) {
  let inner = pattern;
  inner = inner.replace(/<span>([^<]*)<\/span>/i, `<span>${esc(comp.displayTitle || 'Transcript')}</span>`);
  inner = inner.replace(/(<div class="p-8[^"]*">)([\s\S]*?)(<\/div>\s*<\/details>)/i,
    `$1${comp.body || ''}$3`);
  inner = inner.replace(/^<section/, '<div').replace(/<\/section>\s*$/, '</div>');
  return `<section class="py-24" data-component-type="video-transcript">
<div class="max-w-6xl mx-auto px-8">
${inner}
</div>
</section>`;
}

function fillImageGallery(pattern, comp) {
  let inner = pattern;
  inner = replaceFirstTag(inner, 'h2', esc(comp.displayTitle || ''));
  inner = inner.replace(/^<section/, '<div').replace(/<\/section>\s*$/, '</div>');
  return `<section class="py-24" data-component-type="image-gallery">
<div class="max-w-6xl mx-auto px-8">
${inner}
</div>
</section>`;
}

function fillLabeledImage(pattern, comp) {
  let inner = pattern;
  inner = replaceFirstTag(inner, 'h2', esc(comp.displayTitle || ''));
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    inner = inner.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
  }
  inner = inner.replace(/^<section/, '<div').replace(/<\/section>\s*$/, '</div>');
  return `<section class="py-24" data-component-type="labeled-image">
<div class="max-w-6xl mx-auto px-8">
${inner}
</div>
</section>`;
}

// ─── Component dispatcher ─────────────────────────────────────────────
function fillComponent(pattern, comp, index) {
  const type = (comp.type || 'text').toLowerCase();
  switch (type) {
    case 'hero':            return fillHero(pattern, comp);
    case 'text':            return fillText(pattern, comp);
    case 'accordion':       return fillAccordion(pattern, comp);
    case 'mcq':             return fillMCQ(pattern, comp);
    case 'graphic-text':    return fillGraphicText(pattern, comp, index);
    case 'bento':           return fillBento(pattern, comp);
    case 'data-table':      return fillDataTable(pattern, comp);
    case 'textinput':       return fillTextInput(pattern, comp);
    case 'branching':       return fillBranching(pattern, comp);
    case 'timeline':        return fillTimeline(pattern, comp);
    case 'comparison':      return fillComparison(pattern, comp);
    case 'stat-callout':    return fillStatCallout(pattern, comp);
    case 'pullquote':       return fillPullquote(pattern, comp);
    case 'checklist':       return fillChecklist(pattern, comp);
    case 'tabs':            return fillTabs(pattern, comp);
    case 'flashcard':       return fillFlashcard(pattern, comp);
    case 'narrative':       return fillNarrative(pattern, comp);
    case 'key-term':        return fillKeyTerm(pattern, comp);
    case 'full-bleed':      return fillFullBleed(pattern, comp);
    case 'graphic':         return fillGraphic(pattern, comp);
    case 'process-flow':    return fillProcessFlow(pattern, comp);
    case 'media':           return fillMedia(pattern, comp);
    case 'video-transcript':return fillVideoTranscript(pattern, comp);
    case 'image-gallery':   return fillImageGallery(pattern, comp);
    case 'labeled-image':   return fillLabeledImage(pattern, comp);
    default:
      console.log(`  [warn] Unknown component type: ${type}`);
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════

function buildNav(shell, layout) {
  if (!shell || !shell.nav) return '';
  const courseTitle = esc(layout.course.title || 'Course');
  const sections = layout.sections.filter(s => s.title).slice(0, 5);

  let navClass = shell.nav.match(/<nav[^>]*class="([^"]*)"/)?.[1] || '';
  // Ensure critical nav layout classes are always present
  const requiredNav = ['fixed', 'top-0', 'w-full', 'z-50', 'flex', 'justify-between', 'items-center'];
  requiredNav.forEach(cls => { if (!navClass.includes(cls)) navClass += ` ${cls}`; });
  if (!/h-\d+/.test(navClass)) navClass += ' h-20';
  if (!/px-\d+/.test(navClass)) navClass += ' px-8';
  if (!navClass.includes('bg-')) navClass += ' bg-surface-container/60 backdrop-blur-xl';
  navClass = navClass.trim();

  const activeLinkClass = shell.nav.match(/<a[^>]*class="([^"]*border-b[^"]*)"/)?.[1] || "text-primary border-b-2 border-primary pb-1 font-bold tracking-tight text-sm uppercase";
  const inactiveLinkClass = shell.nav.match(/<a[^>]*class="([^"]*hover:text-white[^"]*)"/)?.[1] || "text-on-surface-variant hover:text-white transition-colors font-bold tracking-tight text-sm uppercase";

  const navLinks = sections.map((s, i) => {
    const cls = i === 0 ? activeLinkClass : inactiveLinkClass;
    return `<a class="${cls} whitespace-nowrap" href="#${s.sectionId || `section-${i}`}">${esc(s.title)}</a>`;
  }).join('\n');

  return `<nav class="${navClass}" data-component-type="navigation">
<div class="flex items-center gap-4">
<span class="text-xl font-black tracking-tighter text-primary italic">${courseTitle}</span>
</div>
<div class="hidden md:flex gap-6 items-center overflow-hidden">
${navLinks}
</div>
<div class="flex items-center gap-4">
<button class="hover:bg-on-surface/5 p-2 rounded-full transition-all"><span class="material-symbols-outlined text-on-surface-variant">notifications</span></button>
<button class="hover:bg-on-surface/5 p-2 rounded-full transition-all"><span class="material-symbols-outlined text-on-surface-variant">account_circle</span></button>
</div>
</nav>`;
}

function buildFooter(shell, layout) {
  if (!shell || !shell.footer) return '';
  const courseTitle = esc(layout.course.title || 'Course');
  const year = new Date().getFullYear();

  const footerClass = shell.footer.match(/<footer[^>]*class="([^"]*)"/)?.[1] || 'bg-surface-dim w-full py-12 border-t border-on-surface/5';

  return `<footer class="${footerClass}" data-component-type="footer">
<div class="max-w-6xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
<div class="flex flex-col gap-2 items-center md:items-start">
<span class="text-lg font-bold text-on-surface">${courseTitle}</span>
<span class="text-xs text-on-surface-variant">&copy; ${year} ${courseTitle}. All rights reserved.</span>
</div>
<div class="flex gap-8">
<a class="text-xs text-on-surface-variant hover:text-primary transition-colors" href="#">Privacy Policy</a>
<a class="text-xs text-on-surface-variant hover:text-primary transition-colors" href="#">Terms of Service</a>
</div>
</div>
</footer>`;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN BUILD
// ═══════════════════════════════════════════════════════════════════════
function build() {
  console.log('V5 Course Builder — Stitch Pattern Fill');
  console.log('=========================================\n');

  // Read inputs
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('ERROR: course-layout.json not found');
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  console.log(`[ok] Loaded course-layout.json (${layout.sections.length} sections)`);

  // Load page shell
  const shell = loadPageShell();
  if (shell) {
    console.log(`[ok] Loaded page shell (nav: ${(shell.nav || '').length} chars, footer: ${(shell.footer || '').length} chars)`);
  }

  // Load design tokens — the ONLY source for colours/fonts in the <head>
  if (!fs.existsSync(TOKENS_PATH)) {
    console.error('ERROR: design-tokens.json not found');
    process.exit(1);
  }
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
  console.log(`[ok] Loaded design-tokens.json (${Object.keys(tokens.colors || {}).length} colours, fonts: ${tokens.fonts?.headline}/${tokens.fonts?.body}, isDark: ${tokens.isDark})`);

  // Count patterns available
  const patternFiles = fs.readdirSync(PATTERNS_DIR).filter(f => f.endsWith('.html'));
  console.log(`[ok] ${patternFiles.length} component patterns available`);

  // Build all sections
  let filledCount = 0;
  let fallbackCount = 0;
  const sectionsHtml = [];

  layout.sections.forEach((section, sectionIndex) => {
    const components = section.components || [];
    if (components.length === 0) return;

    const sectionId = section.sectionId || `section-${String(sectionIndex).padStart(2, '0')}`;

    const componentHtmls = [];
    components.forEach((comp, compIndex) => {
      const type = (comp.type || 'text').toLowerCase();
      const pattern = loadPattern(type);

      if (pattern) {
        const filled = fillComponent(pattern, comp, compIndex);
        if (filled) {
          componentHtmls.push(filled);
          filledCount++;
        } else {
          console.log(`  [warn] Fill returned null for ${type}`);
          fallbackCount++;
        }
      } else {
        console.log(`  [warn] No pattern for: ${type}, skipping`);
        fallbackCount++;
      }
    });

    if (componentHtmls.length > 0) {
      const sectionTitle = section.title || '';
      const titleBar = sectionTitle
        ? `<div class="max-w-6xl mx-auto px-8 pt-16 pb-6" id="${sectionId}">
<div class="flex items-center gap-6">
<div class="h-px flex-1 bg-gradient-to-r from-primary/50 to-transparent"></div>
<h2 class="font-headline text-sm font-bold uppercase tracking-[0.25em] text-primary">${esc(sectionTitle)}</h2>
<div class="h-px flex-1 bg-gradient-to-l from-primary/50 to-transparent"></div>
</div>
</div>`
        : '';

      const wrapped = componentHtmls.map((h, i) => {
        if (h.trim().startsWith('<section')) {
          if (i === 0 && !sectionTitle) {
            return h.replace(/<section/, `<section id="${sectionId}"`);
          }
          return h;
        }
        return `<div class="py-12 max-w-6xl mx-auto px-8">\n${h}\n</div>`;
      }).join('\n\n');

      sectionsHtml.push(titleBar + '\n' + wrapped);
    }
  });

  console.log(`[ok] Filled ${filledCount} components (${fallbackCount} fallbacks)\n`);

  // Build nav and footer from Stitch's shell
  const navHtml = buildNav(shell, layout);
  const footerHtml = buildFooter(shell, layout);

  // Get hydration script
  let hydrateScript = '';
  if (fs.existsSync(HYDRATE_PATH)) {
    hydrateScript = fs.readFileSync(HYDRATE_PATH, 'utf-8');
  }

  // Theme + course title
  const isDark = tokens.isDark !== false;
  const courseTitle = layout.course.title || 'Course';

  // Generate <head> from design-tokens.json — NOT from Stitch raw HTML
  const finalHead = generateHead(tokens, courseTitle);
  console.log(`[ok] Generated <head> from design-tokens.json (${finalHead.length} chars)`);

  const finalHtml = `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}" lang="en">
<head>
${finalHead}
</head>
<body class="bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">

${navHtml}

<main class="min-h-screen bg-background overflow-x-hidden pt-20">
${sectionsHtml.join('\n\n')}

<!-- Course Completion -->
<section class="py-20 text-center">
<div class="max-w-6xl mx-auto px-8">
  <span class="material-symbols-outlined text-6xl text-secondary mb-8">verified_user</span>
  <h2 class="font-headline text-3xl font-bold mb-8">Course Complete</h2>
  <p class="text-on-surface-variant text-xl leading-relaxed mb-12">
    You have completed ${esc(courseTitle)}. Review any sections as needed.
  </p>
  <button class="btn-primary px-12 py-5 rounded-full font-bold text-lg" onclick="window.scrollTo({top:0,behavior:'smooth'})">Return to Top</button>
</div>
</section>

${footerHtml}
</main>

<script>
${hydrateScript}
</script>
</body>
</html>`;

  // Write outputs
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, finalHtml, 'utf-8');
  console.log(`[ok] Written: ${OUTPUT_PATH} (${(finalHtml.length / 1024).toFixed(0)} KB)`);

  fs.writeFileSync(PAGES_PATH, finalHtml, 'utf-8');
  console.log(`[ok] Written: ${PAGES_PATH}`);

  console.log('\nBuild complete!');
}

build();
