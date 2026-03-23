#!/usr/bin/env node
/**
 * V2 Brand Scraper
 *
 * Fetches a brand URL via CORS proxy and extracts design tokens
 * (colors, fonts, style, logo). Node.js version of engine/brand-scraper.js.
 *
 * Usage: node v2/scripts/scrape-brand.js <brand-url>
 * Output: v2/output/brand-profile.json
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const CORS_PROXY = 'https://cors-proxy.leoduncan-elearning.workers.dev';

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

  return assignColorRoles(colorMap, css);
}

function assignColorRoles(map, cssText) {
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

  // Detect background
  const darkBgCount = entries.filter(e => getColorLuminance(e.normalized) < 80 && e.contexts.some(c => c.includes('background')))
    .reduce((sum, e) => sum + e.count, 0);
  const lightBgCount = entries.filter(e => getColorLuminance(e.normalized) > 200 && e.contexts.some(c => c.includes('background')))
    .reduce((sum, e) => sum + e.count, 0);

  const bgCandidateDark = entries.find(e => getColorLuminance(e.normalized) < 60 && e.contexts.some(c => c.includes('background')));
  const bgCandidateLight = entries.find(e => getColorLuminance(e.normalized) > 200 && e.contexts.some(c => c.includes('background')));
  const isDark = darkBgCount > lightBgCount && bgCandidateDark;

  let background, surface, textColor;
  if (isDark) {
    background = bgCandidateDark.normalized;
    surface = entries.find(e => getColorLuminance(e.normalized) < 80 && e.normalized !== background)?.normalized || lighten(background, 15);
    textColor = entries.find(e => getColorLuminance(e.normalized) > 200 && e.contexts.some(c => c.includes('color')))?.normalized || '#f0f0f0';
  } else {
    background = bgCandidateLight?.normalized || '#ffffff';
    surface = entries.find(e => getColorLuminance(e.normalized) > 230 && e.normalized !== background)?.normalized || '#f8f9fa';
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

  const cardStyle = (hasBackdropFilter && hasTransparentBg) ? 'glass' :
    hasBackdropFilter ? 'glass' :
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

  const bodyBgMatch = css.match(/(?:body|html|:root)\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i);
  let theme = 'light';
  if (bodyBgMatch) {
    const bgHex = normalizeColor(bodyBgMatch[1]);
    if (perceivedLuminance(bgHex) < 0.3) theme = 'dark';
  }

  return {
    borderRadius: medianRadius + 'px', cardStyle, buttonStyle,
    imageStyle: medianRadius >= 8 ? 'rounded' : 'sharp',
    mood, theme,
    spacing: { unit: 8, section: 64, element: 16 },
  };
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

// ─── Fallback profile ────────────────────────────────────────────────
function buildFallbackProfile(url) {
  return {
    sourceUrl: url,
    colors: {
      primary: '#3C087E', secondary: '#030014', accent: '#6b21a8',
      background: '#ffffff', surface: '#f8f9fa', text: '#030014', textMuted: '#6b7280',
      success: '#10b981', error: '#ef4444', warning: '#f59e0b',
      gradient: 'linear-gradient(135deg, #3C087E, #030014)',
    },
    typography: {
      headingFont: 'Inter', bodyFont: 'Inter',
      fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      baseSize: 16, headingSizes: { h1: 40, h2: 32, h3: 24 },
      lineHeight: 1.6, headingWeight: 700, bodyWeight: 400,
    },
    style: {
      borderRadius: '12px', cardStyle: 'elevated', buttonStyle: 'solid',
      imageStyle: 'rounded', mood: 'elegant', theme: 'light',
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
  console.log(`Background: ${colors.background} (${perceivedLuminance(colors.background) < 0.5 ? 'dark' : 'light'})`);
  console.log(`Fonts: heading="${typography.headingFont}", body="${typography.bodyFont}"`);
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
const brandUrl = process.argv[2];
if (!brandUrl) {
  // Try reading from WEBSITE BRANDING REF.rtf
  const refFile = path.resolve('WEBSITE BRANDING REF.rtf');
  if (fs.existsSync(refFile)) {
    const content = fs.readFileSync(refFile, 'utf-8');
    const urlMatch = content.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      console.log(`Found brand URL in ref file: ${urlMatch[0]}`);
      run(urlMatch[0]);
    } else {
      console.error('Usage: node v2/scripts/scrape-brand.js <brand-url>');
      process.exit(1);
    }
  } else {
    console.error('Usage: node v2/scripts/scrape-brand.js <brand-url>');
    process.exit(1);
  }
} else {
  run(brandUrl);
}

async function run(url) {
  try {
    const profile = await scrapeBrand(url);

    const outputDir = path.resolve('v2/output');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, 'brand-profile.json');
    fs.writeFileSync(outputPath, JSON.stringify(profile, null, 2));
    console.log(`\nOutput: ${outputPath}`);
    console.log('Done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}
