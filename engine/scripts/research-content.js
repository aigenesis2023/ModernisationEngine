#!/usr/bin/env node
/**
 * V5 Research Content — Knowledge Base Assembly
 *
 * Uses Tavily API to gather raw web content (search + extract), then passes
 * pre-gathered content to a Claude subagent for structuring. The subagent
 * does NOT perform web searches — Tavily handles all fetching, Claude handles
 * synthesis and structuring. This dramatically reduces token usage.
 *
 * Modes:
 *   - Research mode (default): Tavily gathers content → subagent structures it
 *   - Load mode (--load):      loads pre-generated knowledge-base.json
 *
 * Usage:
 *   node engine/scripts/research-content.js --topic "Introduction to Cybersecurity"
 *   node engine/scripts/research-content.js --topic "EV Safety" --urls https://example.com
 *   node engine/scripts/research-content.js --load engine/output/knowledge-base.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// ─── Paths ───────────────────────────────────────────────────────────
const SCHEMA_PATH       = path.resolve('engine/schemas/knowledge-base.schema.json');
const OUTPUT_PATH       = path.resolve('engine/output/knowledge-base.json');
const PROMPT_TEMPLATE   = path.resolve('engine/prompts/research-agent.md');
const ASSEMBLED_PROMPT  = path.resolve('engine/output/research-prompt.txt');
const TOPIC_FILE        = path.resolve('engine/input/topic-brief.txt');
const URLS_FILE         = path.resolve('engine/input/urls.txt');

const TAVILY_API_KEY    = process.env.TAVILY_API_KEY;

// ─── Parse CLI arguments ─────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let topic = null, urls = [], loadFile = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--topic' && args[i + 1])  topic    = args[++i];
    else if (args[i] === '--urls' && args[i + 1]) urls   = args[++i].split(',').map(u => u.trim()).filter(Boolean);
    else if (args[i] === '--load' && args[i + 1]) loadFile = args[++i];
  }

  if (!topic && !loadFile && fs.existsSync(TOPIC_FILE)) {
    topic = fs.readFileSync(TOPIC_FILE, 'utf-8').trim();
    console.log(`  Topic from file: ${TOPIC_FILE}`);
  }
  if (urls.length === 0 && fs.existsSync(URLS_FILE)) {
    urls = fs.readFileSync(URLS_FILE, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    if (urls.length > 0) console.log(`  URLs from file: ${URLS_FILE} (${urls.length} URLs)`);
  }

  return { topic, urls, loadFile };
}

// ─── Tavily API helpers ───────────────────────────────────────────────

function tavilyPost(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ...payload, api_key: TAVILY_API_KEY });
    const options = {
      hostname: 'api.tavily.com',
      path: `/${endpoint}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Tavily parse error: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Run a single Tavily search and return results */
async function tavilySearch(query, topic) {
  const result = await tavilyPost('search', {
    query,
    search_depth: 'advanced',
    max_results: 6,
    include_raw_content: 'markdown',
    time_range: 'year',
    topic: 'general',
  });
  return result.results || [];
}

/** Extract full content from user-provided URLs */
async function tavilyExtract(urls) {
  if (!urls.length) return [];
  const result = await tavilyPost('extract', {
    urls,
    extract_depth: 'advanced',
    format: 'markdown',
  });
  return result.results || [];
}

// ─── Build targeted search queries for a topic ────────────────────────
function buildSearchQueries(topic) {
  return [
    `${topic} overview key concepts fundamentals`,
    `${topic} statistics data facts research`,
    `${topic} real world examples case studies`,
    `${topic} common misconceptions myths vs reality`,
    `${topic} latest developments trends 2024 2025`,
    `${topic} practical applications how it works`,
  ];
}

