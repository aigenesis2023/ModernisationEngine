#!/usr/bin/env node
/**
 * V5 Course Builder — Design Contract Build
 *
 * Reads design-contract.json (extracted from Stitch patterns by extract-contract.js)
 * and fills components with real SCORM content. The visual design comes from the
 * contract JSON — this script NEVER reads Stitch's raw HTML patterns.
 *
 * If Stitch changes its HTML output, fix extract-contract.js. Not this file.
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
const CONTRACT_PATH = path.resolve(ROOT, 'v5/output/design-contract.json');
const TOKENS_PATH = path.resolve(ROOT, 'v5/output/design-tokens.json');
const LAYOUT_PATH = path.resolve(ROOT, 'v5/output/course-layout.json');
const HYDRATE_PATH = path.resolve(ROOT, 'v5/scripts/hydrate.js');
const OUTPUT_PATH = path.resolve(ROOT, 'v5/output/course.html');
const PAGES_PATH = path.resolve(ROOT, 'index.html');

// The design contract — extracted from Stitch patterns by extract-contract.js
// This is the ONLY interface between Stitch's design and our build.
let DC = {};

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

/** Strip containment/grid classes from a section class string.
 *  Section handles spacing (py-*) and background (bg-*).
 *  Containment (max-w, mx-auto, px-*) goes in an inner div. */
