/**
 * Visual Media Agent — Decides per-component: HF photo vs Stitch illustration vs none
 *
 * Analyzes course-layout.json and produces a media plan that tells
 * generate-images.js (HF) and generate-stitch-illustrations.js (Stitch)
 * which components to handle.
 *
 * Decision logic:
 * - Components with no visual need → "none"
 * - Tangible real-world subjects (vehicles, equipment, places) → "photo" (HF)
 * - Conceptual/abstract subjects (processes, diagrams, comparisons) → "illustration" (Stitch)
 * - Hero/full-bleed backgrounds → always "photo" (atmosphere matters)
 *
 * Input:  v3/output/course-layout.json
 * Output: v3/output/media-plan.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Component types that never need images
const NO_IMAGE_TYPES = new Set([
  'text', 'accordion', 'mcq', 'textinput', 'checklist',
  'tabs', 'narrative', 'pullquote', 'data-table', 'branching'
]);

// Component types that always use photos (real-world atmosphere)
const ALWAYS_PHOTO_TYPES = new Set([
  'hero', 'full-bleed', 'media', 'video-transcript', 'image-gallery'
]);

// Component types where illustration could enhance but isn't required
const ILLUSTRATION_CANDIDATE_TYPES = new Set([
  'timeline', 'process-flow', 'stat-callout', 'comparison',
  'key-term', 'flashcard'
]);

// Keywords in content that suggest conceptual/abstract (→ illustration)
const CONCEPTUAL_KEYWORDS = [
  'diagram', 'concept', 'process', 'flow', 'cycle', 'relationship',
  'comparison', 'abstract', 'principle', 'theory', 'mechanism',
  'how it works', 'framework', 'model', 'structure', 'anatomy',
  'illustration', 'infographic', 'overview', 'system'
];

// Keywords in content that suggest tangible/real (→ photo)
const TANGIBLE_KEYWORDS = [
  'vehicle', 'car', 'workshop', 'equipment', 'cable', 'battery',
  'charger', 'charging', 'engine', 'motor', 'gloves', 'sign',
  'workplace', 'station', 'port', 'connector', 'tool', 'hook',
  'person', 'worker', 'technician', 'facility', 'laboratory'
];

function analyzeContent(component) {
  // Combine all text content for keyword analysis
  const text = [
    component.displayTitle || '',
    component.body || '',
    component.imagePrompt || '',
    component._graphic?.alt || ''
  ].join(' ').toLowerCase();

  let conceptualScore = 0;
  let tangibleScore = 0;

  for (const kw of CONCEPTUAL_KEYWORDS) {
    if (text.includes(kw)) conceptualScore++;
  }
  for (const kw of TANGIBLE_KEYWORDS) {
    if (text.includes(kw)) tangibleScore++;
  }

  return { conceptualScore, tangibleScore, text };
}

function decideMediaType(component) {
  const type = component.type;

  // No image needed for these types
  if (NO_IMAGE_TYPES.has(type)) {
    // Exception: if the component already has an imagePrompt, respect it
    if (!component.imagePrompt && !component.imagePrompts) {
      return { decision: 'none', reason: `${type} components don't need images` };
    }
  }

  // Always photo for atmospheric/background types
  if (ALWAYS_PHOTO_TYPES.has(type)) {
    return { decision: 'photo', reason: `${type} needs real-world atmospheric imagery` };
  }

  // For graphic-text: analyze whether content is conceptual or tangible
  if (type === 'graphic-text' || type === 'graphic') {
    const { conceptualScore, tangibleScore } = analyzeContent(component);

    if (conceptualScore > tangibleScore && conceptualScore >= 2) {
      return {
        decision: 'illustration',
        reason: `Content is conceptual (score: ${conceptualScore} vs ${tangibleScore} tangible)`
      };
    }
    return {
      decision: 'photo',
      reason: `Content is tangible/real-world (score: ${tangibleScore} vs ${conceptualScore} conceptual)`
    };
  }

  // For bento: items typically show real things
  if (type === 'bento') {
    const { conceptualScore, tangibleScore } = analyzeContent(component);
    if (conceptualScore > tangibleScore + 2) {
      return { decision: 'illustration', reason: 'Bento content is primarily conceptual' };
    }
    return { decision: 'photo', reason: 'Bento items represent tangible categories' };
  }

  // Illustration candidates — these component types benefit from diagrams
  if (ILLUSTRATION_CANDIDATE_TYPES.has(type)) {
    return {
      decision: 'illustration',
      reason: `${type} benefits from a styled diagram/illustration`
    };
  }

  // Labeled image always needs a real image
  if (type === 'labeled-image') {
    return { decision: 'photo', reason: 'Labeled images need real reference photos' };
  }

  // Default: if it has an imagePrompt, use photo
  if (component.imagePrompt || component.imagePrompts) {
    return { decision: 'photo', reason: 'Has imagePrompt, defaulting to photo' };
  }

  return { decision: 'none', reason: 'No image needed' };
}

function generateIllustrationPrompt(component, brandProfile) {
  const brand = brandProfile || {};
  const colors = brand.colors || {};
  const style = brand.style || {};

  const brandContext = [
    colors.primary ? `primary color ${colors.primary}` : '',
    colors.secondary ? `secondary color ${colors.secondary}` : '',
    colors.accent ? `accent color ${colors.accent}` : '',
    colors.background ? `on ${colors.background} background` : '',
    style.mood ? `${style.mood} mood` : '',
    style.cardStyle ? `${style.cardStyle} card style` : ''
  ].filter(Boolean).join(', ');

  const type = component.type;
  const title = component.displayTitle || '';
  const body = (component.body || '').replace(/<[^>]+>/g, '').slice(0, 200);

  // Build type-specific illustration prompts
  const prompts = {
    'timeline': `Design a vertical timeline infographic for "${title}". Show ${component._items?.length || 3} connected steps with numbered nodes and flowing lines. Content: ${body}. Style: ${brandContext}, clean modern design, no text labels, abstract geometric.`,

    'process-flow': `Design a process flow diagram for "${title}". Show ${component._nodes?.length || 4} connected stages with directional arrows between nodes. Content: ${body}. Style: ${brandContext}, technical but elegant, glowing connection lines, modern UI.`,

    'stat-callout': `Design a statistics dashboard panel showing ${component._items?.length || 3} large metric displays. Topic: "${title}". Style: ${brandContext}, data visualization aesthetic, clean typography, gradient accents, modern dark UI.`,

    'comparison': `Design a comparison infographic with ${component.columns?.length || 2} columns. Topic: "${title}". Style: ${brandContext}, clean grid layout, check/cross indicators, modern data presentation.`,

    'key-term': `Design a glossary/vocabulary card layout for "${title}" with ${component._items?.length || 3} term-definition pairs. Style: ${brandContext}, educational reference design, icon accents, clean typography.`,

    'flashcard': `Design a set of flip card illustrations for "${title}". Show ${component._items?.length || 3} cards in a grid. Style: ${brandContext}, 3D depth effect, question/answer visual metaphor, modern learning design.`,

    'graphic-text': `Design an educational illustration for "${title}". Content: ${body}. Style: ${brandContext}, conceptual diagram, clean modern infographic, abstract geometric representation, educational.`,

    'graphic': `Design an educational infographic for "${title}". Content: ${body}. Style: ${brandContext}, data-driven visualization, clean modern design.`
  };

  return prompts[type] || `Design an illustration for "${title}". ${body}. Style: ${brandContext}, modern educational design.`;
}

// --- Main ---
function main() {
  const layoutPath = join(ROOT, 'v3/output/course-layout.json');
  const brandPath = join(ROOT, 'v3/output/brand-profile.json');
  const outputDir = join(ROOT, 'v3/output');

  const layout = JSON.parse(readFileSync(layoutPath, 'utf8'));
  const brand = JSON.parse(readFileSync(brandPath, 'utf8'));

  mkdirSync(outputDir, { recursive: true });

  const mediaPlan = {
    courseTitle: layout.course.title,
    generatedAt: new Date().toISOString(),
    summary: { photos: 0, illustrations: 0, none: 0, total: 0 },
    components: []
  };

  for (const section of layout.sections) {
    for (const comp of section.components) {
      const { decision, reason } = decideMediaType(comp);

      const entry = {
        componentId: comp.componentId,
        type: comp.type,
        displayTitle: comp.displayTitle || '',
        sectionTitle: section.title || '',
        mediaType: decision,
        reason
      };

      if (decision === 'photo') {
        entry.imagePrompt = comp.imagePrompt || null;
        entry.imagePrompts = comp.imagePrompts || null;
        mediaPlan.summary.photos++;
      } else if (decision === 'illustration') {
        entry.illustrationPrompt = generateIllustrationPrompt(comp, brand);
        mediaPlan.summary.illustrations++;
      } else {
        mediaPlan.summary.none++;
      }

      mediaPlan.summary.total++;
      mediaPlan.components.push(entry);
    }
  }

  const outputPath = join(outputDir, 'media-plan.json');
  writeFileSync(outputPath, JSON.stringify(mediaPlan, null, 2));

  // Print summary
  console.log('\n=== VISUAL MEDIA PLAN ===\n');
  console.log(`Course: ${mediaPlan.courseTitle}`);
  console.log(`Total components: ${mediaPlan.summary.total}`);
  console.log(`  Photos (HF):        ${mediaPlan.summary.photos}`);
  console.log(`  Illustrations (Stitch): ${mediaPlan.summary.illustrations}`);
  console.log(`  No image needed:    ${mediaPlan.summary.none}\n`);

  console.log('─'.repeat(80));
  console.log('Component'.padEnd(20) + 'Type'.padEnd(16) + 'Decision'.padEnd(16) + 'Reason');
  console.log('─'.repeat(80));

  for (const c of mediaPlan.components) {
    const name = (c.displayTitle || c.componentId).slice(0, 18).padEnd(20);
    const type = c.type.padEnd(16);
    const dec = c.mediaType.padEnd(16);
    console.log(`${name}${type}${dec}${c.reason}`);
  }

  console.log('\n─'.repeat(80));
  console.log(`\nSaved to: ${outputPath}`);
}

main();
