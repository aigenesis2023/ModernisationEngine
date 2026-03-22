import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import type { BrandProfile, BrandColors, BrandTypography, BrandStyle, BrandLogo } from '../ir/types';

// ============================================================
// Brand Scraper — Fetches a URL and extracts a complete
// design token set (colors, fonts, logo, style) for use
// in generating brand-aligned course output.
// ============================================================

export async function scrapeBrand(url: string, verbose: boolean): Promise<BrandProfile> {
  if (verbose) console.log(`    Fetching ${url}...`);

  let html: string;
  try {
    html = await fetchPage(url);
  } catch (err: any) {
    if (verbose) console.log(`    ⚠ Direct fetch failed (${err.message}). Trying Tavily...`);
    // Fallback to Tavily Extract API
    const tavilyResult = await fetchViaTavily(url, verbose);
    if (tavilyResult) {
      html = tavilyResult;
    } else {
      console.log(`    ⚠ All fetch methods failed. Using default brand profile.`);
      return buildFallbackProfile(url);
    }
  }
  const $ = cheerio.load(html);

  if (verbose) console.log('    Extracting CSS from page...');
  const allCss = await collectAllCss($, url);

  if (verbose) console.log(`    Collected ${allCss.length} chars of CSS`);

  const colors = extractColors(allCss, $);
  const typography = extractTypography(allCss, $);
  const style = extractStyle(allCss);
  const logo = extractLogo($, url);

  if (verbose) {
    console.log(`    Colors: primary=${colors.primary}, secondary=${colors.secondary}`);
    console.log(`    Fonts: heading="${typography.headingFont}", body="${typography.bodyFont}"`);
    if (logo) console.log(`    Logo: ${logo.url}`);
  }

  return { sourceUrl: url, colors, typography, style, logo: logo || undefined };
}

// ---- Page Fetching ----

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    timeout: 15000,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

// ---- Tavily Fallback ----

async function fetchViaTavily(url: string, verbose: boolean): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    if (verbose) console.log('    TAVILY_API_KEY not set, skipping Tavily fallback.');
    return null;
  }

  try {
    if (verbose) console.log(`    Fetching via Tavily Extract API...`);
    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [url],
        include_images: true,
        format: 'text',
      }),
      timeout: 30000,
    });

    if (!response.ok) {
      if (verbose) console.log(`    Tavily returned ${response.status}`);
      return null;
    }

    const data = await response.json() as any;
    const result = data?.results?.[0];
    if (!result?.raw_content) {
      if (verbose) console.log('    Tavily returned no content.');
      return null;
    }

    if (verbose) console.log(`    Tavily extracted ${result.raw_content.length} chars`);

    // Tavily returns plain text/markdown, not HTML. Wrap the content in
    // minimal HTML so cheerio-based extraction still works. We also
    // embed any inline style hints we can extract from the text content
    // so our color/font parsers have something to work with.
    const html = buildHtmlFromTavilyContent(result.raw_content, result.images, url);
    return html;
  } catch (err: any) {
    if (verbose) console.log(`    Tavily fetch failed: ${err.message}`);
    return null;
  }
}

function buildHtmlFromTavilyContent(
  rawContent: string,
  images: { url: string; alt?: string }[] | undefined,
  sourceUrl: string,
): string {
  // Extract any hex colors, rgb values, font names mentioned in the content
  const hexColors = rawContent.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgbColors = rawContent.match(/rgba?\([^)]+\)/g) || [];

  // Build inline CSS from discovered colors so our extractors can find them
  const cssVars = hexColors.map((c, i) => `--extracted-color-${i}: ${c};`).join('\n  ');
  const rgbVars = rgbColors.map((c, i) => `--extracted-rgb-${i}: ${c};`).join('\n  ');

  // Try to find any og:image or logo references in the content
  const logoImg = images?.find(img =>
    img.url && (img.alt?.toLowerCase().includes('logo') || img.url.toLowerCase().includes('logo'))
  );
  const ogImg = images?.[0];

  const logoHtml = logoImg
    ? `<header><a class="logo"><img src="${logoImg.url}" alt="${logoImg.alt || 'Logo'}"></a></header>`
    : '';
  const ogMeta = ogImg
    ? `<meta property="og:image" content="${ogImg.url}"><meta property="og:title" content="Logo">`
    : '';

  return `<!DOCTYPE html>
<html><head>
${ogMeta}
<style>
:root {
  ${cssVars}
  ${rgbVars}
}
</style>
</head><body>
${logoHtml}
<div>${rawContent}</div>
</body></html>`;
}

