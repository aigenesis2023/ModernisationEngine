#!/usr/bin/env node
/**
 * V5 Course Reviewer — Vision-Based Quality Audit
 *
 * Captures Playwright screenshots of every section (desktop + mobile),
 * then outputs them for Claude Code Vision review with structured prompts.
 *
 * This is the SUBJECTIVE quality gate — Vision reviews the screenshots open-ended
 * and flags anything that looks wrong or feels off. No checklist, no categories.
 * Let it notice what it notices.
 *
 * Deterministic checks (spacing, collapsed sections, z-index) live in qa-interactive.js.
 *
 * Usage: node engine/scripts/review-course.js
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
const COURSE_PATH = path.resolve(ROOT, 'engine/output/course.html');
const LAYOUT_PATH = path.resolve(ROOT, 'engine/output/course-layout.json');

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

    await desktopPage.waitForTimeout(1800);
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
  await mobilePage.waitForTimeout(1800);
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
  await mobilePage.waitForTimeout(1800);
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
  await mobilePage.waitForTimeout(1800);
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

// ─── Vision Review Prompt ────────────────────────────────────────────
// Structured criteria across 4 disciplines (graphic design, UX, UI,
// instructional design). Deterministic checks (contrast ratios, padding
// px values, overflow) are already handled by qa-interactive.js — this
// prompt focuses on VISUAL JUDGEMENT that only a human eye (or Vision
// model) can assess.
const REVIEW_PROMPT = `
You are a creative director at an award-winning digital learning agency reviewing a deep-scroll
e-learning course. Your standard is: "Would I put this in our portfolio?" Review EVERY screenshot
(desktop sections + mobile) and flag issues with specific section numbers.

## 1. GRAPHIC DESIGN

- **Typography craft:** Does the type hierarchy FEEL right — not just size, but weight, spacing,
  and rhythm? Are headings commanding attention or blending into body text? Is there typographic
  contrast between sections (a pullquote should feel different from a text block)?
- **Colour harmony:** Do the colours work together across the full scroll? Is accent colour used
  with intention (emphasis moments) or scattered randomly? On dark themes: is text clearly legible
  on ALL background variants? On light themes: do borders/dividers have enough presence?
- **Whitespace & breathing room:** Are sections breathing or cramped? Is there intentional spacing
  variation (tight sections → generous pause → dense section) or is every section the same height?
  Do pullquotes and stat callouts command space around them, or are they squeezed?
- **Image quality & framing:** Do images feel intentional and high quality, or generic/stocky?
  Are image containers well-proportioned? Is the text overlay on hero/full-bleed images readable
  from EVERY part of the image (not just where the gradient is darkest)?
- **Visual weight & balance:** Scan the full page flow — is there a balanced mix of heavy sections
  (dark, image-rich, dense) and light sections (minimal, text-focused, airy)? Or does the page
  feel front-loaded or monotonous?

## 2. UX DESIGN

- **Scroll narrative:** Does the page tell a visual story as you scroll? Is there a clear
  beginning (hero grabs attention), middle (content builds), and end (resolution/action)?
  Or does it feel like a random stack of components?
- **Component transitions:** Do sections flow into each other or do they feel abruptly cut?
  Are there visual connectors (colour shifts, spacing changes) that guide the eye?
- **Interactive affordance:** Do clickable elements LOOK clickable? Can you tell what's a button,
  what's a card you can flip, what's expandable? Or do interactive elements blend into static content?
- **Mobile experience:** Is the mobile layout intentional or just "desktop squished"? Do cards
  stack gracefully? Is touch-friendly spacing maintained? Does the hero work at mobile width?

## 3. UI DESIGN

- **Component polish:** Do cards have consistent shadows, borders, and rounding within the same
  section? Do buttons look like they belong to the same design system? Is there visual consistency
  across all instances of the same component type?
- **State clarity:** For quizzes — is it clear which choice is selected, what the feedback means?
  For tabs — is the active tab visually distinct? For accordions — can you tell which are
  open vs closed?
- **Micro-details:** Are icons the right size relative to their text? Are decorative elements
  (borders, gradients, overlays) enhancing or cluttering? Are empty states handled (no broken
  image boxes, no missing content gaps)?

## 4. INSTRUCTIONAL DESIGN (visual aspects only)

- **Content hierarchy:** Can a learner scan the page and understand the structure? Are section
  headings informative (not generic like "Overview" or "Key Concepts")? Do visual cues (icons,
  colours, component type changes) signal shifts in content type?
- **Engagement rhythm:** Is there visual variety — or do 3+ sections in a row look identical?
  Are interactive components (quizzes, flashcards, tabs) spaced throughout, or clustered?
- **Assessment visibility:** Do quiz/assessment sections stand out as "pause and think" moments,
  or do they blend into the flow and get scrolled past?

## 5. LAYOUT VARIANTS

Some components have multiple layout variants. If you see these in the course, check they render
correctly:

- **Hero variants:** centered-overlay (text centered over full image), split-screen (image + text
  side by side), minimal-text (stripped-down, fewer elements). Does the chosen variant look
  intentional and well-executed?
- **Graphic-text variants:** split (image + text columns), overlap (image partially overlaps text
  area), full-overlay (text over image with gradient). Is the text readable in full-overlay? Does
  the overlap feel designed or broken?
- **Bento variants:** grid-4 (even grid), wide-2 (two wide cards), featured (one large + smaller
  cards). Do cards balance visually?
- **Tabs variants:** horizontal (tabs across top), vertical (tabs on left side). Does the vertical
  layout work or feel cramped?
- **Other variant components (accordion, mcq, stat-callout, timeline, comparison):** Does each
  variant look polished and consistent with the brand?

## HOW TO REPORT

For each issue:
1. Name the **section number** (from the section map)
2. Describe **what's wrong** specifically (not "looks off" — say "heading has no visual weight
   against the dark background" or "cards have uneven heights creating a ragged grid")
3. Rate severity: **critical** (would reject in portfolio), **moderate** (noticeable but functional),
   **minor** (polish detail)
4. Suggest which **engine file** to fix (build-course.js fill function, hydrate.js animation,
   generateHead CSS, generation-engine.md prompt)

ALL FIXES GO IN THE ENGINE — never in output files. If the same issue appears across multiple
sections, flag it once as a pattern, not N separate issues.
`;

main().catch(err => {
  console.error('Review failed:', err.message);
  process.exit(1);
});
