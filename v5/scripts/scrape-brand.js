#!/usr/bin/env node
/**
 * V5 Brand Scraper — Playwright Edition
 *
 * Uses Playwright to visit the brand URL, take a screenshot, and extract
 * computed styles from visible elements. This is far more reliable than
 * parsing raw CSS text, which picks up platform defaults and unused styles.
 *
 * Outputs:
 *   1. brand-profile.json — extracted design data
 *   2. brand-design.md — DESIGN.md format brief for Stitch
 *   3. brand-screenshot.png — landing page screenshot (for future vision API / IMAGE_TO_UI)
 *
 * Usage: node v5/scripts/scrape-brand.js [brand-url]
 *   If no URL argument, reads from brand/url.txt
 */

const fs = require('fs');
const path = require('path');

// ─── Stitch's 28 Supported Fonts ────────────────────────────────────
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

const FONT_ALIASES = {
  'poppins': 'PLUS_JAKARTA_SANS', 'lato': 'WORK_SANS', 'roboto': 'SOURCE_SANS_THREE',
  'open sans': 'SOURCE_SANS_THREE', 'nunito': 'NUNITO_SANS', 'raleway': 'MANROPE',
  'oswald': 'MONTSERRAT', 'playfair display': 'EB_GARAMOND', 'merriweather': 'LITERATA',
  'lora': 'NOTO_SERIF', 'pt sans': 'SOURCE_SANS_THREE', 'pt serif': 'SOURCE_SERIF_FOUR',
  'ubuntu': 'RUBIK', 'fira sans': 'IBM_PLEX_SANS', 'barlow': 'SPACE_GROTESK',
  'quicksand': 'LEXEND', 'karla': 'INTER', 'mulish': 'INTER', 'dm sans': 'DM_SANS',
  'space grotesk': 'SPACE_GROTESK', 'ibm plex sans': 'IBM_PLEX_SANS',
  'plus jakarta sans': 'PLUS_JAKARTA_SANS', 'be vietnam pro': 'BE_VIETNAM_PRO',
  'hanken grotesk': 'HANKEN_GROTESK', 'source sans pro': 'SOURCE_SANS_THREE',
  'source serif pro': 'SOURCE_SERIF_FOUR', 'noto sans': 'INTER', 'noto serif': 'NOTO_SERIF',
  'libre baskerville': 'LIBRE_CASLON_TEXT', 'cormorant garamond': 'EB_GARAMOND',
  'crimson text': 'NOTO_SERIF', 'spectral': 'LITERATA', 'archivo': 'EPILOGUE',
  'outfit': 'SORA', 'figtree': 'DM_SANS', 'geist': 'GEIST', 'satoshi': 'DM_SANS',
  'general sans': 'HANKEN_GROTESK', 'cabinet grotesk': 'EPILOGUE',
  'clash display': 'MONTSERRAT', 'switzer': 'INTER', 'roboto mono': 'SPACE_GROTESK',
  'inter display': 'INTER',
};

// ─── Color utilities ─────────────────────────────────────────────────
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

function normalizeColor(color) {
  color = (color || '').trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) return rgbToHex(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  return color;
}

