/**
 * generate-course-html.js — Stitch-First Course Renderer
 *
 * Sends the FULL course content to Stitch and gets back a complete,
 * designed HTML page. Stitch is the renderer — not a style guide generator.
 *
 * We feed Stitch:
 * - Every section, heading, paragraph, quiz question, accordion item
 * - Brand colors + font (minimal)
 * - Course topic/domain for design direction
 * - Data attribute instructions so we can hydrate interactivity later
 *
 * Stitch returns: a beautiful, fully designed deep-scroll course page.
 * We then inject our hydration script to make interactive elements work.
 *
 * Input:  v4/output/course-layout.json + v4/output/brand-profile.json
 * Output: v4/output/stitch-course-raw.html
 *         v4/output/stitch-course-meta.json
 *
 * Requires: STITCH_API_KEY environment variable
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { StitchToolClient } from '@google/stitch-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUTPUT_DIR = join(ROOT, 'v4/output');

const API_KEY = process.env.STITCH_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set STITCH_API_KEY environment variable');
  process.exit(1);
}

// ─── Build the course content prompt ─────────────────────────────────

function buildCoursePrompt(layout, brand) {
  const course = layout.course;
  const sections = layout.sections;

  // Extract brand basics
  const colors = brand?.colors || {};
  const primary = colors.primary || '#6366f1';
  const secondary = colors.secondary || '#a855f7';
  const accent = colors.accent || '#3b82f6';
  const bg = colors.background || '#000000';
  const font = brand?.typography?.headingFont || 'Inter';

  // Detect domain from content
  const allText = JSON.stringify(layout).toLowerCase();
  let domain = 'professional training';
  let mood = 'modern, clean, authoritative';
  if (allText.match(/safety|hazard|risk|emergency|danger/)) {
    domain = 'safety and compliance training';
    mood = 'authoritative, high-stakes, technical';
  } else if (allText.match(/sales|marketing|customer|revenue/)) {
    domain = 'business and marketing';
    mood = 'dynamic, persuasive, energetic';
  } else if (allText.match(/code|software|api|data|tech/)) {
    domain = 'technology';
    mood = 'technical, precise, innovative';
  } else if (allText.match(/health|medical|patient|clinical/)) {
    domain = 'healthcare';
    mood = 'trustworthy, calm, clinical';
  } else if (allText.match(/lead|manage|team|strategy/)) {
    domain = 'leadership';
    mood = 'confident, inspiring, professional';
  }

  // Build section content
  let sectionContent = '';
  for (const section of sections) {
    sectionContent += `\n### SECTION: ${section.title || 'Introduction'}\n`;

    for (const comp of section.components) {
      sectionContent += buildComponentBlock(comp);
    }
  }

  const prompt = `Design a complete, premium deep-scroll e-learning course page.

COURSE: "${course.title}"
DOMAIN: ${domain}
DESIGN FEEL: ${mood}
BRAND: Primary ${primary}, Secondary ${secondary}, Accent ${accent}, Background ${bg}
FONT: ${font}

This is a single-page deep-scroll course. It should look like a $50,000 custom-built learning platform — NOT a template. Use dramatic typography, generous whitespace, surface hierarchy for depth, and glass effects where appropriate. Dark theme based on the background color.

CRITICAL — INTERACTIVE ELEMENTS:
For elements that need JavaScript interactivity, add these data attributes:
- Accordions: Use native <details><summary> HTML elements
- Quiz questions: Add data-quiz on the container, data-correct="N" (zero-indexed correct answer index) on the container, and data-choice on each option button
- Flashcards: Add data-flashcard on the card container
- Checklists: Add data-checklist on the container, use native <input type="checkbox"> elements
- Tab panels: Add data-tabs on the container, data-tab-trigger on each tab button, data-tab-panel on each content panel
- Carousels/Narrative: Add data-carousel on the container, data-slide on each slide, data-prev and data-next on navigation buttons
- Text inputs: Use native <form> elements with <input> fields

Use Google Material Symbols icons throughout: <span class="material-symbols-outlined">icon_name</span>

HERE IS THE EXACT CONTENT — use it all, do not skip or summarise anything:

${sectionContent}

DESIGN REQUIREMENTS:
- Deep scroll single page, every section flows into the next
- Hero section should be full-viewport with dramatic imagery
- Generate relevant imagery using placeholder URLs or Stitch's image generation
- Generous section padding (7-10rem between major sections)
- Typography scale: hero titles 6-8xl, section titles 3-4xl, body text lg
- Uppercase tracking-widest labels for categories and badges
- Surface hierarchy: use layered backgrounds for depth, not borders
- All content must be included — this IS the course, not a preview
- Make it responsive (mobile-friendly)`;

  return prompt;
}

function buildComponentBlock(comp) {
  const type = comp.type;
  let block = `\n[${type.toUpperCase()}] ${comp.displayTitle || ''}\n`;

  // Strip HTML tags for cleaner prompt
  const cleanHtml = (html) => html || '';

  switch (type) {
    case 'hero':
      block += `Title: ${comp.displayTitle}\n`;
      block += `Subtitle: ${cleanHtml(comp.body)}\n`;
      block += `(Full-viewport hero with background image, dramatic gradient overlay, CTA button)\n`;
      break;

    case 'text':
      block += `${cleanHtml(comp.body)}\n`;
      break;

    case 'accordion':
      block += `Instruction: ${comp.instruction || 'Select each item to learn more.'}\n`;
      block += `INTERACTIVE: Use native <details><summary> elements.\n`;
      for (const item of (comp._items || [])) {
        block += `  • ${item.title}: ${cleanHtml(item.body)}\n`;
      }
      break;

    case 'mcq':
      block += `INTERACTIVE: Add data-quiz and data-correct="${(comp._items || []).findIndex(i => i._shouldBeSelected)}" attributes.\n`;
      block += `Question: ${cleanHtml(comp.body)}\n`;
      block += `Instruction: ${comp.instruction || 'Choose the best answer.'}\n`;
      for (const item of (comp._items || [])) {
        const marker = item._shouldBeSelected ? ' [CORRECT]' : '';
        block += `  ${item.text}${marker}\n`;
      }
      if (comp._feedback) {
        block += `Correct feedback: ${comp._feedback.correct || 'Correct!'}\n`;
        block += `Incorrect feedback: ${comp._feedback._incorrect?.final || comp._feedback.incorrect || 'Incorrect. Try again.'}\n`;
      }
      break;

    case 'textinput':
      block += `INTERACTIVE: Use native <form> with <input> elements.\n`;
      block += `${cleanHtml(comp.body)}\n`;
      for (const item of (comp._items || [])) {
        block += `  Field: ${item.prefix || 'Input'} (placeholder: "${item.placeholder || ''}")\n`;
      }
      break;

    case 'graphic-text':
      block += `${cleanHtml(comp.body)}\n`;
      block += `(Side-by-side text + image layout. Include a relevant image.)\n`;
      break;

    case 'checklist':
      block += `INTERACTIVE: Add data-checklist, use native <input type="checkbox"> per item.\n`;
      block += `${cleanHtml(comp.body)}\n`;
      block += `Instruction: ${comp.instruction || 'Check each item as you review it.'}\n`;
      for (const item of (comp._items || [])) {
        block += `  ☐ ${item.text}${item.detail ? ` — ${item.detail}` : ''}\n`;
      }
      break;

    case 'pullquote':
      block += `Quote: ${cleanHtml(comp.body)}\n`;
      block += `Attribution: ${comp.attribution || ''}${comp.role ? `, ${comp.role}` : ''}\n`;
      break;

    case 'stat-callout':
      block += `${cleanHtml(comp.body)}\n`;
      for (const item of (comp._items || [])) {
        block += `  ${item.prefix || ''}${item.value}${item.suffix || ''} — ${item.label}\n`;
      }
      break;

    case 'bento':
      block += `${cleanHtml(comp.body)}\n`;
      block += `(Multi-card grid layout with images where available)\n`;
      for (const item of (comp._items || [])) {
        block += `  Card: ${item.title} — ${cleanHtml(item.body)}\n`;
      }
      break;

    case 'comparison':
      block += `${cleanHtml(comp.body)}\n`;
      block += `Columns: ${(comp.columns || []).map(c => c.title).join(' | ')}\n`;
      for (const row of (comp.rows || [])) {
        const vals = (row.values || []).map(v => v === true ? '✓' : v === false ? '✗' : v).join(' | ');
        block += `  ${row.label}: ${vals}\n`;
      }
      break;

    case 'timeline':
      block += `${cleanHtml(comp.body)}\n`;
      for (let i = 0; i < (comp._items || []).length; i++) {
        const item = comp._items[i];
        block += `  Step ${String(i + 1).padStart(2, '0')}: ${item.title} — ${cleanHtml(item.body)}\n`;
      }
      break;

    case 'process-flow':
      block += `${cleanHtml(comp.body)}\n`;
      for (const node of (comp._nodes || [])) {
        block += `  → ${node.title}: ${node.body}\n`;
      }
      break;

    case 'tabs':
      block += `INTERACTIVE: Add data-tabs on container, data-tab-trigger on buttons, data-tab-panel on panels.\n`;
      block += `${cleanHtml(comp.body)}\n`;
      for (const item of (comp._items || [])) {
        block += `  Tab "${item.title}": ${cleanHtml(item.body)}\n`;
      }
      break;

    case 'flashcard':
      block += `INTERACTIVE: Add data-flashcard on each card (click to flip).\n`;
      block += `${comp.instruction || 'Click each card to reveal the answer.'}\n`;
      for (const item of (comp._items || [])) {
        block += `  Front: ${item.front} → Back: ${item.back}\n`;
      }
      break;

    case 'narrative':
      block += `INTERACTIVE: Add data-carousel, data-slide, data-prev, data-next.\n`;
      block += `${cleanHtml(comp.body)}\n`;
      for (const item of (comp._items || [])) {
        block += `  Slide: ${item.title} — ${cleanHtml(item.body)}\n`;
      }
      break;

    case 'key-term':
      for (const item of (comp._items || [])) {
        block += `  ${item.term}: ${item.definition}\n`;
      }
      break;

    case 'full-bleed':
      block += `(Full-width parallax image with text overlay)\n`;
      block += `${cleanHtml(comp.body)}\n`;
      break;

    case 'graphic':
      block += `(Full-width image)\n`;
      break;

    case 'media':
    case 'video-transcript':
      block += `(Video player placeholder)\n`;
      block += `${cleanHtml(comp.body)}\n`;
      break;

    default:
      block += `${cleanHtml(comp.body)}\n`;
  }

  return block;
}

// ─── Main ────────────────────────────────────────────────────────────

const layoutPath = join(ROOT, 'v4/output/course-layout.json');
const brandPath = join(ROOT, 'v4/output/brand-profile.json');

const layout = JSON.parse(readFileSync(layoutPath, 'utf8'));
const brand = JSON.parse(readFileSync(brandPath, 'utf8'));

console.log('=== STITCH-FIRST COURSE GENERATOR (v4) ===\n');
console.log(`Course: ${layout.course.title}`);
console.log(`Sections: ${layout.sections.length}`);
console.log(`Components: ${layout.sections.reduce((s, sec) => s + sec.components.length, 0)}`);

const prompt = buildCoursePrompt(layout, brand);
console.log(`Prompt: ${prompt.length} chars\n`);

// Save prompt for reference
writeFileSync(join(OUTPUT_DIR, 'stitch-course-prompt.txt'), prompt);

console.log('─── Calling Stitch (may take 2-5 minutes for full course)... ───\n');

const client = new StitchToolClient({ apiKey: API_KEY, timeout: 600000 });

const project = await client.callTool('create_project', {
  title: `${layout.course.title} — Full Course v4`,
});
const projectId = project.name?.replace('projects/', '') || project.projectId;
console.log(`Project created: ${projectId}`);

const result = await client.callTool('generate_screen_from_text', {
  projectId,
  prompt,
  deviceType: 'DESKTOP',
  modelId: 'GEMINI_3_FLASH',
});

// Save raw API response
writeFileSync(join(OUTPUT_DIR, 'stitch-course-meta.json'), JSON.stringify(result, null, 2));
console.log('Saved: stitch-course-meta.json');

// Download HTML + screenshot (same structure as v3)
let htmlSaved = false;
let screenshotSaved = false;

if (result.outputComponents) {
  for (const comp of result.outputComponents) {
    if (comp.design?.screens) {
      for (const screen of comp.design.screens) {
        if (screen.htmlCode?.downloadUrl && !htmlSaved) {
          console.log('Downloading HTML...');
          const resp = await fetch(screen.htmlCode.downloadUrl);
          const html = await resp.text();
          writeFileSync(join(OUTPUT_DIR, 'stitch-course-raw.html'), html);
          console.log(`Saved: stitch-course-raw.html (${html.length} chars)`);
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
}

console.log('\n✓ Stitch course generation complete');
