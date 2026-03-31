#!/usr/bin/env node
/**
 * V6 Brand Scraper — Screenshot + Natural Language Description + CSS Token Extraction
 *
 * Takes a screenshot of the brand URL, extracts computed CSS tokens via getComputedStyle(),
 * then either:
 *   - API mode (ANTHROPIC_API_KEY set): sends screenshot to Claude Vision for automatic description
 *   - Subagent mode (no API key): writes brand-describe-prompt.txt and exits.
 *     Spawn a subagent to read the screenshot + write brand-describe.json,
 *     then re-run with --description-ready.
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
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const { execSync } = require('child_process');

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
            borderWidth: s.borderWidth !== '0px' ? s.borderWidth : null,
            textTransform: s.textTransform !== 'none' ? s.textTransform : null,
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

  // Text color: most frequent paragraph text color
  const textColor = sortedByCount(textCandidates)[0]?.[0] || null;

  // Heading text color: most frequent heading text color
  const headingTextColor = sortedByCount(headingColors)[0]?.[0] || null;

  // Card surface: most frequent card backgroundColor
  const cardBgMap = {};
  const cardBorderMap = {};
  const cardBorderWidthMap = {};
  for (const item of (extracted.cards || [])) {
    if (item.backgroundColor) countValue(cardBgMap, item.backgroundColor);
    if (item.borderColor) countValue(cardBorderMap, item.borderColor);
    if (item.borderWidth) countValue(cardBorderWidthMap, item.borderWidth);
  }
  const cardSurfaceColor = sortedByCount(cardBgMap)[0]?.[0] || null;
  const cardBorderColor = sortedByCount(cardBorderMap)[0]?.[0] || null;
  const cardBorderWidth = sortedByCount(cardBorderWidthMap)[0]?.[0] || null;

  // Average heading weight
  const headingWeights = (extracted.headings || [])
    .map(h => parseInt(h.fontWeight, 10))
    .filter(w => !isNaN(w));
  const avgHeadingWeight = headingWeights.length > 0
    ? Math.round(headingWeights.reduce((a, b) => a + b, 0) / headingWeights.length)
    : null;

  // Average body/paragraph weight
  const bodyWeights = (extracted.paragraphs || [])
    .map(p => parseInt(p.fontWeight, 10))
    .filter(w => !isNaN(w));
  const avgBodyWeight = bodyWeights.length > 0
    ? Math.round(bodyWeights.reduce((a, b) => a + b, 0) / bodyWeights.length)
    : null;

  // Heading text-transform (check for uppercase)
  const headingTransforms = {};
  for (const h of (extracted.headings || [])) {
    if (h.textTransform) countValue(headingTransforms, h.textTransform);
  }
  const dominantHeadingTransform = sortedByCount(headingTransforms)[0]?.[0] || null;

  // Button border width
  const buttonBorderWidthMap = {};
  for (const b of (extracted.buttons || [])) {
    if (b.borderWidth) countValue(buttonBorderWidthMap, b.borderWidth);
  }
  const buttonBorderWidth = sortedByCount(buttonBorderWidthMap)[0]?.[0] || null;

  const summary = {
    headlineFont,
    bodyFont,
    dominantBorderRadius,
    buttonBorderRadius: buttonRadius,
    dominantShadow,
    accentColors,
    backgroundColors,
    textColor,
    headingTextColor,
    cardSurfaceColor,
    cardBorderColor,
    cardBorderWidth,
    avgHeadingWeight,
    avgBodyWeight,
    dominantHeadingTransform,
    buttonBorderWidth,
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

// ─── dembrandt color extraction ──────────────────────────────────────
/**
 * Extract design tokens from a URL using dembrandt CLI.
 * dembrandt runs its own Playwright instance — do NOT share browser.
 * Returns the palette array: [{ normalized: "#hex", count: N, confidence: "high"|"medium"|"low" }, ...]
 * or null on failure.
 */
const DEMBRANDT_OUTPUT_PATH = path.join(OUTPUT_DIR, 'extracted-dembrandt.json');