function isNearBlackOrWhite(hex) {
  if (!hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (r + g + b) / 3;
  return lum < 20 || lum > 240;
}

function getColorSaturation(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 0;
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
  return rgbToHex(parseInt(hex.slice(1, 3), 16) + amount, parseInt(hex.slice(3, 5), 16) + amount, parseInt(hex.slice(5, 7), 16) + amount);
}

function darken(hex, amount) {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  return rgbToHex(parseInt(hex.slice(1, 3), 16) - amount, parseInt(hex.slice(3, 5), 16) - amount, parseInt(hex.slice(5, 7), 16) - amount);
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

// ─── Font Mapping to Stitch ─────────────────────────────────────────
function mapToStitchFont(fontName) {
  if (!fontName) return 'INTER';
  const lower = fontName.toLowerCase().trim();
  if (FONT_ALIASES[lower]) return FONT_ALIASES[lower];
  const exact = STITCH_FONTS.find(f => f.family.toLowerCase() === lower);
  if (exact) return exact.stitch;
  const partial = STITCH_FONTS.find(f => lower.includes(f.family.toLowerCase()) || f.family.toLowerCase().includes(lower));
  if (partial) return partial.stitch;
  if (/serif|garamond|caslon|baskerville|times|georgia|playfair|merriweather|lora|crimson/i.test(fontName)) return 'NOTO_SERIF';
  return 'INTER';
}

/** Extract first non-system font from computed fontFamily string */
function extractFontName(fontFamily) {
  const SYSTEM_FONTS = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'helvetica', 'arial', 'helvetica neue', 'ui-sans-serif', 'ui-serif']);
  const fonts = fontFamily.split(',').map(f => f.trim().replace(/["']/g, ''));
  for (const f of fonts) {
    if (!SYSTEM_FONTS.has(f.toLowerCase())) return f;
  }
  return fonts[0] || 'Inter';
}

// ─── Stitch Vocabulary Mapping ───────────────────────────────────────
function mapToStitchVocabulary(colors, style) {
  const colorMode = colors.isDark ? 'DARK' : 'LIGHT';
  const radius = style.medianRadius || 8;
  let roundness;
  if (radius <= 4) roundness = 'ROUND_FOUR';
  else if (radius <= 8) roundness = 'ROUND_EIGHT';
  else if (radius <= 16) roundness = 'ROUND_TWELVE';
  else roundness = 'ROUND_FULL';

  let spacingScale = 2;
  if (style.spacing?.section >= 80) spacingScale = 3;
  else if (style.spacing?.section <= 40) spacingScale = 1;

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
  if (colors.isDark) adjectives.push('Sophisticated', 'Moody');
  else adjectives.push('Airy', 'Open');
  if (style.cardStyle === 'glass') adjectives.push('Glass-forward', 'Ethereal');
  else if (style.cardStyle === 'elevated') adjectives.push('Layered', 'Dimensional');
  else if (style.cardStyle === 'outlined') adjectives.push('Clean-lined', 'Structured');
  if (stitchVocab.roundness === 'ROUND_FULL') adjectives.push('Friendly', 'Approachable');
  else if (stitchVocab.roundness === 'ROUND_FOUR') adjectives.push('Precise', 'Technical');
  if (stitchVocab.colorVariant === 'VIBRANT') adjectives.push('Bold', 'Dynamic');
  else if (stitchVocab.colorVariant === 'MONOCHROME') adjectives.push('Minimal', 'Restrained');
  else if (stitchVocab.colorVariant === 'TONAL_SPOT') adjectives.push('Harmonious', 'Focused');
  if (style.mood === 'corporate') adjectives.push('Professional', 'Authoritative');
  else if (style.mood === 'creative') adjectives.push('Creative', 'Expressive');
  else if (style.mood === 'technical') adjectives.push('Technical', 'Engineered');
  return adjectives.slice(0, 5).join(', ');
}

// ─── DESIGN.md Generation ───────────────────────────────────────────
function generateDesignMd(profile) {
  const { colors, typography, style, logo } = profile;
  const headingStitch = mapToStitchFont(typography.headingFont);
  const bodyStitch = mapToStitchFont(typography.bodyFont);
  const headingFamily = STITCH_FONTS.find(f => f.stitch === headingStitch)?.family || 'Inter';
  const bodyFamily = STITCH_FONTS.find(f => f.stitch === bodyStitch)?.family || 'Inter';
  const stitchVocab = mapToStitchVocabulary(colors, style);
  const atmosphere = generateAtmosphere(colors, style, stitchVocab);
  const primaryName = getSemanticColorName(colors.primary);
  const secondaryName = getSemanticColorName(colors.secondary);
  const accentName = getSemanticColorName(colors.accent);

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

  return `# DESIGN.md — Brand Design Brief for Stitch

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
${logo ? `\n## Brand Logo\nLogo URL: ${logo.url}\n` : ''}`.trim();
}

// ─── Fallback profile ────────────────────────────────────────────────
function buildFallbackProfile(url) {
  return {
    sourceUrl: url,
    colors: {
      primary: '#3C087E', secondary: '#030014', accent: '#6b21a8',
      background: '#ffffff', surface: '#f8f9fa', text: '#030014', textMuted: '#6b7280',
      success: '#10b981', error: '#ef4444', warning: '#f59e0b',
      gradient: 'linear-gradient(135deg, #3C087E, #030014)', isDark: false,
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
    logo: undefined, scrapedAt: new Date().toISOString(),
  };
}

// ═════════════════════════════════════════════════════════════════════
// PLAYWRIGHT-BASED EXTRACTION
// Visit the landing page, extract computed styles from visible elements
// ═════════════════════════════════════════════════════════════════════

async function extractWithPlaywright(url) {
  const { chromium } = require('playwright');

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // Extra wait for animations and lazy-loaded content
  await page.waitForTimeout(2000);

  // Take screenshot for future vision API / IMAGE_TO_UI use
  const screenshotPath = path.resolve('v5/output/brand-screenshot.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`Screenshot saved: brand-screenshot.png`);

  // Extract all design data from the rendered page
  console.log('Extracting computed styles from visible elements...');
  const extracted = await page.evaluate(() => {
    function isVisible(el) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0';
    }

    function rgbToHex(str) {
      const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
      if (!m) return null;
      const [, r, g, b] = m;
      // Filter out very transparent colours
      const alphaMatch = str.match(/,\s*([\d.]+)\s*\)/);
      if (alphaMatch && parseFloat(alphaMatch[1]) < 0.3) return null;
      return '#' + [r, g, b].map(c => (+c).toString(16).padStart(2, '0')).join('');
    }

    function isNeutral(hex) {
      if (!hex) return true;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const lum = (r + g + b) / 3;
      return sat < 0.15 || lum < 15 || lum > 245;
    }

    const result = {
      background: null,
      buttonColors: [],
      headingFont: null,
      bodyFont: null,
      headingWeight: null,
      textColor: null,
      textMuted: null,
      allBrandColors: [],
      borderRadii: [],
      hasBoxShadow: false,
      hasBackdropFilter: false,
      hasTransparentBg: false,
      logoUrl: null,
    };

    // 1. Page background — most reliable theme signal
    const bodyBg = rgbToHex(getComputedStyle(document.body).backgroundColor);
    const htmlBg = rgbToHex(getComputedStyle(document.documentElement).backgroundColor);
    result.background = bodyBg || htmlBg;

    // 2. Button/CTA colours — strongest brand signal
    const buttons = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
    buttons.forEach(el => {
      if (!isVisible(el)) return;
      const style = getComputedStyle(el);
      const bg = rgbToHex(style.backgroundColor);
      if (bg && !isNeutral(bg)) {
        result.buttonColors.push(bg);
        const radius = parseFloat(style.borderRadius);
        if (!isNaN(radius)) result.borderRadii.push(radius);
      }
    });

    // 3. Heading typography — from first visible h1, h2, h3
    for (const tag of ['h1', 'h2', 'h3']) {
      const el = document.querySelector(tag);
      if (el && isVisible(el)) {
        const style = getComputedStyle(el);
        if (!result.headingFont) result.headingFont = style.fontFamily;
        if (!result.headingWeight) result.headingWeight = parseInt(style.fontWeight) || 700;
        break;
      }
    }

    // 4. Body typography — from first visible paragraph
    const paragraphs = document.querySelectorAll('p');
    for (const p of paragraphs) {
      if (isVisible(p) && p.textContent.trim().length > 20) {
        const style = getComputedStyle(p);
        result.bodyFont = style.fontFamily;
        result.textColor = rgbToHex(style.color);
        break;
      }
    }

    // 5. Muted text — look for smaller/lighter text
    const smallTexts = document.querySelectorAll('p, span, div');
    for (const el of smallTexts) {
      if (!isVisible(el)) continue;
      const style = getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize);
      if (fontSize > 0 && fontSize <= 14 && el.textContent.trim().length > 5) {
        result.textMuted = rgbToHex(style.color);
        break;
      }
    }

    // 6. All saturated colours from visible elements (backgrounds, borders)
    const allEls = document.querySelectorAll('*');
    const seenColors = new Set();
    for (const el of allEls) {
      if (!isVisible(el)) continue;
      const style = getComputedStyle(el);
      const bg = rgbToHex(style.backgroundColor);
      if (bg && !isNeutral(bg) && !seenColors.has(bg)) {
        seenColors.add(bg);
        result.allBrandColors.push(bg);
      }
      const borderColor = rgbToHex(style.borderColor);
      if (borderColor && !isNeutral(borderColor) && !seenColors.has(borderColor)) {
        seenColors.add(borderColor);
        result.allBrandColors.push(borderColor);
      }
      // Detect card styles
      if (style.backdropFilter && style.backdropFilter !== 'none') result.hasBackdropFilter = true;
      if (style.boxShadow && style.boxShadow !== 'none') result.hasBoxShadow = true;
      const bgAlpha = style.backgroundColor.match(/,\s*([\d.]+)\s*\)/);
      if (bgAlpha && parseFloat(bgAlpha[1]) > 0 && parseFloat(bgAlpha[1]) < 0.8) result.hasTransparentBg = true;
      // Collect border-radius
      const radius = parseFloat(style.borderRadius);
      if (!isNaN(radius) && radius > 0) result.borderRadii.push(radius);
    }

    // 7. Logo — find first visible logo image
    const logoSelectors = [
      'header .logo img', 'header img[class*="logo"]', '.logo img',
      'a[class*="logo"] img', '[class*="logo"] img', 'header a:first-child img',
      '.navbar-brand img', 'nav img:first-of-type', 'header img:first-of-type',
    ];
    for (const sel of logoSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && el.src) {
          result.logoUrl = el.src;
          break;
        }
      } catch {}
    }

    return result;
  });

  await browser.close();
  return extracted;
}

