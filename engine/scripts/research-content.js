#!/usr/bin/env node
/**
 * V5 Research Content — Knowledge Base Assembly
 *
 * Gathers structured knowledge for AI-first course generation.
 * Uses a Claude Code subagent with web search to research topics,
 * producing a knowledge-base.json that feeds into generate-layout.js.
 *
 * Modes:
 *   - Subagent mode (default): writes prompt, subagent does research + writes output
 *   - Load mode (--load):      loads pre-generated knowledge-base.json
 *
 * Usage:
 *   node engine/scripts/research-content.js --topic "Introduction to Cybersecurity"
 *   node engine/scripts/research-content.js --topic "EV Safety" --urls https://example.com
 *   node engine/scripts/research-content.js --load engine/output/knowledge-base.json
 *
 * Input sources:
 *   --topic "..."           Topic brief (required unless --load)
 *   --urls url1,url2        Additional URLs to incorporate (optional)
 *   engine/input/topic-brief.txt   Fallback topic source (plain text)
 *   engine/input/urls.txt          Fallback URLs source (one per line)
 */

const fs = require('fs');
const path = require('path');

// ─── Paths ───────────────────────────────────────────────────────────
const SCHEMA_PATH = path.resolve('engine/schemas/knowledge-base.schema.json');
const OUTPUT_PATH = path.resolve('engine/output/knowledge-base.json');
const PROMPT_TEMPLATE_PATH = path.resolve('engine/prompts/research-agent.md');
const ASSEMBLED_PROMPT_PATH = path.resolve('engine/output/research-prompt.txt');
const TOPIC_FILE = path.resolve('engine/input/topic-brief.txt');
const URLS_FILE = path.resolve('engine/input/urls.txt');

// ─── Parse CLI arguments ─────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let topic = null;
  let urls = [];
  let loadFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1]) {
      topic = args[++i];
    } else if (args[i] === '--urls' && args[i + 1]) {
      urls = args[++i].split(',').map(u => u.trim()).filter(Boolean);
    } else if (args[i] === '--load' && args[i + 1]) {
      loadFile = args[++i];
    }
  }

  // Fallback to files if no CLI args
  if (!topic && !loadFile && fs.existsSync(TOPIC_FILE)) {
    topic = fs.readFileSync(TOPIC_FILE, 'utf-8').trim();
    console.log(`  Topic from file: ${TOPIC_FILE}`);
  }

  if (urls.length === 0 && fs.existsSync(URLS_FILE)) {
    urls = fs.readFileSync(URLS_FILE, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'));
    if (urls.length > 0) {
      console.log(`  URLs from file: ${URLS_FILE} (${urls.length} URLs)`);
    }
  }

  return { topic, urls, loadFile };
}