// ---- CSS Collection ----

async function collectAllCss($: cheerio.CheerioAPI, pageUrl: string): Promise<string> {
  const parts: string[] = [];

  // 1. Inline styles from <style> tags
  $('style').each((_, el) => {
    const text = $(el).text();
    if (text) parts.push(text);
  });

  // 2. External stylesheets from <link rel="stylesheet">
  const linkPromises: Promise<string>[] = [];
  $('link[rel="stylesheet"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) {
      const cssUrl = resolveUrl(href, pageUrl);
      linkPromises.push(
        fetchCss(cssUrl).catch(() => '')
      );
    }
  });

  const externalCss = await Promise.all(linkPromises);
  parts.push(...externalCss.filter(Boolean));

  // 3. Inline style attributes (sample from key elements)
  $('[style]').each((_, el) => {
    const style = $(el).attr('style');
    if (style) parts.push(`._inline { ${style} }`);
  });

  return parts.join('\n');
}

async function fetchCss(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
    timeout: 10000,
  });
  if (!response.ok) return '';
  return response.text();
}

function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

// ---- Color Extraction ----

interface ColorEntry {
  color: string;
  normalized: string;
  count: number;
  contexts: string[]; // which CSS properties this color appears in
}

function extractColors(css: string, $: cheerio.CheerioAPI): BrandColors {
  const colorMap = new Map<string, ColorEntry>();

  // Match hex colors
  const hexPattern = /#([0-9a-fA-F]{3,8})\b/g;
  for (const match of css.matchAll(hexPattern)) {
    recordColor(colorMap, match[0], getPropertyContext(css, match.index || 0));
  }

  // Match rgb/rgba colors
  const rgbPattern = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/g;
  for (const match of css.matchAll(rgbPattern)) {
    const hex = rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    recordColor(colorMap, hex, getPropertyContext(css, match.index || 0));
  }

  // Match CSS custom properties (variables) that hold colors
  const varPattern = /--[\w-]*color[\w-]*\s*:\s*([^;]+)/gi;
  for (const match of css.matchAll(varPattern)) {
    const val = match[1].trim();
    if (val.startsWith('#') || val.startsWith('rgb')) {
      recordColor(colorMap, normalizeColor(val), 'variable');
    }
  }

  // Also check meta theme-color
  const themeColor = $('meta[name="theme-color"]').attr('content');
  if (themeColor) recordColor(colorMap, normalizeColor(themeColor), 'theme-color');

  return assignColorRoles(colorMap);
}

function recordColor(map: Map<string, ColorEntry>, color: string, context: string): void {
  const norm = normalizeColor(color);
  if (isNearBlackOrWhite(norm)) return; // skip pure black/white for primary detection

  const existing = map.get(norm);
  if (existing) {
    existing.count++;
    if (!existing.contexts.includes(context)) existing.contexts.push(context);
  } else {
    map.set(norm, { color, normalized: norm, count: 1, contexts: [context] });
  }
}

function getPropertyContext(css: string, index: number): string {
  // Look backwards from match to find the CSS property name
  const before = css.substring(Math.max(0, index - 100), index);
  const propMatch = before.match(/([\w-]+)\s*:\s*[^;]*$/);
  return propMatch?.[1] || 'unknown';
}

function normalizeColor(color: string): string {
  color = color.trim().toLowerCase();
  // Expand 3-digit hex
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }
  // Convert rgb to hex
  const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
  }
  return color;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function isNearBlackOrWhite(hex: string): boolean {
  if (!hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (r + g + b) / 3;
  return luminance < 20 || luminance > 240;
}

function getColorLuminance(hex: string): number {
  if (!hex.startsWith('#') || hex.length < 7) return 128;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r + g + b) / 3;
}

