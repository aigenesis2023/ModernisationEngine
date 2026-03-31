#!/usr/bin/env node
/**
 * generate-design-tokens.js
 *
 * Session 2 — MD3 palette + token generation
 *
 * Reads extracted-css.json (from scrape-brand.js Session 1)
 * → checks fonts against Google Fonts — if unavailable, writes font-match-prompt.txt
 *   and pauses for a subagent to match fonts visually (run with --fonts-ready after)
 * → identifies primary seed color
 * → generates full MD3 palette
 * → maps to design-tokens.json shape that build-course.js consumes
 * → archetype classification via subagent (writes archetype-prompt.txt, exit, re-run with --archetype-ready)
 * → writes engine/output/design-tokens.json
 *
 * Usage:
 *   node engine/scripts/generate-design-tokens.js                  ← first run (fonts + archetype prompt)
 *   node engine/scripts/generate-design-tokens.js --fonts-ready    ← after font subagent writes font-match.json
 *   node engine/scripts/generate-design-tokens.js --archetype-ready ← after archetype subagent writes archetype-match.json
 *   node engine/scripts/generate-design-tokens.js --fonts-ready --archetype-ready ← both
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const http    = require('http');

const ROOT          = path.resolve(__dirname, '../..');
const OUTPUT_DIR    = path.join(ROOT, 'engine/output');
const EXTRACTED_CSS = path.join(OUTPUT_DIR, 'extracted-css.json');
const BRAND_SPEC    = path.join(OUTPUT_DIR, 'brand-spec.json');
const TOKENS_OUT    = path.join(OUTPUT_DIR, 'design-tokens.json');
const SCREENSHOT    = path.join(OUTPUT_DIR, 'brand-screenshot.png');

// ─── Colour helpers ────────────────────────────────────────────────────────────

/** Parse #rrggbb or #rgb to {r,g,b} */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    };
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Relative luminance (WCAG) */
function luminance({ r, g, b }) {
  const ch = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Is a hex color "dark" (luminance < 0.18) */
function isDarkColor(hex) {
  try {
    return luminance(hexToRgb(hex)) < 0.18;
  } catch {
    return false;
  }
}

/** Is a color "neutral" (grey, white, black — saturation < threshold) */
function isNeutral(hex) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    return saturation < 0.15;
  } catch {
    return true;
  }
}

/** Is a hex string likely a browser-default link blue (#0000ee, #0000ff, etc.) */
function isBrowserDefault(hex) {
  const defaults = new Set(['#0000ee', '#0000ff', '#0000cc', '#000080', '#00f', '#00e']);
  return defaults.has(hex.toLowerCase());
}

/**
 * Pick the seed color from extracted CSS summary.
 * Priority:
 *   1. accentColors (explicitly non-neutral, non-default)
 *   2. Non-neutral, non-background colors in allColors with count >= 2
 *   3. Most common non-neutral non-background color
 *   4. Monochrome brands: warm grey (#6B6B6B) for dark, cool grey (#555566) for light
 *   5. Fallback to #6750A4 (MD3 default purple)
 */
function pickSeedColor(summary) {
  const bgHexes = new Set((summary.backgroundColors || []).map(c => c.hex.toLowerCase()));

  // 1. Accent colors (already filtered for non-neutral in scrape-brand.js)
  const accents = (summary.accentColors || []).filter(c =>
    !isBrowserDefault(c.hex) && !isNeutral(c.hex) && !bgHexes.has(c.hex.toLowerCase())
  );
  if (accents.length) {
    console.log(`[seed] Using accent color: ${accents[0].hex} (count: ${accents[0].count})`);
    return accents[0].hex;
  }

  // 2. Chromatic, non-bg, count >= 2
  const chromatic = (summary.allColors || []).filter(c =>
    !isNeutral(c.hex) && !isBrowserDefault(c.hex) && !bgHexes.has(c.hex.toLowerCase()) && c.count >= 2
  );
  if (chromatic.length) {
    // Pick highest saturation
    const sorted = chromatic.sort((a, b) => {
      const satA = (() => { try { const {r,g,b} = hexToRgb(a.hex); const max=Math.max(r,g,b),min=Math.min(r,g,b); return max===0?0:(max-min)/max; } catch{return 0;} })();
      const satB = (() => { try { const {r,g,b} = hexToRgb(b.hex); const max=Math.max(r,g,b),min=Math.min(r,g,b); return max===0?0:(max-min)/max; } catch{return 0;} })();
      return satB - satA;
    });
    console.log(`[seed] Using chromatic color: ${sorted[0].hex}`);
    return sorted[0].hex;
  }

  // 3. Any chromatic color
  const anyChromatic = (summary.allColors || []).filter(c =>
    !isNeutral(c.hex) && !isBrowserDefault(c.hex)
  );
  if (anyChromatic.length) {
    console.log(`[seed] Fallback chromatic: ${anyChromatic[0].hex}`);
    return anyChromatic[0].hex;
  }

  // 4. Monochrome brand — use a neutral-tinted seed instead of generic purple.
  //    MD3 generates warm/cool neutrals from the seed's hue, so feeding it a
  //    grey with a slight warm or cool cast gives the brand its own surface tint
  //    without introducing an accent color that doesn't exist.
  const bgs = summary.backgroundColors || [];
  const hasDarkBg = bgs.some(c => isDarkColor(c.hex));
  if (hasDarkBg) {
    console.log('[seed] Monochrome dark brand — using warm grey seed #6B6B6B');
    return '#6B6B6B';
  } else {
    console.log('[seed] Monochrome light brand — using cool grey seed #555566');
    return '#555566';
  }
}

