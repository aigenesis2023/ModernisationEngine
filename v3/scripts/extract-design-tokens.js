/**
 * extract-design-tokens.js — Parses Stitch output into a complete design system
 *
 * Extracts THREE layers from Stitch:
 * 1. Design tokens (colors, surfaces, glass, gradients, fonts, radii) — from Tailwind config
 * 2. Design rules (typography, surface hierarchy, border style, spacing) — from designMd
 * 3. Component style map (per-component structural patterns) — from HTML sections
 *
 * Input:  v3/output/design-dna-raw.html + v3/output/design-dna-meta.json
 * Output: v3/output/design-dna.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ─── Component type mapping: Stitch section names → our component types ───
const SECTION_TYPE_MAP = {
  'hero': 'hero',
  'hero section': 'hero',
  'text block': 'text',
  'text': 'text',
  'accordion': 'accordion',
  'text input': 'textinput',
  'text input form': 'textinput',
  'graphic + text': 'graphic-text',
  'graphic text': 'graphic-text',
  'checklist': 'checklist',
  'pull quote': 'pullquote',
  'pullquote': 'pullquote',
  'stat callout': 'stat-callout',
  'stat': 'stat-callout',
  'bento grid': 'bento',
  'bento': 'bento',
  'comparison table': 'comparison',
  'comparison': 'comparison',
  'quiz': 'mcq',
  'quiz component': 'mcq',
  'mcq': 'mcq',
  'full-bleed image': 'full-bleed',
  'full-bleed': 'full-bleed',
  'full bleed': 'full-bleed',
  'key terms': 'key-term',
  'key term': 'key-term',
  'glossary': 'key-term',
  'timeline': 'timeline',
  'narrative slider': 'narrative',
  'narrative': 'narrative',
  'process flow': 'process-flow',
  'process': 'process-flow',
  'tab panel': 'tabs',
  'tabs': 'tabs',
  'flashcard': 'flashcard',
  'flashcards': 'flashcard',
};

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 1: Design Tokens (from Tailwind config + CSS)
// ═══════════════════════════════════════════════════════════════════════════

function extractDesignTokens(html) {
  const tokens = {
    colors: {},
    surfaceHierarchy: {},
    fixedColors: {},
    glass: {},
    gradients: {},
    borderRadius: {},
    fonts: {},
  };

  // Extract Tailwind config
  const configMatch = html.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (configMatch) {
    try {
      let configStr = configMatch[1];
      configStr = configStr.replace(/(\w+)\s*:/g, '"$1":');
      configStr = configStr.replace(/""/g, '"');
      configStr = configStr.replace(/,\s*([}\]])/g, '$1');
      const config = JSON.parse(configStr);
      const extend = config.theme?.extend || {};

      if (extend.colors) {
        for (const [key, value] of Object.entries(extend.colors)) {
          if (key.startsWith('surface')) {
            tokens.surfaceHierarchy[key] = value;
          } else if (key.includes('fixed')) {
            tokens.fixedColors[key] = value;
          } else {
            tokens.colors[key] = value;
          }
        }
      }
      if (extend.fontFamily) tokens.fonts = extend.fontFamily;
      if (extend.borderRadius) tokens.borderRadius = extend.borderRadius;
    } catch (e) {
      console.warn('Warning: Could not parse Tailwind config, using regex fallback');
      extractColorsViaRegex(html, tokens);
    }
  } else {
    extractColorsViaRegex(html, tokens);
  }

  // Extract custom CSS classes
  const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
  if (styleMatch) {
    const css = styleMatch[1];
    const glassMatch = css.match(/\.glass\s*\{([^}]+)\}/);
    if (glassMatch) {
      const bgMatch = glassMatch[1].match(/background:\s*([^;]+)/);
      const blurMatch = glassMatch[1].match(/backdrop-filter:\s*([^;]+)/);
      tokens.glass.card = {
        background: bgMatch ? bgMatch[1].trim() : null,
        backdropFilter: blurMatch ? blurMatch[1].trim() : null,
      };
    }
    const neonMatch = css.match(/\.neon-border\s*\{([^}]+)\}/);
    if (neonMatch) {
      const shadowMatch = neonMatch[1].match(/box-shadow:\s*([^;]+)/);
      tokens.glass.glow = shadowMatch ? shadowMatch[1].trim() : null;
    }
  }

  // Extract shadow patterns
  const shadowPatterns = new Set();
  const shadowRegex = /shadow-\[([^\]]+)\]/g;
  let match;
  while ((match = shadowRegex.exec(html)) !== null) {
    shadowPatterns.add(match[1].replace(/_/g, ' '));
  }
  if (shadowPatterns.size > 0) tokens.glass.shadows = [...shadowPatterns];

  // Extract gradient patterns
  const gradientPatterns = new Set();
  const gradientRegex = /bg-gradient-to-[tbrlxy]\s+from-([^\s"]+)\s+(?:via-([^\s"]+)\s+)?to-([^\s"]+)/g;
  while ((match = gradientRegex.exec(html)) !== null) {
    gradientPatterns.add(`from-${match[1]} ${match[2] ? `via-${match[2]} ` : ''}to-${match[3]}`);
  }
  if (gradientPatterns.size > 0) tokens.gradients.patterns = [...gradientPatterns];

  if (tokens.colors.primary && tokens.colors.secondary) {
    tokens.gradients.signature = `linear-gradient(135deg, ${tokens.colors.primary}, ${tokens.colors.secondary})`;
  }

  return tokens;
}

function extractColorsViaRegex(html, tokens) {
  const colorRegex = /"([a-z-]+)":\s*"(#[0-9a-fA-F]{6})"/g;
  let match;
  while ((match = colorRegex.exec(html)) !== null) {
    const [, key, value] = match;
    if (key.startsWith('surface')) tokens.surfaceHierarchy[key] = value;
    else if (key.includes('fixed')) tokens.fixedColors[key] = value;
    else tokens.colors[key] = value;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 2: Design Rules (from designMd + theme config)
// ═══════════════════════════════════════════════════════════════════════════

function extractDesignRules(meta) {
  const rules = {
    systemName: null,
    colorMode: null,
    spacingScale: null,
    roundness: null,
    typography: {
      label: { transform: 'uppercase', tracking: '0.1em', size: '0.6875rem', weight: 700 },
      heading: { tracking: '-0.02em', weight: 700 },
      body: { lineHeight: 1.6, size: '1rem' },
    },
    surfaceRules: {
      base: 'surface-dim',
      section: 'surface-container-low',
      card: 'surface-container-high',
      floating: 'surface-container-highest',
      input: 'surface-container-lowest',
      hover: 'surface-variant',
    },
    borderStyle: {
      type: 'luminous',
      glowOpacity: 0.1,
      outlineOpacity: 0.15,
    },
    colorCycle: ['primary', 'secondary', 'tertiary', 'error'],
  };

  if (!meta?.outputComponents?.length) return rules;

  // Extract from theme config
  const ds = meta.outputComponents[0]?.designSystem?.designSystem;
  if (ds) {
    rules.systemName = ds.displayName || null;
    const theme = ds.theme || {};
    rules.colorMode = theme.colorMode || 'DARK';
    rules.spacingScale = theme.spacingScale || 3;
    rules.roundness = theme.roundness || 'ROUND_FOUR';

    // Parse designMd for typography, surface, and border rules
    const designMd = theme.designMd || '';
    if (designMd) {
      // Typography rules from designMd
      const labelMatch = designMd.match(/label[^.]*?`([^`]+)`[^.]*?`(uppercase)`[^.]*?`letter-spacing:\s*([^`]+)`/i);
      if (labelMatch) {
        rules.typography.label.size = labelMatch[1] || rules.typography.label.size;
        rules.typography.label.tracking = labelMatch[3] || rules.typography.label.tracking;
      }

      const headingTrackingMatch = designMd.match(/letter-spacing:\s*(-?[\d.]+em)/);
      if (headingTrackingMatch) {
        rules.typography.heading.tracking = headingTrackingMatch[1];
      }

      const bodyLineHeightMatch = designMd.match(/line-height\s*(?:of\s*)?(?:at\s*least\s*)?([\d.]+)/);
      if (bodyLineHeightMatch) {
        rules.typography.body.lineHeight = parseFloat(bodyLineHeightMatch[1]);
      }

      // Surface hierarchy rules
      const surfaceRules = {};
      const surfacePatterns = [
        { key: 'base', regex: /Base\s*Level.*?`([^`]+)`/i },
        { key: 'section', regex: /Section\s*Level.*?`([^`]+)`/i },
        { key: 'card', regex: /Interaction\s*Level.*?`([^`]+)`/i },
        { key: 'floating', regex: /Floating\s*Level.*?`([^`]+)`/i },
      ];
      for (const { key, regex } of surfacePatterns) {
        const m = designMd.match(regex);
        if (m) surfaceRules[key] = m[1];
      }
      if (Object.keys(surfaceRules).length > 0) {
        Object.assign(rules.surfaceRules, surfaceRules);
      }

      // Border style (luminous edge detection)
      if (designMd.includes('Luminous Edge') || designMd.includes('luminous')) {
        rules.borderStyle.type = 'luminous';
      }
      const glowOpacityMatch = designMd.match(/(\d+)-(\d+)%\s*opacity\s*of\s*`?primary`?/i);
      if (glowOpacityMatch) {
        rules.borderStyle.glowOpacity = parseInt(glowOpacityMatch[2]) / 100;
      }
      const ghostBorderMatch = designMd.match(/(\d+)%\s*opacity/);
      if (ghostBorderMatch && designMd.includes('Ghost Border')) {
        rules.borderStyle.outlineOpacity = parseInt(ghostBorderMatch[1]) / 100;
      }

      // No-line rule detection
      rules.borderStyle.noLineRule = designMd.includes('No-Line') || designMd.includes('No Line');
    }
  }

  return rules;
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER 3: Component Style Map (from HTML sections)
// ═══════════════════════════════════════════════════════════════════════════

function extractComponentStyles(html) {
  const componentStyles = {};

  // Split HTML by section comments: <!-- N. SECTION NAME -->
  const sectionRegex = /<!--\s*(\d+)\.\s*([A-Z][A-Z &+/'-]+?)\s*-->/g;
  const sections = [];
  let match;

  while ((match = sectionRegex.exec(html)) !== null) {
    sections.push({
      index: match.index,
      number: parseInt(match[1]),
      name: match[2].trim(),
    });
  }

  // Extract HTML between each section comment
  for (let i = 0; i < sections.length; i++) {
    const startIdx = sections[i].index;
    const endIdx = i + 1 < sections.length ? sections[i + 1].index : html.indexOf('</main>', startIdx);
    if (endIdx <= startIdx) continue;

    const sectionHtml = html.substring(startIdx, endIdx);
    const sectionName = sections[i].name.toLowerCase();

    // Map section name to our component type
    const componentType = SECTION_TYPE_MAP[sectionName];
    if (!componentType) {
      console.warn(`  Unknown section: "${sections[i].name}" — skipping`);
      continue;
    }

    const style = parseComponentSection(sectionHtml, componentType);
    componentStyles[componentType] = style;
  }

  return componentStyles;
}

function parseComponentSection(html, componentType) {
  const style = {
    container: {},
    icons: [],
    typography: {},
    layout: {},
    badge: null,
    treatments: {},
  };

  // ─── Extract Material Icons ─────────────────────────────────────────
  const iconRegex = /<span\s+class="material-symbols-outlined[^"]*"[^>]*>([a-z_]+)<\/span>/g;
  const icons = new Set();
  let match;
  while ((match = iconRegex.exec(html)) !== null) {
    icons.add(match[1]);
  }
  style.icons = [...icons];

  // ─── Extract container background ──────────────────────────────────
  // Look for bg-* classes on the first major element
  const bgClasses = new Set();
  const bgRegex = /bg-([a-z-]+(?:\/\d+)?)/g;
  while ((match = bgRegex.exec(html)) !== null) {
    const bgClass = match[1];
    // Filter out gradient parts and image-related
    if (!bgClass.startsWith('gradient') && !bgClass.startsWith('black') &&
        !bgClass.startsWith('white') && !bgClass.startsWith('zinc') &&
        bgClass !== 'transparent') {
      bgClasses.add(bgClass);
    }
  }
  style.container.backgrounds = [...bgClasses];

  // Find the primary container background (first surface-* or glass class)
  const primaryBg = style.container.backgrounds.find(b => b.startsWith('surface-'));
  if (primaryBg) style.container.primaryBg = primaryBg;

  // ─── Extract border treatments ─────────────────────────────────────
  const borderClasses = new Set();
  const borderRegex = /border(?:-[a-z]+)?(?:\/\d+)?/g;
  while ((match = borderRegex.exec(html)) !== null) {
    if (!match[0].includes('collapse')) borderClasses.add(match[0]);
  }
  style.container.borders = [...borderClasses].slice(0, 5); // limit noise

  // Check for border-l-* accent pattern
  const borderLeftMatch = html.match(/border-l-(\d+)/);
  if (borderLeftMatch) {
    style.treatments.borderLeftAccent = parseInt(borderLeftMatch[1]);
  }

  // ─── Extract rounding ──────────────────────────────────────────────
  const roundedMatch = html.match(/rounded-(\w+)/);
  if (roundedMatch) style.container.rounded = `rounded-${roundedMatch[1]}`;

  // ─── Extract badge/label patterns ──────────────────────────────────
  // Look for small uppercase text elements (badges, category labels)
  const badgeRegex = /<span[^>]*class="[^"]*(?:bg-[^\s"]*\s+)?text-[^\s"]*\s+[^"]*(?:rounded-full|rounded-lg)[^"]*text-\[?(?:10px|\d+px)[^"]*tracking-[^\s"]*[^"]*"[^>]*>([^<]+)<\/span>/g;
  while ((match = badgeRegex.exec(html)) !== null) {
    style.badge = {
      text: match[1].trim(),
      found: true,
    };
  }
  // Fallback: look for any small uppercase tracking-widest element
  if (!style.badge) {
    const labelRegex = /class="[^"]*uppercase[^"]*tracking-(?:widest|\[[\d.]+em\])[^"]*"[^>]*>([^<]{3,30})<\//g;
    while ((match = labelRegex.exec(html)) !== null) {
      const text = match[1].trim();
      // Skip navigation links, generic labels
      if (text && !text.includes('href') && text.length < 40) {
        if (!style.badge) {
          style.badge = { text, found: true };
        }
        break;
      }
    }
  }

  // ─── Extract layout pattern ────────────────────────────────────────
  // Grid columns
  const gridColsMatch = html.match(/grid-cols-(\d+)/g);
  if (gridColsMatch) {
    const cols = gridColsMatch.map(g => parseInt(g.replace('grid-cols-', '')));
    style.layout.gridCols = Math.max(...cols.filter(c => c > 1));
  }

  // Flex direction
  if (html.includes('flex-row')) style.layout.direction = 'row';
  if (html.includes('flex-col')) style.layout.direction = 'column';

  // Alternating layout detection (timeline/zigzag)
  const textRightCount = (html.match(/text-right/g) || []).length;
  const textLeftCount = (html.match(/text-left/g) || []).length;
  if (textRightCount > 0 && textLeftCount > 0) {
    style.layout.alternating = true;
  }

  // Rounded-full for circular nodes
  const roundedFullCount = (html.match(/rounded-full/g) || []).length;
  if (roundedFullCount > 3) {
    style.layout.circularNodes = true;
  }

  // ─── Extract typography patterns ───────────────────────────────────
  // Title size
  const titleSizeMatch = html.match(/text-(\d)xl\s+(?:md:text-(\d)xl\s+)?font-(\w+)/);
  if (titleSizeMatch) {
    style.typography.titleSize = titleSizeMatch[2]
      ? `text-${titleSizeMatch[1]}xl md:text-${titleSizeMatch[2]}xl`
      : `text-${titleSizeMatch[1]}xl`;
    style.typography.titleWeight = `font-${titleSizeMatch[3]}`;
  }

  // Label style detection
  if (html.includes('uppercase') && html.includes('tracking-')) {
    style.typography.hasLabels = true;
  }

  // ─── Extract special treatments ────────────────────────────────────
  // Hover effects
  if (html.includes('hover:')) {
    const hoverBgMatch = html.match(/hover:bg-([a-z-]+)/);
    if (hoverBgMatch) style.treatments.hoverBg = hoverBgMatch[1];
  }

  // Divide pattern (for lists)
  if (html.includes('divide-y')) {
    style.treatments.divideY = true;
  }

  // Gradient line (for timeline)
  if (html.includes('bg-gradient-to-b') && html.includes('w-px')) {
    style.treatments.gradientLine = true;
  }

  // Glow dots
  const glowDotMatch = html.match(/shadow-\[0_0_(\d+)px_([^\]]+)\]/);
  if (glowDotMatch) {
    style.treatments.glowDots = true;
  }

  // Color-per-item pattern (stats, key-terms)
  const coloredItemClasses = [];
  const colorItemRegex = /text-(primary|secondary|tertiary|error)\b/g;
  while ((match = colorItemRegex.exec(html)) !== null) {
    coloredItemClasses.push(match[1]);
  }
  if (new Set(coloredItemClasses).size >= 3) {
    style.treatments.colorCycle = true;
  }

  // Image overlay gradient direction
  const overlayGradientMatch = html.match(/bg-gradient-to-([tbrl])\s/);
  if (overlayGradientMatch) {
    style.treatments.overlayGradientDirection = overlayGradientMatch[1];
  }

  // Details/summary for accordion (native HTML pattern)
  if (html.includes('<details')) {
    style.treatments.nativeDetails = true;
  }

  // Perspective/3D transforms (flashcards)
  if (html.includes('perspective') || html.includes('rotateY')) {
    style.treatments.has3D = true;
  }

  // Tab pill container
  if (html.includes('rounded-full') && html.includes('mx-auto') && componentType === 'tabs') {
    style.treatments.pillTabs = true;
  }

  return style;
}

// ═══════════════════════════════════════════════════════════════════════════
// Main — Assemble all three layers into design-dna.json
// ═══════════════════════════════════════════════════════════════════════════

const htmlPath = join(ROOT, 'v3/output/design-dna-raw.html');
const metaPath = join(ROOT, 'v3/output/design-dna-meta.json');
const outputPath = join(ROOT, 'v3/output/design-dna.json');

const html = readFileSync(htmlPath, 'utf8');
console.log(`Reading HTML: ${htmlPath} (${html.length} chars)`);

// Layer 1: Design tokens
const tokens = extractDesignTokens(html);
console.log('\n=== LAYER 1: DESIGN TOKENS ===');
console.log(`  Colors:          ${Object.keys(tokens.colors).length}`);
console.log(`  Surface levels:  ${Object.keys(tokens.surfaceHierarchy).length}`);
console.log(`  Fixed colors:    ${Object.keys(tokens.fixedColors).length}`);
console.log(`  Fonts:           ${Object.keys(tokens.fonts).length}`);
console.log(`  Border radius:   ${Object.keys(tokens.borderRadius).length}`);
console.log(`  Glass:           ${tokens.glass.card ? 'yes' : 'no'}`);
console.log(`  Shadows:         ${tokens.glass.shadows?.length || 0}`);
console.log(`  Gradients:       ${tokens.gradients.patterns?.length || 0}`);

// Layer 2: Design rules
let designRules = {};
if (existsSync(metaPath)) {
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  designRules = extractDesignRules(meta);
  console.log('\n=== LAYER 2: DESIGN RULES ===');
  console.log(`  System name:     ${designRules.systemName}`);
  console.log(`  Color mode:      ${designRules.colorMode}`);
  console.log(`  Spacing scale:   ${designRules.spacingScale}`);
  console.log(`  Roundness:       ${designRules.roundness}`);
  console.log(`  Border style:    ${designRules.borderStyle.type}`);
  console.log(`  No-line rule:    ${designRules.borderStyle.noLineRule ? 'yes' : 'no'}`);
  console.log(`  Typography:      label=${designRules.typography.label.transform} ${designRules.typography.label.tracking}`);
} else {
  console.log('\n  No meta file found — using default design rules');
  designRules = extractDesignRules(null);
}

// Layer 3: Component style map
const componentStyles = extractComponentStyles(html);
console.log('\n=== LAYER 3: COMPONENT STYLES ===');
const componentTypes = Object.keys(componentStyles);
console.log(`  Components:      ${componentTypes.length}`);
for (const type of componentTypes) {
  const s = componentStyles[type];
  const icons = s.icons.length > 0 ? s.icons.slice(0, 3).join(', ') : 'none';
  const badge = s.badge ? `"${s.badge.text}"` : 'none';
  const bg = s.container.primaryBg || 'default';
  console.log(`  ${type.padEnd(16)} icons=[${icons}] badge=${badge} bg=${bg}`);
}

// ─── Assemble final output ──────────────────────────────────────────────
const designDNA = {
  meta: {
    source: 'Google Stitch',
    generatedAt: new Date().toISOString(),
    systemName: designRules.systemName,
  },
  // Layer 1
  colors: tokens.colors,
  surfaceHierarchy: tokens.surfaceHierarchy,
  fixedColors: tokens.fixedColors,
  glass: tokens.glass,
  gradients: tokens.gradients,
  borderRadius: tokens.borderRadius,
  fonts: tokens.fonts,
  // Layer 2
  designRules,
  // Layer 3
  componentStyles,
};

writeFileSync(outputPath, JSON.stringify(designDNA, null, 2));
console.log(`\nSaved: ${outputPath}`);