async function extractDembrandtColors(url) {
  try {
    console.log('Running dembrandt color extraction...');
    const result = execSync(
      `npx dembrandt "${url}" --json-only --no-sandbox`,
      { timeout: 60000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const parsed = JSON.parse(result.trim());

    // Save full output for auditability
    fs.writeFileSync(DEMBRANDT_OUTPUT_PATH, JSON.stringify(parsed, null, 2));
    console.log(`dembrandt output saved: ${DEMBRANDT_OUTPUT_PATH}`);

    const palette = parsed.colors?.palette || parsed.palette || [];
    console.log(`dembrandt palette: ${palette.length} colors extracted`);
    if (palette.length > 0) {
      const highConf = palette.filter(c => c.confidence === 'high');
      console.log(`  High confidence: ${highConf.map(c => `${c.normalized} (count=${c.count})`).join(', ') || 'none'}`);
    }
    return palette;
  } catch (err) {
    console.warn(`dembrandt extraction failed: ${err.message}`);
    return null;
  }
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

// ─── Subagent mode: write prompt file and exit ───────────────────────
const DESCRIBE_PROMPT_PATH = path.join(OUTPUT_DIR, 'brand-describe-prompt.txt');
const DESCRIBE_RESULT_PATH = path.join(OUTPUT_DIR, 'brand-describe.json');

function writeBrandDescribePrompt(url) {
  const prompt = `# Brand Visual Description Task

Read the brand screenshot at: engine/output/brand-screenshot.png

Write a natural language brand description covering ALL of these:

1. **Visual Theme & Atmosphere** — 3–5 evocative adjectives (e.g. "clean, minimal, confident")
2. **Colour descriptions IN WORDS** — describe the palette in English (e.g. "deep navy background with electric coral accents and white text") — no hex codes
3. **Typography feel** — describe headline + body font character (e.g. "bold geometric sans-serif headlines, light body text")
4. **Component styles** — button shapes (rounded/sharp/pill), card treatments (bordered/shadowed/flat), icon style
5. **Layout feel** — spacious vs compact, editorial vs functional, symmetrical vs asymmetric
6. **Image Treatment** — photographic mood: dark/light, warm/cool, dramatic/soft, or "no photography" if illustration/abstract

The description must be in natural language prose — no bullet points, no hex values.
Aim for 150–250 words.

Then determine whether the brand is DARK or LIGHT themed (dark = dark background is dominant).

Write your result to engine/output/brand-describe.json in this format:
{
  "description": "...",
  "isDark": true | false
}

Brand URL for reference: ${url}
`;
  fs.writeFileSync(DESCRIBE_PROMPT_PATH, prompt);
  console.log('\n' + '='.repeat(70));
  console.log('BRAND DESCRIPTION NEEDED (no ANTHROPIC_API_KEY set)');
  console.log('='.repeat(70));
  console.log('\nA subagent prompt has been written to:');
  console.log(`  ${DESCRIBE_PROMPT_PATH}`);
  console.log('\nSpawn a subagent to:');
  console.log('  1. Read engine/output/brand-screenshot.png (use Read tool — Claude has vision)');
  console.log('  2. Follow the instructions in brand-describe-prompt.txt');
  console.log('  3. Write engine/output/brand-describe.json');
  console.log('\nThen re-run: node engine/scripts/scrape-brand.js --description-ready\n');
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

// ─── Brand Spec paths ────────────────────────────────────────────────
const BRAND_SPEC_PROMPT_PATH = path.join(OUTPUT_DIR, 'brand-spec-prompt.txt');
const BRAND_SPEC_VISION_PATH = path.join(OUTPUT_DIR, 'brand-spec-vision.json');
const BRAND_SPEC_PATH = path.join(OUTPUT_DIR, 'brand-spec.json');

// ─── Luminance helper ────────────────────────────────────────────────
/**
 * Compute relative luminance of a hex color (0 = black, 1 = white).
 * Used to determine onPrimary: dark primary → #ffffff, light primary → #1a1a1a.
 */
function hexLuminance(hex) {
  if (!hex || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  // sRGB linearize
  const linearize = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/**
 * Compute a slight step from a background color for backgroundAlt.
 * Light backgrounds get slightly darker, dark backgrounds get slightly lighter.
 */
function computeBackgroundAlt(bgHex, isDark) {
  if (!bgHex || bgHex.length < 7) return null;
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);
  const step = isDark ? 12 : -8; // lighten dark bgs, darken light bgs
  const clamp = (v) => Math.max(0, Math.min(255, v + step));
  return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// ─── Compute CSS-derived spec fields ─────────────────────────────────
/**
 * Maps the CSS extraction summary to all CSS-derivable fields of brand-spec.json.
 * Vision AI fills the rest (colorStrategy, archetype, surfaceStyle, imageStyle, etc.).
 */
function computeCssDerivedSpec(summary, isDark, dembrandtPalette) {
  // ── Three-source cascade for primary accent color ──────────────────
  // 1. CSS accent (if chromatic) → 2. dembrandt high-confidence → 3. gray fallback
  const isChromatic = (hex) => {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return saturation >= 0.20 && lum > 0.08 && lum < 0.88;
  };

  let primary = '#666666';
  let primarySource = 'fallback';

  const cssAccent = summary.accentColors?.[0]?.hex;
  if (cssAccent && isChromatic(cssAccent)) {
    primary = cssAccent;
    primarySource = 'css';
  } else if (dembrandtPalette && dembrandtPalette.length > 0) {
    // Find the highest-count chromatic color with high confidence
    const highConfChromatic = dembrandtPalette
      .filter(c => c.confidence === 'high' && c.normalized && isChromatic(c.normalized))
      .sort((a, b) => (b.count || 0) - (a.count || 0));
    if (highConfChromatic.length > 0) {
      primary = highConfChromatic[0].normalized;
      primarySource = 'dembrandt';
    }
  }

  console.log(`[cascade] Primary: ${primary} (source: ${primarySource})`);

  // Colors
  const background = summary.backgroundColors?.[0]?.hex || (isDark ? '#111111' : '#ffffff');
  const backgroundAlt = summary.backgroundColors?.[1]?.hex || computeBackgroundAlt(background, isDark);
  // Secondary: CSS 2nd accent, or dembrandt 2nd high-confidence chromatic color (different hue from primary)
  let secondary = summary.accentColors?.[1]?.hex || null;
  if (!secondary && dembrandtPalette && dembrandtPalette.length > 0) {
    const hexToHue = (hex) => {
      if (!hex || hex.length < 7) return -1;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      if (d === 0) return -1;
      let h;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
      return h * 360;
    };
    const primaryHue = hexToHue(primary);
    const secondaryCandidate = dembrandtPalette
      .filter(c => c.confidence === 'high' && c.normalized && isChromatic(c.normalized) && c.normalized !== primary)
      .filter(c => {
        if (primaryHue < 0) return true;
        const hue = hexToHue(c.normalized);
        if (hue < 0) return false;
        const diff = Math.min(Math.abs(primaryHue - hue), 360 - Math.abs(primaryHue - hue));
        return diff > 30; // different hue family
      })
      .sort((a, b) => (b.count || 0) - (a.count || 0));
    if (secondaryCandidate.length > 0) {
      secondary = secondaryCandidate[0].normalized;
    }
  }
  const onBackground = summary.headingTextColor || summary.textColor || (isDark ? '#ffffff' : '#1a1a1a');
  // WCAG AA threshold: white text on bg passes only when bg luminance ≤ 0.18.
  // Above that, dark text gives better contrast. Use 0.18 (not 0.4) to avoid
  // low-contrast white-on-orange situations.
  const onPrimary = hexLuminance(primary) > 0.18 ? '#1a1a1a' : '#ffffff';
  const cardSurface = summary.cardSurfaceColor || null;
  const cardBorder = summary.cardBorderColor || null;

  // Shape — map CSS values to enum tokens
  let borderRadius = 'rounded'; // default
  if (summary.dominantBorderRadius) {
    const px = parseFloat(summary.dominantBorderRadius);
    if (!isNaN(px)) {
      if (px <= 4) borderRadius = 'sharp';
      else if (px <= 12) borderRadius = 'rounded';
      else borderRadius = 'pill';
    }
  }

  let borderWidth = 'none';
  // Check card borders and button borders
  const bw = summary.cardBorderWidth || summary.buttonBorderWidth;
  if (bw) {
    const px = parseFloat(bw);
    if (!isNaN(px) && px > 0) {
      borderWidth = px >= 2 ? 'thick' : 'thin';
    }
  }

  let shadowDepth = 'none';
  if (summary.dominantShadow) {
    const s = summary.dominantShadow;
    // Rough heuristic: check blur radius in box-shadow
    const blurMatch = s.match(/\d+px\s+\d+px\s+(\d+)px/);
    if (blurMatch) {
      const blur = parseInt(blurMatch[1], 10);
      if (blur <= 4) shadowDepth = 'flat';
      else if (blur <= 15) shadowDepth = 'soft';
      else shadowDepth = 'deep';
    } else {
      shadowDepth = 'flat'; // has shadow but can't parse blur
    }
  }

  // Typography weights
  const headlineWeight = summary.avgHeadingWeight || 700;
  const bodyWeight = summary.avgBodyWeight || 400;

  return {
    colors: {
      background,
      backgroundAlt,
      primary,
      secondary,
      onPrimary,
      onBackground,
      cardSurface,
      cardBorder,
    },
    typography: {
      headlineWeight,
      bodyWeight,
    },
    shape: {
      borderRadius,
      borderWidth,
      shadowDepth,
    },
    isDark,
    primarySource,
  };
}

// ─── Write brand-spec prompt for subagent ────────────────────────────
/**
 * Writes engine/output/brand-spec-prompt.txt with:
 * - Screenshot path
 * - All CSS-derived data as context
 * - Pointer to the prompt .md file
 */
function writeBrandSpecPrompt(cssDerivedSpec) {
  const prompt = `# Brand Spec Vision AI Audit — Subagent Task

## Step 1: Read the screenshot
Read the brand screenshot at: engine/output/brand-screenshot.png
(Use the Read tool — you have vision capability.)

## Step 2: CSS-Derived Context (ground truth — do NOT override these)
The following values were extracted directly from the brand's CSS. Use them as context when answering questions — do NOT guess hex values.

\`\`\`json
${JSON.stringify(cssDerivedSpec, null, 2)}
\`\`\`

## Step 3: Answer the 15 structured questions
Read the full prompt at: engine/prompts/brand-spec-audit.md
Follow its instructions exactly. Answer all 15 questions.

## Step 4: Write output
Write your answers as strict JSON to: engine/output/brand-spec-vision.json
`;
  fs.writeFileSync(BRAND_SPEC_PROMPT_PATH, prompt);
  console.log(`\nBrand spec prompt written: ${BRAND_SPEC_PROMPT_PATH}`);
}

// ─── API mode: Vision AI for brand-spec ──────────────────────────────
/**
 * Calls Claude Vision API with the brand screenshot + 14 structured questions.
 * Returns the parsed JSON answers.
 */
async function produceSpecWithVision(screenshotPath, cssDerivedSpec, apiKey) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  console.log('Sending screenshot to Claude Vision for brand-spec audit...');

  const imageData = fs.readFileSync(screenshotPath).toString('base64');
  const auditPrompt = fs.readFileSync(path.resolve('engine/prompts/brand-spec-audit.md'), 'utf-8');

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
          text: `You are performing a Technical Design Audit of the brand website shown in the screenshot.

## CSS-Derived Context (ground truth — use as reference, do NOT guess hex values)
\`\`\`json
${JSON.stringify(cssDerivedSpec, null, 2)}
\`\`\`

## Your Task
Answer the 15 structured questions below. Return ONLY a JSON object with your answers — no markdown, no commentary, no code fences.

${auditPrompt.split('## The 15 Questions')[1]?.split('## Output Format')[0] || ''}

Return the JSON object matching this structure:
{
  "accentSectionBg": boolean,
  "cardsOnAccentBg": "cards" | "direct" | "none",
  "textDirectlyOnAccent": "none" | "headings-only" | "all",
  "primaryRole": "buttons-only" | "buttons-and-icons" | "section-backgrounds-and-buttons",
  "primaryForStatNumbers": boolean,
  "accentSectionFrequency": integer,
  "surfaceStyle": "flat-solid" | "glassmorphic" | "soft-shadow" | "gradient",
  "headlineCharacter": "heavy-condensed" | "bold-geometric" | "light-elegant" | "standard-sans" | "serif",
  "bodyCharacter": "clean-lightweight" | "medium-weight" | "heavy-readable" | "serif-body",
  "uppercaseHeadings": boolean,
  "imageTreatment": "dramatic-dark" | "bright-airy" | "monochrome" | "illustrated" | "none",
  "imageColorTemp": "warm" | "cool" | "neutral",
  "archetype": "tech-modern" | "minimalist" | "editorial" | "glassmorphist" | "corporate" | "warm-organic" | "neo-brutalist" | "luxury",
  "contrast": "high" | "medium" | "low",
  "applicationConstraints": [string array],
  "accentColorHex": "#hex"
}

RESPOND WITH ONLY THE JSON OBJECT. No markdown fences, no explanation.`,
        },
      ],
    }],
  });

  const text = response.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Claude Vision for brand-spec');

  // Parse JSON — handle potential markdown fences
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(cleaned);
  console.log(`Brand-spec vision response parsed: ${Object.keys(parsed).length} fields`);
  return parsed;
}