/** Determine isDark from background colors */
function detectIsDark(summary) {
  const bgs = (summary.backgroundColors || []);

  // If explicit backgroundColors exist, they are decisive — no blending
  if (bgs.length) {
    let darkVotes = 0, lightVotes = 0;
    for (const { hex, count } of bgs) {
      if (isDarkColor(hex)) darkVotes += count;
      else lightVotes += count;
    }
    const result = darkVotes > 0 && darkVotes >= lightVotes;
    console.log(`[dark] Dark: ${result} (bg dark: ${darkVotes}, bg light: ${lightVotes})`);
    return result;
  }

  // Fallback: look at neutral allColors for dominant page tone
  // Skip pure black (#000000) and pure white (#ffffff) — too ambiguous (text/bg)
  const SKIP = new Set(['#000000', '#ffffff', '#fff', '#000']);
  const allBg = (summary.allColors || []).filter(c => isNeutral(c.hex) && !SKIP.has(c.hex.toLowerCase()));
  if (!allBg.length) return true; // default dark

  let darkVotes = 0, lightVotes = 0;
  for (const { hex, count } of allBg) {
    if (isDarkColor(hex)) darkVotes += count;
    else lightVotes += count;
  }

  const result = darkVotes >= lightVotes;
  console.log(`[dark] Dark: ${result} (fallback dark: ${darkVotes}, light: ${lightVotes})`);
  return result;
}

// ─── MD3 palette generation ────────────────────────────────────────────────────

/**
 * Generate design tokens from a seed color using MD3.
 * Returns a colors object in the shape build-course.js expects.
 */
function generateMd3Tokens(seedHex, isDark) {
  const {
    argbFromHex,
    themeFromSourceColor,
    hexFromArgb,
  } = require('@material/material-color-utilities');

  const theme = themeFromSourceColor(argbFromHex(seedHex));
  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;
  const palettes = theme.palettes;

  // MD3 scheme keys → camelCase, we need to map to kebab-case tokens
  const s = scheme.toJSON();

  // Convert all scheme values to hex
  const toHex = (v) => hexFromArgb(v);

  // Helper: get a tonal palette color
  const neutralTone = (t) => hexFromArgb(palettes.neutral.tone(t));
  const neutralVariantTone = (t) => hexFromArgb(palettes.neutralVariant.tone(t));
  const primaryTone = (t) => hexFromArgb(palettes.primary.tone(t));

  // ── Vivid brand detection ──────────────────────────────────────────────
  // MD3 light-mode "primary" = tone 40 = a darkened, muted version of the seed.
  // This destroys brands like Rep Republic (#ff4400 → #b12d00) that use their
  // vivid color as buttons, backgrounds, and bold accents — not just as text.
  // When the seed is highly saturated (> 50%) in a light brand, preserve it
  // directly as primary so "bg-primary" in the course IS the brand's real color.
  const seedRgb = hexToRgb(seedHex);
  const sMax = Math.max(seedRgb.r, seedRgb.g, seedRgb.b);
  const sMin = Math.min(seedRgb.r, seedRgb.g, seedRgb.b);
  const seedSat = sMax === 0 ? 0 : (sMax - sMin) / sMax;
  const seedLum = luminance(seedRgb);
  // Vivid = saturation > 50% and not near-black (lum > 0.04)
  const isVividLight = !isDark && seedSat > 0.5 && seedLum > 0.04;

  const primaryHex   = isVividLight ? seedHex : toHex(s.primary);
  const onPrimaryHex = isVividLight
    ? (seedLum > 0.35 ? '#1a1a1a' : '#ffffff')
    : toHex(s.onPrimary);

  if (isVividLight) {
    console.log(`[vivid] Seed is vivid (sat: ${(seedSat * 100).toFixed(0)}%, lum: ${seedLum.toFixed(2)}) — preserving ${seedHex} as primary (MD3 tone-40 would give ${toHex(s.primary)})`);
  }

  if (isDark) {
    return {
      // Page background — very dark neutral
      'background':                  neutralTone(6),
      'on-surface':                  toHex(s.onSurface),
      // Surface hierarchy (5 levels, darkest → brightest)
      'surface-dim':                 neutralTone(6),
      'surface-bright':              neutralTone(24),
      'surface-container-lowest':    neutralTone(4),
      'surface-container-low':       neutralTone(10),
      'surface-container':           neutralTone(12),
      'surface-container-high':      neutralTone(17),
      'surface-container-highest':   neutralTone(22),
      'surface-variant':             toHex(s.surfaceVariant),
      // Primary accent
      'primary':                     toHex(s.primary),
      'on-primary':                  toHex(s.onPrimary),
      'primary-container':           toHex(s.primaryContainer),
      'on-primary-container':        toHex(s.onPrimaryContainer),
      // Secondary
      'secondary':                   toHex(s.secondary),
      'on-secondary':                toHex(s.onSecondary),
      'secondary-container':         toHex(s.secondaryContainer),
      'on-secondary-container':      toHex(s.onSecondaryContainer),
      // Tertiary
      'tertiary':                    toHex(s.tertiary),
      'on-tertiary':                 toHex(s.onTertiary),
      'tertiary-container':          toHex(s.tertiaryContainer),
      'on-tertiary-container':       toHex(s.onTertiaryContainer),
      // Outline
      'outline':                     toHex(s.outline),
      'outline-variant':             toHex(s.outlineVariant),
      // On-surface-variant (muted text, icons)
      'on-surface-variant':          toHex(s.onSurfaceVariant),
      // Error
      'error':                       toHex(s.error),
      'error-container':             toHex(s.errorContainer),
    };
  } else {
    // Light scheme — use neutralVariant for mid-level surfaces to carry
    // the seed color's hue tint. This prevents all light brands from
    // looking identical ("Google-y" neutral grey).
    // For vivid brands: use pure white background (the brand's actual bg IS white;
    // the vivid color is used as bold accent/section bg, not as page tone).
    return {
      'background':                  isVividLight ? '#ffffff' : neutralTone(98),
      'on-surface':                  toHex(s.onSurface),
      'surface-dim':                 neutralVariantTone(87),
      'surface-bright':              isVividLight ? '#ffffff' : neutralTone(98),
      'surface-container-lowest':    isVividLight ? '#ffffff' : neutralTone(100),
      'surface-container-low':       neutralVariantTone(96),
      'surface-container':           neutralVariantTone(94),
      'surface-container-high':      neutralVariantTone(92),
      'surface-container-highest':   neutralVariantTone(90),
      'surface-variant':             toHex(s.surfaceVariant),
      'primary':                     primaryHex,
      'on-primary':                  onPrimaryHex,
      'primary-container':           toHex(s.primaryContainer),
      'on-primary-container':        toHex(s.onPrimaryContainer),
      'secondary':                   toHex(s.secondary),
      'on-secondary':                toHex(s.onSecondary),
      'secondary-container':         toHex(s.secondaryContainer),
      'on-secondary-container':      toHex(s.onSecondaryContainer),
      'tertiary':                    toHex(s.tertiary),
      'on-tertiary':                 toHex(s.onTertiary),
      'tertiary-container':          toHex(s.tertiaryContainer),
      'on-tertiary-container':       toHex(s.onTertiaryContainer),
      'outline':                     toHex(s.outline),
      'outline-variant':             toHex(s.outlineVariant),
      'on-surface-variant':          toHex(s.onSurfaceVariant),
      'error':                       toHex(s.error),
      'error-container':             toHex(s.errorContainer),
    };
  }
}

