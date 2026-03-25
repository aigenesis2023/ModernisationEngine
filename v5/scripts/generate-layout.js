#!/usr/bin/env node
/**
 * V5 Generate Layout — AI-First Course Generation
 *
 * Takes a knowledge base + brand profile and generates course-layout.json
 * using a Claude Code subagent. Content generation and component selection
 * happen in ONE pass — content is born shaped for its component.
 *
 * Modes:
 *   - Subagent mode (default): writes prompt, subagent generates course-layout.json
 *   - Load mode (--load):      loads pre-generated course-layout.json, validates it
 *
 * Usage:
 *   node v5/scripts/generate-layout.js
 *   node v5/scripts/generate-layout.js --load v5/output/course-layout.json
 */

const fs = require('fs');
const path = require('path');

// ─── Paths ───────────────────────────────────────────────────────────
const PROMPT_PATH = path.resolve('v5/prompts/generation-engine.md');
const AGENT_TASK_PATH = path.resolve('v5/prompts/generation-agent.md');
const COMPONENT_LIB_PATH = path.resolve('v5/schemas/component-library.json');
const KB_PATH = path.resolve('v5/output/knowledge-base.json');
const BRAND_PATH = path.resolve('v5/output/brand-profile.json');
const SCHEMA_PATH = path.resolve('v5/schemas/course-layout.schema.json');
const OUTPUT_PATH = path.resolve('v5/output/course-layout.json');
const ASSEMBLED_PROMPT_PATH = path.resolve('v5/output/generation-prompt.txt');

// ─── Validate the layout JSON ────────────────────────────────────────
function validateLayout(layout) {
  const errors = [];

  if (!layout.course?.title) errors.push('Missing course.title');
  if (!layout.sections || !Array.isArray(layout.sections)) errors.push('Missing sections array');
  if (layout.sections?.length < 2) errors.push('Need at least 2 sections');

  const componentIds = new Set();
  const sectionIds = new Set();
  let totalComponents = 0;
  let totalImages = 0;
  const typesUsed = new Set();

  const validTypes = [
    'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
    'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
    'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
    'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
    'image-gallery', 'full-bleed', 'video-transcript', 'path-selector',
  ];

  for (const section of (layout.sections || [])) {
    if (!section.sectionId) errors.push('Section missing sectionId');
    if (sectionIds.has(section.sectionId)) errors.push(`Duplicate sectionId: ${section.sectionId}`);
    sectionIds.add(section.sectionId);

    let prevType = null;
    for (const comp of (section.components || [])) {
      totalComponents++;

      if (!comp.componentId) errors.push('Component missing componentId');
      if (componentIds.has(comp.componentId)) errors.push(`Duplicate componentId: ${comp.componentId}`);
      componentIds.add(comp.componentId);

      if (!comp.type) errors.push(`Component ${comp.componentId} missing type`);
      if (comp.type && !validTypes.includes(comp.type)) {
        errors.push(`Unknown component type: ${comp.type}`);
      }

      if (comp.type) typesUsed.add(comp.type);

      // Check consecutive same types
      if (comp.type === prevType) {
        errors.push(`Consecutive same type "${comp.type}" in section ${section.sectionId}`);
      }
      prevType = comp.type;

      if (comp.imagePrompt) totalImages++;
      if (comp.imagePrompts) totalImages += comp.imagePrompts.length;
    }
  }

  // Check hero exists as first component
  const firstComp = layout.sections?.[0]?.components?.[0];
  if (firstComp?.type !== 'hero') {
    errors.push('First component must be type "hero"');
  }

  // Check component variety
  if (typesUsed.size < 8) {
    errors.push(`Only ${typesUsed.size} different component types used — aim for 15+`);
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      totalComponents,
      totalImages,
      sections: layout.sections?.length || 0,
      typesUsed: typesUsed.size,
      typeList: [...typesUsed].sort(),
    },
  };
}

