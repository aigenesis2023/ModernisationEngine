/**
 * Stitch Design DNA Generator — V2 (Intelligent Prompt)
 *
 * Combines minimal brand identity (3 colors + font from URL) with
 * course content context (topic, themes, component types from SCORM)
 * to generate a content-aware, brand-aligned design system via Stitch.
 *
 * Stitch is the DESIGNER — we feed it intelligence, it designs everything.
 * We use its FULL output, not just extracted tokens.
 *
 * Input:  v3/output/brand-profile.json (colors + font only)
 *         v3/output/course-layout.json (components + content themes)
 *         v3/output/content-bucket.json (course topic + structure)
 * Output: v3/output/design-dna-raw.html (Stitch's complete HTML)
 *         v3/output/design-dna-screenshot.png
 *         v3/output/design-dna-meta.json
 *
 * Requires: STITCH_API_KEY environment variable
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { StitchToolClient } from '@google/stitch-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUTPUT_DIR = join(ROOT, 'v3/output');

const API_KEY = process.env.STITCH_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set STITCH_API_KEY environment variable');
  process.exit(1);
}

// ─── Extract minimal brand anchor from brand profile ─────────────────
function extractBrandAnchor(brand) {
  const c = brand.colors || {};
  return {
    primary: c.primary || '#6366f1',
    secondary: c.secondary || '#a855f7',
    accent: c.accent || '#3b82f6',
    background: c.background || '#000000',
    text: c.text || '#f0f0f0',
    font: brand.typography?.headingFont || 'Inter',
    bodyFont: brand.typography?.bodyFont || 'Inter',
    isDark: isBackgroundDark(c.background),
  };
}

function isBackgroundDark(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return true;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) < 0.55;
}

// ─── Extract content intelligence from SCORM + layout ────────────────
function extractContentIntelligence(contentBucket, courseLayout) {
  const title = courseLayout.course?.title || contentBucket.courseTitle || 'Course';
  const subtitle = courseLayout.course?.subtitle || '';

  // Get scene titles for topic understanding
  const sceneTopics = (contentBucket.scenes || [])
    .map(s => s.title)
    .filter(t => t && t.length > 2);

  // Get all component types used
  const componentTypes = new Set();
  const componentDetails = [];
  for (const section of courseLayout.sections || []) {
    for (const comp of section.components) {
      componentTypes.add(comp.type);
      componentDetails.push({
        type: comp.type,
        title: comp.displayTitle || '',
        sectionTitle: section.title || '',
      });
    }
  }

  // Infer content domain and mood
  const allText = [title, subtitle, ...sceneTopics].join(' ').toLowerCase();
  let domain = 'general education';
  let mood = 'modern professional';

  if (allText.match(/safety|hazard|risk|emergency|danger|precaution/)) {
    domain = 'safety and compliance training';
    mood = 'authoritative, clear, high-stakes';
  } else if (allText.match(/sales|marketing|brand|customer|revenue/)) {
    domain = 'business and marketing';
    mood = 'dynamic, persuasive, energetic';
  } else if (allText.match(/code|software|develop|api|data|tech/)) {
    domain = 'technology and development';
    mood = 'technical, precise, developer-focused';
  } else if (allText.match(/health|medical|patient|clinical|wellness/)) {
    domain = 'healthcare and wellness';
    mood = 'trustworthy, calm, clinical precision';
  } else if (allText.match(/finance|bank|invest|compliance|regulation/)) {
    domain = 'finance and compliance';
    mood = 'structured, authoritative, detail-oriented';
  } else if (allText.match(/lead|manage|team|communicate|strategy/)) {
    domain = 'leadership and management';
    mood = 'confident, inspiring, professional';
  }

  return {
    title,
    subtitle,
    sceneTopics,
    domain,
    mood,
    componentTypes: [...componentTypes],
    componentDetails,
    totalComponents: componentDetails.length,
  };
}

// ─── Build the intelligent Stitch prompt ─────────────────────────────
function buildStitchPrompt(brand, content) {
  const themeMode = brand.isDark ? 'dark' : 'light';

  // Build component showcase list with context
  const componentShowcase = content.componentDetails
    .filter((c, i, arr) => arr.findIndex(x => x.type === c.type) === i) // unique types
    .map(c => {
      const descriptions = {
        'hero': `HERO SECTION — Full-viewport opening with course title "${content.title}", subtitle, dramatic background, scroll indicator`,
        'text': `TEXT BLOCK — Clean prose section with heading and body paragraphs`,
        'accordion': `ACCORDION — Expandable panels with smooth open/close animation, chevron icons, completion tracking`,
        'graphic-text': `GRAPHIC + TEXT — Side-by-side layout with image on one side and content on the other`,
        'stat-callout': `STAT CALLOUT — Large animated numbers with descriptive labels below (key metrics/figures)`,
        'bento': `BENTO GRID — Multi-card grid layout with image backgrounds, hover lift effects`,
        'comparison': `COMPARISON TABLE — Feature comparison with check/cross indicators across columns`,
        'mcq': `QUIZ COMPONENT — Multiple choice question with selectable answer cards, submit button, feedback state`,
        'checklist': `CHECKLIST — Checkable items with animated progress bar tracking completion percentage`,
        'pullquote': `PULL QUOTE — Emphasized key message with thick accent bar and attribution`,
        'key-term': `KEY TERMS — Vocabulary/glossary cards with icon, term heading, and definition`,
        'timeline': `TIMELINE — Vertical numbered steps with gradient connecting line between nodes`,
        'process-flow': `PROCESS FLOW — Connected workflow nodes with directional arrows between stages`,
        'tabs': `TAB PANEL — Horizontal pill-style tab buttons switching between content panels`,
        'narrative': `NARRATIVE SLIDER — Carousel with prev/next navigation buttons and progress dots`,
        'flashcard': `FLASHCARDS — 3D flip cards showing question on front, answer on back, arranged in a grid`,
        'full-bleed': `FULL-BLEED IMAGE — Edge-to-edge image with gradient overlay and centered text`,
        'textinput': `TEXT INPUT FORM — Labeled input fields with styled borders and submit button`,
      };
      return `• ${descriptions[c.type] || `${c.type.toUpperCase()} — ${c.title}`}`;
    })
    .join('\n');

  return `You are designing a premium e-learning experience. Create a COMPLETE component style guide page showing every component type listed below, fully designed and styled.

COURSE CONTEXT:
- Title: "${content.title}"
- Domain: ${content.domain}
- Topics covered: ${content.sceneTopics.join(', ')}
- Mood: ${content.mood}
- This is a ${content.totalComponents}-component deep-scroll learning experience

BRAND IDENTITY (from client's website — use these EXACT colors):
- Primary: ${brand.primary}
- Secondary: ${brand.secondary}
- Accent: ${brand.accent}
- Background: ${brand.background} (${themeMode} theme)
- Text: ${brand.text}
- Heading font: ${brand.font}
- Body font: ${brand.bodyFont}

DESIGN DIRECTION:
- ${themeMode === 'dark' ? 'Dark, immersive interface with glass-morphism effects, subtle neon glows, and layered translucent surfaces' : 'Clean, bright interface with subtle shadows, crisp borders, and clear visual hierarchy'}
- Premium feel — this should look like a $50,000 custom-built learning platform
- Every component should feel native to the ${content.domain} domain
- Primary color for headings and CTAs, secondary for accents/highlights, accent for interactive elements
- Cards must have DEPTH: layered glass effects, inner shadows, border glows
- Strong typography hierarchy: extra-large bold headings, comfortable body text
- Generous whitespace between all sections
- Show hover states and interactive affordances

COMPONENTS TO DESIGN (show ALL of these with realistic "${content.title}" content):

${componentShowcase}

CRITICAL REQUIREMENTS:
- Use REAL example content from "${content.title}" — NOT placeholder text
- Each component must be VISUALLY DISTINCT but share the same design language
- Show the FULL component with all sub-elements (icons, buttons, states)
- Page scrolls vertically showing all ${content.componentTypes.length} components in sequence
- Use Material Symbols icons throughout for UI elements
- This is the DESIGN REFERENCE that developers will implement — make it pixel-perfect`;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load inputs
  const brandProfile = JSON.parse(readFileSync(join(ROOT, 'v3/output/brand-profile.json'), 'utf8'));
  const courseLayout = JSON.parse(readFileSync(join(ROOT, 'v3/output/course-layout.json'), 'utf8'));
  const contentBucket = JSON.parse(readFileSync(join(ROOT, 'v3/output/content-bucket.json'), 'utf8'));

  // Extract intelligence
  const brand = extractBrandAnchor(brandProfile);
  const content = extractContentIntelligence(contentBucket, courseLayout);

  console.log(`\n=== STITCH DESIGN DNA GENERATOR (v2 — Intelligent Prompt) ===\n`);
  console.log(`Course: ${content.title}`);
  console.log(`Domain: ${content.domain}`);
  console.log(`Mood: ${content.mood}`);
  console.log(`Topics: ${content.sceneTopics.join(', ')}`);
  console.log(`Theme: ${brand.isDark ? 'dark' : 'light'} (bg: ${brand.background})`);
  console.log(`Brand: ${brand.primary} / ${brand.secondary} / ${brand.accent}`);
  console.log(`Font: ${brand.font} / ${brand.bodyFont}`);
  console.log(`Components: ${content.componentTypes.join(', ')} (${content.totalComponents} total)\n`);

  // Build the prompt
  const prompt = buildStitchPrompt(brand, content);
  console.log(`Prompt length: ${prompt.length} chars`);
  writeFileSync(join(OUTPUT_DIR, 'stitch-prompt.txt'), prompt);

  // Call Stitch
  console.log('\n─── Calling Stitch (may take 1-3 minutes)... ───\n');

  const client = new StitchToolClient({ apiKey: API_KEY, timeout: 300000 });

  const project = await client.callTool('create_project', {
    title: `${content.title} — Design DNA v2`,
  });
  const projectId = project.name?.replace('projects/', '') || project.projectId;
  console.log(`Project created: ${projectId}`);

  const result = await client.callTool('generate_screen_from_text', {
    projectId,
    prompt,
    deviceType: 'DESKTOP',
    modelId: 'GEMINI_3_FLASH',
  });

  writeFileSync(join(OUTPUT_DIR, 'design-dna-meta.json'), JSON.stringify(result, null, 2));
  console.log('Saved: design-dna-meta.json');

  // Extract HTML + screenshot
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
            writeFileSync(join(OUTPUT_DIR, 'design-dna-raw.html'), html);
            console.log(`Saved: design-dna-raw.html (${html.length} chars)`);
            htmlSaved = true;
          }
          if (screen.screenshot?.downloadUrl && !screenshotSaved) {
            console.log('Downloading screenshot...');
            const resp = await fetch(screen.screenshot.downloadUrl);
            const buffer = Buffer.from(await resp.arrayBuffer());
            writeFileSync(join(OUTPUT_DIR, 'design-dna-screenshot.png'), buffer);
            console.log(`Saved: design-dna-screenshot.png (${buffer.length} bytes)`);
            screenshotSaved = true;
          }
        }
      }
    }
  }

  await client.close();

  console.log('\n✓ Design DNA generation complete');
  console.log(`  Prompt:     v3/output/stitch-prompt.txt`);
  console.log(`  HTML:       v3/output/design-dna-raw.html`);
  console.log(`  Screenshot: v3/output/design-dna-screenshot.png`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