// ─── Direct token mapping from brand-spec.json ───────────────────────────────

/**
 * Map brand-spec.json colors directly to design tokens.
 * MD3 is used ONLY for gap-filling tokens the brand doesn't define
 * (error, tertiary, outline-variant, container hierarchy).
 * The brand's actual colors are preserved without MD3 transformation.
 */
function mapBrandSpecToTokens(brandSpec) {
  const colors = brandSpec.colors;
  const isDark = brandSpec.isDark;

  // Use brand-spec primary as MD3 seed for gap-fill tokens (so they harmonize)
  const {
    argbFromHex,
    themeFromSourceColor,
    hexFromArgb,
  } = require('@material/material-color-utilities');

  const theme = themeFromSourceColor(argbFromHex(colors.primary));
  const scheme = isDark ? theme.schemes.dark : theme.schemes.light;
  const s = scheme.toJSON();
  const toHex = (v) => hexFromArgb(v);
  const palettes = theme.palettes;
  const neutralTone = (t) => hexFromArgb(palettes.neutral.tone(t));
  const neutralVariantTone = (t) => hexFromArgb(palettes.neutralVariant.tone(t));

  // Direct mapping: brand's actual colors → token roles
  const background = colors.background;
  const primary = colors.primary;
  const onPrimary = colors.onPrimary;
  const onSurface = colors.onBackground;

  // Surface hierarchy: compute from brand background (not MD3)
  // For light brands: slightly darker steps. For dark brands: slightly lighter steps.
  // IMPORTANT: stepSurface must be defined BEFORE cardSurface so we can use it in the fallback.
  const stepSurface = (hex, steps) => {
    if (!hex || hex.length < 7) return hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const dir = isDark ? 1 : -1; // lighten for dark, darken for light
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v + dir * steps)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  };

  // Card surface: use brand's extracted card color, or derive from background.
  // NEVER fall back to neutralVariantTone() — that's MD3-seeded from primary and produces
  // tinted surfaces the brand doesn't use (e.g. #ff4400 orange → #ffe9e4 peach).
  const safeBackgroundAlt = (colors.backgroundAlt && colors.backgroundAlt !== colors.primary)
    ? colors.backgroundAlt
    : null;
  // Light brand: step slightly darker from background (#ffffff → #f8f8f8)
  // Dark brand: step slightly lighter from background (#0a0a0a → #161616)
  const cardSurface = colors.cardSurface || safeBackgroundAlt || stepSurface(background, isDark ? 8 : -4);
  const backgroundAlt = colors.backgroundAlt || stepSurface(background, isDark ? 6 : -2);

  const tokens = {
    'background':                  background,
    'on-surface':                  onSurface,
    // Surface hierarchy — derived from brand background only, never from MD3
    'surface-dim':                 isDark ? background : stepSurface(background, 10),
    'surface-bright':              isDark ? stepSurface(background, 18) : background,
    'surface-container-lowest':    isDark ? stepSurface(background, -2) : background,
    'surface-container-low':       backgroundAlt,
    'surface-container':           cardSurface,
    'surface-container-high':      stepSurface(cardSurface, isDark ? 5 : -3),
    'surface-container-highest':   stepSurface(cardSurface, isDark ? 10 : -6),
    'surface-variant':             toHex(s.surfaceVariant),
    // Primary — brand's exact color, not MD3-transformed
    'primary':                     primary,
    'on-primary':                  onPrimary,
    'primary-container':           toHex(s.primaryContainer),
    'on-primary-container':        toHex(s.onPrimaryContainer),
    // Secondary — use brand's secondary if available, else MD3 gap-fill
    'secondary':                   colors.secondary || toHex(s.secondary),
    'on-secondary':                toHex(s.onSecondary),
    'secondary-container':         toHex(s.secondaryContainer),
    'on-secondary-container':      toHex(s.onSecondaryContainer),
    // Tertiary — always MD3 gap-fill
    'tertiary':                    toHex(s.tertiary),
    'on-tertiary':                 toHex(s.onTertiary),
    'tertiary-container':          toHex(s.tertiaryContainer),
    'on-tertiary-container':       toHex(s.onTertiaryContainer),
    // Outline — MD3 gap-fill
    'outline':                     toHex(s.outline),
    'outline-variant':             toHex(s.outlineVariant),
    'on-surface-variant':          toHex(s.onSurfaceVariant),
    // Error — always MD3 gap-fill
    'error':                       toHex(s.error),
    'error-container':             toHex(s.errorContainer),
  };

  console.log(`[brand-spec] Direct mapping: ${Object.keys(tokens).length} tokens`);
  console.log(`[brand-spec]   background: ${tokens.background} (brand's actual)`);
  console.log(`[brand-spec]   primary: ${tokens.primary} (brand's actual, source: ${colors.primarySource || 'unknown'})`);
  console.log(`[brand-spec]   on-primary: ${tokens['on-primary']} (brand's actual)`);
  console.log(`[brand-spec]   surface-container: ${tokens['surface-container']} (${colors.cardSurface ? "brand's card surface" : 'computed'})`);
  console.log(`[brand-spec]   MD3 gap-fill tokens: error, tertiary, outline, containers`);

  return tokens;
}

