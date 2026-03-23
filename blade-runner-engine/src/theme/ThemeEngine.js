/**
 * ThemeEngine — Injects brand profile into CSS variables
 *
 * Takes the brand profile from the scraper and dynamically
 * updates all CSS custom properties. The entire UI re-skins instantly.
 */

export function applyBrand(brand) {
  if (!brand || !brand.colors) return;

  const root = document.documentElement;
  const c = brand.colors;
  const t = brand.typography || {};
  const s = brand.style || {};

  // Colors
  if (c.primary) {
    root.style.setProperty('--brand-primary', c.primary);
    root.style.setProperty('--brand-heading', c.primary);
  }
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

  // Glow
  if (c.primary) {
    const r = parseInt(c.primary.slice(1, 3), 16);
    const g = parseInt(c.primary.slice(3, 5), 16);
    const b = parseInt(c.primary.slice(5, 7), 16);
    root.style.setProperty('--brand-glow', `0 0 30px rgba(${r}, ${g}, ${b}, 0.15)`);
  }

  // Typography
  if (t.headingFont) {
    root.style.setProperty('--font-heading', `'${t.headingFont}', 'Inter', system-ui, sans-serif`);
    // Inject font import if available
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

  // UI Style
  if (s.borderRadius) {
    const r = parseInt(s.borderRadius);
    root.style.setProperty('--ui-radius', s.borderRadius);
    root.style.setProperty('--ui-radius-sm', Math.max(4, r / 2) + 'px');
    root.style.setProperty('--ui-radius-lg', Math.min(32, r * 1.5) + 'px');
  }

  // Glass intensity based on mood
  // Check theme (dark/light) separately from mood (creative/corporate/etc.)
  // The brand scraper detects theme from CSS body background color
  const theme = s.theme || (s.mood === 'dark' ? 'dark' : '');
  const mood = s.mood || 'default';
  if (theme === 'dark' || mood === 'bold') {
    root.style.setProperty('--ui-glass', 'rgba(255, 255, 255, 0.06)');
    root.style.setProperty('--ui-glass-border', 'rgba(255, 255, 255, 0.12)');
    root.style.setProperty('--ui-glass-hover', 'rgba(255, 255, 255, 0.10)');
  } else if (mood === 'minimal' || mood === 'clean') {
    root.style.setProperty('--ui-glass', 'rgba(0, 0, 0, 0.03)');
    root.style.setProperty('--ui-glass-border', 'rgba(0, 0, 0, 0.08)');
    root.style.setProperty('--ui-glass-hover', 'rgba(0, 0, 0, 0.06)');
  } else {
    // Creative/default — slightly more visible glass
    root.style.setProperty('--ui-glass', 'rgba(255, 255, 255, 0.05)');
    root.style.setProperty('--ui-glass-border', 'rgba(255, 255, 255, 0.10)');
    root.style.setProperty('--ui-glass-hover', 'rgba(255, 255, 255, 0.08)');
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

  css += '}\n';
  return css;
}