function sectionOnly(cls) {
  return cls
    .replace(/max-w-\S+/g, '')
    .replace(/\bmx-auto\b/g, '')
    .replace(/\bpx-\d+\b/g, '')
    .replace(/\bgrid\b/g, '')
    .replace(/md:grid-cols-\d+/g, '')
    .replace(/gap-\d+/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'py-24';
}

/** Merge class strings, filtering empty/null, deduplicating */
function mc(...parts) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
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

// ═══════════════════════════════════════════════════════════════════════
// FILL FUNCTIONS — one per component type
// Each reads visual properties from DC (design contract) — never raw HTML.
//
// Layout contract (hardcoded, same for every brand):
//   - Section tag: spacing + background only (via sectionOnly())
//   - Inner div: max-w-6xl mx-auto px-8 (containment)
//   - Grids: explicit gap-* + min-w on columns
//   - Headings: h2=text-3xl, h3=text-2xl, h4=text-xl
//
// Visual contract (from DC — different per brand):
//   - Shadows, hovers, transitions, gradients, rings
//   - Card backgrounds, border colours
//   - Button styles, input styles
//   - All with safe fallbacks
// ═══════════════════════════════════════════════════════════════════════

function fillHero(comp) {
  const c = DC.hero || {};
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const sectionClass = c.section || 'relative min-h-screen flex items-center justify-center overflow-hidden';
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  const overlayGradient = c.overlayGradient || 'bg-gradient-to-t from-surface-dim via-surface-dim/80 to-surface-dim/40';
  const imgVisuals = c.imgVisuals || 'mix-blend-overlay opacity-40';

  const btn1 = c.btn1 || {};
  const btn1Bg = btn1.gradient || btn1.customClass || btn1.bg || 'bg-primary';
  const btn1Round = btn1.rounded || 'rounded-xl';
  const btn1Visual = btn1.visual || '';

  const btn2 = c.btn2 || {};
  const btn2Bg = btn2.bg || 'border border-outline-variant';
  const btn2Round = btn2.rounded || 'rounded-xl';
  const btn2Visual = btn2.visual || 'hover:bg-surface-variant transition-colors';

  return `<section class="${sectionClass}" data-component-type="hero">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover ${imgVisuals}" src="${imgSrc}"/>` : ''}
<div class="absolute inset-0 ${overlayGradient}"></div>
<div class="relative z-10 text-center max-w-6xl mx-auto px-8">
<h1 class="font-headline text-6xl md:text-8xl font-black tracking-tighter mb-8">${title}</h1>
<p class="text-xl text-on-surface-variant max-w-2xl mx-auto mb-12">${bodyText}</p>
<div class="flex gap-4 justify-center flex-wrap">
<button class="px-8 py-4 ${btn1Bg} text-on-primary ${btn1Round} font-bold ${btn1Visual}">Begin Course</button>
<button class="px-8 py-4 ${btn2Bg} ${btn2Round} font-bold ${btn2Visual}">Explore Modules</button>
</div>
</div>
</section>`;
}

function fillText(comp) {
  const c = DC.text || {};
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly(c.section || 'py-24');

  return `<section class="${secClass}" data-component-type="text">
<div class="max-w-6xl mx-auto px-8">
<h2 class="font-headline text-3xl font-bold mb-8">${title}</h2>
<div class="space-y-6 text-lg text-on-surface-variant leading-relaxed">
${comp.body || ''}
</div>
</div>
</section>`;
}

function fillAccordion(comp) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.accordion || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.accordion || {}).section || 'py-24');
  const detailsClass = c.detailsClass || 'group glass-card rounded-2xl p-6 transition-all duration-300';
  const bodyClass = c.bodyClass || 'mt-4 text-on-surface-variant leading-relaxed';

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

function fillMCQ(comp) {
  const items = comp._items || [];
  const feedback = comp._feedback || {};
  const correctFeedback = stripTags(feedback.correct || 'Correct!');
  const incorrectFeedback = stripTags((feedback._incorrect && feedback._incorrect.final) || 'Not quite. Try again.');
  const c = DC.mcq || {};

  let correctIdx = items.findIndex(i => i.correct || i._shouldBeSelected);
  if (correctIdx < 0) correctIdx = 0;

  const questionText = stripTags(comp.instruction || comp.body || '');
  const title = esc(comp.displayTitle || 'Knowledge Check');

  const secClass = sectionOnly(c.section || 'py-32');

  // Card styling from contract
  const card = c.card || {};
  const cardClass = mc(
    card.bg || 'glass-card',
    'p-6 md:p-12',
    card.shadow || '',
    card.rounded || 'rounded-[2rem]',
    card.border || ''
  );

  const labelClass = c.labelClass || 'text-secondary font-bold text-sm uppercase tracking-widest';

  // Choice styling from contract
  const choice = c.choice || {};
  const choiceRound = choice.rounded || 'rounded-xl';
  const choiceVisuals = choice.visual || 'bg-surface-container/80 hover:bg-surface-container transition-all border border-outline-variant/20 hover:border-secondary/50';
  const choiceIsButton = choice.isButton !== false;
  const hasCheckIcon = c.hasCheckIcon || false;
  const hasRadioIcon = c.hasRadioIcon || false;

  const newChoices = items.map((item, i) => {
    const tag = choiceIsButton ? 'button' : 'div';
    const tagAttrs = choiceIsButton ? 'w-full text-left' : 'group flex items-center cursor-pointer';
    return `<${tag} class="${mc(
      tagAttrs, 'p-5', choiceRound, choiceVisuals,
      (hasCheckIcon || hasRadioIcon) ? 'flex justify-between items-center group' : ''
    )}" data-choice="${i}">
<span class="text-on-surface">${esc(item.text || '')}</span>
${hasRadioIcon ? '<span class="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">radio_button_unchecked</span>' : ''}
${hasCheckIcon ? '<span class="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">check_circle</span>' : ''}
</${tag}>`;
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

function fillGraphicText(comp, index) {
  const c = DC['graphic-text'] || {};
  const title = esc(comp.displayTitle || '');
  const bodyText = comp.body || '';
  const secClass = sectionOnly(c.section || 'py-24');
  const align = comp._imageAlign || (index % 2 === 0 ? 'right' : 'left');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  const glowClass = c.glowClass || '';
  const imgShadow = c.imgShadow || '';

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

function fillBento(comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const c = DC.bento || {};
  const secClass = sectionOnly((DC.bento || {}).section || 'py-32');

  const icons = ['bolt', 'speed', 'shield', 'memory', 'hub', 'star', 'lightbulb', 'science'];
  const cardBgs = c.cardBgs || [];
  const imgHover = c.imgHover || 'group-hover:scale-110 transition-transform duration-700';

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
      return `<div class="md:col-span-1 ${bgI} rounded-3xl p-8 flex flex-col justify-between min-h-[100px]">
