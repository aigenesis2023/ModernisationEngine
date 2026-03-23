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
  // Enforce minimum heading sizes for visual hierarchy regardless of brand data
  if (t.baseSize) root.style.setProperty('--font-base-size', Math.max(15, t.baseSize) + 'px');
  if (t.headingSizes) {
    if (t.headingSizes.h1) root.style.setProperty('--font-h1', Math.max(40, t.headingSizes.h1) + 'px');
    if (t.headingSizes.h2) root.style.setProperty('--font-h2', Math.max(32, t.headingSizes.h2) + 'px');
    if (t.headingSizes.h3) root.style.setProperty('--font-h3', Math.max(22, t.headingSizes.h3) + 'px');
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

  // Spacing — derived from brand spacing unit (scraped from the brand site)
  // These drive all layout spacing in CourseRenderer so different brand
  // densities (compact corporate vs airy creative) produce different layouts.
  const unit = s.spacing?.unit || 8;
  const sectionSpacing = Math.max(72, s.spacing?.section || unit * 10);
  const elementSpacing = s.spacing?.element || unit * 2;

  root.style.setProperty('--spacing-unit', unit + 'px');
  root.style.setProperty('--spacing-section', sectionSpacing + 'px');
  root.style.setProperty('--spacing-section-heading', Math.round(sectionSpacing * 0.6) + 'px');
  root.style.setProperty('--spacing-block-gap', Math.round(sectionSpacing * 0.5) + 'px');
  root.style.setProperty('--spacing-block-padding', Math.max(28, unit * 4) + 'px');
  root.style.setProperty('--spacing-content-padding', Math.max(32, unit * 4) + 'px');

  // Content max-width adapts to brand mood:
  // corporate/technical = narrower (better for dense text)
  // creative/friendly = wider (more visual breathing room)
  const maxWidth = s.mood === 'corporate' || s.mood === 'technical' ? 960 :
                   s.mood === 'creative' || s.mood === 'friendly' ? 1060 : 1000;
  root.style.setProperty('--content-max-width', maxWidth + 'px');

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
 * Apply Stitch Design DNA — complete design system overlay
 *
 * Applies Stitch's full design system on top of the brand profile.
 * Three layers:
 * 1. Color tokens (50+ colors, 10 surface levels)
 * 2. Visual treatments (glass, shadows, gradients, radii)
 * 3. Structural rules (typography, surface usage, border style, color cycle)
 *
 * Call AFTER applyBrand() so DNA values override the basic brand defaults.
 */
export function applyDesignDNA(dna) {
  if (!dna) return;
  const root = document.documentElement;

  // ─── Surface hierarchy (10 tonal levels for layered depth) ─────────
  if (dna.surfaceHierarchy) {
    const sh = dna.surfaceHierarchy;
    for (const [key, value] of Object.entries(sh)) {
      root.style.setProperty(`--${key}`, value);
    }
    if (sh.surface) root.style.setProperty('--brand-surface', sh.surface);
    if (sh.background) root.style.setProperty('--brand-bg', sh.background);
    if (sh['surface-dim']) root.style.setProperty('--brand-bg', sh['surface-dim']);
    if (sh['surface-container-low']) root.style.setProperty('--section-alt-bg', sh['surface-container-low']);
  }

  // ─── Full color system from Stitch ─────────────────────────────────
  if (dna.colors) {
    const dc = dna.colors;
    if (dc.primary) root.style.setProperty('--brand-primary', dc.primary);
    if (dc['primary-container']) root.style.setProperty('--brand-primary-container', dc['primary-container']);
    if (dc.secondary) root.style.setProperty('--brand-secondary', dc.secondary);
    if (dc['secondary-container']) root.style.setProperty('--brand-secondary-container', dc['secondary-container']);
    if (dc.tertiary) root.style.setProperty('--brand-accent', dc.tertiary);
    if (dc['tertiary-container']) root.style.setProperty('--brand-tertiary-container', dc['tertiary-container']);
    if (dc.error) root.style.setProperty('--brand-error', dc.error);
    if (dc.outline) root.style.setProperty('--brand-outline', dc.outline);
    if (dc['outline-variant']) root.style.setProperty('--brand-outline-variant', dc['outline-variant']);
    if (dc['on-surface']) root.style.setProperty('--brand-text', dc['on-surface']);
    if (dc['on-surface-variant']) root.style.setProperty('--brand-text-muted', dc['on-surface-variant']);
    if (dc['on-background']) root.style.setProperty('--brand-heading', dc.primary || dc['on-background']);
    if (dc['surface-tint']) root.style.setProperty('--brand-surface-tint', dc['surface-tint']);
    if (dc['inverse-primary']) root.style.setProperty('--brand-inverse-primary', dc['inverse-primary']);
    for (const [key, value] of Object.entries(dc)) {
      root.style.setProperty(`--stitch-${key}`, value);
    }
  }

  // ─── Glass card (Stitch-designed glass-morphism) ───────────────────
  if (dna.glass?.card) {
    const gc = dna.glass.card;
    if (gc.background) root.style.setProperty('--ui-glass', gc.background);
    if (gc.backdropFilter) root.style.setProperty('--ui-glass-blur', gc.backdropFilter);
  }

  if (dna.glass?.glow) {
    root.style.setProperty('--brand-glow', dna.glass.glow);
    root.style.setProperty('--ui-glass-border', dna.glass.glow.replace(/box-shadow:\s*/, ''));
  }

  if (dna.glass?.shadows?.length) {
    root.style.setProperty('--ui-card-shadow', dna.glass.shadows[0]);
    if (dna.glass.shadows.length > 1) {
      root.style.setProperty('--ui-card-shadow-hover', dna.glass.shadows[1]);
    }
  }

  // ─── Gradients ─────────────────────────────────────────────────────
  if (dna.gradients?.signature) {
    root.style.setProperty('--brand-gradient', dna.gradients.signature);
  }

  // ─── Border radius ─────────────────────────────────────────────────
  if (dna.borderRadius) {
    if (dna.borderRadius.xl) root.style.setProperty('--ui-radius', dna.borderRadius.xl);
    if (dna.borderRadius.lg) root.style.setProperty('--ui-radius-sm', dna.borderRadius.lg);
    if (dna.borderRadius.full) root.style.setProperty('--ui-radius-lg', dna.borderRadius.full);
  }

  // ─── LAYER 3: Structural rules from designMd ──────────────────────
  const rules = dna.designRules;
  if (rules) {
    // Typography rules — components use these for labels, headings, body
    const typo = rules.typography;
    if (typo?.label) {
      root.style.setProperty('--label-transform', typo.label.transform || 'uppercase');
      root.style.setProperty('--label-tracking', typo.label.tracking || '0.1em');
      root.style.setProperty('--label-size', typo.label.size || '0.6875rem');
      root.style.setProperty('--label-weight', typo.label.weight || 700);
    }
    if (typo?.heading) {
      root.style.setProperty('--heading-tracking', typo.heading.tracking || '-0.02em');
      root.style.setProperty('--heading-weight', typo.heading.weight || 700);
    }
    if (typo?.body) {
      root.style.setProperty('--body-line-height', typo.body.lineHeight || 1.6);
    }

    // Surface rules — resolved to hex values for direct use
    const sr = rules.surfaceRules;
    if (sr && dna.surfaceHierarchy) {
      const sh = dna.surfaceHierarchy;
      if (sr.base && sh[sr.base]) root.style.setProperty('--surface-base', sh[sr.base]);
      if (sr.section && sh[sr.section]) root.style.setProperty('--surface-section', sh[sr.section]);
      if (sr.card && sh[sr.card]) root.style.setProperty('--surface-card', sh[sr.card]);
      if (sr.floating && sh[sr.floating]) root.style.setProperty('--surface-floating', sh[sr.floating]);
      if (sr.input && sh[sr.input]) root.style.setProperty('--surface-input', sh[sr.input]);
      if (sr.hover && sh[sr.hover]) root.style.setProperty('--surface-hover', sh[sr.hover]);
    }

    // Border style
    const bs = rules.borderStyle;
    if (bs) {
      root.style.setProperty('--border-style-type', bs.type || 'solid');
      if (bs.type === 'luminous' && dna.colors?.primary) {
        const pRgb = hexToRgb(dna.colors.primary);
        const opacity = bs.glowOpacity || 0.1;
        root.style.setProperty('--border-luminous', `inset 0 1px 0 0 rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, ${opacity})`);
      }
      if (dna.colors?.['outline-variant']) {
        const oRgb = hexToRgb(dna.colors['outline-variant']);
        const opacity = bs.outlineOpacity || 0.15;
        root.style.setProperty('--border-ghost', `rgba(${oRgb.r}, ${oRgb.g}, ${oRgb.b}, ${opacity})`);
      }
    }

    // Color cycle — resolved to hex for components to index into
    const cycle = rules.colorCycle || ['primary', 'secondary', 'tertiary', 'error'];
    cycle.forEach((name, i) => {
      const hex = dna.colors?.[name];
      if (hex) root.style.setProperty(`--color-cycle-${i}`, hex);
    });
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

  // Spacing
  const unit = s.spacing?.unit || 8;
  const sectionSpacing = Math.max(72, s.spacing?.section || unit * 10);
  const elementSpacing = s.spacing?.element || unit * 2;
  css += `  --spacing-unit: ${unit}px;\n`;
  css += `  --spacing-section: ${sectionSpacing}px;\n`;
  css += `  --spacing-section-heading: ${Math.round(sectionSpacing * 0.6)}px;\n`;
  css += `  --spacing-block-gap: ${Math.round(sectionSpacing * 0.5)}px;\n`;
  css += `  --spacing-block-padding: ${Math.max(28, unit * 4)}px;\n`;
  css += `  --spacing-content-padding: ${Math.max(32, unit * 4)}px;\n`;

  const maxWidth = s.mood === 'corporate' || s.mood === 'technical' ? 960 :
                   s.mood === 'creative' || s.mood === 'friendly' ? 1060 : 1000;
  css += `  --content-max-width: ${maxWidth}px;\n`;

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

/**
 * Generate CSS string for Stitch Design DNA tokens
 * (used alongside generateBrandCSS for static HTML export)
 *
 * Mirrors applyDesignDNA() but outputs a CSS string instead of runtime injection.
 * Includes all three layers: tokens, visual treatments, and structural rules.
 */
export function generateDesignDNACSS(dna) {
  if (!dna) return '';

  let css = ':root {\n';

  // Surface hierarchy
  if (dna.surfaceHierarchy) {
    for (const [key, value] of Object.entries(dna.surfaceHierarchy)) {
      css += `  --${key}: ${value};\n`;
    }
    if (dna.surfaceHierarchy.surface) css += `  --brand-surface: ${dna.surfaceHierarchy.surface};\n`;
    if (dna.surfaceHierarchy.background) css += `  --brand-bg: ${dna.surfaceHierarchy.background};\n`;
    if (dna.surfaceHierarchy['surface-dim']) css += `  --brand-bg: ${dna.surfaceHierarchy['surface-dim']};\n`;
    if (dna.surfaceHierarchy['surface-container-low']) css += `  --section-alt-bg: ${dna.surfaceHierarchy['surface-container-low']};\n`;
  }

  // Full color system
  if (dna.colors) {
    const dc = dna.colors;
    if (dc.primary) css += `  --brand-primary: ${dc.primary};\n`;
    if (dc['primary-container']) css += `  --brand-primary-container: ${dc['primary-container']};\n`;
    if (dc.secondary) css += `  --brand-secondary: ${dc.secondary};\n`;
    if (dc['secondary-container']) css += `  --brand-secondary-container: ${dc['secondary-container']};\n`;
    if (dc.tertiary) css += `  --brand-accent: ${dc.tertiary};\n`;
    if (dc['tertiary-container']) css += `  --brand-tertiary-container: ${dc['tertiary-container']};\n`;
    if (dc.error) css += `  --brand-error: ${dc.error};\n`;
    if (dc.outline) css += `  --brand-outline: ${dc.outline};\n`;
    if (dc['outline-variant']) css += `  --brand-outline-variant: ${dc['outline-variant']};\n`;
    if (dc['on-surface']) css += `  --brand-text: ${dc['on-surface']};\n`;
    if (dc['on-surface-variant']) css += `  --brand-text-muted: ${dc['on-surface-variant']};\n`;
    if (dc['on-background']) css += `  --brand-heading: ${dc.primary || dc['on-background']};\n`;
    if (dc['surface-tint']) css += `  --brand-surface-tint: ${dc['surface-tint']};\n`;
    for (const [key, value] of Object.entries(dc)) {
      css += `  --stitch-${key}: ${value};\n`;
    }
  }

  // Glass
  if (dna.glass?.card) {
    if (dna.glass.card.background) css += `  --ui-glass: ${dna.glass.card.background};\n`;
    if (dna.glass.card.backdropFilter) css += `  --ui-glass-blur: ${dna.glass.card.backdropFilter};\n`;
  }
  if (dna.glass?.glow) css += `  --brand-glow: ${dna.glass.glow};\n`;
  if (dna.glass?.shadows?.length) {
    css += `  --ui-card-shadow: ${dna.glass.shadows[0]};\n`;
    if (dna.glass.shadows.length > 1) css += `  --ui-card-shadow-hover: ${dna.glass.shadows[1]};\n`;
  }

  // Gradients
  if (dna.gradients?.signature) css += `  --brand-gradient: ${dna.gradients.signature};\n`;

  // Border radius
  if (dna.borderRadius) {
    if (dna.borderRadius.xl) css += `  --ui-radius: ${dna.borderRadius.xl};\n`;
    if (dna.borderRadius.lg) css += `  --ui-radius-sm: ${dna.borderRadius.lg};\n`;
    if (dna.borderRadius.full) css += `  --ui-radius-lg: ${dna.borderRadius.full};\n`;
  }

  // ─── Structural rules from designMd ──────────────────────────────
  const rules = dna.designRules;
  if (rules) {
    const typo = rules.typography;
    if (typo?.label) {
      css += `  --label-transform: ${typo.label.transform || 'uppercase'};\n`;
      css += `  --label-tracking: ${typo.label.tracking || '0.1em'};\n`;
      css += `  --label-size: ${typo.label.size || '0.6875rem'};\n`;
      css += `  --label-weight: ${typo.label.weight || 700};\n`;
    }
    if (typo?.heading) {
      css += `  --heading-tracking: ${typo.heading.tracking || '-0.02em'};\n`;
      css += `  --heading-weight: ${typo.heading.weight || 700};\n`;
    }
    if (typo?.body) {
      css += `  --body-line-height: ${typo.body.lineHeight || 1.6};\n`;
    }

    // Surface rules resolved to hex
    const sr = rules.surfaceRules;
    if (sr && dna.surfaceHierarchy) {
      const sh = dna.surfaceHierarchy;
      if (sr.base && sh[sr.base]) css += `  --surface-base: ${sh[sr.base]};\n`;
      if (sr.section && sh[sr.section]) css += `  --surface-section: ${sh[sr.section]};\n`;
      if (sr.card && sh[sr.card]) css += `  --surface-card: ${sh[sr.card]};\n`;
      if (sr.floating && sh[sr.floating]) css += `  --surface-floating: ${sh[sr.floating]};\n`;
      if (sr.input && sh[sr.input]) css += `  --surface-input: ${sh[sr.input]};\n`;
      if (sr.hover && sh[sr.hover]) css += `  --surface-hover: ${sh[sr.hover]};\n`;
    }

    // Border luminous glow
    const bs = rules.borderStyle;
    if (bs?.type === 'luminous' && dna.colors?.primary) {
      const pRgb = hexToRgb(dna.colors.primary);
      const opacity = bs.glowOpacity || 0.1;
      css += `  --border-luminous: inset 0 1px 0 0 rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, ${opacity});\n`;
    }
    if (dna.colors?.['outline-variant']) {
      const oRgb = hexToRgb(dna.colors['outline-variant']);
      const opacity = bs?.outlineOpacity || 0.15;
      css += `  --border-ghost: rgba(${oRgb.r}, ${oRgb.g}, ${oRgb.b}, ${opacity});\n`;
    }

    // Color cycle resolved to hex
    const cycle = rules.colorCycle || ['primary', 'secondary', 'tertiary', 'error'];
    cycle.forEach((name, i) => {
      const hex = dna.colors?.[name];
      if (hex) css += `  --color-cycle-${i}: ${hex};\n`;
    });
  }

  css += '}\n';
  return css;
}