// ─── Assemble the subagent prompt ────────────────────────────────────
function assemblePrompt() {
  // System prompt
  if (!fs.existsSync(PROMPT_PATH)) {
    throw new Error('generation-engine.md not found. Run from repo root.');
  }
  const systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');

  // Component library
  if (!fs.existsSync(COMPONENT_LIB_PATH)) {
    throw new Error('component-library.json not found.');
  }
  const componentLib = fs.readFileSync(COMPONENT_LIB_PATH, 'utf-8');

  // Knowledge base
  if (!fs.existsSync(KB_PATH)) {
    throw new Error('knowledge-base.json not found. Run research-content.js first.');
  }
  const knowledgeBase = fs.readFileSync(KB_PATH, 'utf-8');

  // Brand profile
  if (!fs.existsSync(BRAND_PATH)) {
    throw new Error('brand-profile.json not found. Run scrape-brand.js first.');
  }
  const brandProfile = fs.readFileSync(BRAND_PATH, 'utf-8');

  // Output schema
  const schema = fs.existsSync(SCHEMA_PATH)
    ? fs.readFileSync(SCHEMA_PATH, 'utf-8')
    : '';

  const userMessage = `## Your Task

Design and write a complete course from the following knowledge base. Read ALL the research carefully, then create a premium deep-scroll web learning experience using the component library.

**Remember: content and component are one thought. Write content shaped for the component you chose.**

---

## Knowledge Base (from research)

\`\`\`json
${knowledgeBase}
\`\`\`

---

## Brand Profile (from brand URL)

\`\`\`json
${brandProfile}
\`\`\`

---

## Component Library Reference

\`\`\`json
${componentLib}
\`\`\`

---

## Output Schema

Your response must be a single JSON object matching this schema:

\`\`\`json
${schema}
\`\`\`

---

## Instructions

1. Read all learning objectives and content areas
2. Design 5-12 sections that build understanding progressively
3. For each piece of content, choose the best component AND write content shaped for it
4. Use statistics from the knowledge base as stat-callout components
5. Use terminology as key-term components
6. Include ALL quiz ideas as MCQ components with feedback
7. Write imagePrompt for every component that shows an image
8. Include brand colors in image prompts
9. Follow ALL design rules from the system prompt
10. Output ONLY valid JSON — no markdown fences, no explanation text

**Respond with the complete course-layout JSON object only.**`;

  return { systemPrompt, userMessage };
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const loadIndex = args.indexOf('--load');
  const loadFile = loadIndex !== -1 ? args[loadIndex + 1] : null;

  console.log('\n🎨 Generate Layout — AI-First Course Generation\n');

  // ── Load mode ──
  if (loadFile) {
    const filePath = path.resolve(loadFile);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: file not found: ${filePath}`);
      process.exit(1);
    }

    let layout;
    try {
      layout = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error(`Error parsing JSON: ${err.message}`);
      process.exit(1);
    }

    console.log('Validating layout...');
    const validation = validateLayout(layout);
    printValidation(validation);

    // Add/update metadata
    layout.metadata = {
      ...layout.metadata,
      generatedAt: layout.metadata?.generatedAt || new Date().toISOString(),
      sourceType: 'ai-generated',
      componentCount: validation.stats.totalComponents,
      imageCount: validation.stats.totalImages,
    };

    // Copy to output path if loading from elsewhere
    if (filePath !== OUTPUT_PATH) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(layout, null, 2));
      console.log(`\nCopied to: ${OUTPUT_PATH}`);
    } else {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(layout, null, 2));
    }

    console.log('\nDone. Next steps:');
    console.log('  node v5/scripts/generate-course-html.js    # Stitch component kit');
    console.log('  node v5/scripts/generate-images.js          # Generate images');
    console.log('  node v5/scripts/build-course.js              # Build final HTML');
    return;
  }

  // ── Subagent mode ──
  console.log('Assembling prompt...');
  const { systemPrompt, userMessage } = assemblePrompt();
  console.log(`  System prompt: ${systemPrompt.length} chars`);
  console.log(`  User message: ${userMessage.length} chars`);

  // Write assembled prompt to file
  const fullPrompt = `=== SYSTEM PROMPT ===\n\n${systemPrompt}\n\n=== USER MESSAGE ===\n\n${userMessage}`;
  fs.writeFileSync(ASSEMBLED_PROMPT_PATH, fullPrompt);
  console.log(`  Written to: ${ASSEMBLED_PROMPT_PATH}`);

  // Read and display agent task prompt
  let agentTask = '';
  if (fs.existsSync(AGENT_TASK_PATH)) {
    agentTask = fs.readFileSync(AGENT_TASK_PATH, 'utf-8');
  }

  // Display subagent instructions
  console.log('\n' + '='.repeat(70));
  console.log('SUBAGENT MODE');
  console.log('='.repeat(70));
  console.log(`
Agent task prompt:  ${AGENT_TASK_PATH}
System prompt:      ${PROMPT_PATH}

Spawn a subagent (Agent tool) with the task from:
  ${AGENT_TASK_PATH}

After the subagent finishes, validate with:
  node v5/scripts/generate-layout.js --load v5/output/course-layout.json

Then continue with:
  node v5/scripts/generate-course-html.js
  node v5/scripts/generate-images.js
  node v5/scripts/build-course.js
`);
  console.log('='.repeat(70));
}

function printValidation(validation) {
  if (validation.errors.length > 0) {
    console.log(`\n  Warnings/errors (${validation.errors.length}):`);
    for (const err of validation.errors) {
      console.log(`    ⚠ ${err}`);
    }
  }

  console.log('\n  Stats:');
  console.log(`    Sections:        ${validation.stats.sections}`);
  console.log(`    Components:      ${validation.stats.totalComponents}`);
  console.log(`    Image prompts:   ${validation.stats.totalImages}`);
  console.log(`    Component types: ${validation.stats.typesUsed} (${validation.stats.typeList.join(', ')})`);

  if (validation.valid) {
    console.log('\n  Validation: PASSED');
  } else {
    console.log('\n  Validation: PASSED WITH WARNINGS (see above)');
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