// ─── Font checking + subagent matching ────────────────────────────────────────

const FONT_MATCH_PROMPT_PATH = path.join(ROOT, 'engine/output/font-match-prompt.txt');
const FONT_MATCH_RESULT_PATH = path.join(ROOT, 'engine/output/font-match.json');

/**
 * Check if a font family is available on Google Fonts.
 * Uses the CSS2 endpoint — no API key needed. Returns true/false.
 */
function checkGoogleFont(family) {
  return new Promise((resolve) => {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400`;
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

/**
 * Extract the font weights actually used by the brand from raw CSS samples.
 * Returns a sorted deduped array like [300, 400, 600, 700].
 */
function extractUsedWeights(rawCss) {
  const weights = new Set();
  const sections = ['headings', 'paragraphs', 'buttons', 'navItems', 'links'];
  for (const section of sections) {
    for (const item of (rawCss[section] || [])) {
      const w = parseInt(item.fontWeight, 10);
      if (!isNaN(w) && w >= 100 && w <= 900) weights.add(w);
    }
  }
  return [...weights].sort((a, b) => a - b);
}

/**
 * Extract the raw brand fonts from summary (headline + body), filtering generics.
 */
function extractRawFonts(summary) {
  const GENERICS = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
  const allFonts = (summary.allFonts || []).filter(f => !GENERICS.has(f.family));

  const headline = summary.headlineFont && !GENERICS.has(summary.headlineFont)
    ? summary.headlineFont
    : allFonts[0]?.family || null;

  const body = summary.bodyFont && !GENERICS.has(summary.bodyFont)
    ? summary.bodyFont
    : (allFonts.find(f => f.family !== headline)?.family || headline);

  return { headline, body };
}

/**
 * Check fonts against Google Fonts. If any are unavailable, write a subagent
 * prompt and return null (caller should exit and wait for --fonts-ready).
 * If all available, return the font object directly.
 */
async function resolveFonts(extractedCss, brandDesignPath, screenshotPath) {
  const summary = extractedCss.summary || {};
  const raw = extractedCss.raw || {};
  const rawFonts = extractRawFonts(summary);
  const usedWeights = extractUsedWeights(raw);

  console.log(`[fonts] Brand fonts detected: headline="${rawFonts.headline}", body="${rawFonts.body}"`);
  console.log(`[fonts] Weights used: ${usedWeights.join(', ')}`);
  console.log('[fonts] Checking Google Fonts availability...');

  const headlineOk = rawFonts.headline ? await checkGoogleFont(rawFonts.headline) : false;
  const bodyOk     = rawFonts.body && rawFonts.body !== rawFonts.headline
    ? await checkGoogleFont(rawFonts.body)
    : headlineOk;

  console.log(`[fonts]   "${rawFonts.headline}" on Google Fonts: ${headlineOk ? '✓' : '✗'}`);
  if (rawFonts.body !== rawFonts.headline) {
    console.log(`[fonts]   "${rawFonts.body}" on Google Fonts: ${bodyOk ? '✓' : '✗'}`);
  }

  // All fonts available — use them directly
  if (headlineOk && bodyOk) {
    console.log('[fonts] All fonts available on Google Fonts.');
    return { headline: rawFonts.headline || 'Inter', body: rawFonts.body || 'Inter' };
  }

  // One or more unavailable — write subagent prompt and pause
  const brandDesign = fs.existsSync(brandDesignPath)
    ? fs.readFileSync(brandDesignPath, 'utf-8')
    : '(brand-design.md not found)';

  const unavailable = [
    !headlineOk && rawFonts.headline ? `headline font "${rawFonts.headline}"` : null,
    !bodyOk && rawFonts.body && rawFonts.body !== rawFonts.headline ? `body font "${rawFonts.body}"` : null,
  ].filter(Boolean).join(' and ');

  const prompt = `# Font Matching Task

The brand's ${unavailable} ${unavailable.includes('and') ? 'are' : 'is'} not available on Google Fonts.
Your job is to find the best replacement(s) that will look premium and feel native to this brand.

## Brand aesthetic (from brand-design.md)
${brandDesign}

## Typography signals extracted from the brand website
- Headline font (not on Google Fonts): ${rawFonts.headline || 'unknown'}
- Body font (not on Google Fonts): ${rawFonts.body || 'unknown'}
- Font weights the brand uses: ${usedWeights.length ? usedWeights.join(', ') : 'unknown'}
- Border radius character: ${summary.dominantBorderRadius || 'unknown'} (pill = friendly/modern, sharp = minimal/editorial)
- Brand accent colours: ${(summary.accentColors || []).map(c => c.hex).join(', ') || 'none detected'}
- Dark or light brand: ${(summary.backgroundColors || []).some(c => {
    const h = c.hex.replace('#','');
    const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
    return (0.299*r+0.587*g+0.114*b)/255 < 0.18;
  }) ? 'DARK' : 'LIGHT'}
- Screenshot: ${screenshotPath}

## Your task
Look at the screenshot. Read the brand description carefully.
Pick the single best Google Font for HEADLINES and the single best for BODY TEXT.

Prioritise:
1. Aesthetic fit — it should feel like it belongs on this website, not like a substitute
2. Weight coverage — must support all weights in the list above: ${usedWeights.join(', ')}
3. Quality — choose fonts that look premium at both display (60px+) and body (16px) sizes

Rules:
- ONLY suggest fonts that exist on fonts.google.com
- Verify weight availability before suggesting (use web search if needed)
- If the brand has only one font, you may suggest the same font for both headline and body
- Do not suggest Inter or Roboto unless the brand is genuinely corporate/neutral

Write your answer as a JSON file at: engine/output/font-match.json

Format:
{
  "headline": "Font Name Here",
  "body": "Font Name Here",
  "headlineReasoning": "one sentence",
  "bodyReasoning": "one sentence"
}

Nothing else — just write the file.`;

  fs.writeFileSync(FONT_MATCH_PROMPT_PATH, prompt);

  console.log('\n' + '═'.repeat(60));
  console.log('FONT MATCHING REQUIRED');
  console.log('═'.repeat(60));
  console.log(`\nThe brand uses ${unavailable} which ${unavailable.includes('and') ? 'are' : 'is'} not on Google Fonts.`);
  console.log('\nA subagent needs to find the best Google Font match.');
  console.log('\nSpawn a subagent with this instruction:');
  console.log('\n  "Read engine/output/font-match-prompt.txt and');
  console.log('   engine/output/brand-screenshot.png, then follow');
  console.log('   the instructions in the prompt file exactly."');
  console.log('\nThen re-run:');
  console.log('  node engine/scripts/generate-design-tokens.js --fonts-ready');
  console.log('═'.repeat(60) + '\n');

  return null; // signal to main() to exit and wait
}

// ─── Border-radius extraction ──────────────────────────────────────────────────

/**
 * Map raw pixel border-radius to Tailwind tokens.
 * Returns a string like "rounded-full", "rounded-2xl", "rounded-lg", "rounded-md", "rounded-sm", "rounded-none"
 */
function mapRadiusToTailwind(pxValue) {
  const px = parseInt(pxValue, 10);
  if (isNaN(px)) return 'rounded-lg';
  if (px >= 9999 || px >= 100) return 'rounded-full'; // pill shape
  if (px >= 24) return 'rounded-3xl';
  if (px >= 16) return 'rounded-2xl';
  if (px >= 12) return 'rounded-xl';
  if (px >= 8)  return 'rounded-lg';
  if (px >= 4)  return 'rounded-md';
  if (px >= 2)  return 'rounded-sm';
  return 'rounded-none';
}

/**
 * Extract dominant border radius and map to Tailwind scale.
 * Also derives button, card, input variants from the dominant value.
 */
function extractBorderRadius(summary) {
  const dominant = summary.dominantBorderRadius || summary.buttonBorderRadius;
  if (!dominant) return {};

  const px = parseInt(dominant, 10);
  if (isNaN(px)) return {};

  // Derive a consistent scale from the dominant value
  // We use 3 tiers: sm (1/3), md (2/3), full (pill) — all relative to dominant
  const base = Math.min(px, 48); // cap at 48px to avoid huge radii

  return {
    dominantPx: px,
    tailwindClass: mapRadiusToTailwind(dominant),
    // Scale for consistent system
    sm:   Math.round(base * 0.4),
    md:   base,
    lg:   Math.min(Math.round(base * 1.5), 48),
    full: 9999,
    isPill: px >= 50,
  };
}

// ─── Typography generation ─────────────────────────────────────────────────────

/**
 * Generate brand weight preferences from extracted CSS.
 * Only font-weight is brand-variable — sizes, line-heights, and letter-spacing
 * are engine-controlled defaults in build-course.js for cross-brand consistency.
 * build-course.js mergeTypo() extracts only fontWeight from these strings.
 */
function generateTypography(isDark, summary, borderRadiusInfo) {
  const headingWeights = (summary.headings || []).map(h => parseInt(h.fontWeight || '400', 10)).filter(w => !isNaN(w));
  const avgHeadingWeight = headingWeights.length
    ? headingWeights.reduce((a, b) => a + b, 0) / headingWeights.length
    : 400;

  const isBold = avgHeadingWeight >= 600;
  const isLight = avgHeadingWeight <= 350;

  const headingWeight = isBold ? 'font-bold' : isLight ? 'font-light' : 'font-medium';
  const displayWeight = isBold ? 'font-extrabold' : isLight ? 'font-light' : 'font-semibold';

  // Only weight classes — build-course.js owns sizes/line-heights/tracking
  return {
    h1: displayWeight,
    h2: headingWeight,
    h3: headingWeight,
    h4: headingWeight,
    body: '',
    bodyLarge: isLight ? 'font-light' : 'font-normal',
    label: 'font-medium',
    blockquote: isLight ? 'font-light' : 'font-normal',
    statNumber: isBold ? 'font-black' : 'font-bold',
  };
}

// ─── Tailwind config string ────────────────────────────────────────────────────

/**
 * Build the tailwind.config inline script content (for compatibility with
 * existing design-tokens.json shape — build-course.js reads this as tokens.tailwindConfig)
 * This is now SECONDARY — build-course.js builds its own head from structured tokens.
 * We include it for compatibility.
 */
function buildTailwindConfig(colors, fonts) {
  const colorEntries = Object.entries(colors)
    .map(([k, v]) => `          "${k}": "${v}"`)
    .join(',\n');

  return `
    tailwind.config = {
        darkMode: "class",
        theme: {
            extend: {
                colors: {
${colorEntries}
                },
                fontFamily: {
                    "headline": ["${fonts.headline}"],
                    "body": ["${fonts.body}"],
                },
            },
        },
    }
  `;
}

// ─── Vision AI archetype classification ───────────────────────────────────────

const ARCHETYPE_PROMPT_PATH = path.join(ROOT, 'engine/output/archetype-prompt.txt');
const ARCHETYPE_RESULT_PATH = path.join(ROOT, 'engine/output/archetype-match.json');

/**
 * Classify brand archetype — subagent prompt-file pattern (no API key required).
 * Writes archetype-prompt.txt for a Claude Code subagent to read and classify.
 * Returns null to signal to main() that it should exit and wait for --archetype-ready.
 */
async function classifyArchetype(screenshotPath, brandDesignPath, extractedCss) {
  if (!fs.existsSync(screenshotPath)) {
    console.warn('[archetype] No brand screenshot found — skipping classification');
    return null;
  }

  const brandDesign = fs.existsSync(brandDesignPath)
    ? fs.readFileSync(brandDesignPath, 'utf-8')
    : '';
  const summary = extractedCss?.summary || {};

  const prompt = `You are classifying a brand's visual design archetype by looking at their website screenshot.

Read the brand screenshot at: ${screenshotPath}
(Use the Read tool to view it as an image.)

The available archetypes and their characteristics:
- tech-modern: Dark, glowing, electric. Chamfered shapes. Glow shadows. Glass surfaces. Neon accents.
- editorial: Spacious, typographic, refined. Standard shapes. Flat shadows. Solid surfaces. Thin accent borders.
- glassmorphist: Frosted, layered, depth. Squircle shapes. Medium shadows. Heavy glass surfaces. Gradient borders.
- minimalist: Clean, invisible UI. Subtle shapes. Subtle shadows. Flat minimal contrast. Accent only on CTAs.
- neo-brutalist: Bold, high contrast, graphic. Cut-corner shapes. No shadows. Solid high-contrast blocks. Thick borders.
- warm-organic: Soft, approachable, friendly. Organic shapes. Soft large shadows. Warm surfaces. Soft gradients.
- corporate: Professional, structured, trustworthy. Standard shapes. Subtle shadows. Neutral surfaces. Accent on key actions.
- luxury: Dark, subtle, premium. Squircle shapes. No/very subtle shadows. Deep muted surfaces. Metallic accents.

Brand brief:
${brandDesign.slice(0, 800)}

Extracted CSS signals:
- Dominant border-radius: ${summary.dominantBorderRadius || 'unknown'}
- Background colors: ${(summary.backgroundColors || []).map(c => c.hex).join(', ')}
- Accent colors: ${(summary.accentColors || []).map(c => c.hex).join(', ')}
- Headline font: ${summary.headlineFont || 'unknown'}

Look at the screenshot carefully. Consider:
1. Is it light or dark?
2. Are there glass/blur effects?
3. Is the typography dominant (editorial) or visual/graphic?
4. Are there glow effects or electric elements?
5. Is it warm/soft or sharp/cold?
6. What's the overall personality?

Write your answer as a JSON file at: engine/output/archetype-match.json

The file must contain ONLY valid JSON in this exact format:
{
  "archetype": "<one of the 8 archetype names>",
  "confidence": <0.0-1.0>,
  "reasoning": "<one sentence>",
  "styleParams": {
    "shadowStyle": "glow|flat|soft|medium|none|subtle",
    "surfaceStyle": "glass|solid|flat|gradient",
    "shapeFamily": "chamfered|squircle|organic|standard|cut-corner|pill",
    "accentIntensity": "strong|medium|subtle|minimal",
    "iconWeight": "outlined|rounded|filled|thin"
  }
}`;

  fs.writeFileSync(ARCHETYPE_PROMPT_PATH, prompt);
  console.log('\n[archetype] Subagent prompt written to: engine/output/archetype-prompt.txt');
  console.log('\n  Spawn a subagent with this task:');
  console.log('  "Read engine/output/archetype-prompt.txt and follow its instructions.');
  console.log('   View the brand screenshot with the Read tool and classify the archetype.');
  console.log('   Write the result JSON to engine/output/archetype-match.json"');
  console.log('\n  Then re-run:');
  console.log('  node engine/scripts/generate-design-tokens.js --archetype-ready\n');
  return null; // signal to main() to exit and wait
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║  generate-design-tokens.js — Brand Spec + Token Mapping  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Load .env
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf-8');
    for (const line of env.split('\n')) {
      const [k, ...rest] = line.split('=');
      if (k && rest.length && !process.env[k]) {
        process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }

  const fontsReady = process.argv.includes('--fonts-ready');
  const archetypeReady = process.argv.includes('--archetype-ready');

  // ── Load extracted CSS ──
  if (!fs.existsSync(EXTRACTED_CSS)) {
    console.error('ERROR: engine/output/extracted-css.json not found.');
    console.error('Run scrape-brand.js first (Session 1).');
    process.exit(1);
  }

  const extractedCss = JSON.parse(fs.readFileSync(EXTRACTED_CSS, 'utf-8'));
  const summary = extractedCss.summary || {};
  console.log(`[ok] Loaded extracted-css.json from: ${extractedCss.sourceUrl}`);

  // ── Resolve fonts (check Google Fonts availability, subagent if needed) ──
  const brandDesignPath = path.join(OUTPUT_DIR, 'brand-design.md');
  let fonts;

  if (fontsReady) {
    // --fonts-ready: read subagent result
    if (!fs.existsSync(FONT_MATCH_RESULT_PATH)) {
      console.error('ERROR: engine/output/font-match.json not found.');
      console.error('The font-matching subagent must write this file first.');
      process.exit(1);
    }
    const match = JSON.parse(fs.readFileSync(FONT_MATCH_RESULT_PATH, 'utf-8'));
    fonts = { headline: match.headline, body: match.body };
    console.log(`[fonts] Using subagent-matched fonts: headline="${fonts.headline}", body="${fonts.body}"`);
    if (match.headlineReasoning) console.log(`[fonts]   headline reasoning: ${match.headlineReasoning}`);
    if (match.bodyReasoning)    console.log(`[fonts]   body reasoning: ${match.bodyReasoning}`);
  } else {
    // First run: check Google Fonts availability
    fonts = await resolveFonts(extractedCss, brandDesignPath, SCREENSHOT);
    if (!fonts) {
      // Subagent needed — prompt written, exit cleanly
      process.exit(0);
    }
  }

  // ── Load brand-spec.json (Phase 2b: primary input for color mapping) ──
  let brandSpec = null;
  if (fs.existsSync(BRAND_SPEC)) {
    brandSpec = JSON.parse(fs.readFileSync(BRAND_SPEC, 'utf-8'));
    console.log(`[ok] Loaded brand-spec.json (archetype: ${brandSpec.archetype}, primary: ${brandSpec.colors?.primary})`);
  } else {
    console.warn('[warn] brand-spec.json not found — falling back to MD3 palette generation');
  }

  // ── Generate color tokens ──
  let colors, seedHex, isDark;

  if (brandSpec) {
    // ── BRAND-SPEC PATH: direct mapping from extracted brand colors ──
    isDark = brandSpec.isDark;
    seedHex = brandSpec.colors.primary;
    colors = mapBrandSpecToTokens(brandSpec);
  } else {
    // ── LEGACY MD3 PATH: seed → palette generation (backward compatibility) ──
    seedHex = pickSeedColor(summary);
    console.log(`[seed] Seed color: ${seedHex}`);

    isDark = detectIsDark(summary);
    console.log(`[mode] isDark: ${isDark}`);

    console.log('[md3] Generating Material Design 3 palette...');
    colors = generateMd3Tokens(seedHex, isDark);

    // Monochrome brand override
    const hasChromatic = (summary.accentColors || []).some(c => !isNeutral(c.hex) && !isBrowserDefault(c.hex));
    const hasAnyChromatic = (summary.allColors || []).some(c => !isNeutral(c.hex) && !isBrowserDefault(c.hex));
    if (!hasChromatic && !hasAnyChromatic) {
      console.log('[monochrome] Brand has no chromatic colors — desaturating primary family');
      const neutralAccent = isDark ? '#B0B0B0' : '#3A3A3A';
      const neutralContainer = isDark ? '#2A2A2A' : '#E8E8E8';
      const onNeutralContainer = isDark ? '#E0E0E0' : '#1A1A1A';
      colors['primary'] = neutralAccent;
      colors['on-primary'] = isDark ? '#1A1A1A' : '#FFFFFF';
      colors['primary-container'] = neutralContainer;
      colors['on-primary-container'] = onNeutralContainer;
    }

    console.log(`[md3] Generated ${Object.keys(colors).length} color tokens`);
    console.log(`      primary: ${colors.primary}`);
    console.log(`      background: ${colors.background}`);
    console.log(`      surface-container: ${colors['surface-container']}`);
  }

  // ── Extract border radius ──
  const radiusInfo = extractBorderRadius(summary);
  console.log(`[radius] Dominant: ${summary.dominantBorderRadius || 'none'} → ${radiusInfo.tailwindClass || 'default'}`);

  // ── Generate typography ──
  const typography = generateTypography(isDark, summary, radiusInfo);

  // ── Build borderRadius for Tailwind ──
  let borderRadiusTokens = {};
  if (radiusInfo.dominantPx !== undefined) {
    if (radiusInfo.isPill) {
      borderRadiusTokens = { DEFAULT: '0.75rem', lg: '1.5rem', xl: '2rem', full: '9999px' };
    } else if (radiusInfo.dominantPx <= 4) {
      borderRadiusTokens = { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', full: '9999px' };
    } else if (radiusInfo.dominantPx <= 8) {
      borderRadiusTokens = { DEFAULT: '0.5rem', lg: '0.75rem', xl: '1rem', full: '9999px' };
    } else {
      borderRadiusTokens = { DEFAULT: '1rem', lg: '1.5rem', xl: '2rem', full: '9999px' };
    }
  }

  // ── Archetype ──
  let archetypeResult = null;

  if (brandSpec) {
    // Brand-spec path: archetype comes from brand-spec.json (Vision AI Q12)
    archetypeResult = {
      archetype: brandSpec.archetype,
      confidence: 0.85, // Vision AI classification — no separate confidence score
      reasoning: `Classified by Vision AI during brand scraping (brand-spec.json)`,
    };
    console.log(`[archetype] From brand-spec.json: ${archetypeResult.archetype}`);
  } else if (archetypeReady) {
    // Legacy: --archetype-ready from subagent result
    if (!fs.existsSync(ARCHETYPE_RESULT_PATH)) {
      console.error('ERROR: engine/output/archetype-match.json not found.');
      console.error('The archetype classification subagent must write this file first.');
      process.exit(1);
    }
    archetypeResult = JSON.parse(fs.readFileSync(ARCHETYPE_RESULT_PATH, 'utf-8'));
    console.log(`[archetype] Using subagent-classified archetype: ${archetypeResult.archetype} (${Math.round((archetypeResult.confidence || 0) * 100)}% confidence)`);
    if (archetypeResult.reasoning) console.log(`[archetype]   reasoning: ${archetypeResult.reasoning}`);
  } else {
    // Legacy: first run without brand-spec — write prompt for subagent and exit
    const result = await classifyArchetype(SCREENSHOT, brandDesignPath, extractedCss);
    if (!result) {
      // Subagent needed — prompt written, exit cleanly
      process.exit(0);
    }
    archetypeResult = result;
  }

  // ── Compose final tokens ──
  const tokens = {
    generatedAt: new Date().toISOString(),
    sourceUrl: extractedCss.sourceUrl,
    seedColor: seedHex,
    isDark,
    colors,
    fonts,
    borderRadius: borderRadiusTokens,
    spacing: {},
    typography,
    // Archetype classification (used by Session 3+ for recipe selection)
    archetype: archetypeResult ? {
      name: archetypeResult.archetype,
      confidence: archetypeResult.confidence,
      reasoning: archetypeResult.reasoning,
      styleParams: archetypeResult.styleParams,
    } : null,
    // Legacy tailwindConfig field for compatibility (build-course.js does not use this
    // directly — it builds its own config from colors/fonts above — but included for
    // tooling that reads tokens as a design-system snapshot)
    tailwindConfig: buildTailwindConfig(colors, fonts),
  };

  fs.writeFileSync(TOKENS_OUT, JSON.stringify(tokens, null, 2));
  console.log(`\n[✓] Wrote design-tokens.json`);
  console.log(`    ${Object.keys(colors).length} color tokens`);
  console.log(`    fonts: ${fonts.headline} / ${fonts.body}`);
  console.log(`    isDark: ${isDark}`);
  if (archetypeResult) {
    console.log(`    archetype: ${archetypeResult.archetype} (${Math.round(archetypeResult.confidence * 100)}% confidence)`);
  }

  // ── Preview: key color roles ──
  console.log('\n── Color roles ──────────────────────────────────────────');
  const preview = ['background', 'primary', 'secondary', 'tertiary', 'surface-container', 'on-surface', 'outline-variant'];
  for (const key of preview) {
    if (colors[key]) console.log(`  ${key.padEnd(30)} ${colors[key]}`);
  }
  console.log('─────────────────────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
