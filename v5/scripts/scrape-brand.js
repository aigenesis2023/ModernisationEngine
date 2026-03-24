#!/usr/bin/env node
/**
 * V5 Brand Scraper — Screenshot + Natural Language Description
 *
 * Takes a screenshot of the brand URL, then either:
 *   - Manual mode: prints path, waits for user to paste a natural language description
 *   - API mode (ANTHROPIC_API_KEY): sends screenshot to Claude Vision for automatic description
 *
 * Outputs:
 *   1. brand-screenshot.png — viewport screenshot of the landing page
 *   2. brand-design.md — natural language brand description (DESIGN.md format)
 *   3. brand-profile.json — minimal metadata (sourceUrl, scrapedAt, imageTreatment)
 *
 * Usage:
 *   node v5/scripts/scrape-brand.js [brand-url]
 *   If no URL argument, reads from brand/url.txt
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

// ─── Paths ───────────────────────────────────────────────────────────
const OUTPUT_DIR = path.resolve('v5/output');
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, 'brand-screenshot.png');
const DESIGN_MD_PATH = path.join(OUTPUT_DIR, 'brand-design.md');
const PROFILE_PATH = path.join(OUTPUT_DIR, 'brand-profile.json');

// ─── Take screenshot with Playwright ─────────────────────────────────
async function takeScreenshot(url) {
  const { chromium } = require('playwright');

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // Extra wait for animations and lazy-loaded content
  await page.waitForTimeout(2000);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: false });
  console.log(`Screenshot saved: ${SCREENSHOT_PATH}`);

  await browser.close();
  return SCREENSHOT_PATH;
}

// ─── Manual mode: read description from stdin ────────────────────────
async function readManualDescription() {
  console.log('\n' + '='.repeat(70));
  console.log('MANUAL MODE');
  console.log('='.repeat(70));
  console.log(`\nScreenshot saved to:\n  ${SCREENSHOT_PATH}\n`);
  console.log('Open the screenshot and describe the brand\'s visual design.');
  console.log('Include:');
  console.log('  - Visual Theme & Atmosphere (evocative adjectives)');
  console.log('  - Colour descriptions IN WORDS (no hex codes needed)');
  console.log('  - Typography feel (modern sans-serif, elegant serif, etc.)');
  console.log('  - Component styles (button shapes, card treatments)');
  console.log('  - Layout feel (spacious, compact, editorial, etc.)');
  console.log('  - Image Treatment (photographic mood: dark/light, warm/cool, dramatic/soft)');
  console.log('\nPaste your description below, then type END on a new line:\n');
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

// ─── API mode: send screenshot to Claude Vision ─────────────────────
async function describeWithVision(screenshotPath, apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  console.log('Sending screenshot to Claude Vision...');

  const imageData = fs.readFileSync(screenshotPath).toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: imageData,
          },
        },
        {
          type: 'text',
          text: `You are a visual design analyst. Look at this website screenshot and describe its visual design in natural language. This description will be used as a DESIGN.md brief for Google Stitch to design a learning platform in this brand's style.

Write your description using these sections:

## Visual Theme & Atmosphere
Use evocative adjectives that capture the overall feel (e.g., "Sophisticated, glass-forward, dark and moody" or "Airy, minimal, warm and inviting").

## Colour Palette & Roles
Describe colours IN WORDS only — no hex codes. Use descriptive terms like "deep midnight blue", "warm coral", "soft cream". Describe what each colour is used for (backgrounds, headings, buttons, accents, etc.).

## Typography Rules
Describe the typography feel — is it a clean geometric sans-serif? An elegant serif? Describe weight, spacing, and hierarchy you observe.

## Component Stylings
Describe button shapes (pill, rounded, sharp), card treatments (glass/frosted, elevated with shadows, flat, outlined), border styles, and any distinctive interactive element styles.

## Layout Principles
Describe the whitespace strategy, grid feel, visual rhythm, and overall density.

## Image Treatment
Describe ONLY the photographic mood that would complement this design — things like "dramatic low-key lighting, dark atmosphere, cool tones" or "bright natural daylight, warm tones, soft focus". This is for AI-generated photographs, NOT UI design elements. Do not mention glassmorphism, buttons, gradients, or any UI concepts here — only photographic lighting, colour temperature, and mood.

Write naturally and descriptively. Do not use hex codes anywhere. Focus on the FEELING and VISUAL LANGUAGE of the design.`,
        },
      ],
    }],
  });

  const text = response.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude Vision');

  console.log(`Vision response: ${text.length} chars`);
  return text;
}

// ─── Extract image treatment from brand description ──────────────────
function extractImageTreatment(description) {
  // Try to find an "Image Treatment" section
  const sectionMatch = description.match(/##\s*Image Treatment\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (sectionMatch) {
    const treatment = sectionMatch[1].trim();
    if (treatment.length > 10) return treatment;
  }

  // Fallback: derive from overall tone words
  const lower = description.toLowerCase();
  const parts = [];

  if (lower.includes('dark') || lower.includes('moody') || lower.includes('midnight') || lower.includes('deep')) {
    parts.push('dramatic low-key lighting, dark atmosphere');
  } else if (lower.includes('light') || lower.includes('airy') || lower.includes('bright') || lower.includes('warm')) {
    parts.push('bright natural lighting, soft even illumination');
  } else {
    parts.push('balanced professional lighting');
  }

  if (lower.includes('warm') || lower.includes('coral') || lower.includes('amber') || lower.includes('gold')) {
    parts.push('warm colour tones');
  } else if (lower.includes('cool') || lower.includes('blue') || lower.includes('teal') || lower.includes('cyan')) {
    parts.push('cool tones');
  }

  if (lower.includes('elegant') || lower.includes('sophisticated') || lower.includes('premium')) {
    parts.push('refined professional photography');
  } else if (lower.includes('creative') || lower.includes('bold') || lower.includes('dynamic')) {
    parts.push('dynamic artistic composition');
  } else {
    parts.push('clean professional photography');
  }

  return parts.join(', ');
}

// ─── Save outputs ────────────────────────────────────────────────────
function saveOutputs(url, description) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Save brand-design.md
  fs.writeFileSync(DESIGN_MD_PATH, description);
  console.log(`\nOutput: ${DESIGN_MD_PATH}`);

  // Save minimal brand-profile.json
  const imageTreatment = extractImageTreatment(description);
  const profile = {
    sourceUrl: url,
    scrapedAt: new Date().toISOString(),
    imageTreatment,
  };
  fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2));
  console.log(`Output: ${PROFILE_PATH}`);

  // Preview
  console.log('\n--- brand-design.md preview ---');
  console.log(description.split('\n').slice(0, 20).join('\n'));
  console.log('...\n');

  console.log(`Image treatment: ${imageTreatment}\n`);
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  // Read brand URL from CLI arg or brand/url.txt
  const urlArg = process.argv[2];
  let url;
  if (urlArg) {
    url = urlArg;
  } else {
    const urlFile = path.resolve('brand/url.txt');
    if (!fs.existsSync(urlFile)) {
      console.error('Error: No URL argument and brand/url.txt not found.');
      console.error('Usage: node v5/scripts/scrape-brand.js [brand-url]');
      process.exit(1);
    }
    url = fs.readFileSync(urlFile, 'utf-8').trim();
  }

  console.log(`\nBrand Scraper — Screenshot + Description\n`);
  console.log(`URL: ${url}\n`);

  // Step 1: Take screenshot
  try {
    await takeScreenshot(url);
  } catch (err) {
    console.error(`Screenshot failed: ${err.message}`);
    console.error('Continuing without screenshot — you can describe the brand from memory.\n');
  }

  // Step 2: Get description (API or manual)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let description;

  if (apiKey) {
    // API mode: send screenshot to Claude Vision
    if (!fs.existsSync(SCREENSHOT_PATH)) {
      console.error('Error: Screenshot not available for Vision API. Cannot proceed in API mode.');
      process.exit(1);
    }
    try {
      description = await describeWithVision(SCREENSHOT_PATH, apiKey);
    } catch (err) {
      console.error(`Vision API failed: ${err.message}`);
      console.error('Falling back to manual mode.\n');
      description = await readManualDescription();
    }
  } else {
    // Manual mode: wait for user to paste description
    description = await readManualDescription();
  }

  // Step 3: Save outputs
  saveOutputs(url, description);

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