// ─── Process extracted data into profile ──────────────────────────────
function buildProfile(url, extracted) {
  // Browser/platform default colours to filter out
  const PLATFORM_DEFAULTS = new Set([
    '#0000ee', '#551a8b', '#0000ff', // Browser default link colours
    '#0099ff', '#0066cc',            // Framer defaults
    '#007bff', '#6c757d', '#28a745', '#dc3545', // Bootstrap
    '#1a73e8', '#4285f4',            // Google
  ]);

  const filterDefaults = (colors) => colors.filter(c => !PLATFORM_DEFAULTS.has(c));

  // Colours: prioritise button colours, then all brand colours
  const buttonFreq = {};
  filterDefaults(extracted.buttonColors).forEach(c => { buttonFreq[c] = (buttonFreq[c] || 0) + 1; });
  const sortedButtons = Object.entries(buttonFreq).sort((a, b) => b[1] - a[1]).map(e => e[0]);

  const allFreq = {};
  filterDefaults(extracted.allBrandColors).forEach(c => { allFreq[c] = (allFreq[c] || 0) + 1; });
  const sortedAll = Object.entries(allFreq).sort((a, b) => b[1] - a[1]).map(e => e[0]);

  // Primary: most common button colour, or most common visible saturated colour
  const primary = sortedButtons[0] || sortedAll[0] || '#2563eb';

  // Secondary: next distinct colour
  const secondary = [...sortedButtons, ...sortedAll].find(c =>
    c !== primary && colorDistance(c, primary) > 50 && getColorSaturation(c) > 0.1
  ) || darken(primary, 20);

  // Accent: highest saturation colour that's different from both
  const accent = sortedAll.find(c =>
    c !== primary && c !== secondary && getColorSaturation(c) > 0.2
  ) || lighten(primary, 20);

  // Background
  const background = extracted.background || '#ffffff';
  const isDark = perceivedLuminance(background) < 0.45;

  // Surface — slightly lighter/darker than background
  const surface = isDark ? lighten(background, 10) : darken(background, 5);

  // Text colours
  const text = extracted.textColor || (isDark ? '#f0f0f0' : '#1a1a1a');
  const textMuted = extracted.textMuted || (isDark ? '#c8c8c8' : '#6b7280');

  // Typography
  const headingFont = extractFontName(extracted.headingFont || 'Inter');
  const bodyFont = extractFontName(extracted.bodyFont || extracted.headingFont || 'Inter');

  // Style
  const radii = extracted.borderRadii.filter(r => r > 0);
  radii.sort((a, b) => a - b);
  const medianRadius = radii.length > 0 ? radii[Math.floor(radii.length / 2)] : 8;

  const cardStyle = extracted.hasBackdropFilter ? 'glass' :
    extracted.hasBoxShadow ? 'elevated' :
    extracted.hasTransparentBg ? 'glass' : 'flat';

  const hasPillRadius = radii.some(r => r >= 999 || r >= 50);
  let buttonStyle = 'solid';
  if (hasPillRadius) buttonStyle = 'pill';
  else if (medianRadius > 12) buttonStyle = 'rounded';

  const mood = cardStyle === 'glass' ? 'creative' :
    medianRadius >= 20 ? 'friendly' :
    medianRadius <= 4 ? 'corporate' : 'elegant';

  return {
    sourceUrl: url,
    colors: {
      primary, secondary, accent, background, surface, text, textMuted,
      success: '#10b981', error: '#ef4444', warning: '#f59e0b',
      gradient: `linear-gradient(135deg, ${primary}, ${secondary})`,
      isDark, _themeSignals: { light: isDark ? 0 : 1, dark: isDark ? 1 : 0 },
    },
    typography: {
      headingFont, bodyFont,
      fontImportUrl: `https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont)}:wght@400;500;600;700${bodyFont !== headingFont ? `&family=${encodeURIComponent(bodyFont)}:wght@400;500;600;700` : ''}&display=swap`,
      baseSize: 16, headingSizes: { h1: 40, h2: 32, h3: 24 },
      lineHeight: 1.6, headingWeight: extracted.headingWeight || 700, bodyWeight: 400,
    },
    style: {
      borderRadius: medianRadius + 'px', cardStyle, buttonStyle,
      imageStyle: medianRadius >= 8 ? 'rounded' : 'sharp', mood,
      medianRadius, hasBoxShadow: extracted.hasBoxShadow, hasBackdropFilter: extracted.hasBackdropFilter, hasTransparentBg: extracted.hasTransparentBg,
      spacing: { unit: 8, section: 64, element: 16 },
    },
    logo: extracted.logoUrl ? { url: extracted.logoUrl, width: 200, height: 60, alt: 'Logo' } : undefined,
    scrapedAt: new Date().toISOString(),
  };
}