// ─── Format gathered research as a readable block ─────────────────────
function formatResearchBundle(searchResults, extractResults, topic) {
  const lines = [];
  lines.push(`# Pre-Gathered Research: ${topic}`);
  lines.push(`# Collected via Tavily API — ${new Date().toISOString()}`);
  lines.push('');

  // Deduplicate by URL
  const seen = new Set();
  let sourceIndex = 1;

  lines.push('## Search Results\n');
  for (const result of searchResults) {
    if (seen.has(result.url)) continue;
    seen.add(result.url);

    lines.push(`### Source ${sourceIndex++}: ${result.title}`);
    lines.push(`URL: ${result.url}`);
    lines.push('');
    if (result.raw_content) {
      // Cap at ~3000 chars per source to keep prompt manageable
      const content = result.raw_content.slice(0, 3000);
      lines.push(content);
      if (result.raw_content.length > 3000) lines.push('[... content truncated ...]');
    } else if (result.content) {
      lines.push(result.content);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  if (extractResults.length > 0) {
    lines.push('## User-Provided URLs (Full Extract)\n');
    for (const result of extractResults) {
      if (seen.has(result.url)) continue;
      seen.add(result.url);

      lines.push(`### User URL: ${result.url}`);
      lines.push('');
      const content = (result.raw_content || '').slice(0, 5000);
      lines.push(content);
      if ((result.raw_content || '').length > 5000) lines.push('[... content truncated ...]');
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  const totalSources = seen.size;
  lines.push(`## Summary: ${totalSources} unique sources gathered`);

  return { content: lines.join('\n'), sources: [...seen] };
}

// ─── Build the subagent synthesis prompt ─────────────────────────────
function buildSynthesisPrompt(topic, researchContent, sourceUrls, userUrls) {
  if (!fs.existsSync(PROMPT_TEMPLATE)) {
    throw new Error('research-agent.md not found. Run from repo root.');
  }

  let prompt = fs.readFileSync(PROMPT_TEMPLATE, 'utf-8');
  prompt = prompt.replace('{{TOPIC}}', topic);

  const urlNote = userUrls.length > 0
    ? `The user also provided these specific URLs, which have been extracted and included in the research bundle:\n${userUrls.map(u => `- ${u}`).join('\n')}`
    : '';
  prompt = prompt.replace('{{URL_SECTION}}', urlNote);
  prompt = prompt.replace('{{RESEARCH_CONTENT}}', researchContent);

  return prompt;
}

// ─── Validate knowledge base output ──────────────────────────────────
function validateKnowledgeBase(kb) {
  const errors = [];
  if (!kb.topic?.title)   errors.push('Missing topic.title');
  if (!kb.topic?.brief)   errors.push('Missing topic.brief');
  if (!kb.learningObjectives || kb.learningObjectives.length < 2) errors.push('Need at least 2 learning objectives');
  if (!kb.contentAreas   || kb.contentAreas.length < 2)          errors.push('Need at least 2 content areas');

  let totalKeyPoints = 0, totalTeachableMoments = 0, totalCitations = 0;
  const momentTypes = {};

  for (const area of (kb.contentAreas || [])) {
    if (!area.title)            errors.push('Content area missing title');
    if (!area.keyPoints?.length) errors.push(`Content area "${area.title}" has no key points`);
    for (const kp of (area.keyPoints || [])) {
      totalKeyPoints++;
      if (kp.citation) totalCitations++;
    }
    for (const tm of (area.teachableMoments || [])) {
      totalTeachableMoments++;
      if (tm.type) momentTypes[tm.type] = (momentTypes[tm.type] || 0) + 1;
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

function printValidation(validation) {
  if (validation.errors.length > 0) {
    console.log(`\n  Warnings/errors (${validation.errors.length}):`);
    for (const err of validation.errors) console.log(`    ⚠ ${err}`);
  }
  console.log('\n  Stats:');
  console.log(`    Content areas:         ${validation.stats.contentAreas}`);
  console.log(`    Learning objectives:   ${validation.stats.learningObjectives}`);
  console.log(`    Key points:            ${validation.stats.keyPoints}`);
  console.log(`    Teachable moments:     ${validation.stats.teachableMoments}`);
  if (Object.keys(validation.stats.momentTypes).length > 0) {
    for (const [type, count] of Object.entries(validation.stats.momentTypes)) {
      console.log(`      ${type}: ${count}`);
    }
  }
  console.log(`    Citations:             ${validation.stats.citations}`);
  console.log(`    Sources:               ${validation.stats.sources}`);
  console.log(validation.valid ? '\n  Validation: PASSED' : '\n  Validation: PASSED WITH WARNINGS (see above)');
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔬 Research Content — Knowledge Base Assembly\n');

  const { topic, urls, loadFile } = parseArgs();

  // ── Load mode ──
  if (loadFile) {
    const filePath = path.resolve(loadFile);
    if (!fs.existsSync(filePath)) { console.error(`Error: file not found: ${filePath}`); process.exit(1); }
    let kb;
    try { kb = JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
    catch (err) { console.error(`Error parsing JSON: ${err.message}`); process.exit(1); }

    const validation = validateKnowledgeBase(kb);
    printValidation(validation);

    if (filePath !== OUTPUT_PATH) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(kb, null, 2));
      console.log(`\nCopied to: ${OUTPUT_PATH}`);
    }
    console.log('\nDone. Next: node engine/scripts/generate-layout.js');
    return;
  }

  // ── Research mode ──
  if (!topic) {
    console.error('Error: No topic provided.');
    console.error('Usage:');
    console.error('  node engine/scripts/research-content.js --topic "Your Topic Here"');
    console.error('  node engine/scripts/research-content.js --load engine/output/knowledge-base.json');
    console.error('\nOr create: engine/input/topic-brief.txt');
    process.exit(1);
  }

  if (!TAVILY_API_KEY) {
    console.error('Error: TAVILY_API_KEY not set in .env');
    process.exit(1);
  }

  console.log(`  Topic: ${topic}`);
  if (urls.length > 0) {
    console.log(`  User URLs: ${urls.length}`);
    urls.forEach(u => console.log(`    - ${u}`));
  }

  // ── Step 1: Run Tavily searches in parallel ──
  const queries = buildSearchQueries(topic);
  console.log(`\n  Running ${queries.length} Tavily searches in parallel...`);

  const searchPromises = queries.map((q, i) => {
    process.stdout.write(`    [${i + 1}/${queries.length}] ${q.slice(0, 60)}...\n`);
    return tavilySearch(q, topic).catch(err => {
      console.warn(`    Warning: search failed for "${q}": ${err.message}`);
      return [];
    });
  });

  const searchResultSets = await Promise.all(searchPromises);
  const allSearchResults = searchResultSets.flat();
  console.log(`  ✓ ${allSearchResults.length} raw results gathered`);

  // ── Step 2: Extract user-provided URLs ──
  let extractResults = [];
  if (urls.length > 0) {
    console.log(`\n  Extracting ${urls.length} user-provided URLs...`);
    extractResults = await tavilyExtract(urls).catch(err => {
      console.warn(`  Warning: URL extraction failed: ${err.message}`);
      return [];
    });
    console.log(`  ✓ ${extractResults.length} URLs extracted`);
  }

  // ── Step 3: Format research bundle ──
  const { content: researchContent, sources } = formatResearchBundle(allSearchResults, extractResults, topic);
  console.log(`  ✓ Research bundle: ${sources.length} unique sources, ${Math.round(researchContent.length / 1000)}KB`);

  // ── Step 4: Build synthesis prompt ──
  const prompt = buildSynthesisPrompt(topic, researchContent, urls);
  fs.writeFileSync(ASSEMBLED_PROMPT, prompt);
  console.log(`\n  Prompt saved: ${ASSEMBLED_PROMPT}`);

  // ── Step 5: Display subagent instructions ──
  console.log('\n' + '='.repeat(70));
  console.log('SUBAGENT TASK — SYNTHESIS ONLY (no web search needed)');
  console.log('='.repeat(70));
  console.log(`
Tavily has already gathered the research. Spawn a subagent (Agent tool)
with this task — it only needs to READ and STRUCTURE, not search:

${prompt}

The subagent will:
1. Read the pre-gathered research content in the prompt
2. Read the schema at engine/schemas/knowledge-base.schema.json
3. Structure the content into knowledge-base.json (no web search)
4. Write output to engine/output/knowledge-base.json

After the subagent finishes, validate with:
  node engine/scripts/research-content.js --load engine/output/knowledge-base.json

Then continue with:
  node engine/scripts/generate-layout.js
`);
  console.log('='.repeat(70));
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
