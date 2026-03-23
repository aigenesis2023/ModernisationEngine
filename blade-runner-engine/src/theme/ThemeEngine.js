/**
 * ThemeEngine — Injects brand profile into CSS variables
 *
 * Takes the brand profile from the scraper and dynamically
 * updates all CSS custom properties. The entire UI re-skins instantly.
 *
 * Supports both dark and light brand backgrounds. Glass intensity,
 * card shadows, text colors, and section backgrounds all adapt
 * based on actual background luminance — not theme strings.
 */

function hexLuminance(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function hexToRgb(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function computeThemeVars(brand) {
  const c = brand.colors || {};
  const bgColor = c.background || '#0a0a12';
  const bgLum = hexLuminance(bgColor);
  const isLight = bgLum > 0.55;

  const primaryRgb = hexToRgb(c.primary || '#6366f1');

  if (isLight) {
    // ─── LIGHT THEME ──────────────────────────────────────
    // Cards need visible borders and shadows (not just transparency)
    // Surface sections need subtle tinting for alternation
    return {
      '--ui-glass': 'rgba(255, 255, 255, 0.85)',
      '--ui-glass-border': 'rgba(0, 0, 0, 0.12)',
      '--ui-glass-hover': 'rgba(255, 255, 255, 0.95)',
      '--ui-card-shadow': '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
      '--ui-card-shadow-hover': '0 4px 12px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08)',
      '--brand-glow': `0 4px 24px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.12)`,
      '--brand-heading': c.primary || '#1a1a2e',
      '--section-alt-bg': 'rgba(0, 0, 0, 0.03)',
      isLight: true,
    };
  } else {
    // ─── DARK THEME ───────────────────────────────────────
    // Glass overlays with visible white borders and glow
    return {
      '--ui-glass': 'rgba(255, 255, 255, 0.06)',
      '--ui-glass-border': 'rgba(255, 255, 255, 0.12)',
      '--ui-glass-hover': 'rgba(255, 255, 255, 0.10)',
      '--ui-card-shadow': '0 2px 8px rgba(0,0,0,0.3), 0 4px 20px rgba(0,0,0,0.2)',
      '--ui-card-shadow-hover': '0 8px 32px rgba(0,0,0,0.4)',
      '--brand-glow': `0 0 30px rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.15)`,
      '--brand-heading': c.primary || '#ffffff',
      '--section-alt-bg': 'rgba(255, 255, 255, 0.02)',
      isLight: false,
    };
  }
}

export function applyBrand(brand) {
  if (!brand || !brand.colors) return;

  const root = document.documentElement;
  const c = brand.colors;
  const t = brand.typography || {};
  const s = brand.style || {};

  // Colors
  if (c.primary) root.style.setProperty('--brand-primary', c.primary);
  if (c.secondary) root.style.setProperty('--brand-secondary', c.secondary);
  if (c.accent) root.style.setProperty('--brand-accent', c.accent);
  if (c.background) root.style.setProperty('--brand-bg', c.background);
  if (c.surface) root.style.setProperty('--brand-surface', c.surface);
  if (c.text) root.style.setProperty('--brand-text', c.text);
  if (c.textMuted) root.style.setProperty('--brand-text-muted', c.textMuted);
  if (c.success) root.style.setProperty('--brand-success', c.success);
  if (c.error) root.style.setProperty('--brand-error', c.error);

  // Gradient
  if (c.gradient) {
    root.style.setProperty('--brand-gradient', c.gradient);
  } else if (c.primary && c.secondary) {
    root.style.setProperty('--brand-gradient', `linear-gradient(135deg, ${c.primary}, ${c.secondary})`);
  }

  // Typography — fonts
  if (t.headingFont) {
    root.style.setProperty('--font-heading', `'${t.headingFont}', 'Inter', system-ui, sans-serif`);
    if (t.fontImportUrl && !document.querySelector(`link[href*="${t.headingFont}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = t.fontImportUrl;
      document.head.appendChild(link);
    }
  }
  if (t.bodyFont) {
    root.style.setProperty('--font-body', `'${t.bodyFont}', 'Inter', system-ui, sans-serif`);
  }

  // Typography — sizes, weights, line-height
  if (t.baseSize) root.style.setProperty('--font-base-size', t.baseSize + 'px');
  if (t.headingSizes) {
    if (t.headingSizes.h1) root.style.setProperty('--font-h1', t.headingSizes.h1 + 'px');
    if (t.headingSizes.h2) root.style.setProperty('--font-h2', t.headingSizes.h2 + 'px');
    if (t.headingSizes.h3) root.style.setProperty('--font-h3', t.headingSizes.h3 + 'px');
  }
  if (t.headingWeight) root.style.setProperty('--font-heading-weight', t.headingWeight);
  if (t.bodyWeight) root.style.setProperty('--font-body-weight', t.bodyWeight);
  if (t.lineHeight) root.style.setProperty('--font-line-height', t.lineHeight);

  // UI Style
  if (s.borderRadius) {
    const r = parseInt(s.borderRadius);
    root.style.setProperty('--ui-radius', s.borderRadius);
    root.style.setProperty('--ui-radius-sm', Math.max(4, r / 2) + 'px');
    root.style.setProperty('--ui-radius-lg', Math.min(32, r * 1.5) + 'px');
  }

  // Theme-aware glass, shadows, and headings
  const themeVars = computeThemeVars(brand);
  for (const [key, value] of Object.entries(themeVars)) {
    if (key.startsWith('--')) {
      root.style.setProperty(key, value);
    }
  }

  // Add a class for CSS-level theme targeting
  root.classList.toggle('theme-light', themeVars.isLight);
  root.classList.toggle('theme-dark', !themeVars.isLight);

  // Button style
  if (s.buttonStyle === 'pill') {
    root.style.setProperty('--ui-button-radius', '9999px');
  } else if (s.buttonStyle === 'rounded') {
    root.style.setProperty('--ui-button-radius', 'var(--ui-radius, 12px)');
  } else {
    root.style.setProperty('--ui-button-radius', 'var(--ui-radius-sm, 8px)');
  }
}

/**
 * Generate a CSS string with all brand overrides
 * (used for the exported single-file HTML)
 */
export function generateBrandCSS(brand) {
  if (!brand || !brand.colors) return '';

  const c = brand.colors;
  const t = brand.typography || {};
  const s = brand.style || {};

  let css = '';

  // Font import
  if (t.fontImportUrl) {
    css += `@import url("${t.fontImportUrl}");\n`;
  }

  css += ':root {\n';
  if (c.primary) css += `  --brand-primary: ${c.primary};\n`;
  if (c.secondary) css += `  --brand-secondary: ${c.secondary};\n`;
  if (c.accent) css += `  --brand-accent: ${c.accent};\n`;
  if (c.background) css += `  --brand-bg: ${c.background};\n`;
  if (c.surface) css += `  --brand-surface: ${c.surface};\n`;
  if (c.text) css += `  --brand-text: ${c.text};\n`;
  if (c.textMuted) css += `  --brand-text-muted: ${c.textMuted};\n`;
  if (c.success) css += `  --brand-success: ${c.success};\n`;
  if (c.error) css += `  --brand-error: ${c.error};\n`;
  if (c.gradient) css += `  --brand-gradient: ${c.gradient};\n`;

  if (t.headingFont) css += `  --font-heading: '${t.headingFont}', 'Inter', system-ui, sans-serif;\n`;
  if (t.bodyFont) css += `  --font-body: '${t.bodyFont}', 'Inter', system-ui, sans-serif;\n`;

  if (s.borderRadius) {
    const r = parseInt(s.borderRadius);
    css += `  --ui-radius: ${s.borderRadius};\n`;
    css += `  --ui-radius-sm: ${Math.max(4, r / 2)}px;\n`;
    css += `  --ui-radius-lg: ${Math.min(32, r * 1.5)}px;\n`;
  }

  // Theme-aware variables — critical for the static build
  const themeVars = computeThemeVars(brand);
  for (const [key, value] of Object.entries(themeVars)) {
    if (key.startsWith('--')) {
      css += `  ${key}: ${value};\n`;
    }
  }

  css += '}\n';

  // Add theme class to html for CSS selectors
  css += themeVars.isLight ? 'html { color-scheme: light; }\n' : 'html { color-scheme: dark; }\n';

  return css;
}