// ─── Main pipeline ───────────────────────────────────────────────────
async function scrapeBrand(url) {
  console.log(`\nScraping brand: ${url}\n`);

  let extracted;
  try {
    extracted = await extractWithPlaywright(url);
  } catch (err) {
    console.log(`Playwright extraction failed (${err.message}). Using fallback.`);
    return buildFallbackProfile(url);
  }

  const profile = buildProfile(url, extracted);

  console.log(`Colors: primary=${profile.colors.primary}, secondary=${profile.colors.secondary}, accent=${profile.colors.accent}`);
  console.log(`Theme: ${profile.colors.isDark ? 'DARK' : 'LIGHT'}`);
  console.log(`Fonts: heading="${profile.typography.headingFont}" → ${mapToStitchFont(profile.typography.headingFont)}`);
  console.log(`Fonts: body="${profile.typography.bodyFont}" → ${mapToStitchFont(profile.typography.bodyFont)}`);
  console.log(`Style: ${profile.style.mood}, ${profile.style.cardStyle} cards, ${profile.style.buttonStyle} buttons`);
  if (profile.logo) console.log(`Logo: ${profile.logo.url}`);

  return profile;
}

// ─── CLI entry point ─────────────────────────────────────────────────
const brandUrl = process.argv[2] || fs.readFileSync(path.resolve('brand/url.txt'), 'utf-8').trim();
run(brandUrl);

async function run(url) {
  try {
    const profile = await scrapeBrand(url);

    const outputDir = path.resolve('v5/output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const profilePath = path.join(outputDir, 'brand-profile.json');
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
    console.log(`\nOutput: ${profilePath}`);

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