<span class="material-symbols-outlined text-primary text-4xl mb-4">${icons[i % icons.length]}</span>
<div class="min-w-0">
<h4 class="font-headline text-xl font-bold mb-1">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant text-sm">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }
    const bgN = cardBgs[i] || cardBgs[cardBgs.length - 1] || 'glass-card';
    const bgShadow = (c.cardShadows || [])[i] || '';
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

function fillDataTable(comp) {
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['data-table'] || {}).section || 'py-24');
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

function fillTextInput(comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const c = DC.textinput || {};
  const secClass = sectionOnly((DC.textinput || {}).section || 'py-24 bg-surface-container-low');

  const cardClass = (c.cardClass || 'glass-card p-12 rounded-[2rem]').replace(/\bp-12\b/, 'p-6 md:p-12');
  const inputClass = c.inputClass || 'w-full bg-surface-container-lowest border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50 focus:border-secondary';

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

function fillBranching(comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const c = DC.branching || {};
  const secClass = sectionOnly((DC.branching || {}).section || 'py-32');

  const btn = c.button || {};
  const btnVisuals = btn.visual || 'hover:bg-surface-variant transition-all border border-transparent hover:border-secondary/30';
  const btnBg = btn.bg || 'bg-surface-variant/30';
  const btnRound = btn.rounded || 'rounded-2xl';

  const hasArrow = c.hasArrow || false;
  const arrowClass = c.arrowClass || 'mt-6 inline-flex items-center gap-2 text-primary font-bold group-hover:translate-x-2 transition-transform';

  const newButtons = items.map(item =>
    `<button class="group p-6 md:p-8 ${btnBg} ${btnRound} text-left ${btnVisuals}">
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

function fillTimeline(comp) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.timeline || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.timeline || {}).section || 'py-32');

  if (c.hasNumberedCircles && c.circleClass) {
    const connectorClass = c.connectorClass || 'w-0.5 h-full bg-outline-variant/20 mt-4';
    const newSteps = items.map((item, i) => {
      const num = i + 1;
      const isLast = i === items.length - 1;
      return `<div class="flex gap-8">
<div class="flex flex-col items-center">
<div class="${c.circleClass} flex items-center justify-center font-bold">${num}</div>
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

  // Border-l dot layout
  const activeDotClass = c.activeDotClass || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-secondary shadow-[0_0_10px_rgba(37,216,252,0.5)]';
  const inactiveDotClass = c.inactiveDotClass || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-outline-variant';

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

function fillComparison(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly((DC.comparison || {}).section || 'py-24');

  const columns = comp.columns || comp._columns || [];
  const rows = comp.rows || [];
  if (columns.length === 0) return '';

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

function fillStatCallout(comp) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC['stat-callout'] || {};
  const secClass = sectionOnly((DC['stat-callout'] || {}).section || 'py-24 bg-surface-container-low');

  const statStyles = c.stats || [];
  const hasSublabel = c.hasSublabel || false;

  const colCount = Math.min(items.length, 4);
  const gridCols = `grid-cols-2 md:grid-cols-${colCount}`;

  const newStats = items.map((item, i) => {
    const style = statStyles[i] || statStyles[0] || {};
    const cardBg = style.cardBg || '';
    const cardShadow = style.cardShadow || '';
    const cardRound = style.cardRounded || 'rounded-lg';
    const cardBorder = style.cardBorder || '';
    const numColor = style.numColor || 'text-gradient';
    const numWeight = style.numWeight || 'font-extrabold';
    return `<div class="${mc('p-8', cardRound, cardBg, cardShadow, cardBorder, 'min-w-[120px]')}">
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

function fillPullquote(comp) {
  const quote = stripTags(comp.body || '');
  const attribution = esc(comp.attribution || '');
  const c = DC.pullquote || {};
  const secClass = sectionOnly((DC.pullquote || {}).section || 'py-24');

  const bqStyle = c.blockquoteStyle || 'text-2xl font-headline font-bold leading-relaxed';
  const citeStyle = c.citeClass || 'text-on-surface-variant';

  if (c.hasDecorativeQuote && c.decorativeSpanHtml) {
    return `<section class="${secClass} relative" data-component-type="pullquote">
${c.decorativeSpanHtml}
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

function fillChecklist(comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const c = DC.checklist || {};
  const secClass = sectionOnly((DC.checklist || {}).section || 'py-24');

  const card = c.card || {};
  const cardClass = mc(card.bg || 'glass-card', 'p-6 md:p-12', card.rounded || 'rounded-3xl', card.shadow || '');
  const inputClass = c.inputClass || 'w-6 h-6 rounded border-outline-variant text-secondary focus:ring-secondary bg-transparent';
  const labelHover = c.labelHover || 'hover:bg-surface-variant/50 transition-colors';
  const spanHover = c.spanHover || '';

  const newLabels = items.map(item =>
    `<label class="flex items-center gap-4 p-4 rounded-xl cursor-pointer group ${labelHover}">
<input class="${inputClass}" type="checkbox"/>
<span class="text-on-surface-variant ${spanHover ? 'group-hover:text-primary transition-colors' : ''}">${esc(item.text || item.title || '')}</span>
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

function fillTabs(comp) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.tabs || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly(c.section || 'py-32 bg-surface-container-low');
  const activeBtn = c.activeBtn || 'px-8 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm uppercase tracking-wider';
  const inactiveBtn = c.inactiveBtn || 'px-8 py-3 rounded-full glass-card hover:bg-surface-variant transition-all text-on-surface-variant font-bold text-sm uppercase tracking-wider';

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

function fillFlashcard(comp) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.flashcard || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.flashcard || {}).section || 'py-24 bg-surface-container-low overflow-hidden');
  const icons = ['info', 'local_fire_department', 'pan_tool', 'bolt', 'shield', 'warning', 'speed', 'memory'];

  const front = c.front || {};
  const back = c.back || {};
  const useBoldFront = front.useBoldPrimary || false;

  const newCards = items.map((item, i) => {
    const frontText = esc(item.front || item.title || item.term || '');
    const backText = item.back || item.definition || item.body || '';
    const frontFaceClass = useBoldFront
      ? mc(front.bg, 'text-white', front.rounded || 'rounded-3xl', front.shadow || 'shadow-md', 'p-6 md:p-8')
      : mc('glass-card', front.rounded || 'rounded-3xl', front.shadow || 'shadow-md', 'border border-outline-variant/10 p-6 md:p-8');
    const backFaceClass = mc(back.bg || 'bg-secondary-container', back.border || '', back.rounded || 'rounded-3xl', 'p-6 md:p-8 text-center');
    return `<div class="h-48 group cursor-pointer" style="perspective:1000px" data-flashcard>
<div class="relative w-full h-full transition-transform duration-500" style="transform-style:preserve-3d">
<div class="absolute inset-0 flex items-center justify-center ${frontFaceClass}" style="backface-visibility:hidden">
<div class="text-center">
<div class="material-symbols-outlined ${useBoldFront ? 'text-white/80' : 'text-secondary'} text-4xl mb-4">${icons[i % icons.length]}</div>
<div class="font-headline font-bold text-xl">${frontText}</div>
</div>
</div>
<div class="absolute inset-0 flex items-center justify-center ${backFaceClass}" style="backface-visibility:hidden;transform:rotateY(180deg)">
<p class="text-on-secondary-container font-medium">${backText}</p>
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

function fillNarrative(comp) {
  const items = comp._items || [];
  if (items.length === 0) return '';

  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly((DC.narrative || {}).section || 'py-32');

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

function fillKeyTerm(comp) {
  const items = comp._items || [];
  if (items.length === 0) return '';

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['key-term'] || {}).section || 'py-24');

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

function fillFullBleed(comp) {
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const sectionClass = (DC['full-bleed'] || {}).section || 'relative h-[60vh] flex items-center justify-center overflow-hidden';
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

function fillGraphic(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly((DC.graphic || {}).section || 'py-24');
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

function fillProcessFlow(comp) {
  const items = comp._items || comp._nodes || [];
  if (items.length === 0) return '';

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['process-flow'] || {}).section || 'py-24 bg-surface-container-low');

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

function fillMedia(comp) {
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.media || {}).section || 'py-24');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';

  return `<section class="${secClass}" data-component-type="media">
<div class="max-w-6xl mx-auto px-8">
${title ? `<h2 class="font-headline text-3xl font-bold mb-8">${title}</h2>` : ''}
<div class="relative bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center">
${imgSrc ? `<img alt="" class="w-full h-full object-cover" src="${imgSrc}"/>` : '<span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span>'}
</div>
</div>
</section>`;
}

function fillVideoTranscript(comp) {
  const title = esc(comp.displayTitle || 'Transcript');
  const secClass = sectionOnly((DC['video-transcript'] || {}).section || 'py-24');

  return `<section class="${secClass}" data-component-type="video-transcript">
<div class="max-w-6xl mx-auto px-8">
<div class="bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center mb-6">
<span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span>
</div>
<details class="bg-surface-container-low rounded-2xl">
<summary class="p-6 cursor-pointer font-bold flex justify-between items-center">
<span>${title}</span>
<span class="material-symbols-outlined">expand_more</span>
</summary>
<div class="p-8 text-on-surface-variant">${comp.body || ''}</div>
</details>
</div>
</section>`;
}

function fillImageGallery(comp) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];
  const secClass = sectionOnly((DC['image-gallery'] || {}).section || 'py-24');

  const images = items.map(item => {
    const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
    const imgAlt = esc(item._graphic?.alt || item.caption || '');
    return `<div class="bg-surface-container rounded-2xl overflow-hidden aspect-square">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-full object-cover" src="${imgSrc}"/>` : '<div class="w-full h-full flex items-center justify-center"><span class="material-symbols-outlined text-4xl text-on-surface-variant">image</span></div>'}
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="image-gallery">
<div class="max-w-6xl mx-auto px-8">
${title ? `<h2 class="font-headline text-3xl font-bold mb-12">${title}</h2>` : ''}
<div class="grid grid-cols-2 md:grid-cols-3 gap-6">
${images}
</div>
</div>
</section>`;
}

function fillLabeledImage(comp) {
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['labeled-image'] || {}).section || 'py-24');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');
  const markers = comp._markers || [];

  const markerHtml = markers.map(m =>
    `<div class="absolute" style="left:${m.x}%;top:${m.y}%">
<div class="w-6 h-6 rounded-full bg-primary border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform" title="${esc(m.label || '')}"></div>
</div>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="labeled-image">
<div class="max-w-6xl mx-auto px-8">
${title ? `<h2 class="font-headline text-3xl font-bold mb-12">${title}</h2>` : ''}
<div class="relative bg-surface-container rounded-3xl overflow-hidden">
${imgSrc ? `<img alt="${imgAlt}" class="w-full rounded-3xl" src="${imgSrc}"/>` : '<div class="w-full h-64 bg-surface-container"></div>'}
${markerHtml}
</div>
</div>
</section>`;
}

// ─── Component dispatcher ─────────────────────────────────────────────
function fillComponent(comp, index) {
  const type = (comp.type || 'text').toLowerCase();
  switch (type) {
    case 'hero':            return fillHero(comp);
    case 'text':            return fillText(comp);
    case 'accordion':       return fillAccordion(comp);
    case 'mcq':             return fillMCQ(comp);
    case 'graphic-text':    return fillGraphicText(comp, index);
    case 'bento':           return fillBento(comp);
    case 'data-table':      return fillDataTable(comp);
    case 'textinput':       return fillTextInput(comp);
    case 'branching':       return fillBranching(comp);
    case 'timeline':        return fillTimeline(comp);
    case 'comparison':      return fillComparison(comp);
    case 'stat-callout':    return fillStatCallout(comp);
    case 'pullquote':       return fillPullquote(comp);
    case 'checklist':       return fillChecklist(comp);
    case 'tabs':            return fillTabs(comp);
    case 'flashcard':       return fillFlashcard(comp);
    case 'narrative':       return fillNarrative(comp);
    case 'key-term':        return fillKeyTerm(comp);
    case 'full-bleed':      return fillFullBleed(comp);
    case 'graphic':         return fillGraphic(comp);
    case 'process-flow':    return fillProcessFlow(comp);
    case 'media':           return fillMedia(comp);
    case 'video-transcript':return fillVideoTranscript(comp);
    case 'image-gallery':   return fillImageGallery(comp);
    case 'labeled-image':   return fillLabeledImage(comp);
    default:
      console.log(`  [warn] Unknown component type: ${type}`);
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════

function buildNav(layout) {
  const nav = DC._nav || {};
  if (!nav.navClass) return '';

  const courseTitle = esc(layout.course.title || 'Course');
  const sections = layout.sections.filter(s => s.title).slice(0, 5);

  let navClass = nav.navClass || '';
  // Ensure critical nav layout classes are always present
  const requiredNav = ['fixed', 'top-0', 'w-full', 'z-50', 'flex', 'justify-between', 'items-center'];
  requiredNav.forEach(cls => { if (!navClass.includes(cls)) navClass += ` ${cls}`; });
  if (!/h-\d+/.test(navClass)) navClass += ' h-20';
  if (!/px-\d+/.test(navClass)) navClass += ' px-8';
  if (!navClass.includes('bg-')) navClass += ' bg-surface-container/60 backdrop-blur-xl';
  navClass = navClass.trim();

  const activeLinkClass = nav.activeLinkClass || 'text-primary border-b-2 border-primary pb-1 font-bold tracking-tight text-sm uppercase';
  const inactiveLinkClass = nav.inactiveLinkClass || 'text-on-surface-variant hover:text-white transition-colors font-bold tracking-tight text-sm uppercase';

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

function buildFooter(layout) {
  const footer = DC._footer || {};
  const courseTitle = esc(layout.course.title || 'Course');
  const year = new Date().getFullYear();
  const footerClass = footer.footerClass || 'bg-surface-dim w-full py-12 border-t border-on-surface/5';

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
  console.log('V5 Course Builder — Design Contract Build');
  console.log('==========================================\n');

  // Read inputs
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('ERROR: course-layout.json not found');
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  console.log(`[ok] Loaded course-layout.json (${layout.sections.length} sections)`);

  // Load design contract — the ONLY interface to Stitch's visual design
  if (!fs.existsSync(CONTRACT_PATH)) {
    console.error('ERROR: design-contract.json not found. Run extract-contract.js first.');
    process.exit(1);
  }
  DC = JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf-8'));
  console.log(`[ok] Loaded design-contract.json (${Object.keys(DC).length} component contracts)`);

  // Load design tokens — the ONLY source for colours/fonts in the <head>
  if (!fs.existsSync(TOKENS_PATH)) {
    console.error('ERROR: design-tokens.json not found');
    process.exit(1);
  }
  const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
  console.log(`[ok] Loaded design-tokens.json (${Object.keys(tokens.colors || {}).length} colours, fonts: ${tokens.fonts?.headline}/${tokens.fonts?.body}, isDark: ${tokens.isDark})`);

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
      const filled = fillComponent(comp, compIndex);
      if (filled) {
        componentHtmls.push(filled);
        filledCount++;
      } else {
        console.log(`  [warn] Fill returned null for ${type}`);
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

  // Build nav and footer from contract
  const navHtml = buildNav(layout);
  const footerHtml = buildFooter(layout);

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
