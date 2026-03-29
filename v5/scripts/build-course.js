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
 *   3. Typography: text-display/h2/h3/h4/body-lg/body/label-text/blockquote/stat — Stitch-extracted scale
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

// Theme flag — set from design-tokens.json in main(). Used by fill functions
// to ensure text colours are readable on dark or light backgrounds.
let IS_DARK = true;

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

/** Standardise section classes: py-16 spacing + brand bg-* only.
 *  Section tags carry ONLY vertical spacing and background colour.
 *  Everything else — layout, visual, sizing, margin, overflow — is stripped.
 *  Spacing is STANDARDISED to py-16 so the gap between any two sections
 *  is always 128px (64px bottom of A + 64px top of B). */
function sectionOnly(cls) {
  const bgs = cls.split(/\s+/)
    .filter(t => /^(?:(?:sm|md|lg|xl|2xl):)?bg-/.test(t))
    .join(' ');
  return bgs ? `py-16 ${bgs}` : 'py-16';
}

/** Merge class strings, filtering empty/null, deduplicating */
function mc(...parts) {
  return parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

// ─── Typography parsing — converts Tailwind classes to CSS values ────
const TW_SIZE_MAP = {
  'text-xs': '0.75rem', 'text-sm': '0.875rem', 'text-base': '1rem',
  'text-lg': '1.125rem', 'text-xl': '1.25rem', 'text-2xl': '1.5rem',
  'text-3xl': '1.875rem', 'text-4xl': '2.25rem', 'text-5xl': '3rem',
  'text-6xl': '3.75rem', 'text-7xl': '4.5rem', 'text-8xl': '6rem',
};
const TW_WEIGHT_MAP = {
  'font-thin': '100', 'font-extralight': '200', 'font-light': '300',
  'font-normal': '400', 'font-medium': '500', 'font-semibold': '600',
  'font-bold': '700', 'font-extrabold': '800', 'font-black': '900',
};
const TW_LEADING_MAP = {
  'leading-none': '1', 'leading-tight': '1.25', 'leading-snug': '1.375',
  'leading-normal': '1.5', 'leading-relaxed': '1.625', 'leading-loose': '2',
};
const TW_TRACKING_MAP = {
  'tracking-tighter': '-0.05em', 'tracking-tight': '-0.025em',
  'tracking-normal': '0em', 'tracking-wide': '0.025em',
  'tracking-wider': '0.05em', 'tracking-widest': '0.1em',
};

/** Parse Tailwind typography class string into CSS values */
function parseTypoClasses(classStr) {
  if (!classStr) return {};
  const result = {};
  for (const p of classStr.split(/\s+/)) {
    // Custom values: text-[10px], leading-[0.9], tracking-[0.2em]
    let m;
    if ((m = p.match(/^text-\[(.+)\]$/))) { result.fontSize = m[1]; continue; }
    if ((m = p.match(/^leading-\[(.+)\]$/))) { result.lineHeight = m[1]; continue; }
    if ((m = p.match(/^tracking-\[(.+)\]$/))) { result.letterSpacing = m[1]; continue; }
    // Responsive desktop override: md:text-8xl → fontSizeDesktop
    if ((m = p.match(/^md:text-(.+)$/))) {
      const mapped = TW_SIZE_MAP[`text-${m[1]}`];
      if (mapped) result.fontSizeDesktop = mapped;
      continue;
    }
    // Standard mappings
    if (TW_SIZE_MAP[p]) { result.fontSize = TW_SIZE_MAP[p]; continue; }
    if (TW_WEIGHT_MAP[p]) { result.fontWeight = TW_WEIGHT_MAP[p]; continue; }
    if (TW_LEADING_MAP[p]) { result.lineHeight = TW_LEADING_MAP[p]; continue; }
    if (TW_TRACKING_MAP[p]) { result.letterSpacing = TW_TRACKING_MAP[p]; continue; }
  }
  return result;
}

/** Merge parsed typography: Stitch provides weight only, we control size/spacing.
 *  Stitch designs the visual character (bold vs light), but the size scale is a
 *  layout decision — we own it for cross-brand consistency and readability. */
function mergeTypo(stitch, defaults) {
  const s = parseTypoClasses(stitch || '');
  const d = parseTypoClasses(defaults);
  // Only take fontWeight from Stitch — size, lineHeight, letterSpacing are ours
  return { ...d, ...(s.fontWeight ? { fontWeight: s.fontWeight } : {}) };
}

/** Build Tailwind fontSize config entry string: ["size", { lineHeight, fontWeight, ... }] */
function fzEntry(t) {
  const cfg = {};
  if (t.lineHeight) cfg.lineHeight = t.lineHeight;
  if (t.letterSpacing) cfg.letterSpacing = t.letterSpacing;
  if (t.fontWeight) cfg.fontWeight = t.fontWeight;
  return `["${t.fontSize}", ${JSON.stringify(cfg)}]`;
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

  // ── Typography scale — Stitch values with premium fallbacks ──────
  // Extracted from Stitch's raw HTML by extract-contract.js.
  // Fallbacks are premium-tuned: semibold headings, light lead text, normal body.
  const typo = tokens.typography || {};
  const T = {
    display:   mergeTypo(typo.h1,         'text-5xl font-bold tracking-tighter leading-[1.15]'),
    h2:        mergeTypo(typo.h2,         'text-3xl font-semibold leading-snug'),
    h3:        mergeTypo(typo.h3,         'text-xl font-semibold leading-snug'),
    h4:        (() => {
      // If Stitch's h4 is tiny (< 1rem, used as labels), use premium fallback for card titles
      const merged = mergeTypo(typo.h4, 'text-base font-medium leading-normal');
      const size = parseFloat(merged.fontSize) || 0;
      if (size > 0 && size < 1) return mergeTypo('', 'text-base font-medium leading-normal');
      return merged;
    })(),
    bodyLg:    mergeTypo(typo.bodyLarge,   'text-lg font-light leading-relaxed'),
    body:      mergeTypo(typo.body,        'text-base leading-relaxed'),
    label:     mergeTypo(typo.label,       'text-xs font-medium tracking-widest'),
    blockquote: mergeTypo(typo.blockquote, 'text-2xl font-light leading-relaxed'),
    stat:      mergeTypo(typo.statNumber,  'text-4xl font-extrabold'),
  };

  // Desktop display size (hero h1 responsive step-up)
  // If Stitch provided a desktop size, use it; otherwise scale up ~1.5x from base
  const displayXlSize = T.display.fontSizeDesktop || (() => {
    const base = parseFloat(T.display.fontSize) || 3;
    return (base * 1.5).toFixed(2) + 'rem';
  })();
  const displayXl = `"display-xl": ${fzEntry({ ...T.display, fontSize: displayXlSize })},`;

  // Build fontSize config for Tailwind
  const fontSizeEntries = `
                    "display": ${fzEntry(T.display)},
                    ${displayXl}
                    "h2": ${fzEntry(T.h2)},
                    "h3": ${fzEntry(T.h3)},
                    "h4": ${fzEntry(T.h4)},
                    "body-lg": ${fzEntry(T.bodyLg)},
                    "body": ${fzEntry(T.body)},
                    "label-text": ${fzEntry(T.label)},
                    "blockquote": ${fzEntry(T.blockquote)},
                    "stat": ${fzEntry(T.stat)}`;

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

<!-- GSAP + ScrollTrigger (scroll animations) -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.7/dist/ScrollTrigger.min.js"></script>

<!-- SplitType (text line reveals) -->
<script src="https://cdn.jsdelivr.net/npm/split-type@0.3.4/umd/index.min.js"></script>

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
                fontSize: {${fontSizeEntries}
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

    /* Scroll progress bar (injected by hydrate.js as #hydrate-progress) */
    #hydrate-progress {
        background: linear-gradient(90deg, ${secondary}, ${primary}) !important;
    }

    /* Nav drawer */
    .nav-drawer { scrollbar-width: thin; }
    .drawer-link-active .drawer-index { color: ${primary}; }

    /* Utility: hide details marker */
    details summary::-webkit-details-marker { display: none; }

    /* Custom scrollbar */
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: ${colors['surface-container-lowest'] || '#0e0e0e'}; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: ${colors['surface-variant'] || '#353535'}; border-radius: 10px; }

    /* Scroll animation initial states — hidden until GSAP reveals */
    [data-animate] { opacity: 0; }
    [data-animate="fade-up"] { transform: translateY(80px); }
    [data-animate="slide-in-left"] { transform: translateX(-120px); }
    [data-animate="slide-in-right"] { transform: translateX(120px); }
    [data-animate="scale-in"] { transform: scale(0.8); }
    [data-animate="clip-up"] { clip-path: inset(100% 0% 0% 0%); opacity: 1; }
    /* Hero is always visible (above fold) */
    [data-component-type="hero"] { opacity: 1 !important; transform: none !important; }
    [data-component-type="hero"] [data-animate] { opacity: 0; }
    /* Reduced motion: show everything immediately */
    @media (prefers-reduced-motion: reduce) {
      [data-animate] { opacity: 1 !important; transform: none !important; clip-path: none !important; }
    }



    /* Containment safety net */
    html, body { overflow-x: hidden; }
    img, video, iframe { max-width: 100%; }
    .line-clamp-4 { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }

    /* Course gate — blurred preview until path selection is made */
    [data-course-gate].gated {
        position: relative;
        max-height: 60vh;
        overflow: hidden;
        pointer-events: none;
        filter: blur(6px) saturate(0.5);
        opacity: 0.3;
        transition: filter 0.6s ease, opacity 0.6s ease, max-height 0.6s ease;
    }
    [data-course-gate].gated::after {
        content: '';
        position: absolute;
        bottom: 0; left: 0; right: 0;
        height: 200px;
        background: linear-gradient(to bottom, transparent, ${bg});
        pointer-events: none;
    }
    [data-course-gate]:not(.gated) {
        transition: filter 0.6s ease, opacity 0.6s ease, max-height 0.6s ease;
        max-height: none;
        filter: none;
        opacity: 1;
    }

    /* Section progress tracker */
    [data-section-gate] .section-lock-icon { display: inline; }
    [data-section-gate].section-complete .section-lock-icon { display: none; }
    [data-section-gate].section-complete .section-check-icon { display: inline; }
    [data-section-gate]:not(.section-complete) .section-check-icon { display: none; }

    /* Smooth card hover lift */
    .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .hover-lift:hover { transform: translateY(-2px); }

    /* Data table improved styling */
    table th { text-align: left; }

    /* Textarea focus glow */
    textarea:focus { box-shadow: 0 0 0 3px ${secondary}20; }

    /* Smooth section transitions */
    section { transition: opacity 0.3s ease; }

    /* Better form checkboxes */
    input[type="checkbox"]:checked { background-color: ${secondary}; border-color: ${secondary}; }
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
//   - Typography: text-display/h2/h3/h4/body-lg/body/label-text/blockquote/stat
//     (Stitch-extracted scale via Tailwind fontSize config in generateHead)
//
// Visual contract (from DC — different per brand):
//   - Shadows, hovers, transitions, gradients, rings
//   - Card backgrounds, border colours
//   - Button styles, input styles
//   - All with safe fallbacks
// ═══════════════════════════════════════════════════════════════════════

function fillHero(comp, variant) {
  const c = DC.hero || {};
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  const overlayGradient = c.overlayGradient || 'bg-gradient-to-t from-surface-dim via-surface-dim/80 to-surface-dim/40';
  const imgVisuals = c.imgVisuals || 'mix-blend-overlay opacity-40';

  const btn1 = c.btn1 || {};
  const btn1Bg = btn1.gradient || btn1.customClass || btn1.bg || 'bg-primary';
  const btn1Round = btn1.rounded || 'rounded-xl';
  const btn1Visual = btn1.visual || '';
  const btn1Text = btn1.textColor || 'text-on-primary';

  const btn2 = c.btn2 || {};
  const btn2Bg = btn2.bg || 'border border-outline-variant';
  const btn2Round = btn2.rounded || 'rounded-xl';
  const btn2Visual = btn2.visual || 'hover:bg-surface-variant transition-colors';

  const buttons = `<div class="flex gap-4 flex-wrap" data-animate="fade-up">
<button class="px-8 py-4 ${btn1Bg} ${btn1Text} ${btn1Round} font-bold ${btn1Visual}" data-hero-cta="begin">Begin Course</button>
</div>`;

  // ── Variant: split-screen ──
  if (variant === 'split-screen') {
    const sectionClass = c.section || 'relative min-h-screen flex items-center overflow-hidden';
    return `<section class="${sectionClass}" data-component-type="hero">
<div class="relative z-10 w-full grid grid-cols-1 md:grid-cols-2 min-h-screen">
<div class="flex flex-col justify-center px-8 md:px-16 py-20 md:py-0">
<h1 class="font-headline text-display md:text-display-xl mb-8 pb-1 text-on-surface" data-animate="fade-up" data-text-reveal>${title}</h1>
<p class="text-body-lg text-on-surface-variant max-w-lg mb-12" data-animate="fade-up">${bodyText}</p>
${buttons}
</div>
<div class="relative hidden md:block">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover" src="${imgSrc}"/>` : '<div class="absolute inset-0 bg-surface-container"></div>'}
<div class="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent"></div>
</div>
</div>
</section>`;
  }

  // ── Variant: minimal-text ──
  if (variant === 'minimal-text') {
    return `<section class="relative min-h-screen flex items-center overflow-hidden" data-component-type="hero">
<div class="relative z-10 max-w-7xl mx-auto px-8 md:px-16 py-20">
<div class="border-l-4 border-primary pl-8 md:pl-12">
<h1 class="font-headline text-display md:text-display-xl mb-8 pb-1 text-on-surface" data-animate="fade-up" data-text-reveal>${title}</h1>
<p class="text-body-lg text-on-surface-variant max-w-3xl mb-12" data-animate="fade-up">${bodyText}</p>
${buttons}
</div>
</div>
</section>`;
  }

  // ── Default variant: centered-overlay ──
  const sectionClass = c.section || 'relative min-h-screen flex items-center justify-center overflow-hidden';
  return `<section class="${sectionClass}" data-component-type="hero">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover ${imgVisuals}" src="${imgSrc}" data-parallax/>` : ''}
<div class="absolute inset-0 ${overlayGradient}"></div>
<div class="relative z-10 text-center max-w-7xl mx-auto px-8">
<h1 class="font-headline text-display md:text-display-xl mb-8 pb-1 text-white" data-animate="fade-up" data-text-reveal>${title}</h1>
<p class="text-body-lg text-white/80 max-w-3xl mx-auto mb-12" data-animate="fade-up">${bodyText}</p>
<div class="flex gap-4 justify-center flex-wrap" data-animate="fade-up">
<button class="px-8 py-4 ${btn1Bg} ${btn1Text} ${btn1Round} font-bold ${btn1Visual}" data-hero-cta="begin">Begin Course</button>
</div>
</div>
</section>`;
}

function fillText(comp, variant, maxW) {
  const c = DC.text || {};
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly(c.section || 'py-16');
  // Text uses narrower width for readability (~80 chars/line), but respects section width if narrow
  const textW = maxW === 'max-w-3xl' ? 'max-w-3xl' : 'max-w-6xl';

  if (variant === 'two-column') {
    return `<section class="${secClass}" data-component-type="text" data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-8">${title}</h2>` : ''}
<div class="columns-1 md:columns-2 gap-12 text-body-lg text-on-surface-variant">
${comp.body || ''}
</div>
</div>
</section>`;
  }

  if (variant === 'highlight-box') {
    return `<section class="${secClass}" data-component-type="text" data-animate="fade-up">
<div class="${textW} mx-auto px-8">
<div class="border-l-4 border-primary bg-surface-container/50 rounded-r-2xl p-8 md:p-10">
${title ? `<h2 class="font-headline text-h3 mb-4">${title}</h2>` : ''}
<div class="space-y-4 text-body-lg text-on-surface-variant">
${comp.body || ''}
</div>
</div>
</div>
</section>`;
  }

  // Default: standard
  return `<section class="${secClass}" data-component-type="text" data-animate="fade-up">
<div class="${textW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-6">${title}</h2>` : ''}
<div class="space-y-4 text-body-lg text-on-surface-variant">
${comp.body || ''}
</div>
</div>
</section>`;
}

function fillAccordion(comp, variant, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.accordion || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.accordion || {}).section || 'py-16');
  const bodyClass = c.bodyClass || 'mt-4 text-on-surface/80 leading-relaxed';

  const accentIcons = ['lightbulb', 'warning', 'verified', 'psychology', 'explore', 'tips_and_updates', 'auto_awesome', 'school'];

  // ── Variant: accent-border ──
  if (variant === 'accent-border') {
    // accent-border variant always uses a visible left accent regardless of Stitch contract
    const borderStyle = 'border-l-4 border-primary';
    const accentDetails = items.map((item, i) => {
      const icon = accentIcons[i % accentIcons.length];
      return `<details class="group glass-card rounded-2xl ${borderStyle} transition-all duration-300">
<summary class="flex items-center gap-4 cursor-pointer font-headline text-h4 px-8 py-6 hover:bg-on-surface/[0.03] transition-colors">
<span class="material-symbols-outlined text-primary flex-shrink-0">${icon}</span>
<span class="flex-1" data-edit-path="_items.${i}.title">${esc(item.title || '')}</span>
<span class="material-symbols-outlined group-open:rotate-180 transition-transform flex-shrink-0 ml-4 text-on-surface-variant/50">expand_more</span>
</summary>
<div class="${bodyClass} px-8 pb-8 ml-10" data-edit-path="_items.${i}.body" data-edit-html>
${item.body || ''}
</div>
</details>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="accordion">
<div class="${maxW} mx-auto px-8">
<h3 class="font-headline text-h3 mb-8" data-animate="fade-up">${title}</h3>
<div class="space-y-4" data-animate-stagger="fade-up">
${accentDetails}
</div>
</div>
</section>`;
  }

  // ── Default variant: standard ──
  const detailsClass = c.detailsClass || 'group glass-card rounded-2xl transition-all duration-300';
  const newDetails = items.map((item, i) =>
    `<details class="${detailsClass}">
<summary class="flex justify-between items-center cursor-pointer font-headline text-h4 px-8 py-6 hover:bg-on-surface/[0.03] transition-colors">
<span data-edit-path="_items.${i}.title">${esc(item.title || '')}</span>
<span class="material-symbols-outlined group-open:rotate-180 transition-transform flex-shrink-0 ml-4 text-secondary">expand_more</span>
</summary>
<div class="${bodyClass} px-8 pb-8" data-edit-path="_items.${i}.body" data-edit-html>
${item.body || ''}
</div>
</details>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="accordion">
<div class="${maxW} mx-auto px-8">
<h3 class="font-headline text-h3 mb-8" data-animate="fade-up">${title}</h3>
<div class="space-y-4" data-animate-stagger="fade-up">
${newDetails}
</div>
</div>
</section>`;
}

function fillMCQ(comp, variant, maxW) {
  const items = comp._items || [];
  const feedback = comp._feedback || {};
  const correctFeedback = stripTags(feedback.correct || 'Correct!');
  const incorrectFeedback = stripTags((feedback._incorrect && feedback._incorrect.final) || 'Not quite. Try again.');
  const c = DC.mcq || {};

  let correctIdx = items.findIndex(i => i.correct || i._shouldBeSelected);
  if (correctIdx < 0) correctIdx = 0;

  const questionText = stripTags(comp.instruction || comp.body || '');
  const title = esc(comp.displayTitle || 'Knowledge Check');

  const secClass = sectionOnly(c.section || 'py-20');

  // Card styling from contract
  const card = c.card || {};
  const cardClass = mc(
    card.bg || 'glass-card',
    'p-6 md:p-8',
    card.shadow || '',
    card.rounded || 'rounded-[2rem]',
    card.border || ''
  );

  // Always include text-on-surface so label is readable inside a glass card
  // (Stitch sometimes sets section text-white for dark section backgrounds; glass card is lighter)
  // Normalize Stitch sub-14px sizes to text-sm minimum
  const rawLabelClass = (c.labelClass || 'text-label-text').replace(/\btext-\[(?:[1-9]|1[0-3])px\]/g, 'text-sm');
  const labelClass = rawLabelClass + ' text-on-surface-variant';
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Draw metadata
  const dm = comp.drawMetadata || {};
  const drawAttrs = dm.drawCount && dm.poolSize
    ? ` data-draw-count="${dm.drawCount}" data-draw-pool="${dm.poolSize}"${dm.shuffle ? ' data-draw-shuffle' : ''}`
    : '';

  // ── Variant: grid ──
  if (variant === 'grid' && items.length <= 4) {
    const gridChoices = items.map((item, i) => {
      return `<button class="${mc(
        'flex flex-col items-center justify-center gap-3 p-6 md:p-8 rounded-2xl',
        'glass-card border border-outline-variant/20',
        'hover:bg-surface-container hover:border-secondary/50 hover:shadow-lg hover:shadow-secondary/5 transition-all cursor-pointer group text-center'
      )}" data-choice="${i}">
<span class="w-12 h-12 rounded-full border-2 border-outline-variant/40 group-hover:border-secondary group-hover:bg-secondary/10 flex items-center justify-center text-lg font-bold text-on-surface-variant group-hover:text-secondary transition-all">${optionLetters[i] || ''}</span>
<span class="text-on-surface font-medium leading-snug" data-edit-path="_items.${i}.text">${esc(item.text || '')}</span>
</button>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="mcq" data-interactive data-animate="fade-up" data-quiz data-correct="${correctIdx}" data-feedback-correct="${esc(correctFeedback)}" data-feedback-incorrect="${esc(incorrectFeedback)}"${drawAttrs}>
<div class="${maxW} mx-auto px-8">
<div class="${cardClass}">
<span class="${labelClass}" data-edit-path="displayTitle">${title}</span>
<h3 class="font-headline text-h3 mt-2 mb-10 text-center text-on-surface" data-edit-path="instruction">${questionText}</h3>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
${gridChoices}
</div>
<div class="mt-8 hidden" data-quiz-feedback></div>
</div>
</div>
</section>`;
  }

  // ── Default variant: stacked ──
  const newChoices = items.map((item, i) => {
    return `<button class="${mc(
      'w-full text-left flex items-center gap-5 p-5 md:p-6 rounded-xl',
      'bg-surface-container/60 border border-outline-variant/20',
      'hover:bg-surface-container hover:border-secondary/50 hover:shadow-lg hover:shadow-secondary/5 transition-all cursor-pointer group'
    )}" data-choice="${i}">
<span class="w-10 h-10 rounded-full border-2 border-outline-variant/40 group-hover:border-secondary group-hover:bg-secondary/10 flex items-center justify-center text-sm font-bold text-on-surface-variant group-hover:text-secondary transition-all flex-shrink-0">${optionLetters[i] || ''}</span>
<span class="text-on-surface leading-relaxed" data-edit-path="_items.${i}.text">${esc(item.text || '')}</span>
</button>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="mcq" data-interactive data-animate="fade-up" data-quiz data-correct="${correctIdx}" data-feedback-correct="${esc(correctFeedback)}" data-feedback-incorrect="${esc(incorrectFeedback)}"${drawAttrs}>
<div class="${maxW} mx-auto px-8">
<div class="${cardClass}">
<span class="${labelClass}" data-edit-path="displayTitle">${title}</span>
<h3 class="font-headline text-h3 mt-2 mb-8 text-on-surface" data-edit-path="instruction">${questionText}</h3>
<div class="space-y-4">
${newChoices}
</div>
<div class="mt-8 hidden" data-quiz-feedback></div>
</div>
</div>
</section>`;
}

function fillGraphicText(comp, index, variant, maxW) {
  const c = DC['graphic-text'] || {};
  const title = esc(comp.displayTitle || '');
  const bodyText = comp.body || '';
  const secClass = sectionOnly(c.section || 'py-16');
  const align = comp._imageAlign || (index % 2 === 0 ? 'right' : 'left');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  const glowClass = c.glowClass || '';
  const imgShadow = c.imgShadow || '';

  // ── Variant: overlap ──
  if (variant === 'overlap') {
    return `<section class="${secClass}" data-component-type="graphic-text">
<div class="${maxW} mx-auto px-8">
<div class="relative md:min-h-[450px]" data-animate="fade-up">
<div class="w-full md:w-[55%] ${align === 'left' ? 'md:ml-auto' : ''} rounded-2xl overflow-hidden aspect-[3/2] bg-surface-container ${imgShadow}">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-full object-cover" src="${imgSrc}"/>` : '<div class="w-full h-full bg-surface-container"></div>'}
</div>
<div class="relative md:absolute ${align === 'left' ? 'md:left-0' : 'md:right-0'} md:top-1/2 md:-translate-y-1/2 md:w-[55%] glass-card rounded-2xl p-8 md:p-10 mt-[-2rem] md:mt-0 mx-4 md:mx-0 ${imgShadow}">
<h2 class="font-headline text-h2 tracking-tight mb-4">${title}</h2>
<div class="text-body text-on-surface-variant space-y-4">${bodyText}</div>
</div>
</div>
</div>
</section>`;
  }

  // ── Variant: full-overlay ──
  if (variant === 'full-overlay') {
    const gradientDir = align === 'left' ? 'bg-gradient-to-r' : 'bg-gradient-to-l';
    return `<section class="relative min-h-[60vh] flex items-center overflow-hidden" data-component-type="graphic-text">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover" src="${imgSrc}" data-parallax/>` : '<div class="absolute inset-0 bg-surface-container"></div>'}
<div class="absolute inset-0 ${gradientDir} from-background via-background/85 to-background/20"></div>
<div class="${maxW} mx-auto px-8 relative z-10 py-20" data-animate="fade-up">
<div class="md:w-1/2 ${align === 'right' ? 'md:ml-auto' : ''}">
<h2 class="font-headline text-h2 tracking-tight mb-6">${title}</h2>
<div class="text-body-lg text-on-surface-variant leading-normal space-y-4">${bodyText}</div>
</div>
</div>
</section>`;
  }

  // ── Default variant: split ──
  const imageDiv = `<div class="w-full md:w-1/2 flex-shrink-0 min-w-0${align === 'left' ? ' order-2 md:order-1' : ''}" data-animate="${align === 'left' ? 'slide-in-left' : 'slide-in-right'}">
<div class="relative group overflow-hidden">
${glowClass ? `<div class="${glowClass}"></div>` : ''}
<div class="relative rounded-2xl overflow-hidden aspect-[4/3] ${imgShadow} bg-surface-container">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-full object-cover rounded-2xl" src="${imgSrc}"/>` : '<div class="w-full h-full bg-surface-container rounded-2xl"></div>'}
</div>
</div>
</div>`;

  const textDiv = `<div class="w-full md:w-1/2 flex-shrink-0 min-w-0${align === 'left' ? ' order-1 md:order-2' : ''} flex flex-col justify-center" data-animate="fade-up">
<h2 class="font-headline text-h2 tracking-tight mb-6">${title}</h2>
<div class="text-body-lg text-on-surface-variant leading-normal space-y-4">${bodyText}</div>
</div>`;

  return `<section class="${secClass} min-h-[70vh] overflow-x-hidden" data-component-type="graphic-text">
<div class="${maxW} mx-auto px-4 md:px-8">
<div class="flex flex-col md:flex-row gap-8 md:gap-12 items-center">
${align === 'left' ? imageDiv + textDiv : textDiv + imageDiv}
</div>
</div>
</section>`;
}

// Returns the right heading text class based on card background class name.
// Covers MD3 semantic pairs and inverse patterns Stitch sometimes uses.
function bentoCardTextClass(bgClass) {
  if (!bgClass) return 'text-on-surface';
  const b = bgClass.toLowerCase();
  // Container variants (lighter tones) — use on-*-container
  if (b.includes('primary-container'))   return 'text-on-primary-container';
  if (b.includes('secondary-container')) return 'text-on-secondary-container';
  if (b.includes('tertiary-container'))  return 'text-on-tertiary-container';
  if (b.includes('error-container'))     return 'text-on-error-container';
  // Saturated accent backgrounds — use on-* (white/light)
  if (b.includes('primary'))   return 'text-on-primary';
  if (b.includes('secondary')) return 'text-on-secondary';
  if (b.includes('tertiary'))  return 'text-on-tertiary';
  if (b.includes('error'))     return 'text-on-error';
  // Inverse: Stitch uses on-background/on-surface as a dark card bg — pair with surface colour
  if (b.includes('on-background') || b.includes('on-surface') || b.includes('inverse-surface')) {
    return 'text-inverse-on-surface';
  }
  return 'text-on-surface';
}
function bentoCardSubtextClass(bgClass) {
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

function fillBento(comp, variant, maxW) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const c = DC.bento || {};
  const secClass = sectionOnly((DC.bento || {}).section || 'py-16');

  const icons = ['bolt', 'speed', 'shield', 'memory', 'hub', 'star', 'lightbulb', 'science'];
  const cardBgs = c.cardBgs || [];
  const imgHover = c.imgHover || 'group-hover:scale-110 transition-transform duration-700';

  // ── Variant: wide-2 ──
  if (variant === 'wide-2') {
    const wideCards = items.map((item, i) => {
      const bg = cardBgs[i] || cardBgs[0] || 'glass-card';
      const headCls = bentoCardTextClass(bg);
      const subtextCls = bentoCardSubtextClass(bg);
      return `<div class="${bg} rounded-3xl p-8 md:p-10 flex items-start gap-6 min-h-[140px] overflow-hidden">
<div class="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
<span class="material-symbols-outlined text-secondary text-2xl">${icons[i % icons.length]}</span>
</div>
<div class="min-w-0 flex-1">
<h4 class="font-headline text-h4 mb-2 ${headCls}" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="${subtextCls} text-body" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="bento">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-10">${title}</h2>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6" data-animate-stagger="fade-up">
${wideCards}
</div>
</div>
</section>`;
  }

  // ── Variant: featured ──
  if (variant === 'featured') {
    const featuredCards = items.map((item, i) => {
      const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
      if (i === 0) {
        const featBg = cardBgs[0] || 'bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent glass-card';
        return `<div class="md:col-span-2 md:row-span-2 rounded-3xl p-6 md:p-8 flex flex-col justify-end relative overflow-hidden group min-h-[320px] ${featBg}">
${imgSrc ? `<img alt="" class="absolute inset-0 w-full h-full object-cover opacity-15 ${imgHover}" src="${imgSrc}"/>` : ''}
<div class="relative z-10">
<span class="material-symbols-outlined text-primary text-5xl mb-4">${icons[0]}</span>
<h4 class="font-headline text-h3 mb-3 text-on-surface" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-body text-on-surface-variant" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>
</div>`;
      }
      const bgN = cardBgs[i] || cardBgs[cardBgs.length - 1] || 'glass-card';
      const headCls = bentoCardTextClass(bgN);
      const subtextCls = bentoCardSubtextClass(bgN);
      return `<div class="${bgN} rounded-3xl p-6 md:p-8 flex flex-col min-h-[160px] overflow-hidden">
<span class="material-symbols-outlined text-secondary text-3xl mb-4">${icons[i % icons.length]}</span>
<h4 class="font-headline text-h4 mb-2 ${headCls}" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-sm ${subtextCls} leading-relaxed" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="bento">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-10">${title}</h2>
<div class="grid grid-cols-1 md:grid-cols-4 gap-5 auto-rows-auto" data-animate-stagger="fade-up">
${featuredCards}
</div>
</div>
</section>`;
  }

  // ── Default variant: grid-4 ──
  const newCards = items.map((item, i) => {
    if (i === 0) {
      const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
      const bg0 = cardBgs[0] || 'glass-card';
      const headCls0 = bentoCardTextClass(bg0);
      const subtextCls0 = bentoCardSubtextClass(bg0);
      return `<div class="md:col-span-2 md:row-span-2 ${bg0} rounded-3xl p-6 md:p-8 flex flex-col justify-center relative overflow-hidden group min-h-[200px]">
${imgSrc ? `<img alt="" class="absolute inset-0 w-full h-full object-cover opacity-20 ${imgHover}" src="${imgSrc}"/>` : ''}
<div class="relative z-10">
<span class="material-symbols-outlined text-secondary text-4xl mb-3">${icons[0]}</span>
<h4 class="font-headline text-h4 mb-2 ${headCls0}" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="${subtextCls0} text-body" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }
    if (i <= 2 && items.length > 3) {
      const bgI = cardBgs[i] || 'glass-card';
      const headClsI = bentoCardTextClass(bgI);
      const subtextClsI = bentoCardSubtextClass(bgI);
      return `<div class="md:col-span-1 ${bgI} rounded-3xl p-6 md:p-8 flex flex-col min-h-[180px] overflow-hidden">
<span class="material-symbols-outlined text-secondary text-3xl mb-4">${icons[i % icons.length]}</span>
<div class="min-w-0 flex-1">
<h4 class="font-headline text-h4 mb-2 ${headClsI}" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="${subtextClsI} text-body line-clamp-4" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }
    const bgN = cardBgs[i] || cardBgs[cardBgs.length - 1] || 'glass-card';
    const bgShadow = (c.cardShadows || [])[i] || '';
    const headClsN = bentoCardTextClass(bgN);
    const subtextClsN = bentoCardSubtextClass(bgN);
    return `<div class="${i >= 3 && items.length > 4 ? 'md:col-span-2' : ''} ${bgN} rounded-3xl p-6 md:p-8 flex flex-col min-h-[160px] overflow-hidden ${bgShadow}">
<span class="material-symbols-outlined text-secondary text-3xl mb-4">${icons[i % icons.length]}</span>
<h4 class="font-headline text-h4 mb-2 ${headClsN}" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-sm ${subtextClsN} leading-relaxed" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="bento">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-10">${title}</h2>
<div class="grid grid-cols-1 md:grid-cols-4 gap-5 auto-rows-auto" data-animate-stagger="fade-up">
${newCards}
</div>
</div>
</section>`;
}

function fillDataTable(comp, variant, maxW) {
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['data-table'] || {}).section || 'py-16');
  const body = comp.body || '';

  let columns = comp.columns || [];
  let rows = comp.rows || comp._rows || [];
  let bodyUsedForTable = false;

  // Fallback: parse pipe-separated data from body <li> elements
  if (columns.length === 0 && rows.length === 0 && body) {
    const liMatches = body.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    if (liMatches.length >= 2) {
      const parsedRows = liMatches.map(li => stripTags(li).split('|').map(c => c.trim()));
      // First row = headers
      if (parsedRows.length > 0 && parsedRows[0].length >= 2) {
        rows = parsedRows;
        bodyUsedForTable = true; // Don't render body HTML above the table
      }
    }
  }

  let headerHtml = '';
  let bodyHtml = '';

  if (columns.length > 0) {
    headerHtml = columns.map(c => `<th class="px-8 py-4 text-label-text uppercase text-on-surface-variant">${esc(c.title || '')}</th>`).join('');
    bodyHtml = rows.map((row, ri) => {
      const label = row.label || '';
      const vals = row.values || [];
      const cells = vals.map(v => {
        if (v === true || v === 'true') return '<td class="px-8 py-4 text-secondary">&#10003;</td>';
        if (v === false || v === 'false') return '<td class="px-8 py-4 text-error">&#10007;</td>';
        return `<td class="px-8 py-4 text-on-surface-variant">${esc(String(v))}</td>`;
      }).join('');
      return `<tr class="${ri % 2 === 0 ? 'bg-on-surface/[0.02]' : ''} hover:bg-on-surface/5 transition-colors"><td class="px-8 py-4 font-medium">${esc(label)}</td>${cells}</tr>`;
    }).join('\n');
    headerHtml = `<th class="px-8 py-4 text-label-text uppercase text-on-surface-variant"></th>` + headerHtml;
  } else if (rows.length > 0 && Array.isArray(rows[0])) {
    const headers = rows[0];
    headerHtml = headers.map(h => `<th class="px-8 py-4 text-label-text uppercase text-on-surface-variant">${esc(h)}</th>`).join('');
    bodyHtml = rows.slice(1).map((row, ri) =>
      `<tr class="${ri % 2 === 0 ? 'bg-on-surface/[0.02]' : ''} hover:bg-on-surface/5 transition-colors">${row.map((cell, ci) => `<td class="px-8 py-4${ci === 0 ? ' font-medium' : ' text-on-surface-variant'}">${esc(cell)}</td>`).join('')}</tr>`
    ).join('\n');
  }

  // ── Variant: striped-card — table inside a prominent card with stronger striping ──
  if (variant === 'striped-card') {
    return `<section class="${secClass}" data-component-type="data-table" data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
${body && !bodyUsedForTable ? `<div class="mb-6 text-on-surface-variant">${body}</div>` : ''}
<div class="overflow-hidden rounded-2xl glass-card shadow-lg">
<div class="px-8 py-6 bg-surface-container border-b border-on-surface/10">
<h3 class="text-h3 tracking-tight">${title}</h3>
</div>
<div class="overflow-x-auto">
<table class="w-full text-left border-collapse">
<thead><tr class="bg-primary/10">${headerHtml.replace(/text-on-surface-variant/g, 'text-on-surface')}</tr></thead>
<tbody class="divide-y divide-on-surface/5">${bodyHtml.replace(/bg-on-surface\/\[0\.02\]/g, 'bg-surface-container/50')}</tbody>
</table>
</div>
</div>
</div>
</section>`;
  }

  // ── Default variant: standard ──
  return `<section class="${secClass}" data-component-type="data-table" data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
${body && !bodyUsedForTable ? `<div class="mb-6 text-on-surface-variant">${body}</div>` : ''}
<div class="overflow-hidden rounded-xl border border-on-surface/5 glass">
<div class="px-8 py-6 border-b border-on-surface/5">
<h3 class="text-h3 tracking-tight">${title}</h3>
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

function fillTextInput(comp, maxW) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const c = DC.textinput || {};
  const secClass = sectionOnly((DC.textinput || {}).section || 'py-16 bg-surface-container-low');

  const cardClass = (c.cardClass || 'glass-card p-12 rounded-[2rem]').replace(/\bp-12\b/, 'p-6 md:p-12');
  const inputClass = c.inputClass || 'w-full bg-surface-container-lowest border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50 focus:border-secondary';

  const newInputs = items.map((item, i) =>
    `<div>
<label class="block text-label-text uppercase text-on-surface mb-3" data-edit-path="_items.${i}.label">${esc(item.prefix || item.label || '')}</label>
<textarea class="${inputClass} min-h-[80px] resize-y" placeholder="${esc(item.placeholder || '')}" rows="2"></textarea>
</div>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="textinput" data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
<div class="${cardClass}">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="space-y-8">
${newInputs}
<button class="btn-primary px-8 py-4 rounded-xl font-bold text-on-primary w-full">Submit</button>
</div>
</div>
</div>
</section>`;
}

function fillPathSelector(comp, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const title = esc(comp.displayTitle || 'Choose Your Learning Path');
  const bodyText = stripTags(comp.body || '');
  const instruction = esc(comp.instruction || 'Select your role below.');
  const c = DC['path-selector'] || DC.branching || {};
  const secClass = sectionOnly((c).section || 'py-16');

  const btn = c.button || {};
  const btnVisuals = btn.visual || 'hover:bg-surface-variant transition-all border border-transparent hover:border-secondary/30';
  const btnBg = btn.bg || 'bg-surface-variant/30';
  const btnRound = btn.rounded || 'rounded-2xl';

  const newButtons = items.map((item, i) =>
    `<button class="group p-6 md:p-8 ${btnBg} ${btnRound} text-left ${btnVisuals} transition-all duration-300" data-path-option data-path-variable="${esc(item.variable || '')}">
<div class="text-h4 mb-2" data-edit-path="_items.${i}.title">${esc(item.title || '')}</div>
<div class="text-sm text-on-surface-variant" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</div>
</button>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="path-selector" data-interactive data-path-selector>
<div class="${maxW} mx-auto px-8">
<h3 class="font-headline text-h3 mb-4 text-center">${title}</h3>
${bodyText ? `<p class="text-body-lg text-on-surface-variant mb-4 text-center">${bodyText}</p>` : ''}
<p class="text-sm text-on-surface-variant mb-10 text-center italic">${instruction}</p>
<div class="grid grid-cols-1 md:grid-cols-${Math.min(items.length, 3)} gap-6" data-animate-stagger="scale-in">
${newButtons}
</div>
</div>
</section>`;
}

function fillBranching(comp, variant, maxW) {
  let items = comp._items || [];
  // Fallback: if no _items but body has <li> elements, extract them as options
  let scenarioText = '';
  if (items.length === 0 && comp.body) {
    const liMatches = comp.body.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    if (liMatches.length > 0) {
      items = liMatches.map(li => ({ title: stripTags(li) }));
      // Detect scenario pattern: first item is a long description (no letter prefix)
      // that is significantly longer than the remaining items (true scenario vs equal options).
      if (items.length > 2) {
        const first = items[0].title || '';
        const hasLetterPrefix = /^[A-D][\.\):\s—–-]/.test(first.trim());
        const isLong = first.length > 80;
        const avgRest = items.slice(1).reduce((s, it) => s + (it.title || '').length, 0) / (items.length - 1);
        const isScenario = isLong && first.length > avgRest * 2;
        if (!hasLetterPrefix && isScenario) {
          scenarioText = first;
          items = items.slice(1);
        }
      }
      // Strip letter prefixes (A., B., C.) from option text
      items = items.map(item => ({
        ...item,
        title: (item.title || '').replace(/^[A-Z][\.\):\s—–-]\s*/i, '')
      }));
    }
  }
  const title = esc(comp.displayTitle || '');
  const bodyText = scenarioText || (items.length > 0 ? '' : stripTags(comp.body || ''));
  const c = DC.branching || {};
  const secClass = sectionOnly((DC.branching || {}).section || 'py-16');

  const btn = c.button || {};
  const btnVisuals = btn.visual || 'hover:bg-surface-container-high transition-all border border-outline-variant/20 hover:border-secondary/30';
  const btnBg = btn.bg || 'glass-card';
  const btnRound = btn.rounded || 'rounded-2xl';

  const hasArrow = c.hasArrow || false;
  const arrowClass = c.arrowClass || 'mt-4 inline-flex items-center gap-2 text-primary font-bold group-hover:translate-x-2 transition-transform';

  // ── Variant: list — vertical stacked list with numbered indicators ──
  if (variant === 'list') {
    const listItems = items.map((item, i) =>
      `<button class="group flex items-start gap-5 p-5 md:p-6 ${btnBg} rounded-xl text-left ${btnVisuals} w-full">
<div class="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold">${String.fromCharCode(65 + i)}</div>
<div class="flex-1 min-w-0">
<div class="text-h4 text-on-surface" data-edit-path="_items.${i}.title">${esc(item.title || '')}</div>
${(item.body || '') ? `<div class="text-body text-on-surface-variant mt-1" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</div>` : ''}
</div>
<span class="material-symbols-outlined text-on-surface-variant/40 group-hover:text-secondary transition-colors self-center">chevron_right</span>
</button>`
    ).join('\n');

    return `<section class="${secClass}" data-component-type="branching" data-interactive>
<div class="${maxW} mx-auto px-8">
<h3 class="font-headline text-h3 mb-8">${title}</h3>
${bodyText ? `<p class="text-body-lg text-on-surface-variant mb-8 italic">${bodyText}</p>` : ''}
<div class="flex flex-col gap-3" data-animate-stagger="fade-up">
${listItems}
</div>
</div>
</section>`;
  }

  // ── Default variant: cards — grid of option cards ──
  const newButtons = items.map((item, i) =>
    `<button class="group p-6 md:p-8 ${btnBg} ${btnRound} text-left ${btnVisuals} relative overflow-hidden">
<span class="absolute bottom-2 right-3 text-4xl font-headline font-black text-primary/8 group-hover:text-secondary/15 transition-colors select-none leading-none">${String.fromCharCode(65 + i)}</span>
<div class="relative z-10">
<div class="text-h4 text-on-surface mb-2" data-edit-path="_items.${i}.title">${esc(item.title || '')}</div>
<div class="text-body text-on-surface-variant" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</div>
${hasArrow ? `<span class="${arrowClass}">Choose <span class="material-symbols-outlined">arrow_forward</span></span>` : ''}
</div>
</button>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="branching" data-interactive>
<div class="${maxW} mx-auto px-8">
<h3 class="font-headline text-h3 mb-8 text-center">${title}</h3>
${bodyText ? `<p class="text-body-lg text-on-surface-variant mb-8 text-center italic">${bodyText}</p>` : ''}
<div class="grid grid-cols-1 md:grid-cols-2 gap-5" data-animate-stagger="fade-up">
${newButtons}
</div>
</div>
</section>`;
}

function fillTimeline(comp, variant, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.timeline || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.timeline || {}).section || 'py-16');

  // ── Variant: centered-alternating ──
  if (variant === 'centered-alternating') {
    const altSteps = items.map((item, i) => {
      const num = String(i + 1).padStart(2, '0');
      const isLeft = i % 2 === 0;
      return `<div class="relative flex items-center ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} gap-8">
<div class="hidden md:block md:w-[calc(50%-2rem)] ${isLeft ? 'text-right' : 'text-left'}">
<div class="glass-card rounded-2xl p-5 md:p-6 inline-block ${isLeft ? 'ml-auto' : 'mr-auto'}">
<h4 class="font-headline text-h4 mb-2" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant text-sm leading-normal" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>
</div>
<div class="relative z-10 flex-shrink-0">
<div class="w-10 h-10 rounded-full bg-primary border-4 border-background flex items-center justify-center text-on-primary text-sm font-bold shadow-lg">${num}</div>
</div>
<div class="md:w-[calc(50%-2rem)] md:hidden">
<h4 class="font-headline text-h4 mb-2" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant text-sm leading-normal" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>
<div class="hidden md:block md:w-[calc(50%-2rem)]"></div>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="timeline">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-12 text-center">${title}</h2>
<div class="relative">
<div class="hidden md:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-outline-variant/30 -translate-x-1/2"></div>
<div class="space-y-8" data-animate-stagger="fade-up">
${altSteps}
</div>
</div>
</div>
</section>`;
  }

  // ── Default variant: vertical ──
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
<h4 class="font-headline text-h4 mb-2" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="timeline">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-10 text-center">${title}</h2>
<div class="space-y-0" data-animate-stagger="fade-up">
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
    const titleClass = i === 0 ? 'font-headline text-h4 text-secondary mb-2' : 'font-headline text-h4 mb-2';
    return `<div class="relative pl-14">
<div class="${dotClass}"></div>
<div class="text-primary/30 font-headline font-black text-sm uppercase tracking-widest mb-1">${num}</div>
<div class="${titleClass}" data-edit-path="_items.${i}.title">${esc(item.title || '')}</div>
<p class="text-body text-on-surface-variant" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="timeline">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-10 text-center">${title}</h2>
<div class="relative border-l-2 border-outline-variant ml-4 space-y-10" data-animate-stagger="fade-up">
${newSteps}
</div>
</div>
</section>`;
}

function fillComparison(comp, variant, maxW) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly((DC.comparison || {}).section || 'py-16');

  const columns = comp.columns || comp._columns || [];
  const rows = comp.rows || [];
  if (columns.length === 0) return '';

  // ── Variant: stacked-rows (2-column only) ──
  if (variant === 'stacked-rows' && columns.length === 2) {
    const stackedRows = rows.map((row, ri) => {
      const label = row.label || '';
      const vals = row.values || [];
      const renderVal = (v) => {
        if (v === true || v === 'true') return '<span class="material-symbols-outlined text-secondary text-xl">check_circle</span>';
        if (v === false || v === 'false') return '<span class="material-symbols-outlined text-error/60 text-xl">cancel</span>';
        return `<span class="text-on-surface-variant text-sm">${esc(String(v))}</span>`;
      };
      return `<div class="glass-card rounded-xl px-5 py-3 flex flex-col md:flex-row items-center gap-2 md:gap-4">
<div class="flex-shrink-0 px-3 py-1 bg-surface-container rounded-full text-label-text uppercase text-on-surface text-center md:order-2" data-edit-path="rows.${ri}.label">${esc(label)}</div>
<div class="flex-1 text-center md:text-right md:order-1">${renderVal(vals[0])}</div>
<div class="flex-1 text-center md:text-left md:order-3">${renderVal(vals[1])}</div>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="comparison" data-animate="fade-up">
<div class="${maxW} mx-auto px-4 md:px-8">
<h2 class="font-headline text-h2 mb-8 text-center">${title}</h2>
${body ? `<p class="text-center text-on-surface-variant mb-8">${stripTags(body)}</p>` : ''}
<div class="flex justify-between mb-6 px-4">
<span class="font-headline text-h4 text-primary" data-edit-path="columns.0.title">${esc(columns[0].title || '')}</span>
<span class="font-headline text-h4 text-secondary" data-edit-path="columns.1.title">${esc(columns[1].title || '')}</span>
</div>
<div class="space-y-3" data-animate-stagger="fade-up">
${stackedRows}
</div>
</div>
</section>`;
  }

  // ── Default variant: columns ──
  const headerHtml = `<th class="px-5 py-3 font-bold uppercase tracking-widest text-sm text-on-surface-variant"></th>` +
    columns.map(c => `<th class="px-5 py-3 font-bold uppercase tracking-widest text-sm text-primary">${esc(c.title || '')}</th>`).join('');

  const rowsHtml = rows.map((row, ri) => {
    const label = row.label || '';
    const vals = (row.values || []).map(v => {
      if (v === true || v === 'true') return '<td class="px-5 py-3 text-center"><span class="material-symbols-outlined text-secondary text-xl">check_circle</span></td>';
      if (v === false || v === 'false') return '<td class="px-5 py-3 text-center"><span class="material-symbols-outlined text-error/60 text-xl">cancel</span></td>';
      return `<td class="px-5 py-3 text-on-surface-variant">${esc(String(v))}</td>`;
    }).join('');
    return `<tr class="${ri % 2 === 0 ? 'bg-on-surface/[0.02]' : ''} hover:bg-on-surface/5 transition-colors border-b border-on-surface/5 last:border-0"><td class="px-5 py-3 font-bold">${esc(label)}</td>${vals}</tr>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="comparison" data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-8 text-center">${title}</h2>
${body ? `<p class="text-center text-on-surface-variant mb-10">${stripTags(body)}</p>` : ''}
<div class="overflow-x-auto glass rounded-3xl border border-on-surface/5">
<table class="w-full text-left">
<thead class="bg-on-surface/5"><tr>${headerHtml}</tr></thead>
<tbody class="divide-y divide-on-surface/5">${rowsHtml}</tbody>
</table>
</div>
</div>
</section>`;
}

function fillStatCallout(comp, variant, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC['stat-callout'] || {};
  const secClass = sectionOnly((DC['stat-callout'] || {}).section || 'py-16 bg-surface-container-low');

  const statStyles = c.stats || [];
  const hasSublabel = c.hasSublabel || false;
  // Use a single consistent accent color for all stats (first stat's color)
  const unifiedNumColor = (statStyles[0] || {}).numColor || 'text-secondary';

  // ── Variant: card-row ──
  if (variant === 'card-row') {
    // Extract all numeric values first, then make bars proportional to max
    const numericValues = items.map(item => {
      const numMatch = (item.stat || item.value || '').replace(/,/g, '').match(/[\d.]+/);
      return numMatch ? parseFloat(numMatch[0]) : 0;
    });
    const maxVal = Math.max(...numericValues, 1);

    const cardStats = items.map((item, i) => {
      const style = statStyles[i] || statStyles[0] || {};
      const numColor = unifiedNumColor;
      const numWeight = style.numWeight || 'font-extrabold';
      const displayValue = (item.prefix || '') + (item.stat || item.value || '') + (item.suffix || '');
      const barWidth = Math.max(Math.round((numericValues[i] / maxVal) * 100), 5);
      return `<div class="glass-card rounded-2xl p-6 md:p-8 min-w-[200px] flex flex-col">
<div class="text-stat font-headline ${numWeight} ${numColor} mb-2" data-counter data-edit-path="_items.${i}.value" data-stat-prefix="${esc(item.prefix||'')}" data-stat-suffix="${esc(item.suffix||'')}">${esc(displayValue)}</div>
<p class="text-on-surface-variant text-sm font-medium mb-4 flex-1" data-edit-path="_items.${i}.label">${esc(item.label || '')}</p>
<div class="h-1.5 bg-surface-container rounded-full overflow-hidden mt-auto">
<div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style="width:${barWidth}%"></div>
</div>
</div>`;
    }).join('\n');

    const colCount = Math.min(items.length, 4);
    return `<section class="${secClass}" data-component-type="stat-callout">
<div class="${maxW} mx-auto px-8">
<div class="grid grid-cols-1 sm:grid-cols-2 ${colCount > 2 ? `md:grid-cols-${colCount}` : ''} gap-6" data-animate-stagger="fade-up">
${cardStats}
</div>
</div>
</section>`;
  }

  // ── Default variant: centered ──
  const colCount = Math.min(items.length, 4);
  const gridCols = `grid-cols-2 md:grid-cols-${colCount}`;

  const newStats = items.map((item, i) => {
    const style = statStyles[i] || statStyles[0] || {};
    const cardBg = style.cardBg || '';
    const cardShadow = style.cardShadow || '';
    const cardRound = style.cardRounded || 'rounded-lg';
    const cardBorder = style.cardBorder || '';
    const numColor = unifiedNumColor;
    const numWeight = style.numWeight || 'font-extrabold';
    const displayValue = (item.prefix || '') + (item.stat || item.value || '') + (item.suffix || '');
    return `<div class="${mc('p-8', cardRound, cardBg, cardShadow, cardBorder, 'min-w-[120px]')}">
<div class="text-stat font-headline ${numWeight} ${numColor} mb-3" data-counter data-edit-path="_items.${i}.value" data-stat-prefix="${esc(item.prefix||'')}" data-stat-suffix="${esc(item.suffix||'')}">${esc(displayValue)}</div>
${hasSublabel ? `<div class="text-on-surface text-h4 mb-1" data-edit-path="_items.${i}.label">${esc(item.label || '')}</div>` : ''}
<p class="text-on-surface-variant ${hasSublabel ? 'font-light text-sm' : 'text-sm leading-snug font-medium mt-2'}" data-edit-path="_items.${i}.label">${esc(item.sublabel || (hasSublabel ? '' : item.label) || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="stat-callout">
<div class="${maxW} mx-auto px-8">
<div class="grid ${gridCols} gap-8 text-center" data-animate-stagger="fade-up">
${newStats}
</div>
</div>
</section>`;
}

function fillPullquote(comp, variant, maxW) {
  const quote = stripTags(comp.body || '');
  const attribution = esc(comp.attribution || '');
  const role = esc(comp.role || '');
  const c = DC.pullquote || {};
  const secClass = sectionOnly((DC.pullquote || {}).section || 'py-16');

  const bqStyle = c.blockquoteStyle || 'text-blockquote font-headline';
  const citeStyle = c.citeClass || 'text-on-surface-variant';

  // Scale down font for long quotes
  let quoteBqStyle = bqStyle;
  if (quote.length > 120) {
    quoteBqStyle = bqStyle
      .replace(/\btext-[5-9]xl\b/g, 'text-3xl')
      .replace(/\bmd:text-[5-9]xl\b/g, 'md:text-4xl');
  } else if (quote.length > 60) {
    quoteBqStyle = bqStyle
      .replace(/\btext-[6-9]xl\b/g, 'text-4xl')
      .replace(/\bmd:text-[6-9]xl\b/g, 'md:text-5xl');
  }

  const attrHtml = attribution ? `<p class="mt-4 text-on-surface-variant" data-animate="fade-up" data-edit-path="attribution">— ${attribution}${role ? `<span class="block text-sm mt-1 text-on-surface-variant/60">${role}</span>` : ''}</p>` : '';

  if (variant === 'centered') {
    // Centered with decorative quotes — large impact
    return `<section class="${secClass}" data-component-type="pullquote">
<div class="max-w-5xl mx-auto px-8 text-center">
<div class="flex justify-center mb-2">
${c.decorativeSpanHtml || '<span class="text-primary/10 text-[6rem] font-serif leading-none select-none pointer-events-none" aria-hidden="true">&ldquo;</span>'}
</div>
<blockquote class="${mc('font-headline', quoteBqStyle)}" data-text-reveal data-edit-path="body">${quote}</blockquote>
${attribution ? `<cite class="${mc('mt-6 block not-italic', citeStyle)}" data-animate="fade-up" data-edit-path="attribution">— ${attribution}${role ? `, ${role}` : ''}</cite>` : ''}
</div>
</section>`;
  }

  if (variant === 'minimal') {
    // Minimal — no decoration, just bold text on surface-container
    return `<section class="${sectionOnly('py-20 bg-surface-container-low')}" data-component-type="pullquote">
<div class="max-w-4xl mx-auto px-8 text-center">
<blockquote class="font-headline text-blockquote text-on-surface" data-animate="fade-up" data-edit-path="body">${quote}</blockquote>
${attribution ? `<p class="mt-6 text-sm text-on-surface-variant uppercase tracking-widest" data-animate="fade-up" data-edit-path="attribution">— ${attribution}${role ? ` · ${role}` : ''}</p>` : ''}
</div>
</section>`;
  }

  // Default: accent-bar — border-l with quote mark
  return `<section class="${secClass}" data-component-type="pullquote">
<div class="${maxW} mx-auto px-8">
<div class="relative pl-8 border-l-4 border-primary" data-animate="fade-up" data-accent-bar>
<span class="text-primary/20 text-7xl font-serif absolute -top-6 -left-1 leading-none select-none" aria-hidden="true">&ldquo;</span>
<blockquote class="${mc('font-headline', quoteBqStyle)}" data-text-reveal data-edit-path="body">${quote}</blockquote>
${attrHtml}
</div>
</div>
</section>`;
}

function fillChecklist(comp, variant, maxW) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const c = DC.checklist || {};
  const secClass = sectionOnly((DC.checklist || {}).section || 'py-16');

  const card = c.card || {};
  const cardClass = mc(card.bg || 'glass-card', 'p-6 md:p-8', card.rounded || 'rounded-3xl', card.shadow || '');
  const inputClass = c.inputClass || 'w-7 h-7 rounded border-outline-variant text-secondary focus:ring-secondary bg-transparent cursor-pointer';
  const labelHover = c.labelHover || 'hover:bg-surface-variant/50 transition-colors';
  const spanHover = c.spanHover || '';

  // ── Variant: card-style — each item as a separate card ──
  if (variant === 'card-style') {
    const cardItems = items.map((item, i) =>
      `<label class="flex items-center gap-5 p-6 glass-card rounded-2xl cursor-pointer group border border-outline-variant/10 ${labelHover}">
<input class="${inputClass}" type="checkbox"/>
<span class="text-on-surface font-medium ${spanHover ? 'group-hover:text-primary transition-colors' : ''}" data-edit-path="_items.${i}.text">${esc(item.text || item.title || '')}</span>
</label>`
    ).join('\n');

    return `<section class="${secClass}" data-component-type="checklist" data-interactive>
<div class="${maxW} mx-auto px-8" data-checklist data-animate="fade-up">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
${cardItems}
</div>
<div class="mt-6 text-sm text-on-surface-variant font-bold" data-checklist-progress>0 / ${items.length} complete</div>
</div>
</section>`;
  }

  // ── Variant: numbered — numbered list with checkboxes ──
  if (variant === 'numbered') {
    const numberedItems = items.map((item, i) =>
      `<label class="flex items-center gap-5 p-5 rounded-xl cursor-pointer group bg-surface-container/30 border border-outline-variant/10 ${labelHover}">
<div class="w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold text-sm">${i + 1}</div>
<input class="${inputClass}" type="checkbox"/>
<span class="text-on-surface font-medium ${spanHover ? 'group-hover:text-primary transition-colors' : ''}" data-edit-path="_items.${i}.text">${esc(item.text || item.title || '')}</span>
</label>`
    ).join('\n');

    return `<section class="${secClass}" data-component-type="checklist" data-interactive>
<div class="${maxW} mx-auto px-8">
<div class="${cardClass}" data-checklist data-animate="fade-up">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="space-y-2">
${numberedItems}
</div>
<div class="mt-6 text-sm text-on-surface-variant font-bold" data-checklist-progress>0 / ${items.length} complete</div>
</div>
</div>
</section>`;
  }

  // ── Default variant: standard ──
  const newLabels = items.map((item, i) =>
    `<label class="flex items-center gap-5 p-5 rounded-xl cursor-pointer group bg-surface-container/30 border border-outline-variant/10 ${labelHover}">
<input class="${inputClass}" type="checkbox"/>
<span class="text-on-surface font-medium ${spanHover ? 'group-hover:text-primary transition-colors' : ''}" data-edit-path="_items.${i}.text">${esc(item.text || item.title || '')}</span>
</label>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="checklist" data-interactive>
<div class="${maxW} mx-auto px-8">
<div class="${cardClass}" data-checklist data-animate="fade-up">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="space-y-2">
${newLabels}
</div>
<div class="mt-6 text-sm text-on-surface-variant font-bold" data-checklist-progress>0 / ${items.length} complete</div>
</div>
</div>
</section>`;
}

function fillTabs(comp, variant, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.tabs || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly(c.section || 'py-16 bg-surface-container-low');
  // Validate tab button classes — Stitch sometimes extracts the tab-list container
  // instead of individual button styles (no padding/bg = bad extraction)
  const activeFallback = 'px-6 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm tracking-wide';
  const inactiveFallback = 'px-6 py-3 rounded-full glass-card hover:bg-surface-variant transition-all text-on-surface-variant font-bold text-sm tracking-wide';
  // Replace any sub-14px text size from Stitch contract with text-sm minimum
  const normalizeTabSize = (cls) => cls ? cls.replace(/\btext-\[(?:[1-9]|1[0-3])px\]/g, 'text-sm') : cls;
  const rawActiveBtn = (c.activeBtn && /\bp[xy]?-\d/.test(c.activeBtn)) ? c.activeBtn : activeFallback;
  const rawInactiveBtn = (c.inactiveBtn && /\bp[xy]?-\d/.test(c.inactiveBtn)) ? c.inactiveBtn : inactiveFallback;
  // In dark themes, Material You `on-primary` is a dark colour (navy) meant for light primary buttons.
  // When the active tab button uses a gradient background (not `background-color`), the contrast
  // checker sees the dark page background — resulting in dark-on-dark. Force a readable light colour.
  const fixActiveBtnContrast = (cls) => {
    if (!IS_DARK) return cls;
    return cls
      .replace(/\btext-on-primary\b/g, 'text-on-surface')
      .replace(/\btext-on-primary-container\b/g, 'text-on-surface');
  };
  const activeBtn = fixActiveBtnContrast(normalizeTabSize(rawActiveBtn));
  const inactiveBtn = normalizeTabSize(rawInactiveBtn);

  // ── Variant: vertical ──
  if (variant === 'vertical') {
    const vActiveBtn = activeBtn.replace('rounded-full', 'rounded-xl').replace('text-sm', 'text-sm text-left');
    const vInactiveBtn = inactiveBtn.replace('rounded-full', 'rounded-xl').replace('text-sm', 'text-sm text-left');

    // On mobile: flex-row (scrollable), so no w-full — use flex-shrink-0 whitespace-nowrap
    // On desktop (md:): flex-col, so w-full is needed
    const vTriggers = items.map((item, i) =>
      `<button class="flex-shrink-0 md:w-full whitespace-nowrap md:whitespace-normal ${i === 0 ? vActiveBtn : vInactiveBtn}" data-tab-trigger="${i}"><span data-edit-path="_items.${i}.title">${esc(item.title || `Tab ${i + 1}`)}</span></button>`
    ).join('\n');

    const vPanels = items.map((item, i) =>
      `<div class="glass-card rounded-3xl p-6 md:p-8 min-h-[300px] w-full min-w-0 overflow-hidden" data-tab-panel="${i}"${i > 0 ? ' style="display:none"' : ''}>
<h4 class="font-headline text-h4 mb-4" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<div class="text-body text-on-surface-variant overflow-hidden" data-edit-path="_items.${i}.body" data-edit-html>${item.body || ''}</div>
</div>`
    ).join('\n');

    return `<section class="${secClass} overflow-x-hidden" data-component-type="tabs" data-interactive data-animate="fade-up">
<div class="${maxW} mx-auto px-4 md:px-8">
<h2 class="font-headline text-h2 mb-10">${title}</h2>
<div class="flex flex-col md:flex-row gap-6 min-w-0" data-tabs>
<div class="flex flex-row md:flex-col gap-2 md:w-64 flex-shrink-0 overflow-x-auto md:overflow-visible">
${vTriggers}
</div>
<div class="flex-1 min-w-0">
${vPanels}
</div>
</div>
</div>
</section>`;
  }

  // ── Default variant: horizontal ──
  const triggers = items.map((item, i) =>
    `<button class="${i === 0 ? activeBtn : inactiveBtn}" data-tab-trigger="${i}"><span data-edit-path="_items.${i}.title">${esc(item.title || `Tab ${i + 1}`)}</span></button>`
  ).join('\n');

  const panels = items.map((item, i) =>
    `<div class="glass-card rounded-3xl p-6 md:p-8 min-h-[300px] w-full min-w-0 overflow-hidden" data-tab-panel="${i}"${i > 0 ? ' style="display:none"' : ''}>
<h4 class="font-headline text-h4 mb-4" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<div class="text-body text-on-surface-variant overflow-hidden" data-edit-path="_items.${i}.body" data-edit-html>${item.body || ''}</div>
</div>`
  ).join('\n');

  return `<section class="${secClass} overflow-x-hidden" data-component-type="tabs" data-interactive data-animate="fade-up">
<div class="${maxW} mx-auto px-4 md:px-8">
<h2 class="font-headline text-h2 mb-10 text-center">${title}</h2>
<div data-tabs class="min-w-0">
<div class="flex flex-wrap justify-center gap-3 mb-8">
${triggers}
</div>
${panels}
</div>
</div>
</section>`;
}

function fillFlashcard(comp, variant, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';
  const c = DC.flashcard || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.flashcard || {}).section || 'py-16 bg-surface-container-low overflow-hidden');
  const icons = ['info', 'local_fire_department', 'pan_tool', 'bolt', 'shield', 'warning', 'speed', 'memory'];

  const front = c.front || {};
  const back = c.back || {};
  const useBoldFront = front.useBoldPrimary || false;

  const makeCard = (item, i, large) => {
    const frontText = esc(item.front || item.title || item.term || '');
    const backText = item.back || item.definition || item.body || '';
    const frontFaceClass = useBoldFront
      ? mc(front.bg, 'text-white', front.rounded || 'rounded-3xl', front.shadow || 'shadow-md', large ? 'p-10 md:p-14' : 'p-6 md:p-8')
      : mc('glass-card', front.rounded || 'rounded-3xl', front.shadow || 'shadow-md', 'border border-outline-variant/10', large ? 'p-10 md:p-14' : 'p-6 md:p-8');
    const backFaceClass = mc(back.bg || 'bg-secondary-container', back.border || '', back.rounded || 'rounded-3xl', large ? 'p-8 md:p-12 text-center' : 'p-4 md:p-5 text-center');
    return `<div class="group cursor-pointer h-full" style="perspective:1000px" data-flashcard>
<div class="relative w-full h-full transition-transform duration-500" style="transform-style:preserve-3d">
<div class="flex items-center justify-center h-full ${frontFaceClass}" style="backface-visibility:hidden">
<div class="text-center">
<div class="material-symbols-outlined ${useBoldFront ? 'text-white/80' : 'text-secondary'} text-${large ? '4' : '3'}xl mb-3">${icons[i % icons.length]}</div>
<div class="font-headline ${large ? 'text-h4' : 'text-body'} leading-snug" data-edit-path="_items.${i}.front">${frontText}</div>
<div class="mt-2 text-xs text-on-surface-variant/60 uppercase tracking-wider">Tap to reveal</div>
</div>
</div>
<div class="absolute inset-0 flex items-center justify-center ${backFaceClass} overflow-y-auto" style="backface-visibility:hidden;transform:rotateY(180deg)">
<p class="text-on-secondary-container font-medium text-${large ? 'base' : 'xs'} leading-snug" data-edit-path="_items.${i}.back">${backText}</p>
</div>
</div>
</div>`;
  };

  // ── Variant: single-large — one card at a time, carousel-style ──
  if (variant === 'single-large') {
    const largeCards = items.map((item, i) => {
      const cardHtml = makeCard(item, i, true);
      return `<div data-slide="${i + 1}"${i > 0 ? ' style="display:none"' : ''}>${cardHtml}</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="flashcard" data-interactive data-carousel>
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-10 text-center">${title}</h2>
<div class="max-w-4xl mx-auto">
${largeCards}
</div>
<div class="flex justify-center gap-3 mt-8">
<button class="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center hover:bg-secondary/20 transition-colors" data-prev>
<span class="material-symbols-outlined">chevron_left</span>
</button>
<span class="flex items-center text-sm text-on-surface-variant font-bold" data-slide-counter>1 / ${items.length}</span>
<button class="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center" data-next>
<span class="material-symbols-outlined">chevron_right</span>
</button>
</div>
</div>
</section>`;
  }

  // ── Default variant: grid ──
  const newCards = items.map((item, i) => makeCard(item, i, false)).join('\n');

  // Smart column count: avoid orphan rows (e.g., 5 cards in 3+2)
  // ≤3 → 3 cols, 4 → 2 cols (2x2), 5 → 5 cols, 6 → 3 cols (2x3), 7+ → 4 cols
  const n = items.length;
  const gridCols = n <= 3 ? `md:grid-cols-${n}` : n === 4 ? '' : n === 5 ? 'md:grid-cols-5' : n === 6 ? 'md:grid-cols-3' : 'md:grid-cols-4';

  return `<section class="${secClass}" data-component-type="flashcard" data-interactive>
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-10 text-center">${title}</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-6" data-animate-stagger="scale-in">
${newCards}
</div>
</div>
</section>`;
}

function fillNarrative(comp, variant, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';

  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  // Cap narrative py to py-16 — large Stitch py values create a dead zone above the carousel
  const secClass = sectionOnly((DC.narrative || {}).section || 'py-16')
    .replace(/\bpy-(\d+)\b/g, (m, n) => parseInt(n) > 16 ? 'py-16' : m);

  const navButtons = `<div class="flex justify-center gap-3 mt-6">
<button class="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center hover:bg-secondary/20 transition-colors" data-prev>
<span class="material-symbols-outlined">chevron_left</span>
</button>
<button class="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center" data-next>
<span class="material-symbols-outlined">chevron_right</span>
</button>
</div>`;

  // ── Variant: image-focused — large image with smaller text below ──
  if (variant === 'image-focused') {
    const imgSlides = items.map((item, i) => {
      const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
      const imgAlt = esc(item._graphic?.alt || item.title || '');
      const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
      return `<div data-slide="${i + 1}"${i > 0 ? ' style="display:none"' : ''}>
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-[400px] object-cover rounded-2xl mb-6" src="${imgSrc}"/>` : ''}
<div class="text-on-surface-variant font-bold mb-2">${counter}</div>
<h4 class="font-headline text-h4 mb-2 text-on-surface" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant text-sm" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="narrative" data-interactive data-carousel data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="glass-card rounded-[2.5rem] p-4 md:p-6 relative overflow-hidden">
${imgSlides}
${navButtons}
</div>
</div>
</section>`;
  }

  // ── Variant: text-focused — text-dominant, compact cards ──
  if (variant === 'text-focused') {
    const textSlides = items.map((item, i) => {
      const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
      return `<div data-slide="${i + 1}"${i > 0 ? ' style="display:none"' : ''}>
<div class="text-on-surface-variant font-bold mb-4">${counter}</div>
<h4 class="font-headline text-h3 mb-4 text-on-surface" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<div class="text-body text-on-surface-variant leading-normal" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</div>
</div>`;
    }).join('\n');

    return `<section class="${secClass}" data-component-type="narrative" data-interactive data-carousel data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="glass-card rounded-[2.5rem] p-6 md:p-8 relative">
${textSlides}
${navButtons}
</div>
</div>
</section>`;
  }

  // ── Default variant (image-focused is default per component-library) ──
  const newSlides = items.map((item, i) => {
    const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    return `<div data-slide="${i + 1}"${i > 0 ? ' style="display:none"' : ''}>
<div class="text-on-surface-variant font-bold mb-4">${counter}</div>
<h4 class="font-headline text-h4 mb-4 text-on-surface" data-edit-path="_items.${i}.title">${esc(item.title || '')}</h4>
<p class="text-sm text-on-surface-variant leading-normal" data-edit-path="_items.${i}.body">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="narrative" data-interactive data-carousel data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="glass-card rounded-[2.5rem] p-6 md:p-8 relative">
${newSlides}
${navButtons}
</div>
</div>
</section>`;
}

function fillKeyTerm(comp, variant, maxW) {
  const items = comp._items || [];
  if (items.length === 0) return '';

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['key-term'] || {}).section || 'py-16');

  // ── Variant: list — vertical definition list ──
  if (variant === 'list') {
    const listItems = items.map((item, i) =>
      `<div class="flex gap-6 p-5 border-b border-on-surface/5 last:border-0">
<div class="text-on-surface font-headline text-h4 w-48 flex-shrink-0" data-edit-path="_items.${i}.term">${esc(item.term || item.title || '')}</div>
<p class="text-on-surface-variant text-body flex-1" data-edit-path="_items.${i}.definition">${esc(item.definition || item.body || '')}</p>
</div>`
    ).join('\n');

    return `<section class="${secClass}" data-component-type="key-term">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="glass-card rounded-2xl overflow-hidden" data-animate="fade-up">
${listItems}
</div>
</div>
</section>`;
  }

  // ── Default variant: card-grid ──
  const cols = items.length <= 2 ? items.length : items.length === 4 ? 2 : 3;
  const newCards = items.map((item, i) =>
    `<div class="glass-card p-6 md:p-8 rounded-2xl overflow-hidden border-l-4 border-primary">
<div class="text-on-surface font-headline text-h4 mb-3" data-edit-path="_items.${i}.term">${esc(item.term || item.title || '')}</div>
<p class="text-on-surface-variant text-body" data-edit-path="_items.${i}.definition">${esc(item.definition || item.body || '')}</p>
</div>`
  ).join('\n');

  return `<section class="${secClass}" data-component-type="key-term">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-8">${title}</h2>
<div class="grid grid-cols-1 sm:grid-cols-2 ${cols === 3 ? 'md:grid-cols-3' : ''} gap-6" data-animate-stagger="fade-up">
${newCards}
</div>
</div>
</section>`;
}

function fillFullBleed(comp, variant) {
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  // Variant determines text position and gradient direction
  const pos = variant || comp.overlayPosition || 'center';

  if (pos === 'left') {
    return `<section class="relative h-[60vh] flex items-center overflow-x-hidden overflow-y-hidden" data-component-type="full-bleed">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover" src="${imgSrc}" data-parallax/>` : ''}
<div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>
<div class="relative z-10 w-full max-w-6xl mx-auto px-8 text-left" data-animate="fade-up">
<h2 class="font-headline text-h2 md:text-display tracking-tight mb-4 text-white max-w-2xl" data-edit-path="displayTitle">${title}</h2>
${bodyText ? `<p class="text-lg md:text-xl text-white/80 max-w-xl" data-edit-path="body">${bodyText}</p>` : ''}
</div>
</section>`;
  }

  if (pos === 'right') {
    return `<section class="relative h-[60vh] flex items-center overflow-x-hidden overflow-y-hidden" data-component-type="full-bleed">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover" src="${imgSrc}" data-parallax/>` : ''}
<div class="absolute inset-0 bg-gradient-to-l from-black/90 via-black/50 to-transparent"></div>
<div class="relative z-10 w-full max-w-6xl mx-auto px-8 text-right flex flex-col items-end" data-animate="fade-up">
<h2 class="font-headline text-h2 md:text-display tracking-tight mb-4 text-white max-w-2xl" data-edit-path="displayTitle">${title}</h2>
${bodyText ? `<p class="text-lg md:text-xl text-white/80 max-w-xl" data-edit-path="body">${bodyText}</p>` : ''}
</div>
</section>`;
  }

  // Default: center — full overlay, centered text
  return `<section class="relative h-[60vh] flex items-center overflow-hidden" data-component-type="full-bleed">
${imgSrc ? `<img alt="${imgAlt}" class="absolute inset-0 w-full h-full object-cover" src="${imgSrc}" data-parallax/>` : ''}
<div class="absolute inset-0 bg-black/60"></div>
<div class="relative z-10 w-full max-w-6xl mx-auto px-8 text-center" data-animate="fade-up">
<h2 class="font-headline text-h2 md:text-display tracking-tight mb-4 text-white" data-edit-path="displayTitle">${title}</h2>
${bodyText ? `<p class="text-lg md:text-xl text-white/80 max-w-3xl mx-auto" data-edit-path="body">${bodyText}</p>` : ''}
</div>
</section>`;
}

function fillGraphic(comp, variant, maxW) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly((DC.graphic || {}).section || 'py-12');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  if (variant === 'captioned-card') {
    // Image inside a glass card with title overlay and caption below
    return `<section class="${secClass}" data-component-type="graphic">
<div class="${maxW} mx-auto px-8">
<div class="glass-card rounded-2xl overflow-hidden" data-animate="fade-up">
<div class="relative">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-auto max-h-[50vh] object-cover" src="${imgSrc}"/>` : '<div class="w-full h-64 bg-surface-container"></div>'}
${title ? `<div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-8 pb-6 pt-16"><h2 class="font-headline text-h3 text-white">${title}</h2></div>` : ''}
</div>
${body ? `<div class="px-8 py-5 text-on-surface-variant">${body}</div>` : ''}
</div>
</div>
</section>`;
  }

  // Default: standard — clean image with optional title above and caption below
  return `<section class="${secClass}" data-component-type="graphic">
<div class="${maxW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-8">${title}</h2>` : ''}
<div class="rounded-2xl overflow-hidden" data-animate="clip-up">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-auto max-h-[60vh] object-cover" src="${imgSrc}"/>` : '<div class="w-full h-64 bg-surface-container rounded-2xl"></div>'}
</div>
${body ? `<div class="mt-4 text-on-surface-variant">${body}</div>` : ''}
</div>
</section>`;
}

function fillProcessFlow(comp, variant, maxW) {
  const items = comp._items || comp._nodes || [];
  if (items.length === 0) return '';

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['process-flow'] || {}).section || 'py-16 bg-surface-container-low');

  if (variant === 'horizontal') {
    // Compact horizontal layout — nodes in a row with arrows between
    const hNodes = items.map((item, i) => {
      const isFirst = i === 0;
      const isLast = i === items.length - 1;
      const borderColor = isFirst ? 'border-secondary' : isLast ? 'border-primary' : 'border-outline-variant/30';
      return `<div class="glass-card px-4 py-4 rounded-xl border-t-4 ${borderColor} flex-1 min-w-0 text-center">
<div class="font-headline text-body mb-1" data-edit-path="_items.${i}.title">${esc(item.title || '')}</div>
${item.body ? `<div class="text-body text-on-surface-variant" data-edit-path="_items.${i}.body">${stripTags(item.body)}</div>` : ''}
</div>`;
    });

    const hArrow = `<div class="flex items-center flex-shrink-0 px-1"><span class="material-symbols-outlined text-outline-variant/50 text-lg">arrow_forward</span></div>`;

    const withHArrows = hNodes.flatMap((n, i) =>
      i < hNodes.length - 1 ? [n, hArrow] : [n]
    ).join('\n');

    return `<section class="${secClass}" data-component-type="process-flow">
<div class="${maxW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-10 text-center">${title}</h2>` : ''}
<div class="flex flex-col md:flex-row gap-2 items-stretch" data-animate="fade-up">
${withHArrows}
</div>
</div>
</section>`;
  }

  // Default: vertical — stacked cards with down arrows
  const newNodes = items.map((item, i) => {
    const isFirst = i === 0;
    const isLast = i === items.length - 1;
    const borderClass = isFirst ? 'border-l-4 border-secondary' : isLast ? 'border-l-4 border-primary' : 'border-l-4 border-outline-variant/30';
    const stepNum = String(i + 1).padStart(2, '0');
    const numColor = isFirst ? 'text-secondary' : isLast ? 'text-primary' : 'text-primary/40';
    return `<div class="glass-card px-6 md:px-8 py-5 md:py-6 rounded-xl ${borderClass} flex items-start gap-5">
<span class="${numColor} font-headline font-black text-2xl mt-0.5 flex-shrink-0">${stepNum}</span>
<div class="min-w-0">
<div class="font-headline text-h4 mb-1" data-edit-path="_items.${i}.title">${esc(item.title || '')}</div>
${item.body ? `<div class="text-body text-on-surface-variant" data-edit-path="_items.${i}.body">${stripTags(item.body)}</div>` : ''}
</div>
</div>`;
  });

  const arrowEl = `<div class="flex justify-center py-1"><span class="material-symbols-outlined text-outline-variant/50 text-lg">arrow_downward</span></div>`;

  const withArrows = newNodes.flatMap((n, i) =>
    i < newNodes.length - 1 ? [n, arrowEl] : [n]
  ).join('\n');

  return `<section class="${secClass}" data-component-type="process-flow">
<div class="${maxW} mx-auto px-8">
<h2 class="font-headline text-h2 mb-12 text-center">${title}</h2>
<div class="flex flex-col gap-2" data-animate-stagger="fade-up">
${withArrows}
</div>
</div>
</section>`;
}

function fillMedia(comp, maxW) {
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC.media || {}).section || 'py-16');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';

  return `<section class="${secClass}" data-component-type="media" data-animate="clip-up">
<div class="${maxW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-8">${title}</h2>` : ''}
<div class="relative bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center">
${imgSrc ? `<img alt="" class="w-full h-full object-cover" src="${imgSrc}"/>` : '<span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span>'}
</div>
</div>
</section>`;
}

function fillVideoTranscript(comp, maxW) {
  const title = esc(comp.displayTitle || 'Transcript');
  const secClass = sectionOnly((DC['video-transcript'] || {}).section || 'py-16');

  return `<section class="${secClass}" data-component-type="video-transcript" data-animate="fade-up">
<div class="${maxW} mx-auto px-8">
<div class="bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center mb-6">
<span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span>
</div>
<details class="bg-surface-container-low rounded-2xl">
<summary class="p-6 cursor-pointer font-bold flex justify-between items-center">
<span>${title}</span>
<span class="material-symbols-outlined">expand_more</span>
</summary>
<div class="p-8 text-on-surface-variant" data-edit-path="body" data-edit-html>${comp.body || ''}</div>
</details>
</div>
</section>`;
}

function fillImageGallery(comp, maxW) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];
  const secClass = sectionOnly((DC['image-gallery'] || {}).section || 'py-16');

  const images = items.map((item, i) => {
    const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
    const imgAlt = esc(item._graphic?.alt || item.caption || '');
    const caption = esc(item.caption || '');
    return `<div class="bg-surface-container rounded-2xl overflow-hidden">
${imgSrc ? `<div class="aspect-square"><img alt="${imgAlt}" class="w-full h-full object-cover" src="${imgSrc}"/></div>` : '<div class="aspect-square flex items-center justify-center"><span class="material-symbols-outlined text-4xl text-on-surface-variant">image</span></div>'}
${caption ? `<p class="px-4 py-3 text-sm text-on-surface-variant" data-edit-path="_items.${i}.caption">${caption}</p>` : ''}
</div>`;
  }).join('\n');

  return `<section class="${secClass}" data-component-type="image-gallery">
<div class="${maxW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-12">${title}</h2>` : ''}
<div class="grid grid-cols-2 md:grid-cols-3 gap-6 ${items.length % 3 === 1 ? '[&>:last-child]:md:col-start-2' : items.length % 3 === 2 ? '' : ''}" data-animate-stagger="scale-in">
${images}
</div>
</div>
</section>`;
}

function fillLabeledImage(comp, variant, maxW) {
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly((DC['labeled-image'] || {}).section || 'py-16');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = esc(comp._graphic?.alt || '');
  const markers = comp._markers || [];

  // ── Variant: side-panel — image on left, marker list on right ──
  if (variant === 'side-panel') {
    const panelItems = markers.map((m, i) =>
      `<div class="flex items-start gap-4 p-4 rounded-xl hover:bg-surface-container/50 transition-colors">
<div class="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary text-xs font-bold">${i + 1}</div>
<div>
<div class="font-bold text-on-surface text-sm" data-edit-path="_markers.${i}.label">${esc(m.label || '')}</div>
${m.description ? `<p class="text-xs text-on-surface-variant mt-1" data-edit-path="_markers.${i}.description">${esc(m.description || '')}</p>` : ''}
</div>
</div>`
    ).join('\n');

    return `<section class="${secClass}" data-component-type="labeled-image">
<div class="${maxW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-12">${title}</h2>` : ''}
<div class="flex flex-col md:flex-row gap-8" data-animate="fade-up">
<div class="flex-1 relative bg-surface-container rounded-3xl overflow-hidden min-h-[300px]">
${imgSrc ? `<img alt="${imgAlt}" class="w-full h-full object-cover rounded-3xl" src="${imgSrc}"/>` : '<div class="w-full h-[400px] bg-surface-container rounded-3xl flex items-center justify-center"><span class="material-symbols-outlined text-6xl text-on-surface-variant/30">image</span></div>'}
</div>
<div class="md:w-80 flex-shrink-0 glass-card rounded-2xl p-4 space-y-1 self-start">
${panelItems}
</div>
</div>
</div>
</section>`;
  }

  // ── Default variant: numbered-dots — markers overlaid on image ──
  const markerHtml = markers.map((m, i) =>
    `<div class="absolute group z-10" style="left:${m.x}%;top:${m.y}%">
<div class="w-8 h-8 rounded-full bg-primary border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform flex items-center justify-center text-on-primary text-xs font-bold">${i + 1}</div>
<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 glass-card rounded-xl text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">${esc(m.label || '')}</div>
</div>`
  ).join('\n');

  const hasImage = !!imgSrc;
  const fallbackMarkerList = !hasImage && markers.length > 0
    ? `<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-8">${markers.map((m, i) =>
        `<div class="glass-card rounded-xl p-4 flex items-center gap-3 border border-outline-variant/20">
<div class="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary text-xs font-bold">${i + 1}</div>
<span class="text-sm font-medium" data-edit-path="_markers.${i}.label">${esc(m.label || '')}</span>
</div>`
      ).join('\n')}</div>`
    : '';

  return `<section class="${secClass}" data-component-type="labeled-image">
<div class="${maxW} mx-auto px-8">
${title ? `<h2 class="font-headline text-h2 mb-12">${title}</h2>` : ''}
<div class="relative bg-surface-container rounded-3xl overflow-hidden min-h-[300px]" data-animate="clip-up">
${imgSrc ? `<img alt="${imgAlt}" class="w-full max-h-[65vh] object-cover rounded-3xl" src="${imgSrc}"/>` : '<div class="w-full h-[400px] bg-surface-container rounded-3xl flex items-center justify-center"><span class="material-symbols-outlined text-6xl text-on-surface-variant/30">image</span></div>'}
${hasImage ? markerHtml : ''}
</div>
${fallbackMarkerList}
</div>
</section>`;
}

// ─── Divider ──────────────────────────────────────────────────────────
// Dividers use NO own vertical padding — adjacent sections' py-16 (64px each)
// provides the gap. The divider's visual element sits centred in that 128px
// natural gap. Negative margins pull it into the middle of the gap.
function fillDivider(comp, variant, maxW) {
  // variant takes precedence — template pre-rendering passes variant override
  const style = variant || comp.style || 'line';
  const icon = esc(comp.icon || 'more_horiz');

  if (style === 'spacing') {
    // Pure whitespace divider — no negative pull, just a clean spacer
    return `<section class="py-4" data-component-type="divider">
<div class="h-4"></div>
</section>`;
  }

  if (style === 'icon') {
    return `<section class="py-4" data-component-type="divider">
<div class="${maxW} mx-auto px-8 flex items-center gap-4">
<div class="flex-1 h-px bg-outline-variant/20"></div>
<span class="material-symbols-outlined text-on-surface-variant/40 text-xl">${icon}</span>
<div class="flex-1 h-px bg-outline-variant/20"></div>
</div>
</section>`;
  }

  // Default: line
  return `<section class="py-4" data-component-type="divider">
<div class="${maxW} mx-auto px-8">
<hr class="border-0 h-px bg-outline-variant/20"/>
</div>
</section>`;
}

// ─── Callout ──────────────────────────────────────────────────────────
function fillCallout(comp, variant, maxW) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly((DC.callout || {}).section || 'py-16');
  // variant takes precedence — template pre-rendering passes variant override
  // so each alternate (info/warning/tip/success) gets its own style
  const calloutType = variant || comp.calloutType || 'info';

  const typeConfig = {
    info:    { icon: 'info',          border: 'border-primary',      bg: 'bg-primary/5',   iconColor: 'text-primary' },
    warning: { icon: 'warning',       border: 'border-amber-500',    bg: 'bg-amber-500/5', iconColor: 'text-amber-500' },
    tip:     { icon: 'tips_and_updates', border: 'border-emerald-500', bg: 'bg-emerald-500/5', iconColor: 'text-emerald-500' },
    success: { icon: 'check_circle',  border: 'border-teal-500',  bg: 'bg-teal-500/5', iconColor: 'text-teal-500' }
  };
  const cfg = typeConfig[calloutType] || typeConfig.info;

  return `<section class="${secClass}" data-component-type="callout">
<div class="${maxW} mx-auto px-8">
<div class="border-l-4 ${cfg.border} ${cfg.bg} rounded-r-xl p-6 md:p-8" data-animate="fade-up">
<div class="flex items-start gap-4">
<span class="material-symbols-outlined ${cfg.iconColor} text-2xl flex-shrink-0 mt-0.5">${cfg.icon}</span>
<div>
${title ? `<h4 class="font-headline text-h4 text-on-surface mb-2">${title}</h4>` : ''}
<div class="text-body text-on-surface-variant">${body}</div>
</div>
</div>
</div>
</div>
</section>`;
}

// ─── Section width helper ─────────────────────────────────────────────
// Converts sectionWidth enum to Tailwind containment class.
// Used by section assembly to vary content width per section.
const SECTION_WIDTHS = {
  narrow:   'max-w-3xl',
  standard: 'max-w-6xl',
  wide:     'max-w-[90rem]',
  full:     'max-w-6xl'  // 'full' uses edge-to-edge bg but contained inner content
};
function getSectionMaxW(sectionWidth) {
  return SECTION_WIDTHS[sectionWidth] || SECTION_WIDTHS.standard;
}

// ─── Category map: component type → category (for authoring panel) ────
const CATEGORY_MAP = {
  'hero': 'Structure', 'path-selector': 'Structure', 'divider': 'Structure',
  'text': 'Content', 'graphic': 'Content', 'graphic-text': 'Content',
  'full-bleed': 'Content', 'pullquote': 'Content', 'stat-callout': 'Content',
  'key-term': 'Content', 'callout': 'Content',
  'accordion': 'Explore', 'tabs': 'Explore', 'narrative': 'Explore',
  'flashcard': 'Explore', 'labeled-image': 'Explore',
  'mcq': 'Assess', 'branching': 'Assess', 'textinput': 'Assess', 'checklist': 'Assess',
  'bento': 'Layout', 'comparison': 'Layout', 'data-table': 'Layout',
  'timeline': 'Layout', 'process-flow': 'Layout', 'image-gallery': 'Layout',
  'media': 'Media', 'video-transcript': 'Media'
};

// ─── Variant map: component types that have layout variants ───────────
const VARIANT_MAP = {
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
  'branching':    ['cards', 'list']
};

// ─── Per-component width boost ───────────────────────────────────────
// Most components look best at the default section width (max-w-6xl).
// Visual/multi-column components benefit from extra breathing room
// when the section is set to 'wide'. Only these get boosted.
const COMPONENT_WIDTH_BOOST = {
  'graphic-text':                'max-w-7xl',
  'graphic':                     'max-w-7xl',
  'image-gallery':               'max-w-7xl',
  'labeled-image':               'max-w-7xl',
  'flashcard:grid':              'max-w-7xl',
  'mcq:grid':                    'max-w-7xl',
  'tabs:vertical':               'max-w-7xl',
  'branching:cards':             'max-w-7xl',
  'key-term:card-grid':          'max-w-7xl',
  'timeline:centered-alternating':'max-w-7xl',
};

// ─── Per-component width cap ────────────────────────────────────────
// Vertical list components look better narrower — cap them regardless of section width.
const COMPONENT_WIDTH_CAP = {
  'mcq:stacked':       'max-w-4xl',
  'branching:list':    'max-w-4xl',
  'bento:featured':    'max-w-6xl',
  'stat-callout':      'max-w-6xl',
};

function getComponentMaxW(type, variant, sectionMaxW) {
  const remOf = (cls) => {
    const m = cls.match(/max-w-(\d+)xl/);
    if (!m) return cls.includes('max-w-[') ? 90 : 72; // 90rem or 6xl default
    return parseInt(m[1]);
  };
  // Check for width cap first (narrows vertical list components)
  const cap = COMPONENT_WIDTH_CAP[`${type}:${variant}`] || COMPONENT_WIDTH_CAP[type];
  if (cap) return remOf(cap) < remOf(sectionMaxW) ? cap : sectionMaxW;
  // Then check for width boost (widens visual/multi-column components)
  const boost = COMPONENT_WIDTH_BOOST[`${type}:${variant}`] || COMPONENT_WIDTH_BOOST[type];
  if (!boost) return sectionMaxW;
  // Boost applies when section is 'wide' or wider — never exceed section width
  return remOf(boost) <= remOf(sectionMaxW) ? boost : sectionMaxW;
}

// ─── Single-variant renderer (used internally) ───────────────────────
function fillComponentVariant(comp, index, sectionWidth, variantOverride) {
  const type = (comp.type || 'text').toLowerCase();
  const variant = variantOverride !== undefined ? variantOverride : (comp.variant || '');
  const maxW = getComponentMaxW(type, variant, getSectionMaxW(sectionWidth));
  let html;
  switch (type) {
    case 'hero':            html = fillHero(comp, variant); break;
    case 'text':            html = fillText(comp, variant, maxW); break;
    case 'accordion':       html = fillAccordion(comp, variant, maxW); break;
    case 'mcq':             html = fillMCQ(comp, variant, maxW); break;
    case 'graphic-text':    html = fillGraphicText(comp, index, variant, maxW); break;
    case 'bento':           html = fillBento(comp, variant, maxW); break;
    case 'data-table':      html = fillDataTable(comp, variant, maxW); break;
    case 'textinput':       html = fillTextInput(comp, maxW); break;
    case 'path-selector':   html = fillPathSelector(comp, maxW); break;
    case 'branching':       html = fillBranching(comp, variant, maxW); break;
    case 'timeline':        html = fillTimeline(comp, variant, maxW); break;
    case 'comparison':      html = fillComparison(comp, variant, maxW); break;
    case 'stat-callout':    html = fillStatCallout(comp, variant, maxW); break;
    case 'pullquote':       html = fillPullquote(comp, variant, maxW); break;
    case 'checklist':       html = fillChecklist(comp, variant, maxW); break;
    case 'tabs':            html = fillTabs(comp, variant, maxW); break;
    case 'flashcard':       html = fillFlashcard(comp, variant, maxW); break;
    case 'narrative':       html = fillNarrative(comp, variant, maxW); break;
    case 'key-term':        html = fillKeyTerm(comp, variant, maxW); break;
    case 'full-bleed':      html = fillFullBleed(comp, variant); break;
    case 'graphic':         html = fillGraphic(comp, variant, maxW); break;
    case 'process-flow':    html = fillProcessFlow(comp, variant, maxW); break;
    case 'media':           html = fillMedia(comp, maxW); break;
    case 'video-transcript':html = fillVideoTranscript(comp, maxW); break;
    case 'image-gallery':   html = fillImageGallery(comp, maxW); break;
    case 'labeled-image':   html = fillLabeledImage(comp, variant, maxW); break;
    case 'divider':         html = fillDivider(comp, variant, maxW); break;
    case 'callout':         html = fillCallout(comp, variant, maxW); break;
    default:
      console.log(`  [warn] Unknown component type: ${type}`);
      return null;
  }
  // Inject data-variant so QA and authoring layer can find the right instance
  if (html && variant) {
    html = html.replace(/^(<section\b[^>]*)>/, `$1 data-variant="${variant}">`);
  }
  // Inject data-category for authoring panel category grouping
  const category = CATEGORY_MAP[type];
  if (html && category) {
    html = html.replace(/^(<section\b[^>]*)>/, `$1 data-category="${category}">`);
  }
  return html;
}

// ─── Component dispatcher (renders active variant + alt templates) ────
function fillComponent(comp, index, sectionWidth) {
  const type = (comp.type || 'text').toLowerCase();
  const variant = comp.variant || '';

  // Render the active variant
  let html = fillComponentVariant(comp, index, sectionWidth);
  if (!html) return null;

  // Pre-render alternate variants as <template> tags for authoring layer switching
  const allVariants = VARIANT_MAP[type];
  if (allVariants && allVariants.length > 1) {
    const activeVariant = variant || allVariants[0];
    const altTemplates = [];
    for (const v of allVariants) {
      if (v === activeVariant) continue;
      const altHtml = fillComponentVariant(comp, index, sectionWidth, v);
      if (altHtml) {
        altTemplates.push(`<template data-variant-alt="${esc(v)}">${altHtml}</template>`);
      }
    }
    if (altTemplates.length > 0) {
      // Inject templates before the closing </section> tag (or at end if no section wrapper)
      if (html.includes('</section>')) {
        html = html.replace(/<\/section>\s*$/, `${altTemplates.join('\n')}\n</section>`);
      } else {
        html += '\n' + altTemplates.join('\n');
      }
    }
  }

  return html;
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════

function buildNav(layout) {
  const courseTitle = esc(layout.course.title || 'Course');
  const sections = layout.sections.filter(s => s.title);

  // Build section list for the slide-out drawer
  const drawerLinks = sections.map((s, i) => {
    const sId = s.sectionId || `section-${i}`;
    return `<a class="drawer-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all" href="#${sId}" data-drawer-link="${sId}">
<span class="drawer-index text-xs font-bold text-outline-variant w-5 text-center">${String(i + 1).padStart(2, '0')}</span>
<span class="flex-1 truncate">${esc(s.title)}</span>
<span class="drawer-status material-symbols-outlined text-base text-outline-variant" style="font-size:16px"></span>
</a>`;
  }).join('\n');

  return `<!-- Slim sticky header -->
<nav class="fixed top-0 w-full z-50 h-14 px-4 md:px-8 flex items-center justify-between glass-nav bg-background/80 backdrop-blur-xl" data-component-type="navigation">
<button class="nav-hamburger p-2 -ml-2 rounded-lg hover:bg-on-surface/5 transition-colors" aria-label="Open section menu" data-nav-toggle>
<span class="material-symbols-outlined text-on-surface">menu</span>
</button>
<span class="text-sm font-bold tracking-tight text-on-surface truncate max-w-[60vw] md:max-w-none">${courseTitle}</span>
<div class="flex items-center gap-2">
<span class="text-xs font-medium text-on-surface-variant tabular-nums" data-progress-text>0%</span>
</div>
</nav>

<!-- Section drawer overlay -->
<div class="nav-drawer-overlay fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300" data-drawer-overlay></div>

<!-- Section drawer -->
<aside class="nav-drawer fixed top-0 left-0 z-[70] h-full w-80 max-w-[85vw] bg-surface-container shadow-2xl transform -translate-x-full transition-transform duration-300 ease-out flex flex-col" data-drawer>
<div class="flex items-center justify-between px-4 h-14 border-b border-outline-variant/20 shrink-0">
<span class="text-sm font-bold text-on-surface">Sections</span>
<button class="p-2 rounded-lg hover:bg-on-surface/5 transition-colors" data-drawer-close aria-label="Close menu">
<span class="material-symbols-outlined text-on-surface-variant">close</span>
</button>
</div>
<div class="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar flex flex-col gap-0.5">
${drawerLinks}
</div>
<div class="shrink-0 px-4 py-3 border-t border-outline-variant/20">
<div class="flex items-center justify-between text-xs text-on-surface-variant mb-2">
<span>Progress</span>
<span data-drawer-progress-text>0%</span>
</div>
<div class="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
<div class="h-full rounded-full bg-primary transition-all duration-300" data-drawer-progress-bar style="width:0%"></div>
</div>
</div>
</aside>`;
}

// Footer removed — e-learning courses end with their final section + completion block.
// No generic website footer needed. Future platform-level footer handled by authoring layer.

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
  IS_DARK = tokens.isDark !== false;
  console.log(`[ok] Loaded design-tokens.json (${Object.keys(tokens.colors || {}).length} colours, fonts: ${tokens.fonts?.headline}/${tokens.fonts?.body}, isDark: ${tokens.isDark})`);

  // ── Dark-mode contract fixes ──────────────────────────────────────────
  // Stitch sometimes hardcodes bg-white into card/section/panel classes.
  // On dark themes these create white blocks. Fix only the specific keys
  // that are card/section backgrounds — leave button accents (hero CTA) alone.
  if (tokens.isDark !== false) {
    const stripBgWhite = (s) => typeof s === 'string' ? s.replace(/\bbg-white\b/g, 'glass-card') : s;
    const stripHoverBgWhite = (s) => typeof s === 'string' ? s.replace(/\bhover:bg-white\b/g, 'hover:bg-surface-container') : s;
    const stripBorderBlack = (s) => typeof s === 'string' ? s.replace(/\bborder-black(\/\d+)?\b/g, (m, frac) => 'border-outline-variant' + (frac || '/20')) : s;

    // Section backgrounds: bg-white → remove (let page bg show through)
    const stripSectionBgWhite = (s) => typeof s === 'string' ? s.replace(/\bbg-white\b/g, '') : s;
    for (const key of ['comparison', 'tabs', 'image-gallery']) {
      if (DC[key]?.section) DC[key].section = stripSectionBgWhite(DC[key].section);
    }
    // Card backgrounds: bg-white → glass-card (rounded frosted panels)
    if (DC.mcq?.card?.bg) DC.mcq.card.bg = stripBgWhite(DC.mcq.card.bg);
    if (DC.branching?.button?.bg) DC.branching.button.bg = stripBgWhite(DC.branching.button.bg);
    if (DC.flashcard?.front?.bg) DC.flashcard.front.bg = stripBgWhite(DC.flashcard.front.bg);
    // Flat panels: bg-white → bg-surface-container (no frosted glass, no extra borders)
    const stripBgWhiteFlat = (s) => typeof s === 'string' ? s.replace(/\bbg-white\b/g, 'bg-surface-container') : s;
    if (DC.accordion?.detailsClass) DC.accordion.detailsClass = stripBgWhiteFlat(stripBorderBlack(DC.accordion.detailsClass));
    // Hover/interaction states
    if (DC.checklist?.labelHover) DC.checklist.labelHover = stripHoverBgWhite(DC.checklist.labelHover);
    if (DC.checklist?.labelClass) DC.checklist.labelClass = stripHoverBgWhite(stripBorderBlack(DC.checklist.labelClass));
    console.log('[ok] Fixed dark-mode contract overrides (bg-white in cards/sections/panels)');
  }

  // Build all sections
  let filledCount = 0;
  let fallbackCount = 0;
  const sectionsHtml = [];

  layout.sections.forEach((section, sectionIndex) => {
    const components = section.components || [];
    if (components.length === 0) return;

    const sectionId = section.sectionId || `section-${String(sectionIndex).padStart(2, '0')}`;

    // Determine section width, with minimum-width safeguards per component type.
    // Components that use multi-column grids or need breathing room should never be narrow.
    const NEEDS_STANDARD = new Set([
      'mcq', 'branching', 'flashcard', 'bento', 'comparison', 'data-table',
      'tabs', 'checklist', 'narrative', 'process-flow', 'image-gallery',
      'labeled-image', 'timeline', 'key-term', 'accordion', 'stat-callout'
    ]);
    let sectionWidth = section.sectionWidth || 'standard';
    if (sectionWidth === 'narrow') {
      const hasWideComponent = components.some(c => NEEDS_STANDARD.has((c.type || '').toLowerCase()));
      if (hasWideComponent) {
        sectionWidth = 'standard';
      }
    }
    const componentHtmls = [];
    const interactiveTypes = new Set(['mcq', 'accordion', 'tabs', 'flashcard', 'narrative', 'checklist', 'textinput']);
    let interactiveCount = 0;
    components.forEach((comp, compIndex) => {
      const type = (comp.type || 'text').toLowerCase();
      if (interactiveTypes.has(type)) interactiveCount++;
      let filled = fillComponent(comp, compIndex, sectionWidth);
      if (filled) {
        // Add authoring data attributes for JSON↔DOM mapping (all variants including templates)
        filled = filled.replace(
          /data-component-type="/g,
          `data-section-index="${sectionIndex}" data-component-index="${compIndex}" data-component-type="`
        );
        // Add required-items tracking if the layout engine tagged this component
        if (comp.requiredItems && interactiveTypes.has(type)) {
          filled = filled.replace(
            /data-component-type="/,
            `data-required-items="${comp.requiredItems}" data-component-type="`
          );
        }
        // Wrap with data-show-if if the component has its OWN showIf condition
        // (Section-level showIf is handled separately — wraps the entire section including title bar)
        if (comp.showIf && Object.keys(comp.showIf).length > 0) {
          const condition = Object.entries(comp.showIf)
            .map(([k, v]) => `${k}=${v}`)
            .join('|');
          filled = `<div data-show-if="${esc(condition)}" style="display:none">\n${filled}\n</div>`;
        }
        componentHtmls.push(filled);
        filledCount++;
      } else {
        console.log(`  [warn] Fill returned null for ${type}`);
        fallbackCount++;
      }
    });

    if (componentHtmls.length > 0) {
      const sectionTitle = section.title || '';
      // Track sections with interactive components for progress
      const trackAttr = interactiveCount > 0 ? ` data-section-track="${sectionId}" data-interactive-count="${interactiveCount}"` : '';
      const secMaxW = getSectionMaxW(sectionWidth);
      const titleBar = sectionTitle
        ? `<div class="${secMaxW} mx-auto px-8 pt-24 pb-8" id="${sectionId}"${trackAttr}>
<div class="flex items-center gap-6">
<div class="h-px flex-1 bg-gradient-to-r from-primary/60 to-transparent"></div>
<h2 class="font-headline text-label-text uppercase text-primary">${esc(sectionTitle)}</h2>
<div class="h-px flex-1 bg-gradient-to-l from-primary/60 to-transparent"></div>
</div>
</div>`
        : '';

      const wrapped = componentHtmls.map((h, i) => {
        if (h.trim().startsWith('<section') || h.trim().startsWith('<div data-show-if')) {
          if (i === 0 && !sectionTitle) {
            // Add section id to the first element
            if (h.trim().startsWith('<div data-show-if')) {
              return h.replace(/<div data-show-if/, `<div id="${sectionId}" data-show-if`);
            }
            return h.replace(/<section/, `<section id="${sectionId}"`);
          }
          return h;
        }
        return `<div class="py-12 ${secMaxW} mx-auto px-8">\n${h}\n</div>`;
      }).join('\n\n');

      // If section has showIf, wrap the entire section (title bar + components) together
      let sectionBlock = titleBar + '\n' + wrapped;
      if (section.showIf && Object.keys(section.showIf).length > 0) {
        const condition = Object.entries(section.showIf)
          .map(([k, v]) => `${k}=${v}`)
          .join('|');
        sectionBlock = `<div data-show-if="${esc(condition)}" style="display:none">\n${sectionBlock}\n</div>`;
      }

      sectionsHtml.push(sectionBlock);
    }
  });

  console.log(`[ok] Filled ${filledCount} components (${fallbackCount} fallbacks)\n`);

  // Course gate: if any section contains a path-selector, wrap everything after it
  // in a gate wrapper so hydrate.js can enforce "choose before continuing"
  const gateIndex = sectionsHtml.findIndex(h => h.includes('data-path-selector'));
  if (gateIndex >= 0 && gateIndex < sectionsHtml.length - 1) {
    const before = sectionsHtml.slice(0, gateIndex + 1);
    const after = sectionsHtml.slice(gateIndex + 1);
    const gatedBlock = `<div data-course-gate class="gated">\n${after.join('\n\n')}\n</div>`;
    sectionsHtml.length = 0;
    sectionsHtml.push(...before, gatedBlock);
    console.log(`[ok] Course gate: content after section ${gateIndex} wrapped in gate (${after.length} sections gated)`);
  }

  // Build nav (slim header + drawer)
  const navHtml = buildNav(layout);

  // Get hydration script
  let hydrateScript = '';
  if (fs.existsSync(HYDRATE_PATH)) {
    hydrateScript = fs.readFileSync(HYDRATE_PATH, 'utf-8');
  }

  // ⚠️ ARCHIVED — content-bucket.json is SCORM-only. AI-first pipeline does not use it.
  // Section gating and path groups are SCORM features. Do not read content-bucket.json.
  let pathStateScript = '';
  let sectionGatingScript = '';

  // Theme + course title
  const isDark = tokens.isDark !== false;
  const courseTitle = layout.course.title || 'Course';

  // Generate <head> from design-tokens.json — NOT from Stitch raw HTML
  const finalHead = generateHead(tokens, courseTitle);
  console.log(`[ok] Generated <head> from design-tokens.json (${finalHead.length} chars)`);

  let finalHtml = `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}" lang="en">
<head>
${finalHead}
</head>
<body class="bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">

${navHtml}

<main class="min-h-screen bg-background overflow-x-hidden pt-14">
${sectionsHtml.join('\n\n')}

<!-- Course Completion -->
<section class="py-16 text-center">
<div class="max-w-xl mx-auto px-8">
  <div class="w-16 h-16 mx-auto mb-6 rounded-full bg-secondary/10 flex items-center justify-center">
    <span class="material-symbols-outlined text-3xl text-secondary">verified_user</span>
  </div>
  <h2 class="font-headline text-h3 mb-3">Course Complete</h2>
  <p class="text-body text-on-surface-variant mb-8">
    You have completed ${esc(courseTitle)}. Review any sections as needed.
  </p>
  <button class="btn-primary px-8 py-3 rounded-full font-bold text-sm" onclick="window.scrollTo({top:0,behavior:'smooth'})">Return to Top</button>
</div>
</section>
</main>

<script type="application/json" id="course-data">${JSON.stringify(layout).replace(/<\//g, '<\\/')}</script>
<script type="application/json" id="category-meta">${JSON.stringify({
  map: CATEGORY_MAP,
  colors: {
    Content: '#3b82f6', Explore: '#8b5cf6', Assess: '#ef4444',
    Layout: '#22c55e', Media: '#06b6d4', Structure: '#f59e0b'
  },
  labels: {
    Content: 'Content', Explore: 'Explore', Assess: 'Assess',
    Layout: 'Layout', Media: 'Media', Structure: 'Structure'
  }
}).replace(/<\//g, '<\\/')}</script>
<script>
${pathStateScript}${sectionGatingScript}${hydrateScript}
</script>
</body>
</html>`;

  // Strip empty heading tags (defensive: AI content may omit displayTitle)
  finalHtml = finalHtml.replace(/<h([1-6])([^>]*)>\s*<\/h\1>/g, '');

  // Write outputs
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, finalHtml, 'utf-8');
  console.log(`[ok] Written: ${OUTPUT_PATH} (${(finalHtml.length / 1024).toFixed(0)} KB)`);

  fs.writeFileSync(PAGES_PATH, finalHtml, 'utf-8');
  console.log(`[ok] Written: ${PAGES_PATH}`);

  console.log('\nBuild complete!');
}

build();
