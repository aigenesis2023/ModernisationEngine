#!/usr/bin/env node
/**
 * V5 Course Reviewer — Automated Screenshot Capture
 *
 * Takes Playwright screenshots of every section in the generated course,
 * plus the brand screenshot for visual comparison. Outputs to screenshots/
 * with consistent naming for easy before/after comparison.
 *
 * Usage: node v5/scripts/review-course.js
 *
 * Output:
 *   screenshots/brand.jpeg          — Brand URL reference
 *   screenshots/section-00.jpeg     — Hero section
 *   screenshots/section-01.jpeg     — First content section
 *   screenshots/section-NN.jpeg     — Each subsequent section
 *   screenshots/footer.jpeg         — Footer / course complete
 *   screenshots/mobile-hero.jpeg    — Mobile viewport hero
 *   screenshots/mobile-mid.jpeg     — Mobile viewport mid-page
 *
 * These screenshots are reviewed by Claude Code (vision) to identify
 * layout issues, spacing problems, and visual quality gaps. Fixes go
 * into the engine (build-course.js, hydrate.js, etc.), never into output.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SCREENSHOTS_DIR = path.resolve(ROOT, 'screenshots');
const COURSE_PATH = path.resolve(ROOT, 'v5/output/course.html');
const LAYOUT_PATH = path.resolve(ROOT, 'v5/output/course-layout.json');
const BRAND_SCREENSHOT = path.resolve(ROOT, 'v5/output/brand-screenshot.png');

async function main() {
  console.log('V5 Course Reviewer — Screenshot Capture');
  console.log('========================================\n');

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

  // Copy brand screenshot for reference
  if (fs.existsSync(BRAND_SCREENSHOT)) {
    fs.copyFileSync(BRAND_SCREENSHOT, path.join(SCREENSHOTS_DIR, 'brand.jpeg'));
    console.log('[ok] Copied brand screenshot for reference');
  }

  // Read layout to get section IDs
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  const sections = layout.sections || [];
  console.log(`[ok] Found ${sections.length} sections to capture\n`);

  // Launch browser
  const browser = await chromium.launch({ headless: true });

  // ─── Desktop screenshots ───────────────────────────────────────────
  console.log('--- Desktop (1440x900) ---');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewportSize({ width: 1440, height: 900 });

  // Load via file:// protocol (no server needed)
  await desktopPage.goto(`file://${COURSE_PATH}`, { waitUntil: 'networkidle' });
  // Wait for fonts and images to load
  await desktopPage.waitForTimeout(2000);

  // Screenshot each section
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const sectionId = section.sectionId || `section-${String(i).padStart(2, '0')}`;
    const filename = `section-${String(i).padStart(2, '0')}.jpeg`;

    // Scroll to section
    const found = await desktopPage.evaluate((id) => {
      // Try finding by ID
      let el = document.getElementById(id);
      if (!el) {
        // Try finding section with matching ID in any attribute
        el = document.querySelector(`[id="${id}"]`);
      }
      if (el) {
        el.scrollIntoView({ behavior: 'instant', block: 'start' });
        return true;
      }
      return false;
    }, sectionId);

    if (!found) {
      // Fallback: scroll by percentage
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

  // Footer / completion section
  await desktopPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await desktopPage.waitForTimeout(300);
  await desktopPage.screenshot({
    path: path.join(SCREENSHOTS_DIR, 'footer.jpeg'),
    type: 'jpeg',
    quality: 90,
  });
  console.log('  [ok] footer.jpeg — Course complete + footer');

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

  // Mobile mid-page (scroll to ~40%)
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

  await mobilePage.close();
  await browser.close();

  // ─── Summary ───────────────────────────────────────────────────────
  const files = fs.readdirSync(SCREENSHOTS_DIR).filter(f => f.endsWith('.jpeg'));
  console.log(`\n========================================`);
  console.log(`Review complete: ${files.length} screenshots saved to screenshots/`);
  console.log(`\nFiles:`);
  files.sort().forEach(f => console.log(`  ${f}`));
  console.log(`\nReview these screenshots, identify issues, fix the engine, rebuild.`);
}

main().catch(err => {
  console.error('Review failed:', err.message);
  process.exit(1);
});
