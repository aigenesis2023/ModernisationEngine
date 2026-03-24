#!/usr/bin/env node
/**
 * V5 Brand Scraper
 *
 * Fetches a brand URL via CORS proxy and extracts design tokens.
 * Generates TWO outputs:
 *   1. brand-profile.json — raw scraped data (kept for reference)
 *   2. brand-design.md — DESIGN.md format brief for Stitch (NEW in V5)
 *
 * V5 upgrades:
 *   - Font mapping to Stitch's 28 supported fonts
 *   - Visual pattern mapping to Stitch vocabulary (colorVariant, roundness, spacingScale)
 *   - Multi-signal theme detection (fixes Fluence-style false dark detection)
 *   - DESIGN.md generation in Stitch's native format
 *
 * Usage: node v5/scripts/scrape-brand.js <brand-url>
 * Output: v5/output/brand-profile.json + v5/output/brand-design.md
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const CORS_PROXY = 'https://cors-proxy.leoduncan-elearning.workers.dev';

// ─── Stitch's 28 Supported Fonts ────────────────────────────────────
// Each entry: { stitch: enum name, family: CSS family, category, weight }
const STITCH_FONTS = [
  { stitch: 'BE_VIETNAM_PRO', family: 'Be Vietnam Pro', category: 'sans', weight: 'geometric' },
  { stitch: 'EPILOGUE', family: 'Epilogue', category: 'sans', weight: 'geometric' },
  { stitch: 'INTER', family: 'Inter', category: 'sans', weight: 'neutral' },
  { stitch: 'LEXEND', family: 'Lexend', category: 'sans', weight: 'readable' },
  { stitch: 'MANROPE', family: 'Manrope', category: 'sans', weight: 'geometric' },
  { stitch: 'NEWSREADER', family: 'Newsreader', category: 'serif', weight: 'editorial' },
  { stitch: 'NOTO_SERIF', family: 'Noto Serif', category: 'serif', weight: 'classic' },
  { stitch: 'PLUS_JAKARTA_SANS', family: 'Plus Jakarta Sans', category: 'sans', weight: 'friendly' },
  { stitch: 'PUBLIC_SANS', family: 'Public Sans', category: 'sans', weight: 'neutral' },
  { stitch: 'SPACE_GROTESK', family: 'Space Grotesk', category: 'sans', weight: 'technical' },
  { stitch: 'SPLINE_SANS', family: 'Spline Sans', category: 'sans', weight: 'modern' },
  { stitch: 'WORK_SANS', family: 'Work Sans', category: 'sans', weight: 'neutral' },
  { stitch: 'DOMINE', family: 'Domine', category: 'serif', weight: 'strong' },
  { stitch: 'LIBRE_CASLON_TEXT', family: 'Libre Caslon Text', category: 'serif', weight: 'classic' },
  { stitch: 'EB_GARAMOND', family: 'EB Garamond', category: 'serif', weight: 'elegant' },
  { stitch: 'LITERATA', family: 'Literata', category: 'serif', weight: 'readable' },
  { stitch: 'SOURCE_SERIF_FOUR', family: 'Source Serif 4', category: 'serif', weight: 'editorial' },
  { stitch: 'MONTSERRAT', family: 'Montserrat', category: 'sans', weight: 'geometric' },
  { stitch: 'METROPOLIS', family: 'Metropolis', category: 'sans', weight: 'geometric' },
  { stitch: 'SOURCE_SANS_THREE', family: 'Source Sans 3', category: 'sans', weight: 'neutral' },
  { stitch: 'NUNITO_SANS', family: 'Nunito Sans', category: 'sans', weight: 'friendly' },
  { stitch: 'ARIMO', family: 'Arimo', category: 'sans', weight: 'neutral' },
  { stitch: 'HANKEN_GROTESK', family: 'Hanken Grotesk', category: 'sans', weight: 'geometric' },
  { stitch: 'RUBIK', family: 'Rubik', category: 'sans', weight: 'friendly' },
  { stitch: 'GEIST', family: 'Geist', category: 'sans', weight: 'technical' },
  { stitch: 'DM_SANS', family: 'DM Sans', category: 'sans', weight: 'geometric' },
  { stitch: 'IBM_PLEX_SANS', family: 'IBM Plex Sans', category: 'sans', weight: 'technical' },
  { stitch: 'SORA', family: 'Sora', category: 'sans', weight: 'geometric' },
];

// Known font → Stitch mapping for common brand fonts
const FONT_ALIASES = {
  'poppins': 'PLUS_JAKARTA_SANS',
  'lato': 'WORK_SANS',
  'roboto': 'SOURCE_SANS_THREE',
  'open sans': 'SOURCE_SANS_THREE',
  'nunito': 'NUNITO_SANS',
  'raleway': 'MANROPE',
  'oswald': 'MONTSERRAT',
  'playfair display': 'EB_GARAMOND',
  'merriweather': 'LITERATA',
  'lora': 'NOTO_SERIF',
  'pt sans': 'SOURCE_SANS_THREE',
  'pt serif': 'SOURCE_SERIF_FOUR',
  'ubuntu': 'RUBIK',
  'fira sans': 'IBM_PLEX_SANS',
  'barlow': 'SPACE_GROTESK',
  'quicksand': 'LEXEND',
  'karla': 'INTER',
  'josefin sans': 'SORA',
  'cabin': 'DM_SANS',
  'mulish': 'INTER',
  'dm sans': 'DM_SANS',
  'space grotesk': 'SPACE_GROTESK',
  'ibm plex sans': 'IBM_PLEX_SANS',
  'plus jakarta sans': 'PLUS_JAKARTA_SANS',
  'be vietnam pro': 'BE_VIETNAM_PRO',
  'hanken grotesk': 'HANKEN_GROTESK',
  'source sans pro': 'SOURCE_SANS_THREE',
  'source serif pro': 'SOURCE_SERIF_FOUR',
  'noto sans': 'INTER',
  'noto serif': 'NOTO_SERIF',
  'libre baskerville': 'LIBRE_CASLON_TEXT',
  'cormorant garamond': 'EB_GARAMOND',
  'crimson text': 'NOTO_SERIF',
  'spectral': 'LITERATA',
  'archivo': 'EPILOGUE',
  'outfit': 'SORA',
  'figtree': 'DM_SANS',
  'geist': 'GEIST',
  'satoshi': 'DM_SANS',
  'general sans': 'HANKEN_GROTESK',
  'cabinet grotesk': 'EPILOGUE',
  'clash display': 'MONTSERRAT',
  'switzer': 'INTER',
};

// ─── Fetch with CORS proxy ──────────────────────────────────────────
async function fetchViaProxy(url) {
  const proxyUrl = `${CORS_PROXY}?url=${encodeURIComponent(url)}`;
  const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.text();
}

// ─── Color utilities ─────────────────────────────────────────────────
function normalizeColor(color) {
  color = (color || '').trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  return color;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function isNearBlackOrWhite(hex) {
  if (!hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (r + g + b) / 3;
  return lum < 20 || lum > 240;
}

function getColorLuminance(hex) {
  if (!hex.startsWith('#') || hex.length < 7) return 128;
  return (parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16)) / 3;
}

function getColorSaturation(hex) {
  if (!hex.startsWith('#') || hex.length < 7) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function colorDistance(hex1, hex2) {
  const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function lighten(hex, amount) {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  return rgbToHex(
    Math.min(255, parseInt(hex.slice(1, 3), 16) + amount),
    Math.min(255, parseInt(hex.slice(3, 5), 16) + amount),
    Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  );
}

function darken(hex, amount) {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  return rgbToHex(
    Math.max(0, parseInt(hex.slice(1, 3), 16) - amount),
    Math.max(0, parseInt(hex.slice(3, 5), 16) - amount),
    Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  );
}

function perceivedLuminance(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function getHue(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

// ─── CSS Collection ──────────────────────────────────────────────────
async function collectAllCss(doc, pageUrl) {
  const parts = [];

  // Inline <style> tags
  doc.querySelectorAll('style').forEach(el => {
    if (el.textContent) parts.push(el.textContent);
  });

  // External stylesheets
  const links = doc.querySelectorAll('link[rel="stylesheet"]');
  for (const el of links) {
    const href = el.getAttribute('href');
    if (!href) continue;
    try {
      const cssUrl = new URL(href, pageUrl).href;
      const css = await fetchViaProxy(cssUrl);
      parts.push(css);
    } catch {
      // Skip unreachable stylesheets
    }
  }

  // Inline style attributes
  doc.querySelectorAll('[style]').forEach(el => {
    const style = el.getAttribute('style');
    if (style) parts.push(`._inline { ${style} }`);
  });

  return parts.join('\n');
}

// ─── Color Extraction ────────────────────────────────────────────────
function extractColors(css, doc) {
  const colorMap = new Map();

  function getPropertyContext(index) {
    const before = css.substring(Math.max(0, index - 100), index);
    const propMatch = before.match(/([\w-]+)\s*:\s*[^;]*$/);
    return propMatch?.[1] || 'unknown';
  }

  function record(color, context) {
    const norm = normalizeColor(color);
    if (isNearBlackOrWhite(norm)) return;
    if (!norm.startsWith('#') || norm.length < 7) return;
    const existing = colorMap.get(norm);
    if (existing) {
      existing.count++;
      if (!existing.contexts.includes(context)) existing.contexts.push(context);
    } else {
      colorMap.set(norm, { normalized: norm, count: 1, contexts: [context] });
    }
  }

  // Hex colors
  for (const match of css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    record(match[0], getPropertyContext(match.index || 0));
  }

  // RGB/RGBA
  for (const match of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/g)) {
    const hex = rgbToHex(+match[1], +match[2], +match[3]);
    record(hex, getPropertyContext(match.index || 0));
  }

  // CSS variables
  for (const match of css.matchAll(/--[\w-]*color[\w-]*\s*:\s*([^;]+)/gi)) {
    const val = match[1].trim();
    if (val.startsWith('#') || val.startsWith('rgb')) {
      record(normalizeColor(val), 'variable');
    }
  }

  // Meta theme-color
  const themeColor = doc.querySelector('meta[name="theme-color"]');
  if (themeColor) record(normalizeColor(themeColor.getAttribute('content') || ''), 'theme-color');

  return assignColorRoles(colorMap, css, doc);
}

function assignColorRoles(map, cssText, doc) {
  const entries = Array.from(map.values())
    .filter(e => e.normalized.startsWith('#') && e.normalized.length >= 7)
    .sort((a, b) => b.count - a.count);

  const primaryCandidates = entries.filter(e =>
    getColorSaturation(e.normalized) > 0.2 &&
    (e.contexts.some(c => ['background', 'background-color', 'border-color', 'theme-color', 'variable'].includes(c)) || e.count >= 3)
  );

  const primary = primaryCandidates[0]?.normalized || entries[0]?.normalized || '#2563eb';
  const secondary = entries.find(e =>
    e.normalized !== primary && getColorSaturation(e.normalized) > 0.1 && colorDistance(e.normalized, primary) > 50
  )?.normalized || darken(primary, 20);

  const accentCandidates = entries
    .filter(e => e.normalized !== primary && e.normalized !== secondary)
    .sort((a, b) => getColorSaturation(b.normalized) - getColorSaturation(a.normalized));
  const accent = accentCandidates[0]?.normalized || lighten(primary, 20);

  // ─── Multi-signal theme detection (V5 — fixes false dark detection) ───
  // Collect ALL signals rather than trusting a single CSS property.
  const themeSignals = { light: 0, dark: 0 };

  // Signal 1: body/html explicit background
  const bodyBgMatch = cssText.match(/(?:body|html)\s*\{[^}]*?background(?:-color)?\s*:\s*([^;}\s]+)/i);
  if (bodyBgMatch) {
    const val = bodyBgMatch[1].trim();
    if (val.startsWith('#') || val.startsWith('rgb')) {
      const lum = perceivedLuminance(normalizeColor(val));
      themeSignals[lum < 0.45 ? 'dark' : 'light'] += 3;
    }
  }

  // Signal 2: inline style on body/html
  if (doc) {
    for (const tag of ['body', 'html']) {
      const el = doc.querySelector(tag);
      if (el) {
        const inlineStyle = el.getAttribute('style') || '';
        const inlineBgMatch = inlineStyle.match(/background(?:-color)?\s*:\s*([^;]+)/i);
        if (inlineBgMatch) {
          const val = inlineBgMatch[1].trim();
          if (val.startsWith('#') || val.startsWith('rgb')) {
            const lum = perceivedLuminance(normalizeColor(val));
            themeSignals[lum < 0.45 ? 'dark' : 'light'] += 2;
          }
        }
      }
    }
  }

  // Signal 3: CSS variables referencing background on :root
  const rootBgVarMatch = cssText.match(/:root\s*\{[^}]*?--[\w-]*(?:bg|background)[\w-]*\s*:\s*([^;}\s]+)/i);
  if (rootBgVarMatch) {
    const val = rootBgVarMatch[1].trim();
    if (val.startsWith('#') || val.startsWith('rgb')) {
      const lum = perceivedLuminance(normalizeColor(val));
      themeSignals[lum < 0.45 ? 'dark' : 'light'] += 2;
    }
  }

  // Signal 4: Count of dark vs light backgrounds across ALL elements
  const darkBgCount = entries.filter(e =>
    getColorLuminance(e.normalized) < 80 &&
    e.contexts.some(c => c.includes('background'))
  ).reduce((sum, e) => sum + e.count, 0);
  const lightBgCount = entries.filter(e =>
    getColorLuminance(e.normalized) > 180 &&
    e.contexts.some(c => c.includes('background'))
  ).reduce((sum, e) => sum + e.count, 0);

  if (lightBgCount > darkBgCount * 1.5) themeSignals.light += 2;
  else if (darkBgCount > lightBgCount * 1.5) themeSignals.dark += 2;

  // Signal 5: Text color luminance — light text = dark theme, dark text = light theme
  const textEntries = entries.filter(e => e.contexts.some(c => c === 'color'));
  const lightTextCount = textEntries.filter(e => getColorLuminance(e.normalized) > 180).reduce((s, e) => s + e.count, 0);
  const darkTextCount = textEntries.filter(e => getColorLuminance(e.normalized) < 80).reduce((s, e) => s + e.count, 0);
  if (darkTextCount > lightTextCount * 1.5) themeSignals.light += 2;
  else if (lightTextCount > darkTextCount * 1.5) themeSignals.dark += 2;

  // Signal 6: meta theme-color
  const metaTheme = doc.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    const lum = perceivedLuminance(normalizeColor(metaTheme.getAttribute('content') || ''));
    themeSignals[lum < 0.45 ? 'dark' : 'light'] += 1;
  }

  // Signal 7: Presence of "dark" or "light" in class names on html/body
  if (doc) {
    const htmlClass = (doc.querySelector('html')?.getAttribute('class') || '').toLowerCase();
    const bodyClass = (doc.querySelector('body')?.getAttribute('class') || '').toLowerCase();
    if (htmlClass.includes('dark') || bodyClass.includes('dark')) themeSignals.dark += 3;
    if (htmlClass.includes('light') || bodyClass.includes('light')) themeSignals.light += 3;
  }

  // Default to light if signals are tied or no signals found
  const isDark = themeSignals.dark > themeSignals.light;

  // Determine background/surface/text using the detected theme
  let background, surface, textColor;

  if (isDark) {
    const darkBg = entries.find(e => getColorLuminance(e.normalized) < 60 && e.contexts.some(c => c.includes('background')));
    background = darkBg?.normalized || '#0a0a12';
    surface = entries.find(e => {
      const lum = getColorLuminance(e.normalized);
      return lum > 10 && lum < 80 && e.normalized !== background;
    })?.normalized || lighten(background, 18);
    textColor = entries.find(e => getColorLuminance(e.normalized) > 200 && e.contexts.some(c => c.includes('color')))?.normalized || '#f0f0f0';
  } else {
    const lightBg = entries.find(e => getColorLuminance(e.normalized) > 200 && e.contexts.some(c => c.includes('background')));
    background = lightBg?.normalized || '#ffffff';
    surface = entries.find(e => getColorLuminance(e.normalized) > 220 && e.normalized !== background)?.normalized || '#f8f9fa';
    textColor = entries.find(e => getColorLuminance(e.normalized) < 60 && e.contexts.some(c => c.includes('color')))?.normalized || '#1a1a2e';
  }

  const gradientMatch = (cssText || '').match(/linear-gradient\([^)]*(?:,\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))){2,}[^)]*\)/);
  const gradient = gradientMatch ? gradientMatch[0] : `linear-gradient(135deg, ${primary}, ${secondary})`;

  return {
    primary, secondary, accent,
    background, surface,
    text: textColor, textMuted: isDark ? darken(textColor, 40) : lighten(textColor, 40),
    success: '#10b981', error: '#ef4444', warning: '#f59e0b',
    gradient,
    isDark,
    _themeSignals: themeSignals,
  };
}

// ─── Typography Extraction ───────────────────────────────────────────
function extractTypography(css, doc) {
  const fontFamilies = [];
  const systemFonts = new Set([
    'arial', 'helvetica', 'times', 'times new roman', 'courier', 'sans-serif', 'serif',
    'monospace', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
    'inherit', 'initial', 'unset',
  ]);

  for (const match of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const font = match[1].split(',')[0].trim().replace(/["']/g, '').trim();
    if (font && !systemFonts.has(font.toLowerCase())) {
      const existing = fontFamilies.find(f => f.font === font);
      if (existing) existing.count++;
      else fontFamilies.push({ font, count: 1 });
    }
  }

  let fontImportUrl;
  const gfLink = doc.querySelector('link[href*="fonts.googleapis.com"]');
  if (gfLink) fontImportUrl = gfLink.getAttribute('href');

  const importMatch = css.match(/@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com[^'")\s]+)/);
  if (importMatch && !fontImportUrl) fontImportUrl = importMatch[1];

  fontFamilies.sort((a, b) => b.count - a.count);
  const headingFont = fontFamilies[0]?.font || 'Inter';
  const bodyFont = fontFamilies.length > 1 ? fontFamilies[1].font : fontFamilies[0]?.font || 'Inter';

  const fontSizes = [];
  for (const match of css.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
    fontSizes.push(parseFloat(match[1]));
  }
  fontSizes.sort((a, b) => a - b);
  const baseSize = fontSizes.length > 0 ? fontSizes[Math.floor(fontSizes.length / 2)] : 16;

  const weights = [];
  for (const match of css.matchAll(/font-weight\s*:\s*(\d+)/gi)) {
    weights.push(parseInt(match[1]));
  }
  const headingWeight = weights.filter(w => w >= 600).length > 0 ? Math.max(...weights.filter(w => w >= 600)) : 700;
  const bodyWeight = weights.filter(w => w <= 500).length > 0 ? weights.filter(w => w <= 500).sort((a, b) => b - a)[0] : 400;

  if (!fontImportUrl && headingFont !== 'Inter' && !systemFonts.has(headingFont.toLowerCase())) {
    const fonts = [headingFont];
    if (bodyFont !== headingFont) fonts.push(bodyFont);
    fontImportUrl = 'https://fonts.googleapis.com/css2?' +
      fonts.map(f => 'family=' + encodeURIComponent(f) + ':wght@400;500;600;700').join('&') + '&display=swap';
  }

  return {
    headingFont, bodyFont, fontImportUrl, baseSize,
    headingSizes: { h1: Math.round(baseSize * 2.5), h2: Math.round(baseSize * 2), h3: Math.round(baseSize * 1.5) },
    lineHeight: 1.6, headingWeight, bodyWeight,
  };
}

// ─── Font Mapping to Stitch ─────────────────────────────────────────
function mapToStitchFont(fontName) {
  if (!fontName) return 'INTER';
  const lower = fontName.toLowerCase().trim();

  // Direct alias match
  if (FONT_ALIASES[lower]) return FONT_ALIASES[lower];

  // Exact Stitch family match
  const exact = STITCH_FONTS.find(f => f.family.toLowerCase() === lower);
  if (exact) return exact.stitch;

  // Partial match — font name contains a Stitch font name or vice versa
  const partial = STITCH_FONTS.find(f =>
    lower.includes(f.family.toLowerCase()) || f.family.toLowerCase().includes(lower)
  );
  if (partial) return partial.stitch;

  // Category-based fallback: detect if serif or sans from the name
  const isSerif = /serif|garamond|caslon|baskerville|times|georgia|playfair|merriweather|lora|crimson/i.test(fontName);
  if (isSerif) return 'NOTO_SERIF';

  // Default sans-serif
  return 'INTER';
}

// ─── Style Extraction ────────────────────────────────────────────────
function extractStyle(css) {
  const radiusValues = [];
  for (const match of css.matchAll(/border-radius\s*:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
    radiusValues.push(parseFloat(match[1]));
  }
  const medianRadius = radiusValues.length > 0
    ? radiusValues.sort((a, b) => a - b)[Math.floor(radiusValues.length / 2)]
    : 8;

  const hasBoxShadow = /box-shadow\s*:/i.test(css);
  const hasBackdropFilter = /backdrop-filter\s*:/i.test(css);
  const hasBorder = /border\s*:\s*1px/i.test(css);
  const hasTransparentBg = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0?\.[0-4]\d*\s*\)/i.test(css);

  const cardStyle = hasBackdropFilter ? 'glass' :
    hasBoxShadow ? 'elevated' : hasBorder ? 'outlined' : 'flat';

  const hasPillRadius = /border-radius\s*:\s*(9999|999|200|50%)\s*px?/i.test(css);
  const hasGradientBtn = /\.btn[^{]*\{[^}]*gradient/i.test(css) || /button[^{]*\{[^}]*gradient/i.test(css);
  const hasOutlineBtn = /\.btn[^{]*outline|\.btn-outline/i.test(css);

  let buttonStyle = 'solid';
  if (hasPillRadius) buttonStyle = 'pill';
  else if (hasGradientBtn) buttonStyle = 'gradient';
  else if (hasOutlineBtn) buttonStyle = 'outline';
  else if (medianRadius > 8) buttonStyle = 'rounded';

  const mood = cardStyle === 'glass' ? 'creative' : medianRadius >= 20 ? 'friendly' :
    medianRadius <= 4 && /text-transform\s*:\s*uppercase/i.test(css) ? 'corporate' :
    /monospace|code|terminal/i.test(css) ? 'technical' : 'elegant';

  return {
    borderRadius: medianRadius + 'px', cardStyle, buttonStyle,
    imageStyle: medianRadius >= 8 ? 'rounded' : 'sharp',
    mood,
    medianRadius,
    hasBoxShadow, hasBackdropFilter, hasTransparentBg,
    spacing: { unit: 8, section: 64, element: 16 },
  };
}

// ─── Stitch Vocabulary Mapping ───────────────────────────────────────
function mapToStitchVocabulary(colors, style) {
  // colorMode
  const colorMode = colors.isDark ? 'DARK' : 'LIGHT';

  // roundness based on median border-radius
  const radius = style.medianRadius || 8;
  let roundness;
  if (radius <= 4) roundness = 'ROUND_FOUR';
  else if (radius <= 8) roundness = 'ROUND_EIGHT';
  else if (radius <= 16) roundness = 'ROUND_TWELVE';
  else roundness = 'ROUND_FULL';

  // spacingScale — compact, normal, or spacious
  let spacingScale = 2; // normal
  if (style.spacing?.section >= 80) spacingScale = 3;
  else if (style.spacing?.section <= 40) spacingScale = 1;

  // colorVariant from color analysis
  const primarySat = getColorSaturation(colors.primary);
  const secondarySat = getColorSaturation(colors.secondary);
  const accentSat = getColorSaturation(colors.accent);
  const avgSat = (primarySat + secondarySat + accentSat) / 3;

  const primaryHue = getHue(colors.primary);
  const secondaryHue = getHue(colors.secondary);
  const hueDiff = Math.abs(primaryHue - secondaryHue);

  let colorVariant;
  if (avgSat < 0.1) colorVariant = 'MONOCHROME';
  else if (avgSat < 0.25) colorVariant = 'NEUTRAL';
  else if (hueDiff > 120) colorVariant = 'VIBRANT';
  else if (hueDiff > 60) colorVariant = 'EXPRESSIVE';
  else colorVariant = 'TONAL_SPOT';

  return { colorMode, roundness, spacingScale, colorVariant };
}

// ─── Semantic Color Naming ──────────────────────────────────────────
function getSemanticColorName(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 'Unknown';

  const hue = getHue(hex);
  const sat = getColorSaturation(hex);
  const lum = perceivedLuminance(hex);

  if (sat < 0.1) {
    if (lum > 0.9) return 'Snow White';
    if (lum > 0.7) return 'Silver Mist';
    if (lum > 0.5) return 'Ash Grey';
    if (lum > 0.3) return 'Charcoal';
    if (lum > 0.1) return 'Midnight';
    return 'Obsidian';
  }

  // Hue-based naming with luminance modifiers
  const prefix = lum > 0.7 ? 'Soft ' : lum < 0.3 ? 'Deep ' : '';

  if (hue < 15 || hue >= 345) return prefix + 'Crimson';
  if (hue < 30) return prefix + 'Coral';
  if (hue < 45) return prefix + 'Amber';
  if (hue < 65) return prefix + 'Gold';
  if (hue < 80) return prefix + 'Lime';
  if (hue < 150) return prefix + 'Emerald';
  if (hue < 180) return prefix + 'Teal';
  if (hue < 210) return prefix + 'Cyan';
  if (hue < 240) return prefix + 'Azure';
  if (hue < 270) return prefix + 'Indigo';
  if (hue < 300) return prefix + 'Amethyst';
  if (hue < 330) return prefix + 'Magenta';
  return prefix + 'Rose';
}

// ─── Atmosphere Description ──────────────────────────────────────────
function generateAtmosphere(colors, style, stitchVocab) {
  const adjectives = [];

  // Theme-based
  if (colors.isDark) adjectives.push('Sophisticated', 'Moody');
  else adjectives.push('Airy', 'Open');

  // Card style
  if (style.cardStyle === 'glass') adjectives.push('Glass-forward', 'Ethereal');
  else if (style.cardStyle === 'elevated') adjectives.push('Layered', 'Dimensional');
  else if (style.cardStyle === 'outlined') adjectives.push('Clean-lined', 'Structured');

  // Roundness
  if (stitchVocab.roundness === 'ROUND_FULL') adjectives.push('Friendly', 'Approachable');
  else if (stitchVocab.roundness === 'ROUND_FOUR') adjectives.push('Precise', 'Technical');

  // Color vibrancy
  if (stitchVocab.colorVariant === 'VIBRANT') adjectives.push('Bold', 'Dynamic');
  else if (stitchVocab.colorVariant === 'MONOCHROME') adjectives.push('Minimal', 'Restrained');
  else if (stitchVocab.colorVariant === 'TONAL_SPOT') adjectives.push('Harmonious', 'Focused');

  // Mood
  if (style.mood === 'corporate') adjectives.push('Professional', 'Authoritative');
  else if (style.mood === 'creative') adjectives.push('Creative', 'Expressive');
  else if (style.mood === 'technical') adjectives.push('Technical', 'Engineered');

  // Pick the best 3-5
  return adjectives.slice(0, 5).join(', ');
}

// ─── Logo Extraction ─────────────────────────────────────────────────
function extractLogo(doc, pageUrl) {
  const selectors = [
    'header .logo img', 'header img[class*="logo"]', '.logo img',
    'a[class*="logo"] img', '[class*="logo"] img', 'header a:first-child img',
    '.navbar-brand img', 'header img:first-of-type',
  ];

  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      if (!el) continue;
      const src = el.getAttribute('src');
      if (src) {
        return {
          url: new URL(src, pageUrl).href,
          width: parseInt(el.getAttribute('width') || '0') || 200,
          height: parseInt(el.getAttribute('height') || '0') || 60,
          alt: el.getAttribute('alt') || 'Logo',
        };
      }
    } catch { /* skip invalid selectors */ }
  }

  const ogImage = doc.querySelector('meta[property="og:image"]');
  if (ogImage) {
    const content = ogImage.getAttribute('content');
    if (content) {
      return {
        url: new URL(content, pageUrl).href,
        width: 200, height: 60,
        alt: doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || 'Logo',
      };
    }
  }

  return null;
}

