#!/usr/bin/env node
/**
 * V2 Design Course — AI Layout Engine Script
 *
 * Orchestrates the AI layout step of the pipeline.
 * Reads the system prompt, content bucket, and brand profile,
 * assembles the full LLM message, then either:
 *   - Manual mode (--manual): writes prompt to file for human paste into Claude Code
 *   - API mode (ANTHROPIC_API_KEY): calls Claude API directly
 *
 * The output is identical in both modes: validated course-layout.json.
 *
 * Usage:
 *   node v2/scripts/design-course.js --manual          # Write prompt, wait for paste
 *   ANTHROPIC_API_KEY=sk-... node v2/scripts/design-course.js  # Call API directly
 *   node v2/scripts/design-course.js --load response.json      # Load a saved response
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─── Paths ───────────────────────────────────────────────────────────
const PROMPT_PATH = path.resolve('v2/prompts/layout-engine.md');
const COMPONENT_LIB_PATH = path.resolve('v2/schemas/component-library.json');
const CONTENT_PATH = path.resolve('v2/output/content-bucket.json');
const BRAND_PATH = path.resolve('v2/output/brand-profile.json');
const SCHEMA_PATH = path.resolve('v2/schemas/course-layout.schema.json');
const OUTPUT_PATH = path.resolve('v2/output/course-layout.json');
const ASSEMBLED_PROMPT_PATH = path.resolve('v2/output/design-prompt.txt');

// ─── Assemble the full prompt ────────────────────────────────────────
function assemblePrompt() {
  // System prompt
  if (!fs.existsSync(PROMPT_PATH)) {
    throw new Error('layout-engine.md not found. Run from repo root.');
  }
  const systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf-8');

  // Component library (embedded in user message for reference)
  if (!fs.existsSync(COMPONENT_LIB_PATH)) {
    throw new Error('component-library.json not found.');
  }
  const componentLib = fs.readFileSync(COMPONENT_LIB_PATH, 'utf-8');

  // Content bucket
  if (!fs.existsSync(CONTENT_PATH)) {
    throw new Error('content-bucket.json not found. Run extract.js first.');
  }
  const contentBucket = fs.readFileSync(CONTENT_PATH, 'utf-8');

  // Brand profile
  if (!fs.existsSync(BRAND_PATH)) {
    throw new Error('brand-profile.json not found. Run scrape-brand.js first.');
  }
  const brandProfile = fs.readFileSync(BRAND_PATH, 'utf-8');

  // Output schema (for reference in the prompt)
  const schema = fs.existsSync(SCHEMA_PATH)
    ? fs.readFileSync(SCHEMA_PATH, 'utf-8')
    : '';

  const userMessage = `## Your Task

Design a complete course layout for the following content. Read ALL the content carefully, then create a premium deep-scroll web learning experience using the component library.

---

## Content Bucket (extracted from SCORM)

\`\`\`json
${contentBucket}
\`\`\`

---

## Brand Profile (extracted from brand URL)

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

1. Read all scenes and slides to understand the full educational arc
2. Design 5-12 sections that tell a coherent learning story
3. Choose the best component for each piece of content
4. Rewrite all text to be clean, modern, and scannable
5. Write imagePrompt for every component that shows an image
6. Include brand colors in image prompts
7. Follow ALL design rules from the system prompt
8. Output ONLY valid JSON — no markdown fences, no explanation text

**Respond with the complete course-layout JSON object only.**`;

  return { systemPrompt, userMessage };
}

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

  const validTypes = [
    'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
    'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
    'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
    'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
    'image-gallery', 'full-bleed', 'video-transcript',
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

  return {
    valid: errors.length === 0,
    errors,
    stats: { totalComponents, totalImages, sections: layout.sections?.length || 0 },
  };
}

// ─── Extract JSON from LLM response ─────────────────────────────────
function extractJson(response) {
  // Try parsing directly first
  try {
    return JSON.parse(response);
  } catch {}

  // Try extracting from markdown code fences
  const fenceMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]);
    } catch {}
  }

  // Try finding the first { ... } block
  const start = response.indexOf('{');
  const end = response.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(response.substring(start, end + 1));
    } catch {}
  }

  throw new Error('Could not extract valid JSON from LLM response');
}

// ─── API mode: call Claude ───────────────────────────────────────────
async function callClaudeAPI(systemPrompt, userMessage, apiKey) {
  console.log('Calling Claude API...');

  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300000), // 5 min timeout
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API error ${resp.status}: ${err}`);
  }

  const data = await resp.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty API response');

  console.log(`API response: ${text.length} chars`);
  return text;
}

// ─── Manual mode: read from stdin ────────────────────────────────────
async function readManualResponse() {
  console.log('\n' + '='.repeat(70));
  console.log('MANUAL MODE');
  console.log('='.repeat(70));
  console.log(`\nThe assembled prompt has been written to:\n  ${ASSEMBLED_PROMPT_PATH}\n`);
  console.log('Next steps:');
  console.log('  1. Open that file and copy its contents');
  console.log('  2. Paste into Claude Code (or any LLM chat)');
  console.log('  3. Copy the JSON response');
  console.log('  4. Either:');
  console.log('     a. Save it to a file and run: node v2/scripts/design-course.js --load <file>');
  console.log('     b. Paste it below (end with a line containing just "END")\n');
  console.log('Waiting for response (paste JSON then type END on a new line):');
  console.log('-'.repeat(70));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = [];

  return new Promise((resolve) => {
    rl.on('line', (line) => {
      if (line.trim() === 'END') {
        rl.close();
        resolve(lines.join('\n'));
      } else {
        lines.push(line);
      }
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isManual = args.includes('--manual');
  const loadIndex = args.indexOf('--load');
  const loadFile = loadIndex !== -1 ? args[loadIndex + 1] : null;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  console.log('\n🔧 Design Course — AI Layout Engine\n');

  // Step 1: Assemble prompt
  console.log('Assembling prompt...');
  const { systemPrompt, userMessage } = assemblePrompt();
  console.log(`  System prompt: ${systemPrompt.length} chars`);
  console.log(`  User message: ${userMessage.length} chars`);

  // Always write the assembled prompt to file (useful for debugging and manual mode)
  const fullPrompt = `=== SYSTEM PROMPT ===\n\n${systemPrompt}\n\n=== USER MESSAGE ===\n\n${userMessage}`;
  fs.writeFileSync(ASSEMBLED_PROMPT_PATH, fullPrompt);
  console.log(`  Written to: ${ASSEMBLED_PROMPT_PATH}`);

  // Step 2: Get LLM response
  let response;

  if (loadFile) {
    // Load from file
    const filePath = path.resolve(loadFile);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: file not found: ${filePath}`);
      process.exit(1);
    }
    response = fs.readFileSync(filePath, 'utf-8');
    console.log(`\nLoaded response from: ${filePath} (${response.length} chars)`);

  } else if (isManual) {
    // Manual mode: user pastes response
    response = await readManualResponse();

  } else if (apiKey) {
    // API mode: call Claude
    response = await callClaudeAPI(systemPrompt, userMessage, apiKey);

  } else {
    // No mode specified — default to manual
    console.log('\nNo API key found and --manual not specified.');
    console.log('Defaulting to manual mode.\n');
    console.log('Tip: Set ANTHROPIC_API_KEY env var for API mode, or use --manual.\n');
    response = await readManualResponse();
  }

  // Step 3: Extract and validate JSON
  console.log('\nExtracting JSON from response...');
  let layout;
  try {
    layout = extractJson(response);
    console.log('  JSON extracted successfully');
  } catch (err) {
    console.error(`  Error: ${err.message}`);
    // Save raw response for debugging
    const debugPath = path.resolve('v2/output/design-response-raw.txt');
    fs.writeFileSync(debugPath, response);
    console.error(`  Raw response saved to: ${debugPath}`);
    process.exit(1);
  }

  // Step 4: Validate
  console.log('\nValidating layout...');
  const validation = validateLayout(layout);

  if (validation.errors.length > 0) {
    console.log(`\n  Warnings/errors (${validation.errors.length}):`);
    for (const err of validation.errors) {
      console.log(`    ⚠ ${err}`);
    }
  }

  console.log(`\n  Stats:`);
  console.log(`    Sections: ${validation.stats.sections}`);
  console.log(`    Components: ${validation.stats.totalComponents}`);
  console.log(`    Image prompts: ${validation.stats.totalImages}`);

  // Step 5: Save
  // Add metadata
  layout.metadata = {
    ...layout.metadata,
    generatedAt: new Date().toISOString(),
    componentCount: validation.stats.totalComponents,
    imageCount: validation.stats.totalImages,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(layout, null, 2));
  console.log(`\nOutput: ${OUTPUT_PATH}`);

  if (validation.valid) {
    console.log('Validation: PASSED');
  } else {
    console.log('Validation: PASSED WITH WARNINGS (see above)');
  }

  console.log('\nNext steps:');
  console.log('  node v2/scripts/generate-images.js    # Generate images');
  console.log('  node v2/scripts/build-course.js        # Build final HTML');
  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
