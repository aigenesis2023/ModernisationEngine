#!/usr/bin/env node
/**
 * V6 Brand Scraper — Screenshot + Natural Language Description + CSS Token Extraction
 *
 * Takes a screenshot of the brand URL, extracts computed CSS tokens via getComputedStyle(),
 * then either:
 *   - Manual mode: prints path, waits for user to paste a natural language description
 *   - API mode (ANTHROPIC_API_KEY): sends screenshot to Claude Vision for automatic description
 *
 * Outputs:
 *   1. brand-screenshot.png    — viewport screenshot of the landing page
 *   2. brand-design.md         — natural language brand description (DESIGN.md format)
 *   3. brand-profile.json      — minimal metadata (sourceUrl, scrapedAt, imageTreatment)
 *   4. extracted-css.json      — NEW: computed CSS tokens (colors, fonts, radii, shadows)
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
const EXTRACTED_CSS_PATH = path.join(OUTPUT_DIR, 'extracted-css.json');

// ─── CSS Token Extraction ─────────────────────────────────────────────
/**
 * Extracts computed CSS values from the live page using getComputedStyle().
 * Samples buttons, headings, paragraphs, cards, backgrounds, links, and inputs.
 * Returns raw samples + a consolidated summary with semantic candidates.
 */
async function extractCSSTokens(page) {
  console.log('Extracting CSS tokens via getComputedStyle()...');

  // Run inside the browser context
  const extracted = await page.evaluate(() => {
    // Convert rgb()/rgba() → hex. Returns null for transparent/unset.
    const rgbToHex = (rgb) => {
      if (!rgb || rgb === 'transparent') return null;
      const match = rgb.match(/rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/);
      if (!match) return null;
      const r = Math.round(parseFloat(match[1]));
      const g = Math.round(parseFloat(match[2]));
      const b = Math.round(parseFloat(match[3]));
      // Skip rgba(0,0,0,0) — transparent black
      const alphaMatch = rgb.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
      if (alphaMatch && parseFloat(alphaMatch[1]) < 0.05) return null;
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    };

    const sample = (selector, limit = 15) => {
      return Array.from(document.querySelectorAll(selector))
        .filter(el => {
          const s = getComputedStyle(el);
          return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0;
        })
        .slice(0, limit)
        .map(el => {
          const s = getComputedStyle(el);
          const fontFamily = s.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
          const borderRadius = s.borderRadius;
          const boxShadow = s.boxShadow !== 'none' ? s.boxShadow : null;
          return {
            color: rgbToHex(s.color),
            backgroundColor: rgbToHex(s.backgroundColor),
            fontFamily: fontFamily || null,
            fontWeight: s.fontWeight,
            fontSize: s.fontSize,
            borderRadius: borderRadius !== '0px' ? borderRadius : null,
            boxShadow,
            borderColor: rgbToHex(s.borderColor),
            padding: s.padding,
          };
        })
        // Only keep entries with at least one color value
        .filter(item => item.color || item.backgroundColor);
    };

    return {
      buttons: sample('button, [role="button"], a[class*="btn"], [class*="button"]:not(section):not(div > div)'),
      headings: sample('h1, h2, h3'),
      paragraphs: sample('p'),
      cards: sample('[class*="card"], [class*="panel"], [class*="tile"], [class*="box"]'),
      backgrounds: sample('section, main, header, [class*="hero"], [class*="section"]'),
      links: sample('a:not([class*="btn"]):not([class*="button"])'),
      inputs: sample('input, textarea, select'),
      navItems: sample('nav a, [class*="nav"] a, [class*="menu"] a'),
    };
  });

  // ── Server-side consolidation ──────────────────────────────────────

  const countValue = (map, value) => {
    if (!value || value === 'none' || value === 'transparent' || value === '0px') return;
    map[value] = (map[value] || 0) + 1;
  };

  const sortedByCount = (map) =>
    Object.entries(map).sort((a, b) => b[1] - a[1]);

  // Frequency maps
  const allColors = {};
  const allFonts = {};
  const allRadii = {};
  const allShadows = {};
  const accentCandidates = {};   // colors from interactive elements (buttons, links, nav)
  const backgroundCandidates = {}; // colors from section/header backgrounds
  const textCandidates = {};     // colors from paragraph/body text
  const headingColors = {};
  const headingFonts = {};

  const processItems = (items, context) => {
    for (const item of items) {
      if (item.color) {
        countValue(allColors, item.color);
        if (context === 'paragraphs') countValue(textCandidates, item.color);
        if (context === 'headings') countValue(headingColors, item.color);
        if (context === 'buttons' || context === 'links' || context === 'nav') {
          countValue(accentCandidates, item.color);
        }
      }
      if (item.backgroundColor) {
        countValue(allColors, item.backgroundColor);
        if (context === 'backgrounds') countValue(backgroundCandidates, item.backgroundColor);
        // Count backgroundColor from interactive elements as accent candidates
        // (catches CTA links styled as pill buttons, cards with brand-colored backgrounds)
        if (context === 'buttons' || context === 'links' || context === 'nav' || context === 'cards') {
          countValue(accentCandidates, item.backgroundColor);
        }
      }
      if (item.fontFamily) {
        countValue(allFonts, item.fontFamily);
        if (context === 'headings') countValue(headingFonts, item.fontFamily);
      }
      if (item.borderRadius) countValue(allRadii, item.borderRadius);
      if (item.boxShadow) countValue(allShadows, item.boxShadow);
    }
  };

  processItems(extracted.buttons || [], 'buttons');
  processItems(extracted.headings || [], 'headings');
  processItems(extracted.paragraphs || [], 'paragraphs');
  processItems(extracted.links || [], 'links');
  processItems(extracted.backgrounds || [], 'backgrounds');
  processItems(extracted.cards || [], 'cards');
  processItems(extracted.navItems || [], 'nav');
  processItems(extracted.inputs || [], 'inputs');

  // ── Semantic candidates ────────────────────────────────────────────

  // Generic CSS font family names that browsers fall back to — not brand fonts
  const GENERIC_FONTS = new Set([
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
    'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace',
    'ui-rounded', 'math', 'emoji',
  ]);

  // Browser default colors — not brand colors
  const BROWSER_DEFAULT_COLORS = new Set([
    '#0000ee', '#0000ff', '#551a8b', '#ee0000', '#ff0000',
  ]);

  // Is this color near-neutral (near-white, near-black, or low saturation gray)?
  const isNearNeutral = (hex) => {
    if (!hex || hex.length < 7) return true;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.88 || luminance < 0.08 || saturation < 0.20;
  };

  // Accent colors: saturated, non-neutral, non-browser-default colors from interactive elements
  const accentColors = sortedByCount(accentCandidates)
    .filter(([hex]) => !isNearNeutral(hex) && !BROWSER_DEFAULT_COLORS.has(hex))
    .slice(0, 3)
    .map(([hex, count]) => ({ hex, count }));

  // Background colors: dominant section backgrounds
  const backgroundColors = sortedByCount(backgroundCandidates)
    .slice(0, 5)
    .map(([hex, count]) => ({ hex, count }));

  // Font role classification:
  // - Headline: font most frequently seen on h1/h2/h3 headings (skip generic fallbacks)
  // - Body: most frequent REAL font overall that isn't the headline font
  const headlineFontEntry = sortedByCount(headingFonts).find(([f]) => !GENERIC_FONTS.has(f));
  const headlineFont = headlineFontEntry?.[0] || null;
  const bodyFontEntry = sortedByCount(allFonts).find(([f]) => f !== headlineFont && !GENERIC_FONTS.has(f));
  const bodyFont = bodyFontEntry?.[0] || headlineFont;

  // Border radius: dominant value from all elements
  const dominantBorderRadius = sortedByCount(allRadii)[0]?.[0] || null;
  const buttonRadius = sortedByCount(
    Object.fromEntries(
      (extracted.buttons || [])
        .filter(b => b.borderRadius)
        .map(b => [b.borderRadius, 1])
    )
  )[0]?.[0] || dominantBorderRadius;

  // Primary shadow: most common box-shadow
  const dominantShadow = sortedByCount(allShadows)[0]?.[0] || null;

  const summary = {
    headlineFont,
    bodyFont,
    dominantBorderRadius,
    buttonBorderRadius: buttonRadius,
    dominantShadow,
    accentColors,
    backgroundColors,
    allColors: sortedByCount(allColors).slice(0, 20).map(([hex, count]) => ({ hex, count })),
    allRadii: sortedByCount(allRadii).map(([value, count]) => ({ value, count })),
    allFonts: sortedByCount(allFonts).map(([family, count]) => ({ family, count })),
  };

  console.log(`  Colors found: ${Object.keys(allColors).length} unique`);
  console.log(`  Accent candidates: ${accentColors.length} saturated colors`);
  console.log(`  Headline font: ${headlineFont || '(not detected)'}`);
  console.log(`  Body font: ${bodyFont || '(not detected)'}`);
  console.log(`  Border radii: ${Object.keys(allRadii).length} unique values`);

  return { raw: extracted, summary };
}

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

  // ─── Extract CSS tokens (while browser is still open) ──────────────
  let extractedCSS = null;
  try {
    extractedCSS = await extractCSSTokens(page);
  } catch (err) {
    console.warn(`CSS extraction failed: ${err.message}`);
    console.warn('Continuing without CSS tokens.');
  }

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
  return { screenshotPath: SCREENSHOT_PATH, isDark: theme.isDark, extractedCSS };
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
Write 1-2 sentences describing ONLY lighting style, colour temperature, and mood — for example: "Dramatic low-key lighting, deep shadows, cool blue tones, cinematic." Do NOT describe example photographs, people, subjects, or scenes. Do NOT write "a shot of someone..." or "an image of...". Only lighting, colour, and atmosphere. No hex codes.`,
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
function saveOutputs(url, description, detectedIsDark, extractedCSS) {
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

  // Save extracted-css.json (NEW — used by generate-design-tokens.js in Session 2)
  if (extractedCSS) {
    const cssOutput = {
      extractedAt: new Date().toISOString(),
      sourceUrl: url,
      ...extractedCSS,
    };
    fs.writeFileSync(EXTRACTED_CSS_PATH, JSON.stringify(cssOutput, null, 2));
    console.log(`Output: ${EXTRACTED_CSS_PATH}`);

    // Print summary for immediate inspection
    const s = extractedCSS.summary;
    console.log('\n--- CSS Token Summary ---');
    console.log(`  Headline font:     ${s.headlineFont || 'not detected'}`);
    console.log(`  Body font:         ${s.bodyFont || 'not detected'}`);
    console.log(`  Border radius:     ${s.dominantBorderRadius || 'not detected'}`);
    console.log(`  Button radius:     ${s.buttonBorderRadius || 'not detected'}`);
    if (s.accentColors.length > 0) {
      console.log(`  Accent colors:     ${s.accentColors.map(c => c.hex).join(', ')}`);
    } else {
      console.log(`  Accent colors:     none detected (may be a neutral brand)`);
    }
    if (s.backgroundColors.length > 0) {
      console.log(`  Backgrounds:       ${s.backgroundColors.map(c => c.hex).join(', ')}`);
    }
    console.log('');
  }

  // Preview
  console.log('--- brand-design.md preview ---');
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

  console.log(`\nBrand Scraper — Screenshot + Description + CSS Extraction\n`);
  console.log(`URL: ${url}\n`);

  // Step 1: Take screenshot + detect dominant theme + extract CSS tokens
  let detectedIsDark = false; // safe default: light
  let extractedCSS = null;
  try {
    const result = await takeScreenshotAndDetectTheme(url);
    detectedIsDark = result.isDark;
    extractedCSS = result.extractedCSS;
  } catch (err) {
    console.error(`Screenshot/extraction failed: ${err.message}`);
    console.error('Continuing without screenshot or CSS tokens.\n');
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

  // Step 3: Save outputs (includes detected theme + extracted CSS)
  saveOutputs(url, description, detectedIsDark, extractedCSS);

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
