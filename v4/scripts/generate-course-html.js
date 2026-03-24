/**
 * generate-course-html.js — V5 Stitch Component Kit Generator
 *
 * Sends Stitch TWO things:
 *   1. brand-design.md — DESIGN.md format brief (how it should look)
 *   2. representative-course.md — all 25 component types (what to design)
 *
 * Stitch designs a complete, branded page experience — navigation, sections,
 * every component type, transitions, footer. We then EXTRACT:
 *   - Page shell (nav, section wrappers, footer)
 *   - Component patterns (one HTML fragment per type, identified by data-component-type)
 *   - Design tokens (Tailwind config, colour system, fonts)
 *
 * This is a REUSABLE DESIGN ASSET — the future authoring layer can re-render
 * courses with different content or swapped components without re-calling Stitch.
 *
 * CRITICAL: DesignTheme is OUTPUT-only in the Stitch API. There is no theme
 * input parameter. The DESIGN.md content goes INSIDE the text prompt parameter.
 * Stitch understands it there because it's trained on the DESIGN.md format.
 *
 * Input:  v4/output/brand-design.md + v4/prompts/representative-course.md
 * Output: v4/output/stitch-course-raw.html
 *         v4/output/stitch-course-meta.json
 *         v4/output/stitch-course-screenshot.png
 *         v4/output/component-patterns/*.html
 *         v4/output/design-tokens.json
 *
 * Requires: STITCH_API_KEY environment variable
 * Model: GEMINI_3_1_PRO (Deep Think — significantly better for design reasoning)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { StitchToolClient } from '@google/stitch-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
config({ path: join(ROOT, '.env') });
const OUTPUT_DIR = join(ROOT, 'v4/output');
const PATTERNS_DIR = join(OUTPUT_DIR, 'component-patterns');

const API_KEY = process.env.STITCH_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set STITCH_API_KEY environment variable');
  process.exit(1);
}

// ─── Build the Stitch prompt ────────────────────────────────────────

function buildStitchPrompt(designMd, representativeCourse) {
  return `You are designing a complete, premium e-learning course page.

=== DESIGN SYSTEM BRIEF ===

${designMd}

=== COURSE CONTENT TO DESIGN ===

${representativeCourse}

=== CRITICAL REQUIREMENTS ===

1. Platform: Web Desktop (responsive — must also work on mobile)
2. Single deep-scroll page with flowing sections, smooth transitions, and visual rhythm
3. EVERY component MUST be wrapped in a container with data-component-type="typename" attribute
4. Interactive elements MUST include these exact data attributes for JavaScript hydration:
   - Quizzes: data-quiz on container, data-correct="N" (zero-indexed), data-choice on each option
   - Accordions: Native <details><summary> HTML elements
   - Tabs: data-tabs on container, data-tab-trigger on buttons, data-tab-panel on panels
   - Flashcards: data-flashcard on card container
   - Checklists: data-checklist on container, native <input type="checkbox">
   - Carousels: data-carousel on container, data-slide on slides, data-prev/data-next on nav
   - Text inputs: Native <form> with <input> elements
5. Use Google Material Symbols for icons: <span class="material-symbols-outlined">icon_name</span>
6. Design this to feel like a $50,000 custom-built learning platform — not a template
7. The design must be unmistakably on-brand using the colour palette and typography above
8. Include a fixed navigation bar, section transitions, and a footer`;
}

// ─── Extract component patterns from Stitch HTML ─────────────────────

function extractComponentPatterns(html) {
  const patterns = {};

  // Match all data-component-type containers
  // Strategy: find each opening tag with data-component-type, then extract
  // the complete element including all children
  const componentTypes = [
    'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
    'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
    'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
    'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
    'image-gallery', 'full-bleed', 'video-transcript',
  ];

  for (const type of componentTypes) {
    // Find the data-component-type attribute in the HTML
    const marker = `data-component-type="${type}"`;
    const startIdx = html.indexOf(marker);
    if (startIdx === -1) continue;

    // Walk back to find the opening tag
    let tagStart = startIdx;
    while (tagStart > 0 && html[tagStart] !== '<') tagStart--;

    // Determine the tag name
    const tagMatch = html.substring(tagStart).match(/^<(\w+)/);
    if (!tagMatch) continue;
    const tagName = tagMatch[1];

    // Find the matching closing tag by counting nesting depth
    let depth = 0;
    let pos = tagStart;
    let foundEnd = false;

    while (pos < html.length) {
      const nextOpen = html.indexOf(`<${tagName}`, pos + 1);
      const nextClose = html.indexOf(`</${tagName}>`, pos + 1);

      if (nextClose === -1) break; // malformed HTML

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // Another opening tag of same type before closing
        depth++;
        pos = nextOpen;
      } else {
        if (depth === 0) {
          // This is our matching close tag
          const endIdx = nextClose + `</${tagName}>`.length;
          patterns[type] = html.substring(tagStart, endIdx);
          foundEnd = true;
          break;
        } else {
          depth--;
          pos = nextClose;
        }
      }
    }

    if (!foundEnd) {
      // Try self-closing or single-line pattern as fallback
      const selfClose = html.substring(tagStart).match(new RegExp(`^<${tagName}[^>]*\\/>`));
      if (selfClose) {
        patterns[type] = selfClose[0];
      }
    }
  }

  return patterns;
}

// ─── Extract design tokens from Stitch HTML ──────────────────────────

function extractDesignTokens(html) {
  const tokens = {
    colors: {},
    fonts: {},
    borderRadius: {},
    spacing: {},
    tailwindConfig: null,
  };

  // Extract Tailwind config — find the script block containing tailwind.config
  const configScriptMatch = html.match(/<script[^>]*id="tailwind-config"[^>]*>([\s\S]*?)<\/script>/i) ||
                            html.match(/tailwind\.config\s*=\s*([\s\S]*?)\s*<\/script>/);
  if (configScriptMatch) {
    const configText = configScriptMatch[1];
    tokens.tailwindConfig = configText;

    // Parse ALL color tokens using a simple regex on key-value pairs
    // This works regardless of nesting depth
    for (const cm of configText.matchAll(/"([\w-]+)"\s*:\s*"(#[0-9a-fA-F]{3,8})"/g)) {
      tokens.colors[cm[1]] = cm[2];
    }

    // Fonts
    for (const fm of configText.matchAll(/"(headline|body|label|display|title)"\s*:\s*\["([^"]+)"/g)) {
      tokens.fonts[fm[1]] = fm[2];
    }

    // Border radius
    const radiusMatch = configText.match(/"borderRadius"\s*:\s*\{([^}]+)\}/);
    if (radiusMatch) {
      for (const rm of radiusMatch[1].matchAll(/"(\w+)"\s*:\s*"([^"]+)"/g)) {
        tokens.borderRadius[rm[1]] = rm[2];
      }
    }
  }

  // Extract background color for theme detection
  if (tokens.colors.background) {
    tokens.isDark = isColorDark(tokens.colors.background);
  } else {
    const bgMatch = html.match(/"background"\s*:\s*"(#[0-9a-fA-F]{3,8})"/);
    if (bgMatch) tokens.isDark = isColorDark(bgMatch[1]);
  }

  return tokens;
}

function isColorDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.4;
}

// ─── Extract page shell ──────────────────────────────────────────────

function extractPageShell(html) {
  const shell = { head: '', nav: '', footer: '', trailingStyles: '' };

  // Head content
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (headMatch) shell.head = headMatch[1];

  // Nav — look for <nav> or <header> element
  const navMatch = html.match(/<nav[^>]*>[\s\S]*?<\/nav>/i) ||
                   html.match(/<header[^>]*>[\s\S]*?<\/header>/i);
  if (navMatch) shell.nav = navMatch[0];

  // Footer
  const footerMatch = html.match(/<footer[^>]*>[\s\S]*?<\/footer>/i);
  if (footerMatch) shell.footer = footerMatch[0];

  // Trailing styles (perspective, backface, etc.)
  const afterMain = html.split('</main>')[1] || html.split('</body>')[0]?.split('</footer>')[1] || '';
  const trailingStyles = [];
  for (const m of afterMain.matchAll(/<style>([\s\S]*?)<\/style>/gi)) {
    trailingStyles.push(m[1]);
  }
  if (trailingStyles.length > 0) {
    shell.trailingStyles = `<style>\n${trailingStyles.join('\n')}\n</style>`;
  }

  return shell;
}

// ─── Main ────────────────────────────────────────────────────────────

// Read inputs
const designMdPath = join(ROOT, 'v4/output/brand-design.md');
const repCoursePath = join(ROOT, 'v4/prompts/representative-course.md');

if (!existsSync(designMdPath)) {
  console.error('ERROR: brand-design.md not found. Run scrape-brand.js first.');
  process.exit(1);
}
if (!existsSync(repCoursePath)) {
  console.error('ERROR: representative-course.md not found.');
  process.exit(1);
}

const designMd = readFileSync(designMdPath, 'utf8');
const representativeCourse = readFileSync(repCoursePath, 'utf8');

console.log('=== V5 STITCH COMPONENT KIT GENERATOR ===\n');
console.log(`Design brief: ${designMd.length} chars`);
console.log(`Representative course: ${representativeCourse.length} chars`);

const prompt = buildStitchPrompt(designMd, representativeCourse);
console.log(`Total prompt: ${prompt.length} chars\n`);

// Save prompt for reference
writeFileSync(join(OUTPUT_DIR, 'stitch-course-prompt.txt'), prompt);

console.log('─── Calling Stitch with GEMINI_3_1_PRO (Deep Think — may take 3-5 minutes)... ───\n');

const client = new StitchToolClient({ apiKey: API_KEY, timeout: 600000 });

const project = await client.callTool('create_project', {
  title: 'Brand Component Kit — V5',
});
const projectId = project.name?.replace('projects/', '') || project.projectId;
console.log(`Project created: ${projectId}`);

const result = await client.callTool('generate_screen_from_text', {
  projectId,
  prompt,
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_1_PRO',
});

// Save raw API response
writeFileSync(join(OUTPUT_DIR, 'stitch-course-meta.json'), JSON.stringify(result, null, 2));
console.log('Saved: stitch-course-meta.json');

// Download HTML + screenshot
let htmlContent = '';
let htmlSaved = false;
let screenshotSaved = false;

if (result.outputComponents) {
  for (const comp of result.outputComponents) {
    if (comp.design?.screens) {
      for (const screen of comp.design.screens) {
        if (screen.htmlCode?.downloadUrl && !htmlSaved) {
          console.log('Downloading HTML...');
          const resp = await fetch(screen.htmlCode.downloadUrl);
          htmlContent = await resp.text();
          writeFileSync(join(OUTPUT_DIR, 'stitch-course-raw.html'), htmlContent);
          console.log(`Saved: stitch-course-raw.html (${htmlContent.length} chars)`);
          htmlSaved = true;
        }
        if (screen.screenshot?.downloadUrl && !screenshotSaved) {
          console.log('Downloading screenshot...');
          const resp = await fetch(screen.screenshot.downloadUrl);
          const buf = Buffer.from(await resp.arrayBuffer());
          writeFileSync(join(OUTPUT_DIR, 'stitch-course-screenshot.png'), buf);
          console.log(`Saved: stitch-course-screenshot.png (${buf.length} bytes)`);
          screenshotSaved = true;
        }
      }
    }
  }
}

if (!htmlSaved) {
  console.error('ERROR: No HTML found in Stitch response');
  console.log('Response keys:', Object.keys(result || {}));
  process.exit(1);
}

// ─── Extract component patterns ──────────────────────────────────────

console.log('\n─── Extracting component patterns... ───\n');

const patterns = extractComponentPatterns(htmlContent);
const patternTypes = Object.keys(patterns);

// Save each pattern as individual HTML file
mkdirSync(PATTERNS_DIR, { recursive: true });
for (const [type, html] of Object.entries(patterns)) {
  writeFileSync(join(PATTERNS_DIR, `${type}.html`), html);
}

console.log(`Extracted ${patternTypes.length}/25 component patterns:`);
console.log(`  Found: ${patternTypes.join(', ')}`);

const missing = [
  'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
  'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
  'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
  'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
  'image-gallery', 'full-bleed', 'video-transcript',
].filter(t => !patternTypes.includes(t));

if (missing.length > 0) {
  console.log(`  Missing: ${missing.join(', ')}`);
}

// ─── Extract design tokens ───────────────────────────────────────────

console.log('\n─── Extracting design tokens... ───\n');

const tokens = extractDesignTokens(htmlContent);
writeFileSync(join(OUTPUT_DIR, 'design-tokens.json'), JSON.stringify(tokens, null, 2));
console.log(`Saved: design-tokens.json`);
console.log(`  Colors: ${Object.keys(tokens.colors).length} tokens`);
console.log(`  Fonts: ${Object.keys(tokens.fonts).length} families`);
console.log(`  Border radius: ${Object.keys(tokens.borderRadius).length} values`);
console.log(`  Theme: ${tokens.isDark ? 'dark' : 'light'}`);

// ─── Extract page shell ──────────────────────────────────────────────

console.log('\n─── Extracting page shell... ───\n');

const shell = extractPageShell(htmlContent);
writeFileSync(join(PATTERNS_DIR, '_page-shell.json'), JSON.stringify(shell, null, 2));
console.log(`Saved: component-patterns/_page-shell.json`);
console.log(`  Head: ${shell.head.length} chars`);
console.log(`  Nav: ${shell.nav.length} chars`);
console.log(`  Footer: ${shell.footer.length} chars`);

console.log('\n=== Stitch Component Kit generation complete ===');
console.log(`\nSummary:`);
console.log(`  Component patterns: ${patternTypes.length}/25`);
console.log(`  Design tokens: ${Object.keys(tokens.colors).length} colors, ${Object.keys(tokens.fonts).length} fonts`);
console.log(`  Page shell: nav + footer extracted`);
console.log(`  Model: GEMINI_3_1_PRO (Deep Think)`);
