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
 *   node engine/scripts/scrape-brand.js [brand-url]
 *   If no URL argument, reads from brand/url.txt
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

// ─── Paths ───────────────────────────────────────────────────────────
const OUTPUT_DIR = path.resolve('engine/output');
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, 'brand-screenshot.png');
const DESIGN_MD_PATH = path.join(OUTPUT_DIR, 'brand-design.md');
const PROFILE_PATH = path.join(OUTPUT_DIR, 'brand-profile.json');

// ─── Take screenshot + detect dominant theme with Playwright ─────────
async function takeScreenshotAndDetectTheme(url) {
  const { chromium } = require('playwright');

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  // Extra wait for animations and lazy-loaded content
  await page.waitForTimeout(2000);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Take full-page screenshot so the whole brand is visible (not just the hero)
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`Screenshot saved: ${SCREENSHOT_PATH} (full page)`);

  // ─── Detect dominant background colour ─────────────────────────────
  // Sample background colours at multiple scroll positions to determine
  // if the brand is truly light or dark. The hero alone can be misleading
  // (e.g. fitflow has a dark hero but is a light brand).
  const detectedTheme = await page.evaluate(() => {
    const pageHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    // Sample at 5 evenly-spaced vertical positions (skipping the hero at 0)
    const samplePoints = [];
    for (let i = 1; i <= 5; i++) {
      samplePoints.push(Math.min(Math.floor((pageHeight * i) / 6), pageHeight - 1));
    }

    let lightCount = 0;
    let darkCount = 0;

    for (const y of samplePoints) {
      // Find the element at the center of the viewport at this Y position
      const el = document.elementFromPoint(640, Math.min(y, viewportHeight - 1));
      if (!el) continue;

      // Walk up the DOM to find the nearest element with a background colour
      let current = el;
      let bgColor = null;
      while (current && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        const bg = style.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          bgColor = bg;
          break;
        }
        current = current.parentElement;
      }

      // Fall back to body/html background
      if (!bgColor) {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        bgColor = (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)') ? bodyBg : htmlBg;
      }

      if (!bgColor) continue;

      // Parse rgb/rgba
      const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) continue;

      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      if (luminance < 0.4) darkCount++;
      else lightCount++;
    }

    return {
      isDark: darkCount > lightCount,
      samples: { light: lightCount, dark: darkCount },
    };
  });

  // We need to scroll to each sample point to get accurate elementFromPoint results
  // since elementFromPoint only works within the visible viewport.
  // Re-do with scrolling:
  const scrolledTheme = await page.evaluate(async () => {
    const pageHeight = document.documentElement.scrollHeight;
    const viewportHeight = window.innerHeight;
    const sampleCount = 6;
    let lightCount = 0;
    let darkCount = 0;

    for (let i = 0; i < sampleCount; i++) {
      // Scroll to evenly-spaced positions, skipping the very top (hero)
      const scrollY = Math.floor((pageHeight * (i + 1)) / (sampleCount + 1));
      window.scrollTo(0, scrollY);
      // Small delay for rendering
      await new Promise(r => setTimeout(r, 100));

      // Sample at center of viewport
      const el = document.elementFromPoint(640, viewportHeight / 2);
      if (!el) continue;

      let current = el;
      let bgColor = null;
      while (current && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        const bg = style.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          bgColor = bg;
          break;
        }
        current = current.parentElement;
      }

      if (!bgColor) {
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        bgColor = (bodyBg && bodyBg !== 'rgba(0, 0, 0, 0)') ? bodyBg : htmlBg;
      }

      if (!bgColor) continue;

      const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!match) continue;

      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      if (luminance < 0.4) darkCount++;
      else lightCount++;
    }

    // Scroll back to top
    window.scrollTo(0, 0);

    return {
      isDark: darkCount > lightCount,
      samples: { light: lightCount, dark: darkCount },
    };
  });

  const theme = scrolledTheme.samples.light + scrolledTheme.samples.dark > 0
    ? scrolledTheme : detectedTheme;

  console.log(`Theme detection: ${theme.samples.light} light samples, ${theme.samples.dark} dark samples → ${theme.isDark ? 'DARK' : 'LIGHT'}`);

  await browser.close();
  return { screenshotPath: SCREENSHOT_PATH, isDark: theme.isDark };
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
function saveOutputs(url, description, detectedIsDark) {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Save brand-design.md
  fs.writeFileSync(DESIGN_MD_PATH, description);
  console.log(`\nOutput: ${DESIGN_MD_PATH}`);

  // Save brand-profile.json with detected theme
  const imageTreatment = extractImageTreatment(description);
  const profile = {
    sourceUrl: url,
    scrapedAt: new Date().toISOString(),
    imageTreatment,
    detectedTheme: detectedIsDark ? 'dark' : 'light',
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
      console.error('Usage: node engine/scripts/scrape-brand.js [brand-url]');
      process.exit(1);
    }
    url = fs.readFileSync(urlFile, 'utf-8').trim();
  }

  console.log(`\nBrand Scraper — Screenshot + Description\n`);
  console.log(`URL: ${url}\n`);

  // Step 1: Take screenshot + detect dominant theme
  let detectedIsDark = false; // safe default: light
  try {
    const result = await takeScreenshotAndDetectTheme(url);
    detectedIsDark = result.isDark;
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

  // Step 3: Save outputs (includes detected theme)
  saveOutputs(url, description, detectedIsDark);

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