function getColorSaturation(hex: string): number {
  if (!hex.startsWith('#') || hex.length < 7) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function assignColorRoles(map: Map<string, ColorEntry>): BrandColors {
  const entries = Array.from(map.values())
    .filter(e => e.normalized.startsWith('#') && e.normalized.length >= 7)
    .sort((a, b) => b.count - a.count);

  // Primary: most frequent saturated color used in backgrounds/buttons/links
  const primaryCandidates = entries.filter(e =>
    getColorSaturation(e.normalized) > 0.2 &&
    (e.contexts.some(c => ['background', 'background-color', 'border-color', 'theme-color', 'variable'].includes(c)) ||
     e.count >= 3)
  );

  const primary = primaryCandidates[0]?.normalized || entries[0]?.normalized || '#2563eb';

  // Secondary: next most frequent distinct color
  const secondary = entries.find(e =>
    e.normalized !== primary &&
    getColorSaturation(e.normalized) > 0.1 &&
    colorDistance(e.normalized, primary) > 50
  )?.normalized || darken(primary, 20);

  // Accent: most saturated color that isn't primary/secondary
  const accentCandidates = entries
    .filter(e => e.normalized !== primary && e.normalized !== secondary)
    .sort((a, b) => getColorSaturation(b.normalized) - getColorSaturation(a.normalized));
  const accent = accentCandidates[0]?.normalized || lighten(primary, 20);

  // Background: lightest color or default white
  const bgCandidate = entries.find(e =>
    getColorLuminance(e.normalized) > 200 &&
    e.contexts.some(c => c.includes('background'))
  );
  const background = bgCandidate?.normalized || '#ffffff';

  // Surface: slightly off-white
  const surface = entries.find(e =>
    getColorLuminance(e.normalized) > 230 &&
    e.normalized !== background
  )?.normalized || '#f8f9fa';

  // Text: darkest color
  const textColor = entries.find(e =>
    getColorLuminance(e.normalized) < 60 &&
    e.contexts.some(c => c.includes('color'))
  )?.normalized || '#1a1a2e';

  // Detect gradient
  const gradientMatch = entries.length >= 2
    ? `linear-gradient(135deg, ${primary}, ${secondary})`
    : undefined;

  return {
    primary,
    secondary,
    accent,
    background,
    surface,
    text: textColor,
    textMuted: lighten(textColor, 40),
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    gradient: gradientMatch,
  };
}

function colorDistance(hex1: string, hex2: string): number {
  const r1 = parseInt(hex1.slice(1, 3), 16), g1 = parseInt(hex1.slice(3, 5), 16), b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16), g2 = parseInt(hex2.slice(3, 5), 16), b2 = parseInt(hex2.slice(5, 7), 16);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function lighten(hex: string, amount: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return rgbToHex(r, g, b);
}

function darken(hex: string, amount: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return rgbToHex(r, g, b);
}

// ---- Typography Extraction ----

function extractTypography(css: string, $: cheerio.CheerioAPI): BrandTypography {
  const fontFamilies: { font: string; count: number; context: string }[] = [];

  // Extract font-family declarations
  const fontPattern = /font-family\s*:\s*([^;}{]+)/gi;
  for (const match of css.matchAll(fontPattern)) {
    const font = cleanFontName(match[1]);
    if (font && !isSystemFont(font)) {
      const existing = fontFamilies.find(f => f.font === font);
      if (existing) existing.count++;
      else fontFamilies.push({ font, count: 1, context: getPropertyContext(css, match.index || 0) });
    }
  }

  // Check Google Fonts link
  let fontImportUrl: string | undefined;
  $('link[href*="fonts.googleapis.com"]').each((_, el) => {
    fontImportUrl = $(el).attr('href') || undefined;
  });

  // Also check @import in CSS
  const importMatch = css.match(/@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com[^'")\s]+)/);
  if (importMatch && !fontImportUrl) fontImportUrl = importMatch[1];

  // Sort by frequency
  fontFamilies.sort((a, b) => b.count - a.count);

  const headingFont = fontFamilies[0]?.font || 'Inter';
  const bodyFont = fontFamilies.length > 1 ? fontFamilies[1].font : fontFamilies[0]?.font || 'Inter';

  // Extract font sizes
  const fontSizes: number[] = [];
  const sizePattern = /font-size\s*:\s*(\d+(?:\.\d+)?)\s*px/gi;
  for (const match of css.matchAll(sizePattern)) {
    fontSizes.push(parseFloat(match[1]));
  }
  fontSizes.sort((a, b) => a - b);

  const baseSize = fontSizes.length > 0
    ? fontSizes[Math.floor(fontSizes.length / 2)] // median
    : 16;

  // Extract font weights
  const weights: number[] = [];
  const weightPattern = /font-weight\s*:\s*(\d+)/gi;
  for (const match of css.matchAll(weightPattern)) {
    weights.push(parseInt(match[1]));
  }

  const headingWeight = weights.filter(w => w >= 600).length > 0
    ? Math.max(...weights.filter(w => w >= 600))
    : 700;
  const bodyWeight = weights.filter(w => w <= 500).length > 0
    ? weights.filter(w => w <= 500).sort((a, b) => b - a)[0]
    : 400;

  // Build Google Fonts URL if we found fonts but no import
  if (!fontImportUrl && !isSystemFont(headingFont)) {
    const fonts = [headingFont];
    if (bodyFont !== headingFont) fonts.push(bodyFont);
    const familyParams = fonts.map(f => `family=${encodeURIComponent(f)}:wght@400;500;600;700`).join('&');
    fontImportUrl = `https://fonts.googleapis.com/css2?${familyParams}&display=swap`;
  }

  return {
    headingFont,
    bodyFont,
    fontImportUrl,
    baseSize,
    headingSizes: {
      h1: Math.round(baseSize * 2.5),
      h2: Math.round(baseSize * 2),
      h3: Math.round(baseSize * 1.5),
    },
    lineHeight: 1.6,
    headingWeight,
    bodyWeight,
  };
}

function cleanFontName(raw: string): string {
  return raw
    .split(',')[0]
    .trim()
    .replace(/["']/g, '')
    .trim();
}

function isSystemFont(font: string): boolean {
  const systemFonts = [
    'arial', 'helvetica', 'times', 'times new roman', 'courier',
    'sans-serif', 'serif', 'monospace', 'system-ui', '-apple-system',
    'blinkmacsystemfont', 'segoe ui', 'inherit', 'initial', 'unset',
  ];
  return systemFonts.includes(font.toLowerCase());
}

// ---- Style Extraction ----

function extractStyle(css: string): BrandStyle {
  // Border radius
  const radiusValues: number[] = [];
  const radiusPattern = /border-radius\s*:\s*(\d+(?:\.\d+)?)\s*px/gi;
  for (const match of css.matchAll(radiusPattern)) {
    radiusValues.push(parseFloat(match[1]));
  }
  const medianRadius = radiusValues.length > 0
    ? radiusValues.sort((a, b) => a - b)[Math.floor(radiusValues.length / 2)]
    : 8;
  const borderRadius = `${medianRadius}px`;

  // Card style detection
  const hasBoxShadow = /box-shadow\s*:/i.test(css);
  const hasBackdropFilter = /backdrop-filter\s*:/i.test(css);
  const hasBorder = /border\s*:\s*1px/i.test(css);
  const cardStyle: BrandStyle['cardStyle'] =
    hasBackdropFilter ? 'glass' :
    hasBoxShadow ? 'elevated' :
    hasBorder ? 'outlined' : 'flat';

  // Button style detection
  const hasGradientBtn = /\.btn[^{]*\{[^}]*(?:gradient|linear-gradient)/i.test(css) ||
    /button[^{]*\{[^}]*gradient/i.test(css);
  const hasOutlineBtn = /\.btn[^{]*outline|\.btn-outline/i.test(css);
  const buttonStyle: BrandStyle['buttonStyle'] =
    hasGradientBtn ? 'gradient' :
    hasOutlineBtn ? 'outline' : 'solid';

  // Image style from border-radius on images
  const imgRadiusMatch = css.match(/img[^{]*\{[^}]*border-radius\s*:\s*(\d+)/i);
  const imgRadius = imgRadiusMatch ? parseInt(imgRadiusMatch[1]) : medianRadius;
  const imageStyle: BrandStyle['imageStyle'] =
    imgRadius >= 50 ? 'circular' :
    imgRadius >= 8 ? 'rounded' : 'sharp';

  // Mood detection
  const mood = detectMood(css, medianRadius, cardStyle);

  // Spacing
  const paddingValues: number[] = [];
  const paddingPattern = /padding\s*:\s*(\d+(?:\.\d+)?)\s*px/gi;
  for (const match of css.matchAll(paddingPattern)) {
    paddingValues.push(parseFloat(match[1]));
  }
  const spacingUnit = paddingValues.length > 0
    ? Math.round(paddingValues.sort((a, b) => a - b)[Math.floor(paddingValues.length / 4)] / 4) * 4 || 8
    : 8;

  return {
    borderRadius,
    cardStyle,
    buttonStyle,
    imageStyle,
    mood,
    spacing: {
      unit: spacingUnit,
      section: spacingUnit * 8,
      element: spacingUnit * 2,
    },
  };
}

function detectMood(css: string, borderRadius: number, cardStyle: BrandStyle['cardStyle']): BrandStyle['mood'] {
  // Heuristic mood detection based on design patterns
  if (cardStyle === 'glass') return 'creative';
  if (borderRadius >= 20) return 'friendly';
  if (borderRadius <= 4 && /text-transform\s*:\s*uppercase/i.test(css)) return 'corporate';
  if (/monospace|code|terminal/i.test(css)) return 'technical';
  return 'elegant';
}

// ---- Logo Extraction ----

function extractLogo($: cheerio.CheerioAPI, pageUrl: string): BrandLogo | null {
  // Try multiple common logo patterns in priority order
  const selectors = [
    'header .logo img',
    'header img[class*="logo"]',
    '.logo img',
    'a[class*="logo"] img',
    '[class*="logo"] img',
    'header a:first-child img',
    '.navbar-brand img',
    'header img:first-of-type',
    // SVG logos
    'header .logo svg',
    '[class*="logo"] svg',
  ];

  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length === 0) continue;

    if (el.is('svg')) {
      // For SVG logos, we can't easily get a URL, but note it exists
      return {
        url: '', // Will be handled by template with inline SVG
        width: parseInt(el.attr('width') || '200'),
        height: parseInt(el.attr('height') || '60'),
        alt: el.attr('aria-label') || 'Logo',
      };
    }

    const src = el.attr('src');
    if (src) {
      return {
        url: resolveUrl(src, pageUrl),
        width: parseInt(el.attr('width') || '0') || 200,
        height: parseInt(el.attr('height') || '0') || 60,
        alt: el.attr('alt') || 'Logo',
      };
    }
  }

  // Fallback: check OG image
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    return {
      url: resolveUrl(ogImage, pageUrl),
      width: 200,
      height: 60,
      alt: $('meta[property="og:title"]').attr('content') || 'Logo',
    };
  }

  return null;
}

// ---- Fallback Brand Profile ----
// When the brand URL cannot be fetched, extract domain name and
// return a sensible default profile so the engine can still run.

function buildFallbackProfile(url: string): BrandProfile {
  let domain = '';
  try { domain = new URL(url).hostname.replace('www.', ''); } catch {}
  const brandName = domain.split('.')[0] || 'brand';

  return {
    sourceUrl: url,
    colors: {
      primary: '#3C087E',
      secondary: '#030014',
      accent: '#6b21a8',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#030014',
      textMuted: '#6b7280',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      gradient: 'linear-gradient(135deg, #3C087E, #030014)',
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      baseSize: 16,
      headingSizes: { h1: 40, h2: 32, h3: 24 },
      lineHeight: 1.6,
      headingWeight: 700,
      bodyWeight: 400,
    },
    style: {
      borderRadius: '12px',
      cardStyle: 'elevated',
      buttonStyle: 'solid',
      imageStyle: 'rounded',
      mood: 'elegant',
      spacing: { unit: 8, section: 64, element: 16 },
    },
    logo: undefined,
  };
}