// ─── Merge CSS-derived + Vision AI → final brand-spec.json ──────────
/**
 * Merges CSS-derived data (ground truth for hex) with Vision AI answers (ground truth for strategy).
 * Computes derived fields (onPrimary, pairingLogic, backgroundAlt).
 * Cross-validates and writes engine/output/brand-spec.json.
 */
function mergeBrandSpec(cssDerivedSpec, visionResult) {
  const warnings = [];

  // Cross-validation 1: accentSectionBg vs CSS backgrounds
  // If Vision says no accent sections but CSS found primary as a section background
  if (!visionResult.accentSectionBg && cssDerivedSpec.colors.primary) {
    // Check if primary appears in background colors (would need raw data — skip for now, just note)
    // This is a soft check — Vision AI is the authority for strategy questions
  }

  // Cross-validation 2: isDark — CSS is ground truth for luminance
  if (typeof visionResult.isDark === 'boolean' && visionResult.isDark !== cssDerivedSpec.isDark) {
    warnings.push(`isDark mismatch: Vision=${visionResult.isDark}, CSS=${cssDerivedSpec.isDark}. Using CSS (ground truth).`);
  }

  // Cross-validation 3: uppercaseHeadings — CSS text-transform can verify
  // (cssDerivedSpec doesn't carry headingTransform, but we could add it if needed)

  // Map Vision AI answers to schema fields
  const cardsOnAccentBg = visionResult.cardsOnAccentBg === 'cards';
  // "headings-only" means body text is in cards — only "all" means body text directly on accent
  const textDirectlyOnAccent = visionResult.textDirectlyOnAccent === 'all';
  const primaryForIcons = visionResult.primaryRole === 'buttons-and-icons' || visionResult.primaryRole === 'section-backgrounds-and-buttons';
  const primaryForButtons = true; // accent is always used for buttons

  // Determine headline/body character from Vision AI
  const headlineCharacter = visionResult.headlineCharacter || 'standard-sans';
  const bodyCharacter = visionResult.bodyCharacter || 'clean-lightweight';

  // Cross-validation: Vision AI Q15 accentColorHex vs cascade-selected primary
  if (visionResult.accentColorHex && cssDerivedSpec.colors.primary) {
    const cascadePrimary = cssDerivedSpec.colors.primary.toLowerCase();
    const visionAccent = visionResult.accentColorHex.toLowerCase();
    if (cascadePrimary !== visionAccent) {
      // Check if they're in the same hue family (within ~30° on the color wheel)
      const hexToHue = (hex) => {
        if (!hex || hex.length < 7) return -1;
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        if (d === 0) return -1; // achromatic
        let h;
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
        return h * 360;
      };
      const hue1 = hexToHue(cascadePrimary);
      const hue2 = hexToHue(visionAccent);
      if (hue1 >= 0 && hue2 >= 0) {
        const hueDiff = Math.min(Math.abs(hue1 - hue2), 360 - Math.abs(hue1 - hue2));
        if (hueDiff > 30) {
          warnings.push(`Primary hue mismatch: cascade=${cascadePrimary} (hue ${Math.round(hue1)}°), Vision AI Q15=${visionAccent} (hue ${Math.round(hue2)}°). Keeping cascade result (${cssDerivedSpec.primarySource} source). Vision AI is validation only.`);
        }
      }
    }
  }

  // Build final spec
  const spec = {
    colors: {
      ...cssDerivedSpec.colors,
      primarySource: cssDerivedSpec.primarySource || 'fallback',
    },
    colorStrategy: {
      accentSectionBg: visionResult.accentSectionBg,
      cardsOnAccentBg,
      primaryForIcons,
      primaryForStatNumbers: visionResult.primaryForStatNumbers,
      primaryForButtons,
      textDirectlyOnAccent,
      accentSectionFrequency: visionResult.accentSectionFrequency || 0,
    },
    typography: {
      headlineCharacter,
      bodyCharacter,
      headlineWeight: cssDerivedSpec.typography.headlineWeight,
      bodyWeight: cssDerivedSpec.typography.bodyWeight,
      uppercaseHeadings: visionResult.uppercaseHeadings,
    },
    shape: {
      ...cssDerivedSpec.shape,
      surfaceStyle: visionResult.surfaceStyle || 'flat-solid',
    },
    imageStyle: {
      treatment: visionResult.imageTreatment || 'none',
      colorTemp: visionResult.imageColorTemp || 'neutral',
      contrast: visionResult.contrast || 'medium',
    },
    pairingLogic: {
      background: 'onBackground',
      primary: 'onPrimary',
      cardSurface: 'onBackground',
      accentSectionBg: 'onPrimary',
    },
    applicationConstraints: visionResult.applicationConstraints || [],
    archetype: visionResult.archetype || 'corporate',
    isDark: cssDerivedSpec.isDark, // CSS is ground truth
  };

  // Log warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Cross-validation warnings:');
    for (const w of warnings) console.log(`   ${w}`);
  }

  // Write brand-spec.json
  fs.writeFileSync(BRAND_SPEC_PATH, JSON.stringify(spec, null, 2));
  console.log(`\nOutput: ${BRAND_SPEC_PATH}`);

  // Print summary
  console.log('\n--- brand-spec.json summary ---');
  console.log(`  Background:     ${spec.colors.background}`);
  console.log(`  Primary:        ${spec.colors.primary}`);
  console.log(`  onPrimary:      ${spec.colors.onPrimary}`);
  console.log(`  Archetype:      ${spec.archetype}`);
  console.log(`  isDark:         ${spec.isDark}`);
  console.log(`  accentSectionBg: ${spec.colorStrategy.accentSectionBg}`);
  console.log(`  cardsOnAccent:  ${spec.colorStrategy.cardsOnAccentBg}`);
  console.log(`  surfaceStyle:   ${spec.shape.surfaceStyle}`);
  console.log(`  Constraints:    ${spec.applicationConstraints.length} rules`);
  console.log('');

  return spec;
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
  const args = process.argv.slice(2);
  const descriptionReady = args.includes('--description-ready');
  const specReady = args.includes('--spec-ready');

  // Read brand URL from CLI arg or brand/url.txt
  const urlArg = args.find(a => !a.startsWith('--'));
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

  console.log(`\nBrand Scraper — Screenshot + Description + CSS Extraction + Brand Spec\n`);
  console.log(`URL: ${url}\n`);

  // Step 1: Take screenshot + detect dominant theme + extract CSS tokens
  // (Skip if --description-ready or --spec-ready: screenshot and CSS already done on first run)
  let detectedIsDark = false; // safe default: light
  let extractedCSS = null;
  let dembrandtPalette = null;

  if (descriptionReady || specReady) {
    // Load previously extracted CSS (written on first run)
    if (fs.existsSync(EXTRACTED_CSS_PATH)) {
      extractedCSS = JSON.parse(fs.readFileSync(EXTRACTED_CSS_PATH, 'utf-8'));
      console.log('Loaded existing extracted-css.json');
    }
    // Load previously extracted dembrandt palette (written on first run)
    if (fs.existsSync(DEMBRANDT_OUTPUT_PATH)) {
      try {
        const dembrandtData = JSON.parse(fs.readFileSync(DEMBRANDT_OUTPUT_PATH, 'utf-8'));
        dembrandtPalette = dembrandtData.colors?.palette || dembrandtData.palette || [];
        console.log(`Loaded dembrandt palette: ${dembrandtPalette.length} colors`);
      } catch (e) {
        console.warn('Could not load dembrandt data');
      }
    }
    // isDark comes from brand-describe.json — no need to re-scrape
  } else {
    try {
      const result = await takeScreenshotAndDetectTheme(url);
      detectedIsDark = result.isDark;
      extractedCSS = result.extractedCSS;
    } catch (err) {
      console.error(`Screenshot/extraction failed: ${err.message}`);
      console.error('Continuing without screenshot or CSS tokens.\n');
    }

    // Run dembrandt extraction (separate Playwright instance, ~8-15s)
    dembrandtPalette = await extractDembrandtColors(url);
  }

  // Step 2: Get description (API or subagent)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let description;
  let descriptionDone = false;

  if (descriptionReady) {
    // Subagent has written brand-describe.json — load it
    if (!fs.existsSync(DESCRIBE_RESULT_PATH)) {
      console.error(`Error: --description-ready flag set but ${DESCRIBE_RESULT_PATH} not found.`);
      console.error('Run the subagent first, then re-run with --description-ready.');
      process.exit(1);
    }
    const result = JSON.parse(fs.readFileSync(DESCRIBE_RESULT_PATH, 'utf-8'));
    description = result.description;
    if (typeof result.isDark === 'boolean') detectedIsDark = result.isDark;
    console.log('Loaded brand description from brand-describe.json');
    descriptionDone = true;
  } else if (specReady && !descriptionReady) {
    // --spec-ready only (description was done in a previous run via API mode)
    // Load existing brand-design.md if it exists
    if (fs.existsSync(DESIGN_MD_PATH)) {
      description = fs.readFileSync(DESIGN_MD_PATH, 'utf-8');
      console.log('Loaded existing brand-design.md');
      descriptionDone = true;
    }
    // Load isDark from existing brand-profile.json
    if (fs.existsSync(PROFILE_PATH)) {
      const profile = JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf-8'));
      detectedIsDark = profile.detectedTheme === 'dark';
    }
  } else if (apiKey) {
    // API mode: send screenshot to Claude Vision
    if (!fs.existsSync(SCREENSHOT_PATH)) {
      console.error('Error: Screenshot not available for Vision API. Cannot proceed in API mode.');
      process.exit(1);
    }
    try {
      description = await describeWithVision(SCREENSHOT_PATH, apiKey);
      descriptionDone = true;
    } catch (err) {
      console.error(`Vision API failed: ${err.message}`);
      console.error('Falling back to subagent mode.\n');
      if (extractedCSS) {
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        const cssOutput = { extractedAt: new Date().toISOString(), sourceUrl: url, ...extractedCSS };
        fs.writeFileSync(EXTRACTED_CSS_PATH, JSON.stringify(cssOutput, null, 2));
        console.log(`Saved extracted-css.json`);
      }
      writeBrandDescribePrompt(url);
      // Also write brand-spec prompt
      const cssSummary = extractedCSS?.summary || extractedCSS?.summary;
      if (cssSummary) {
        const cssDerivedSpec = computeCssDerivedSpec(cssSummary, detectedIsDark, dembrandtPalette);
        writeBrandSpecPrompt(cssDerivedSpec);
      }
      process.exit(0);
    }
  } else {
    // No API key — save CSS now (needed for generate-design-tokens.js later)
    if (extractedCSS) {
      if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      const cssOutput = { extractedAt: new Date().toISOString(), sourceUrl: url, ...extractedCSS };
      fs.writeFileSync(EXTRACTED_CSS_PATH, JSON.stringify(cssOutput, null, 2));
      console.log(`Saved extracted-css.json`);
    }
    writeBrandDescribePrompt(url);
    // Also write brand-spec prompt for subagent
    const cssSummary = extractedCSS?.summary;
    if (cssSummary) {
      const cssDerivedSpec = computeCssDerivedSpec(cssSummary, detectedIsDark, dembrandtPalette);
      writeBrandSpecPrompt(cssDerivedSpec);
      console.log('\nSpawn a SECOND subagent to:');
      console.log('  1. Read engine/output/brand-spec-prompt.txt');
      console.log('  2. Follow the instructions → read screenshot + answer 14 questions');
      console.log('  3. Write engine/output/brand-spec-vision.json');
      console.log('\nThen re-run: node engine/scripts/scrape-brand.js --description-ready --spec-ready\n');
    }
    process.exit(0);
  }

  // Step 3: Save standard outputs (includes detected theme + extracted CSS)
  if (descriptionDone && description) {
    saveOutputs(url, description, detectedIsDark, extractedCSS);
  }

  // Step 4: Brand Spec workflow
  // Compute CSS-derived spec from summary
  const cssSummary = extractedCSS?.summary;
  let cssDerivedSpec = null;
  if (cssSummary) {
    cssDerivedSpec = computeCssDerivedSpec(cssSummary, detectedIsDark, dembrandtPalette);
  }

  if (specReady) {
    // Subagent has written brand-spec-vision.json — merge and produce final brand-spec.json
    if (!fs.existsSync(BRAND_SPEC_VISION_PATH)) {
      console.error(`Error: --spec-ready flag set but ${BRAND_SPEC_VISION_PATH} not found.`);
      console.error('Run the brand-spec subagent first, then re-run with --spec-ready.');
      process.exit(1);
    }
    const visionResult = JSON.parse(fs.readFileSync(BRAND_SPEC_VISION_PATH, 'utf-8'));
    console.log('Loaded brand-spec vision answers from brand-spec-vision.json');

    if (!cssDerivedSpec) {
      console.error('Error: Cannot merge brand-spec — no CSS summary available.');
      console.error('Ensure extracted-css.json exists from the first run.');
      process.exit(1);
    }

    mergeBrandSpec(cssDerivedSpec, visionResult);
  } else if (apiKey && cssDerivedSpec) {
    // API mode: call Vision AI for brand-spec directly
    try {
      const visionResult = await produceSpecWithVision(SCREENSHOT_PATH, cssDerivedSpec, apiKey);
      // Save vision result for debugging/reference
      fs.writeFileSync(BRAND_SPEC_VISION_PATH, JSON.stringify(visionResult, null, 2));
      console.log(`Output: ${BRAND_SPEC_VISION_PATH}`);
      mergeBrandSpec(cssDerivedSpec, visionResult);
    } catch (err) {
      console.error(`Brand-spec Vision API failed: ${err.message}`);
      console.error('Falling back: writing brand-spec-prompt.txt for subagent.\n');
      writeBrandSpecPrompt(cssDerivedSpec);
      console.log('Spawn a subagent to answer the 14 questions, then re-run with --spec-ready.');
    }
  } else if (cssDerivedSpec) {
    // No API key, description came from subagent — write brand-spec prompt
    writeBrandSpecPrompt(cssDerivedSpec);
    console.log('\n' + '='.repeat(70));
    console.log('BRAND SPEC AUDIT NEEDED');
    console.log('='.repeat(70));
    console.log('\nSpawn a subagent to:');
    console.log('  1. Read engine/output/brand-spec-prompt.txt');
    console.log('  2. Follow the instructions → read screenshot + answer 14 questions');
    console.log('  3. Write engine/output/brand-spec-vision.json');
    console.log('\nThen re-run: node engine/scripts/scrape-brand.js --spec-ready\n');
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
