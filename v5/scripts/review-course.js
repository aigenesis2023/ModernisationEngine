#!/usr/bin/env node
/**
 * V5 Course Reviewer — Vision-Based Quality Audit
 *
 * Captures Playwright screenshots of every section (desktop + mobile),
 * then outputs them for Claude Code Vision review with structured prompts.
 *
 * This is the SUBJECTIVE quality gate — it catches things computed checks can't:
 *   - Visual rhythm and monotony (three identical layouts in a row)
 *   - Gradient-on-gradient readability
 *   - Whether interactive elements look clickable
 *   - Mobile layout feeling intentional vs squashed desktop
 *   - Emotional arc — does the density build and breathe
 *
 * Deterministic checks (contrast ratios, spacing, overlap) live in qa-interactive.js.
 *
 * Usage: node v5/scripts/review-course.js
 *
 * Output:
 *   screenshots/section-00.jpeg     — Hero section
 *   screenshots/section-01.jpeg     — First content section
 *   screenshots/section-NN.jpeg     — Each subsequent section
 *   screenshots/completion.jpeg     — Course completion block
 *   screenshots/mobile-hero.jpeg    — Mobile viewport hero
 *   screenshots/mobile-mid.jpeg     — Mobile viewport mid-page
 *   screenshots/mobile-end.jpeg     — Mobile viewport end
 *
 * These screenshots are reviewed by Claude Code (vision). Fixes go
 * into the engine (build-course.js, hydrate.js, etc.), never into output.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCREENSHOTS_DIR = path.resolve(ROOT, 'screenshots');
const COURSE_PATH = path.resolve(ROOT, 'v5/output/course.html');
const LAYOUT_PATH = path.resolve(ROOT, 'v5/output/course-layout.json');

async function main() {
  console.log('V5 Course Reviewer — Vision-Based Quality Audit');
  console.log('================================================\n');

  // Validate inputs
  if (!fs.existsSync(COURSE_PATH)) {
    console.error('ERROR: course.html not found. Run build-course.js first.');
    process.exit(1);
  }
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('ERROR: course-layout.json not found.');
    process.exit(1);
  }

  // Ensure screenshots directory exists
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // Read layout to get section info
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  const sections = layout.sections || [];
  const courseTitle = layout.course?.title || 'Course';
  const archetype = layout.metadata?.archetype || 'unknown';
  console.log(`Course: "${courseTitle}" (archetype: ${archetype})`);
  console.log(`Sections: ${sections.length}\n`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  // ─── Desktop screenshots ───────────────────────────────────────────
  console.log('--- Desktop (1440x900) ---');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewportSize({ width: 1440, height: 900 });
  await desktopPage.goto(`file://${COURSE_PATH}`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(2000);

  // Screenshot each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionId = section.sectionId || `section-${String(i).padStart(2, '0')}`;
    const filename = `section-${String(i).padStart(2, '0')}.jpeg`;

    const found = await desktopPage.evaluate((id) => {
      let el = document.getElementById(id);
      if (!el) el = document.querySelector(`[id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
        return true;
      }
      return false;
    }, sectionId);

    if (!found) {
      await desktopPage.evaluate((pct) => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, maxScroll * pct);
      }, i / sections.length);
    }

    await desktopPage.waitForTimeout(300);
    await desktopPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, filename),
      type: 'jpeg',
      quality: 90,
    });
    console.log(`  [ok] ${filename} — ${section.title || '(hero)'}`);
  }

  // Completion section (scroll to bottom)
  await desktopPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await desktopPage.waitForTimeout(300);
  await desktopPage.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'completion.jpeg'),
    type: 'jpeg',
    quality: 90,
  });
  console.log('  [ok] completion.jpeg — Course completion block');

  await desktopPage.close();

  // ─── Mobile screenshots ────────────────────────────────────────────
  console.log('\n--- Mobile (390x844) ---');
  const mobilePage = await browser.newPage();
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await mobilePage.goto(`file://${COURSE_PATH}`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  // Mobile hero
  await mobilePage.evaluate(() => window.scrollTo(0, 0));
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'mobile-hero.jpeg'),
    type: 'jpeg',
    quality: 90,
  });
  console.log('  [ok] mobile-hero.jpeg');

  // Mobile mid-page (40%)
  await mobilePage.evaluate(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, maxScroll * 0.4);
  });
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'mobile-mid.jpeg'),
    type: 'jpeg',
    quality: 90,
  });
  console.log('  [ok] mobile-mid.jpeg');

  // Mobile end (90%)
  await mobilePage.evaluate(() => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, maxScroll * 0.9);
  });
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'mobile-end.jpeg'),
    type: 'jpeg',
    quality: 90,
  });
  console.log('  [ok] mobile-end.jpeg');

  await mobilePage.close();
  await browser.close();

  // ─── Summary + Vision review instructions ──────────────────────────
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.jpeg'));
  console.log(`\n================================================`);
  console.log(`Screenshots captured: ${files.length} files in screenshots/\n`);
  files.sort().forEach(f => console.log(`  ${f}`));

  // Build section map for review context
  const sectionMap = sections.map((s, i) => {
    const types = (s.components || []).map(c => c.type).join(', ');
    const width = s.sectionWidth || 'standard';
    return `  ${String(i).padStart(2, '0')}: "${s.title || '(hero)'}" [${types}] (${width})`;
  }).join('\n');

  console.log(`\n================================================`);
  console.log(`VISION REVIEW PROMPT`);
  console.log(`================================================\n`);
  console.log(`Review the screenshots above for "${courseTitle}" (archetype: ${archetype}).`);
  console.log(`\nSection map:\n${sectionMap}\n`);
  console.log(REVIEW_PROMPT);
}

// ─── Structured Vision Review Prompt ─────────────────────────────────
// This prompt guides Claude Code Vision to evaluate subjective quality.
// Deterministic checks (contrast, spacing, overflow) are in qa-interactive.js.
const REVIEW_PROMPT = `
For each screenshot, evaluate these 5 categories. Give a PASS/WARN/FAIL verdict
with a one-line reason. Only flag genuine issues — do not nitpick.

## 1. VISUAL RHYTHM
Does the section sequence feel varied or monotonous?
- FAIL: Three or more consecutive sections with identical visual structure
- WARN: Two similar layouts in a row, or a section that feels flat/empty
- PASS: Good variation in density, width, and component types between sections

## 2. READABILITY
Can all text be read comfortably?
- FAIL: Text lost in a busy background, gradient-on-gradient that's unreadable
- WARN: Text that requires squinting, overly thin fonts on complex backgrounds
- PASS: All text is clear and legible
(Note: solid-background contrast is checked computationally — focus on gradients,
overlays, and complex visual situations only)

## 3. COMPONENT QUALITY
Do interactive elements look like interactive elements?
- FAIL: Buttons that don't look clickable, cards with no visual affordance
- WARN: Quiz choices that blend into the background, tabs that look like plain text
- PASS: Clear visual affordances — buttons look tappable, cards look interactive

## 4. MOBILE COHERENCE
Does the mobile layout feel intentional?
- FAIL: Content clearly cut off, overlapping elements, unreadable text
- WARN: Layout that works but feels like squashed desktop rather than designed for mobile
- PASS: Mobile layout feels considered — appropriate stacking, readable text, usable targets

Output format — one line per category, per section group:
  [RHYTHM]     PASS/WARN/FAIL — reason
  [READABILITY] PASS/WARN/FAIL — reason
  [COMPONENTS] PASS/WARN/FAIL — reason
  [MOBILE]     PASS/WARN/FAIL — reason

End with an overall verdict and a prioritised list of fixes (if any).
Fixes go in the ENGINE (build-course.js, hydrate.js, generation-engine.md, etc.) — never in output files.
`;

main().catch(err => {
  console.error('Review failed:', err.message);
  process.exit(1);
});
