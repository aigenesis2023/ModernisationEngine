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
      const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
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
          fetch(corsProxyUrl + '?url=' + encodeURIComponent(cssUrl), { signal: AbortSignal.timeout(5000) })
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

  /**
   * Compute perceived luminance using the standard formula.
   * Returns 0-1 range.
   */
  function perceivedLuminance(hex) {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return 0.5;
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

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

    return assignColorRoles(colorMap, css);
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

    // Detect body/root background — look for dark backgrounds too
    var bgCandidateLight = entries.find(function(e) { return getColorLuminance(e.normalized) > 200 && e.contexts.some(function(c) { return c.includes('background'); }); });
    var bgCandidateDark = entries.find(function(e) { return getColorLuminance(e.normalized) < 60 && e.contexts.some(function(c) { return c.includes('background'); }); });

    // Check if the page is predominantly dark-themed:
    // count dark bg occurrences vs light bg occurrences
    var darkBgCount = entries.filter(function(e) { return getColorLuminance(e.normalized) < 80 && e.contexts.some(function(c) { return c.includes('background'); }); })
      .reduce(function(sum, e) { return sum + e.count; }, 0);
    var lightBgCount = entries.filter(function(e) { return getColorLuminance(e.normalized) > 200 && e.contexts.some(function(c) { return c.includes('background'); }); })
      .reduce(function(sum, e) { return sum + e.count; }, 0);

    var isDark = darkBgCount > lightBgCount && bgCandidateDark;

    var background, surface, textColor;
    if (isDark) {
      background = bgCandidateDark.normalized;
      surface = entries.find(function(e) { return getColorLuminance(e.normalized) < 80 && e.normalized !== background; })?.normalized || lighten(background, 15);
      textColor = entries.find(function(e) { return getColorLuminance(e.normalized) > 200 && e.contexts.some(function(c) { return c.includes('color'); }); })?.normalized || '#f0f0f0';
    } else {
      background = bgCandidateLight?.normalized || '#ffffff';
      surface = entries.find(function(e) { return getColorLuminance(e.normalized) > 230 && e.normalized !== background; })?.normalized || '#f8f9fa';
      textColor = entries.find(function(e) { return getColorLuminance(e.normalized) < 60 && e.contexts.some(function(c) { return c.includes('color'); }); })?.normalized || '#1a1a2e';
    }

    // Extract multi-stop gradient from CSS if present
    var gradientMatch = (cssText || '').match(/linear-gradient\([^)]*(?:,\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))){2,}[^)]*\)/);
    var gradient;
    if (gradientMatch) {
      gradient = gradientMatch[0];
    } else if (entries.length >= 2) {
      gradient = 'linear-gradient(135deg, ' + primary + ', ' + secondary + ')';
    }

    return {
      primary: primary, secondary: secondary, accent: accent,
      background: background, surface: surface,
      text: textColor, textMuted: isDark ? darken(textColor, 40) : lighten(textColor, 40),
      success: '#10b981', error: '#ef4444', warning: '#f59e0b',
      gradient: gradient,
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
    var radiusValues = [];
    for (var match of css.matchAll(/border-radius\s*:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
      radiusValues.push(parseFloat(match[1]));
    }
    var medianRadius = radiusValues.length > 0
      ? radiusValues.sort(function(a, b) { return a - b; })[Math.floor(radiusValues.length / 2)] : 8;

    var hasBoxShadow = /box-shadow\s*:/i.test(css);
    var hasBackdropFilter = /backdrop-filter\s*:/i.test(css);
    var hasBorder = /border\s*:\s*1px/i.test(css);

    // Glassmorphism: requires both semi-transparent backgrounds AND backdrop-filter
    var hasTransparentBg = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0?\.[0-4]\d*\s*\)/i.test(css);
    var cardStyle = (hasBackdropFilter && hasTransparentBg) ? 'glass' :
      hasBackdropFilter ? 'glass' :
      hasBoxShadow ? 'elevated' : hasBorder ? 'outlined' : 'flat';

    // Button border-radius detection — look at button/btn/a elements specifically
    var btnRadiusValues = [];
    // Match border-radius in rules that target buttons, links styled as buttons, or .btn classes
    var btnRadiusPatterns = [
      /(?:button|\.btn|a\.btn|\.cta|input\[type=.?submit)[^{]*\{[^}]*border-radius\s*:\s*(\d+(?:\.\d+)?)\s*px/gi,
      /border-radius\s*:\s*(\d+(?:\.\d+)?)\s*px[^}]*(?:cursor\s*:\s*pointer)/gi,
    ];
    for (var p = 0; p < btnRadiusPatterns.length; p++) {
      for (var brm of css.matchAll(btnRadiusPatterns[p])) {
        btnRadiusValues.push(parseFloat(brm[1]));
      }
    }
    // Also check for 50% or 9999px radius patterns (pill)
    var hasPillRadius = /border-radius\s*:\s*(9999|999|200|50%)\s*px?/i.test(css);

    var hasGradientBtn = /\.btn[^{]*\{[^}]*gradient/i.test(css) || /button[^{]*\{[^}]*gradient/i.test(css);
    var hasOutlineBtn = /\.btn[^{]*outline|\.btn-outline/i.test(css);

    // Determine button style: check radius first for pill, then gradient/outline
    var maxBtnRadius = btnRadiusValues.length > 0 ? Math.max.apply(null, btnRadiusValues) : 0;
    var buttonStyle;
    if (hasPillRadius || maxBtnRadius > 50) {
      buttonStyle = 'pill';
    } else if (maxBtnRadius > 8) {
      buttonStyle = 'rounded';
    } else if (hasGradientBtn) {
      buttonStyle = 'gradient';
    } else if (hasOutlineBtn) {
      buttonStyle = 'outline';
    } else {
      buttonStyle = 'solid';
    }

    var imgRadiusMatch = css.match(/img[^{]*\{[^}]*border-radius\s*:\s*(\d+)/i);
    var imgRadius = imgRadiusMatch ? parseInt(imgRadiusMatch[1]) : medianRadius;
    var imageStyle = imgRadius >= 50 ? 'circular' : imgRadius >= 8 ? 'rounded' : 'sharp';

    var mood = cardStyle === 'glass' ? 'creative' : medianRadius >= 20 ? 'friendly' :
      medianRadius <= 4 && /text-transform\s*:\s*uppercase/i.test(css) ? 'corporate' :
      /monospace|code|terminal/i.test(css) ? 'technical' : 'elegant';

    var paddingValues = [];
    for (var pm of css.matchAll(/padding\s*:\s*(\d+(?:\.\d+)?)\s*px/gi)) {
      paddingValues.push(parseFloat(pm[1]));
    }
    var spacingUnit = paddingValues.length > 0
      ? Math.round(paddingValues.sort(function(a, b) { return a - b; })[Math.floor(paddingValues.length / 4)] / 4) * 4 || 8 : 8;

    // Detect dark/light theme from background colors found in CSS
    // We check body, html, :root backgrounds
    var bodyBgMatch = css.match(/(?:body|html|:root)\s*\{[^}]*background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/i);
    var theme = 'light';
    if (bodyBgMatch) {
      var bgHex = normalizeColor(bodyBgMatch[1]);
      if (perceivedLuminance(bgHex) < 0.3) {
        theme = 'dark';
      }
    }

    return {
      borderRadius: medianRadius + 'px', cardStyle: cardStyle, buttonStyle: buttonStyle,
      imageStyle: imageStyle, mood: mood, theme: theme,
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
        imageStyle: 'rounded', mood: 'elegant', theme: 'light',
        spacing: { unit: 8, section: 64, element: 16 },
      },
      logo: undefined,
    };
  }

  return { scrapeBrand };
})();
