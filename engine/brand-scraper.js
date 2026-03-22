/**
 * Browser-compatible Brand Scraper
 * Fetches a URL via CORS proxy and extracts design tokens (colors, fonts, logo, style).
 * Uses browser DOMParser instead of cheerio.
 */
window.BrandScraper = (function () {
  'use strict';

  async function scrapeBrand(url, corsProxyUrl, log) {
    log('Fetching brand URL: ' + url);
    let html;
    try {
      const proxyUrl = corsProxyUrl + '?url=' + encodeURIComponent(url);
      const resp = await fetch(proxyUrl);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      html = await resp.text();
    } catch (err) {
      log('Fetch failed (' + err.message + '). Using fallback brand profile.');
      return buildFallbackProfile(url);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    log('Extracting CSS from page...');
    const allCss = await collectAllCss(doc, url, corsProxyUrl);
    log('Collected ' + allCss.length + ' chars of CSS');

    const colors = extractColors(allCss, doc);
    const typography = extractTypography(allCss, doc);
    const style = extractStyle(allCss);
    const logo = extractLogo(doc, url);

    log('Colors: primary=' + colors.primary + ', secondary=' + colors.secondary);
    log('Fonts: heading="' + typography.headingFont + '", body="' + typography.bodyFont + '"');
    if (logo) log('Logo: ' + logo.url);

    return { sourceUrl: url, colors, typography, style, logo: logo || undefined };
  }

  // ---- CSS Collection ----

  async function collectAllCss(doc, pageUrl, corsProxyUrl) {
    const parts = [];

    // Inline <style> tags
    doc.querySelectorAll('style').forEach(el => {
      if (el.textContent) parts.push(el.textContent);
    });

    // External stylesheets
    const linkPromises = [];
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => {
      const href = el.getAttribute('href');
      if (href) {
        const cssUrl = resolveUrl(href, pageUrl);
        linkPromises.push(
          fetch(corsProxyUrl + '?url=' + encodeURIComponent(cssUrl))
            .then(r => r.ok ? r.text() : '')
            .catch(() => '')
        );
      }
    });
    const externalCss = await Promise.all(linkPromises);
    parts.push(...externalCss.filter(Boolean));

    // Inline style attributes
    doc.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      if (style) parts.push('._inline { ' + style + ' }');
    });

    return parts.join('\n');
  }

  function resolveUrl(href, base) {
    try { return new URL(href, base).href; }
    catch { return href; }
  }

  // ---- Color Extraction ----

  function extractColors(css, doc) {
    const colorMap = new Map();

    // Hex colors
    for (const match of css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
      recordColor(colorMap, match[0], getPropertyContext(css, match.index || 0));
    }

    // RGB/RGBA colors
    for (const match of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/g)) {
      const hex = rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
      recordColor(colorMap, hex, getPropertyContext(css, match.index || 0));
    }

    // CSS variables with "color" in the name
    for (const match of css.matchAll(/--[\w-]*color[\w-]*\s*:\s*([^;]+)/gi)) {
      const val = match[1].trim();
      if (val.startsWith('#') || val.startsWith('rgb')) {
        recordColor(colorMap, normalizeColor(val), 'variable');
      }
    }

    // Meta theme-color
    const themeColor = doc.querySelector('meta[name="theme-color"]');
    if (themeColor) recordColor(colorMap, normalizeColor(themeColor.getAttribute('content') || ''), 'theme-color');

    return assignColorRoles(colorMap);
  }

  function recordColor(map, color, context) {
    const norm = normalizeColor(color);
    if (isNearBlackOrWhite(norm)) return;
    const existing = map.get(norm);
    if (existing) {
      existing.count++;
      if (!existing.contexts.includes(context)) existing.contexts.push(context);
    } else {
      map.set(norm, { color, normalized: norm, count: 1, contexts: [context] });
    }
  }

  function getPropertyContext(css, index) {
    const before = css.substring(Math.max(0, index - 100), index);
    const propMatch = before.match(/([\w-]+)\s*:\s*[^;]*$/);
    return propMatch?.[1] || 'unknown';
  }

  function normalizeColor(color) {
    color = (color || '').trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    const rgbMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) return rgbToHex(parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]));
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

  function assignColorRoles(map) {
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

    const bgCandidate = entries.find(e => getColorLuminance(e.normalized) > 200 && e.contexts.some(c => c.includes('background')));
    const background = bgCandidate?.normalized || '#ffffff';
    const surface = entries.find(e => getColorLuminance(e.normalized) > 230 && e.normalized !== background)?.normalized || '#f8f9fa';
    const textColor = entries.find(e => getColorLuminance(e.normalized) < 60 && e.contexts.some(c => c.includes('color')))?.normalized || '#1a1a2e';

    return {
      primary, secondary, accent, background, surface,
      text: textColor, textMuted: lighten(textColor, 40),
      success: '#10b981', error: '#ef4444', warning: '#f59e0b',
      gradient: entries.length >= 2 ? 'linear-gradient(135deg, ' + primary + ', ' + secondary + ')' : undefined,
    };
  }

  // ---- Typography Extraction ----

  function extractTypography(css, doc) {
    const fontFamilies = [];
    for (const match of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
      const font = cleanFontName(match[1]);
      if (font && !isSystemFont(font)) {
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

    if (!fontImportUrl && !isSystemFont(headingFont)) {
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

  function cleanFontName(raw) { return raw.split(',')[0].trim().replace(/["']/g, '').trim(); }

  function isSystemFont(font) {
    return ['arial', 'helvetica', 'times', 'times new roman', 'courier', 'sans-serif', 'serif',
      'monospace', 'system-ui', '-apple-system', 'blinkmacsystemfont', 'segoe ui',
      'inherit', 'initial', 'unset'].includes(font.toLowerCase());
  }

  // ---- Style Extraction ----

  function extractStyle(css) {
    const radiusValues = [];
    for (const match of css.matchAll(/border-radius\s*:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
      radiusValues.push(parseFloat(match[1]));
    }
    const medianRadius = radiusValues.length > 0
      ? radiusValues.sort((a, b) => a - b)[Math.floor(radiusValues.length / 2)] : 8;

    const hasBoxShadow = /box-shadow\s*:/i.test(css);
    const hasBackdropFilter = /backdrop-filter\s*:/i.test(css);
    const hasBorder = /border\s*:\s*1px/i.test(css);
    const cardStyle = hasBackdropFilter ? 'glass' : hasBoxShadow ? 'elevated' : hasBorder ? 'outlined' : 'flat';

    const hasGradientBtn = /\.btn[^{]*\{[^}]*gradient/i.test(css) || /button[^{]*\{[^}]*gradient/i.test(css);
    const hasOutlineBtn = /\.btn[^{]*outline|\.btn-outline/i.test(css);
    const buttonStyle = hasGradientBtn ? 'gradient' : hasOutlineBtn ? 'outline' : 'solid';

    const imgRadiusMatch = css.match(/img[^{]*\{[^}]*border-radius\s*:\s*(\d+)/i);
    const imgRadius = imgRadiusMatch ? parseInt(imgRadiusMatch[1]) : medianRadius;
    const imageStyle = imgRadius >= 50 ? 'circular' : imgRadius >= 8 ? 'rounded' : 'sharp';

    const mood = cardStyle === 'glass' ? 'creative' : medianRadius >= 20 ? 'friendly' :
      medianRadius <= 4 && /text-transform\s*:\s*uppercase/i.test(css) ? 'corporate' :
      /monospace|code|terminal/i.test(css) ? 'technical' : 'elegant';

    const paddingValues = [];
    for (const match of css.matchAll(/padding\s*:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
      paddingValues.push(parseFloat(match[1]));
    }
    const spacingUnit = paddingValues.length > 0
      ? Math.round(paddingValues.sort((a, b) => a - b)[Math.floor(paddingValues.length / 4)] / 4) * 4 || 8 : 8;

    return {
      borderRadius: medianRadius + 'px', cardStyle, buttonStyle, imageStyle, mood,
      spacing: { unit: spacingUnit, section: spacingUnit * 8, element: spacingUnit * 2 },
    };
  }

  // ---- Logo Extraction ----

  function extractLogo(doc, pageUrl) {
    const selectors = [
      'header .logo img', 'header img[class*="logo"]', '.logo img',
      'a[class*="logo"] img', '[class*="logo"] img', 'header a:first-child img',
      '.navbar-brand img', 'header img:first-of-type',
    ];
    for (const sel of selectors) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      const src = el.getAttribute('src');
      if (src) {
        return {
          url: resolveUrl(src, pageUrl),
          width: parseInt(el.getAttribute('width') || '0') || 200,
          height: parseInt(el.getAttribute('height') || '0') || 60,
          alt: el.getAttribute('alt') || 'Logo',
        };
      }
    }
    const ogImage = doc.querySelector('meta[property="og:image"]');
    if (ogImage) {
      return {
        url: resolveUrl(ogImage.getAttribute('content') || '', pageUrl),
        width: 200, height: 60,
        alt: (doc.querySelector('meta[property="og:title"]')?.getAttribute('content')) || 'Logo',
      };
    }
    return null;
  }

  // ---- Fallback ----

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
        imageStyle: 'rounded', mood: 'elegant',
        spacing: { unit: 8, section: 64, element: 16 },
      },
      logo: undefined,
    };
  }

  return { scrapeBrand };
})();
