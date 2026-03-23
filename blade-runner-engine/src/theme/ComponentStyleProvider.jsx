/**
 * ComponentStyleProvider — Bridge between Stitch design DNA and React components
 *
 * Reads window.designDNA.componentStyles (per-component-type patterns extracted
 * from Stitch's HTML) and window.designDNA.designRules (typography, surface,
 * border rules from Stitch's designMd) and provides them to components via
 * React context.
 *
 * Each component calls useComponentStyle('accordion') and gets back the style
 * config that Stitch designed for that component type in this specific course.
 * If no DNA is present (e.g. running without Stitch), components get null
 * and use their own built-in defaults.
 *
 * This is the key bridge: Stitch decides the visual treatment per component,
 * our components apply those decisions while handling all interactivity.
 */
import { createContext, useContext, useMemo } from 'react';

const ComponentStyleContext = createContext(null);

/**
 * Provider — wraps the app, reads DNA from window.designDNA
 *
 * The DNA includes:
 * - componentStyles: per-type structural patterns (icons, backgrounds, badges, layouts)
 * - designRules: global rules (typography, surface hierarchy, border style)
 * - surfaceHierarchy: resolved hex values for each surface level
 * - colors: full color system
 */
export function ComponentStyleProvider({ designDNA, children }) {
  const value = useMemo(() => {
    if (!designDNA) return null;

    const styles = designDNA.componentStyles || {};
    const rules = designDNA.designRules || {};
    const surfaces = designDNA.surfaceHierarchy || {};
    const colors = designDNA.colors || {};

    return {
      // Per-component-type style configs from Stitch HTML parsing
      componentStyles: styles,

      // Global design rules from Stitch designMd
      designRules: rules,

      // Resolved surface hierarchy (hex values)
      surfaces,

      // Full color system
      colors,

      // ─── Helper: resolve a surface token to a hex value ─────────
      // e.g. resolveSurface('surface-container-low') → '#131313'
      resolveSurface(token) {
        if (!token) return null;
        return surfaces[token] || null;
      },

      // ─── Helper: get the color cycle array as resolved hex values ──
      // Returns [primaryHex, secondaryHex, tertiaryHex, errorHex]
      getColorCycle() {
        const cycle = rules.colorCycle || ['primary', 'secondary', 'tertiary', 'error'];
        return cycle.map(name => colors[name] || null).filter(Boolean);
      },

      // ─── Helper: get a color from the cycle by index ────────────
      // Wraps around if index exceeds cycle length
      getCycleColor(index) {
        const cycle = this.getColorCycle();
        if (cycle.length === 0) return null;
        return cycle[index % cycle.length];
      },

      // ─── Helper: get typography rules ───────────────────────────
      getTypography() {
        return rules.typography || null;
      },

      // ─── Helper: get border style rules ─────────────────────────
      getBorderStyle() {
        return rules.borderStyle || null;
      },
    };
  }, [designDNA]);

  return (
    <ComponentStyleContext.Provider value={value}>
      {children}
    </ComponentStyleContext.Provider>
  );
}

/**
 * useComponentStyle(type) — Hook for components to get their Stitch-designed style
 *
 * Returns an object with:
 * - style: the per-component style config (icons, backgrounds, badges, layout, etc.)
 *   or null if no DNA / no config for this type
 * - rules: global design rules (typography, surfaces, borders)
 * - resolveSurface(token): resolve a surface token to hex
 * - getCycleColor(index): get a cycling color by index
 * - hasDNA: boolean — whether design DNA is available at all
 *
 * Components should check hasDNA and fall back to their built-in defaults when false.
 */
export function useComponentStyle(componentType) {
  const ctx = useContext(ComponentStyleContext);

  if (!ctx) {
    return {
      style: null,
      rules: null,
      resolveSurface: () => null,
      getCycleColor: () => null,
      getColorCycle: () => [],
      hasDNA: false,
    };
  }

  return {
    style: ctx.componentStyles[componentType] || null,
    rules: ctx.designRules,
    resolveSurface: ctx.resolveSurface.bind(ctx),
    getCycleColor: ctx.getCycleColor.bind(ctx),
    getColorCycle: ctx.getColorCycle.bind(ctx),
    hasDNA: true,
  };
}

/**
 * useDesignRules() — Hook for accessing global design rules
 *
 * Useful for components that need typography, border, or surface rules
 * without needing a specific component type's style config.
 */
export function useDesignRules() {
  const ctx = useContext(ComponentStyleContext);
  if (!ctx) {
    return {
      typography: null,
      borderStyle: null,
      surfaceRules: null,
      hasDNA: false,
    };
  }
  return {
    typography: ctx.designRules?.typography || null,
    borderStyle: ctx.designRules?.borderStyle || null,
    surfaceRules: ctx.designRules?.surfaceRules || null,
    hasDNA: true,
  };
}
