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
const BRAND_DESIGN_PATH = path.resolve('v5/output/brand-design.md');
const SCHEMA_PATH = path.resolve('v5/schemas/course-layout.schema.json');
const OUTPUT_PATH = path.resolve('v5/output/course-layout.json');
const ASSEMBLED_PROMPT_PATH = path.resolve('v5/output/generation-prompt.txt');

// ─── Use shared validation ───────────────────────────────────────────
const { validateLayout } = require('./lib/validate-layout');

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

  // Brand design brief (natural language — for voice calibration)
  const brandDesign = fs.existsSync(BRAND_DESIGN_PATH)
    ? fs.readFileSync(BRAND_DESIGN_PATH, 'utf-8')
    : '';

  // Output schema
  const schema = fs.existsSync(SCHEMA_PATH)
    ? fs.readFileSync(SCHEMA_PATH, 'utf-8')
    : '';

  const userMessage = `## Your Task

Design and write a complete course from the following knowledge base. Read ALL the research carefully — especially the teachable moments. Then create a premium deep-scroll web learning experience that someone would WANT to scroll through.

**Read the brand brief FIRST to calibrate your writing voice. Then plan the emotional arc. Then design sections.**

---

## Brand Brief (from brand URL — USE THIS TO CALIBRATE YOUR VOICE)

${brandDesign || 'No brand brief available. Use a professional, modern tone.'}

---

## Brand Profile (metadata)

\`\`\`json
${brandProfile}
\`\`\`

---

## Knowledge Base (raw research — all facts, insights, teachable moments)

\`\`\`json
${knowledgeBase}
\`\`\`

---

## Component Library (your creative palette — read learningMoment and creativeUses)

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

1. Read the brand brief — infer voice (playful / corporate / technical / warm)
2. Read all content areas, key points, and teachable moments
3. Identify the 3-5 most compelling insights — these will anchor the course
4. Plan the emotional arc: Hook → Foundation → Challenge → Insight → Application
5. Plan the rhythm: which sections are breathers, standard, or deep dives
6. Design 5-12 sections — NO two adjacent sections should follow the same structural pattern
7. For each piece of content, choose the best component AND write content shaped for it
8. Create ALL assessments yourself — the knowledge base has raw facts, not pre-built quizzes
9. Write imagePrompt for every component that shows an image
10. Follow ALL design rules and anti-patterns from the system prompt
11. Output ONLY valid JSON — no markdown fences, no explanation text

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