// ─── Validate knowledge base output ──────────────────────────────────
function validateKnowledgeBase(kb) {
  const errors = [];

  if (!kb.topic?.title) errors.push('Missing topic.title');
  if (!kb.topic?.brief) errors.push('Missing topic.brief');
  if (!kb.learningObjectives || kb.learningObjectives.length < 2) {
    errors.push('Need at least 2 learning objectives');
  }
  if (!kb.contentAreas || kb.contentAreas.length < 2) {
    errors.push('Need at least 2 content areas');
  }

  let totalKeyPoints = 0;
  let totalTeachableMoments = 0;
  let totalCitations = 0;
  const momentTypes = {};

  for (const area of (kb.contentAreas || [])) {
    if (!area.title) errors.push('Content area missing title');
    if (!area.keyPoints?.length) errors.push(`Content area "${area.title}" has no key points`);

    for (const kp of (area.keyPoints || [])) {
      totalKeyPoints++;
      if (kp.citation) totalCitations++;
    }

    for (const tm of (area.teachableMoments || [])) {
      totalTeachableMoments++;
      if (tm.type) {
        momentTypes[tm.type] = (momentTypes[tm.type] || 0) + 1;
      }
      if (!tm.hook) errors.push(`Teachable moment in "${area.title}" missing hook`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      contentAreas: (kb.contentAreas || []).length,
      learningObjectives: (kb.learningObjectives || []).length,
      keyPoints: totalKeyPoints,
      teachableMoments: totalTeachableMoments,
      momentTypes,
      citations: totalCitations,
      sources: (kb.sources || []).length,
    },
  };
}

// ─── Build the subagent prompt from template ────────────────────────
function buildResearchPrompt(topic, urls) {
  if (!fs.existsSync(PROMPT_TEMPLATE_PATH)) {
    throw new Error('research-agent.md not found. Run from repo root.');
  }

  let prompt = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf-8');

  // Replace template variables
  prompt = prompt.replace('{{TOPIC}}', topic);

  const urlSection = urls.length > 0
    ? `**Additional URLs to incorporate:**\n${urls.map(u => `- ${u}`).join('\n')}\n\nFor each URL, extract key learning points, facts, and terminology. Incorporate them into the appropriate content areas.`
    : '';
  prompt = prompt.replace('{{URL_SECTION}}', urlSection);

  return prompt;
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔬 Research Content — Knowledge Base Assembly\n');

  const { topic, urls, loadFile } = parseArgs();

  // ── Load mode ──
  if (loadFile) {
    const filePath = path.resolve(loadFile);
    if (!fs.existsSync(filePath)) {
      console.error(`Error: file not found: ${filePath}`);
      process.exit(1);
    }

    let kb;
    try {
      kb = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (err) {
      console.error(`Error parsing JSON: ${err.message}`);
      process.exit(1);
    }

    const validation = validateKnowledgeBase(kb);
    printValidation(validation);

    // Copy to output path if loading from elsewhere
    if (filePath !== OUTPUT_PATH) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(kb, null, 2));
      console.log(`\nCopied to: ${OUTPUT_PATH}`);
    }

    console.log('\nDone. Next: node engine/scripts/generate-layout.js');
    return;
  }

  // ── Subagent mode ──
  if (!topic) {
    console.error('Error: No topic provided.');
    console.error('Usage:');
    console.error('  node engine/scripts/research-content.js --topic "Your Topic Here"');
    console.error('  node engine/scripts/research-content.js --load engine/output/knowledge-base.json');
    console.error('\nOr create: engine/input/topic-brief.txt');
    process.exit(1);
  }

  console.log(`  Topic: ${topic}`);
  if (urls.length > 0) {
    console.log(`  URLs: ${urls.length}`);
    urls.forEach(u => console.log(`    - ${u}`));
  }

  // Build and save the assembled research prompt
  const prompt = buildResearchPrompt(topic, urls);
  fs.writeFileSync(ASSEMBLED_PROMPT_PATH, prompt);
  console.log(`\n  Prompt template: ${PROMPT_TEMPLATE_PATH}`);
  console.log(`  Assembled prompt: ${ASSEMBLED_PROMPT_PATH}`);

  // Display subagent instructions
  console.log('\n' + '='.repeat(70));
  console.log('SUBAGENT MODE');
  console.log('='.repeat(70));
  console.log(`
Spawn a subagent (Agent tool) with this task:

${prompt}

The subagent will:
1. Use web search to research the topic
2. Read the schema at engine/schemas/knowledge-base.schema.json
3. Write structured output to engine/output/knowledge-base.json

After the subagent finishes, validate with:
  node engine/scripts/research-content.js --load engine/output/knowledge-base.json

Then continue with:
  node engine/scripts/generate-layout.js
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
  console.log(`    Content areas:         ${validation.stats.contentAreas}`);
  console.log(`    Learning objectives:   ${validation.stats.learningObjectives}`);
  console.log(`    Key points:            ${validation.stats.keyPoints}`);
  console.log(`    Teachable moments:     ${validation.stats.teachableMoments}`);
  if (Object.keys(validation.stats.momentTypes).length > 0) {
    console.log(`    Moment types:`);
    for (const [type, count] of Object.entries(validation.stats.momentTypes)) {
      console.log(`      ${type}: ${count}`);
    }
  }
  console.log(`    Citations:             ${validation.stats.citations}`);
  console.log(`    Sources:               ${validation.stats.sources}`);

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
