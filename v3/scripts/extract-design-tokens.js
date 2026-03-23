/**
 * extract-design-tokens.js — Parses Stitch HTML into a complete design system
 *
 * Reads the raw HTML from Stitch and extracts:
 * - Tailwind config (complete color system, fonts, border-radius)
 * - Custom CSS classes (glass, neon-border, etc.)
 * - Shadow/glow patterns from inline styles
 *
 * This extracts Stitch's FULL design system, not just a few tokens.
 *
 * Input:  v3/output/design-dna-raw.html
 * Output: v3/output/design-dna.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

function extractDesignTokens(html) {
  const tokens = {
    meta: {
      source: 'Google Stitch',
      generatedAt: new Date().toISOString(),
    },
    colors: {},
    surfaceHierarchy: {},
    fixedColors: {},
    glass: {},
    gradients: {},
    borderRadius: {},
    fonts: {},
    customClasses: {},
  };

  // ─── 1. Extract Tailwind config (the core design system) ───────────
  const configMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (configMatch) {
    try {
      // Clean up the JS object to be valid JSON
      let configStr = configMatch[1];
      // Add quotes around unquoted keys
      configStr = configStr.replace(/(\w+)\s*:/g, '"$1":');
      // Fix double-quoted keys that already had quotes
      configStr = configStr.replace(/""/g, '"');
      // Remove trailing commas
      configStr = configStr.replace(/,\s*([}\]])/g, '$1');

      const config = JSON.parse(configStr);
      const extend = config.theme?.extend || {};

      // Extract ALL colors
      if (extend.colors) {
        for (const [key, value] of Object.entries(extend.colors)) {
          // Categorize colors
          if (key.startsWith('surface')) {
            tokens.surfaceHierarchy[key] = value;
          } else if (key.includes('fixed')) {
            tokens.fixedColors[key] = value;
          } else {
            tokens.colors[key] = value;
          }
        }
      }

      // Extract fonts
      if (extend.fontFamily) {
        tokens.fonts = extend.fontFamily;
      }

      // Extract border radius
      if (extend.borderRadius) {
        tokens.borderRadius = extend.borderRadius;
      }
    } catch (e) {
      console.warn('Warning: Could not parse Tailwind config as JSON, trying regex fallback');
      extractColorsViaRegex(html, tokens);
    }
  } else {
    console.warn('Warning: No Tailwind config found, using regex extraction');
    extractColorsViaRegex(html, tokens);
  }

  // ─── 2. Extract custom CSS classes ─────────────────────────────────
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    const css = styleMatch[1];

    // Glass definition
    const glassMatch = css.match(/\.glass\s*\{([^}]+)\}/);
    if (glassMatch) {
      const glassCss = glassMatch[1];
      const bgMatch = glassCss.match(/background:\s*([^;]+)/);
      const blurMatch = glassCss.match(/backdrop-filter:\s*([^;]+)/);
      tokens.glass.card = {
        background: bgMatch ? bgMatch[1].trim() : null,
        backdropFilter: blurMatch ? blurMatch[1].trim() : null,
      };
    }

    // Neon border / glow
    const neonMatch = css.match(/\.neon-border\s*\{([^}]+)\}/);
    if (neonMatch) {
      const shadowMatch = neonMatch[1].match(/box-shadow:\s*([^;]+)/);
      tokens.glass.glow = shadowMatch ? shadowMatch[1].trim() : null;
    }

    // Store raw custom CSS for reference
    tokens.customClasses.raw = css.trim();
  }

  // ─── 3. Extract shadow/glow patterns from HTML ─────────────────────
  const shadowPatterns = new Set();
  const shadowRegex = /shadow-\[([^\]]+)\]/g;
  let match;
  while ((match = shadowRegex.exec(html)) !== null) {
    shadowPatterns.add(match[1].replace(/_/g, ' '));
  }
  if (shadowPatterns.size > 0) {
    tokens.glass.shadows = [...shadowPatterns];
  }

  // ─── 4. Extract gradient patterns ──────────────────────────────────
  const gradientPatterns = new Set();
  const gradientRegex = /bg-gradient-to-[tbrlxy]\s+from-([^\s]+)\s+(?:via-([^\s]+)\s+)?to-([^\s]+)/g;
  while ((match = gradientRegex.exec(html)) !== null) {
    gradientPatterns.add(`from-${match[1]} ${match[2] ? `via-${match[2]} ` : ''}to-${match[3]}`);
  }
  if (gradientPatterns.size > 0) {
    tokens.gradients.patterns = [...gradientPatterns];
  }

  // Build a signature gradient from primary/secondary colors
  if (tokens.colors.primary && tokens.colors.secondary) {
    tokens.gradients.signature = `linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.secondary})`;
  }

  return tokens;
}

function extractColorsViaRegex(html, tokens) {
  // Fallback: extract colors from tailwind config via regex
  const colorRegex = /"([a-z-]+)":\s*"(#[0-9a-fA-F]{6})"/g;
  let match;
  while ((match = colorRegex.exec(html)) !== null) {
    const [, key, value] = match;
    if (key.startsWith('surface')) {
      tokens.surfaceHierarchy[key] = value;
    } else if (key.includes('fixed')) {
      tokens.fixedColors[key] = value;
    } else {
      tokens.colors[key] = value;
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────
const htmlPath = join(ROOT, 'v3/output/design-dna-raw.html');
const outputPath = join(ROOT, 'v3/output/design-dna.json');

const html = readFileSync(htmlPath, 'utf8');
console.log(`Reading: ${htmlPath} (${html.length} chars)\n`);

const tokens = extractDesignTokens(html);

// Summary
console.log('=== EXTRACTED DESIGN TOKENS ===\n');
console.log(`Colors:          ${Object.keys(tokens.colors).length}`);
console.log(`Surface levels:  ${Object.keys(tokens.surfaceHierarchy).length}`);
console.log(`Fixed colors:    ${Object.keys(tokens.fixedColors).length}`);
console.log(`Fonts:           ${Object.keys(tokens.fonts).length}`);
console.log(`Border radius:   ${Object.keys(tokens.borderRadius).length}`);
console.log(`Glass:           ${tokens.glass.card ? 'yes' : 'no'}`);
console.log(`Glow:            ${tokens.glass.glow ? 'yes' : 'no'}`);
console.log(`Shadows:         ${tokens.glass.shadows?.length || 0}`);
console.log(`Gradients:       ${tokens.gradients.patterns?.length || 0}`);
console.log(`Custom CSS:      ${tokens.customClasses.raw ? 'yes' : 'no'}`);

writeFileSync(outputPath, JSON.stringify(tokens, null, 2));
console.log(`\nSaved: ${outputPath}`);