// ─── DESIGN.md Generation ───────────────────────────────────────────
function generateDesignMd(profile) {
  const { colors, typography, style, logo } = profile;

  // Map fonts to Stitch
  const headingStitch = mapToStitchFont(typography.headingFont);
  const bodyStitch = mapToStitchFont(typography.bodyFont);
  const headingFamily = STITCH_FONTS.find(f => f.stitch === headingStitch)?.family || 'Inter';
  const bodyFamily = STITCH_FONTS.find(f => f.stitch === bodyStitch)?.family || 'Inter';

  // Map to Stitch vocabulary
  const stitchVocab = mapToStitchVocabulary(colors, style);

  // Generate atmosphere
  const atmosphere = generateAtmosphere(colors, style, stitchVocab);

  // Semantic color names
  const primaryName = getSemanticColorName(colors.primary);
  const secondaryName = getSemanticColorName(colors.secondary);
  const accentName = getSemanticColorName(colors.accent);

  // Card and button descriptions in natural language
  let cardDescription;
  if (style.cardStyle === 'glass') cardDescription = 'Frosted glass cards with backdrop blur and subtle borders';
  else if (style.cardStyle === 'elevated') cardDescription = 'Elevated cards with soft shadows and clean edges';
  else if (style.cardStyle === 'outlined') cardDescription = 'Clean-bordered cards with minimal depth';
  else cardDescription = 'Flat cards with clear content separation';

  let buttonDescription;
  if (style.buttonStyle === 'pill') buttonDescription = 'Pill-shaped buttons with full border radius';
  else if (style.buttonStyle === 'gradient') buttonDescription = 'Gradient-filled buttons with brand colour transitions';
  else if (style.buttonStyle === 'outline') buttonDescription = 'Ghost/outline buttons with border and transparent fill';
  else if (style.buttonStyle === 'rounded') buttonDescription = 'Softly rounded buttons with solid fill';
  else buttonDescription = 'Solid fill buttons with subtle corner radius';

  const md = `# DESIGN.md — Brand Design Brief for Stitch

## Visual Theme & Atmosphere
${atmosphere}

This design should feel like a premium, custom-built learning platform. The overall mood is **${style.mood}** with a **${stitchVocab.colorMode.toLowerCase()}** colour scheme.

## Colour Palette & Roles
- **${primaryName}** (${colors.primary}) — Primary actions, key interactive elements, navigation accents
- **${secondaryName}** (${colors.secondary}) — Secondary actions, supporting elements, section highlights
- **${accentName}** (${colors.accent}) — Accent highlights, hover states, decorative elements
- **Background** (${colors.background}) — Page background
- **Surface** (${colors.surface}) — Card backgrounds, elevated containers
- **Text** (${colors.text}) — Primary body text
- **Text Muted** (${colors.textMuted}) — Secondary text, captions, labels

Material Design System:
- colorMode: ${stitchVocab.colorMode}
- colorVariant: ${stitchVocab.colorVariant}

## Typography Rules
- **Headings:** ${headingFamily} (${headingStitch}) — bold, confident, clear hierarchy
- **Body:** ${bodyFamily} (${bodyStitch}) — readable, comfortable, generous line height
- Let Stitch determine the exact font sizes, weights, and line heights for optimal readability

## Component Stylings
- **Cards:** ${cardDescription}
- **Buttons:** ${buttonDescription}
- **Borders:** ${style.imageStyle === 'rounded' ? 'Soft rounded corners on images and containers' : 'Sharp corners for a precise, editorial feel'}
- **Interactive elements:** Clear hover states, smooth transitions, focus indicators for accessibility
${style.hasBackdropFilter ? '- **Glass effects:** Use backdrop-filter blur for overlays and floating elements' : ''}

Stitch DesignTheme:
- roundness: ${stitchVocab.roundness}
- spacingScale: ${stitchVocab.spacingScale}

## Layout Principles
- **Whitespace:** ${stitchVocab.spacingScale >= 3 ? 'Generous breathing room between sections' : stitchVocab.spacingScale <= 1 ? 'Compact, content-dense layout' : 'Balanced whitespace for comfortable reading'}
- **Grid:** Responsive grid that works from mobile to desktop
- **Section rhythm:** Alternate between content-dense and visual-break sections for reading flow
- **Visual hierarchy:** Clear distinction between headings, subheadings, body text, and labels
${logo ? `\n## Brand Logo\nLogo URL: ${logo.url}\n` : ''}
`;

  return md.trim();
}

// ─── Fallback profile ────────────────────────────────────────────────
function buildFallbackProfile(url) {
  return {
    sourceUrl: url,
    colors: {
      primary: '#3C087E', secondary: '#030014', accent: '#6b21a8',
      background: '#ffffff', surface: '#f8f9fa', text: '#030014', textMuted: '#6b7280',
      success: '#10b981', error: '#ef4444', warning: '#f59e0b',
      gradient: 'linear-gradient(135deg, #3C087E, #030014)',
      isDark: false,
      _themeSignals: { light: 0, dark: 0 },
    },
    typography: {
      headingFont: 'Inter', bodyFont: 'Inter',
      fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      baseSize: 16, headingSizes: { h1: 40, h2: 32, h3: 24 },
      lineHeight: 1.6, headingWeight: 700, bodyWeight: 400,
    },
    style: {
      borderRadius: '12px', cardStyle: 'elevated', buttonStyle: 'solid',
      imageStyle: 'rounded', mood: 'elegant',
      medianRadius: 12, hasBoxShadow: true, hasBackdropFilter: false, hasTransparentBg: false,
      spacing: { unit: 8, section: 64, element: 16 },
    },
    logo: undefined,
    scrapedAt: new Date().toISOString(),
  };
}

// ─── Main scrape pipeline ────────────────────────────────────────────
async function scrapeBrand(url) {
  console.log(`\nScraping brand: ${url}\n`);

  let html;
  try {
    html = await fetchViaProxy(url);
    console.log(`Fetched ${html.length} chars of HTML`);
  } catch (err) {
    console.log(`Fetch failed (${err.message}). Using fallback.`);
    return buildFallbackProfile(url);
  }

  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  console.log('Collecting CSS...');
  const allCss = await collectAllCss(doc, url);
  console.log(`Collected ${allCss.length} chars of CSS`);

  const colors = extractColors(allCss, doc);
  const typography = extractTypography(allCss, doc);
  const style = extractStyle(allCss);
  const logo = extractLogo(doc, url);

  console.log(`Colors: primary=${colors.primary}, secondary=${colors.secondary}, accent=${colors.accent}`);
  console.log(`Theme: ${colors.isDark ? 'DARK' : 'LIGHT'} (signals: light=${colors._themeSignals.light}, dark=${colors._themeSignals.dark})`);
  console.log(`Fonts: heading="${typography.headingFont}" → ${mapToStitchFont(typography.headingFont)}`);
  console.log(`Fonts: body="${typography.bodyFont}" → ${mapToStitchFont(typography.bodyFont)}`);
  console.log(`Style: ${style.mood}, ${style.cardStyle} cards, ${style.buttonStyle} buttons`);
  if (logo) console.log(`Logo: ${logo.url}`);

  return {
    sourceUrl: url,
    colors,
    typography,
    style,
    logo: logo || undefined,
    scrapedAt: new Date().toISOString(),
  };
}

// ─── CLI entry point ─────────────────────────────────────────────────
const brandUrl = process.argv[2] || fs.readFileSync(path.resolve('brand/url.txt'), 'utf-8').trim();
run(brandUrl);

async function run(url) {
  try {
    const profile = await scrapeBrand(url);

    const outputDir = path.resolve('v5/output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Output 1: Raw brand profile (kept for reference, used by other scripts)
    const profilePath = path.join(outputDir, 'brand-profile.json');
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    console.log(`\nOutput: ${profilePath}`);

    // Output 2: DESIGN.md for Stitch (NEW in V5)
    const designMd = generateDesignMd(profile);
    const designPath = path.join(outputDir, 'brand-design.md');
    fs.writeFileSync(designPath, designMd);
    console.log(`Output: ${designPath}`);

    console.log('\n--- brand-design.md preview ---');
    console.log(designMd.split('\n').slice(0, 20).join('\n'));
    console.log('...\n');

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
