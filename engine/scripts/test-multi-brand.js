#!/usr/bin/env node
/**
 * Session 4 — Multi-brand calibration test
 *
 * Tests the new MD3 + archetype pipeline across cached matrix brands.
 * For each brand:
 *   1. Creates synthetic extracted-css.json from known brand signals
 *   2. Runs generate-design-tokens.js (MD3 palette + fonts, no Vision AI)
 *   3. Patches archetype manually (no ANTHROPIC_API_KEY)
 *   4. Builds course with reference layout
 *   5. Runs qa-course.js (structural QA)
 *   6. Reports results
 *
 * Usage:
 *   node engine/scripts/test-multi-brand.js [--brand sprig] [--all]
 *   node engine/scripts/test-multi-brand.js --build-only   (skip token gen, just rebuild)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT = path.join(ROOT, 'engine/output');
const MATRIX = path.join(OUTPUT, 'matrix');
const REF_LAYOUT = path.join(ROOT, 'engine/input/reference-course-layout.json');

// ─── Brand definitions (derived from brand-design.md + Stitch tokens) ───

const BRANDS = {
  sprig: {
    label: 'Sprig (dark, cyan, tech)',
    isDark: true,
    accentHex: '#00BFA5',       // vivid cyan-teal from brand description
    bgHex: '#0A0F1A',          // deep dark navy-black
    headlineFont: 'Space Grotesk',
    bodyFont: 'Manrope',
    borderRadius: '12px',       // moderately rounded, not pill
    archetype: 'tech-modern',
    category: 'dark',
  },
  aigents: {
    label: 'Aigents (light, editorial, monochrome)',
    isDark: false,
    accentHex: '#1A1A1A',       // monochromatic — black is the accent
    bgHex: '#FFFFFF',           // clean white
    headlineFont: 'Newsreader',
    bodyFont: 'Inter',
    borderRadius: '8px',        // clean minimal borders
    archetype: 'editorial',
    category: 'light',
  },
  landio: {
    label: 'Landio (dark, sleek, glassmorphism)',
    isDark: true,
    accentHex: '#60A5FA',       // soft muted blue glow
    bgHex: '#0B0D14',          // ultra-dark charcoal
    headlineFont: 'Manrope',
    bodyFont: 'Inter',
    borderRadius: '16px',       // rounded glass cards
    archetype: 'glassmorphist',
    category: 'dark',
  },
  fluence: {
    label: 'Fluence (light, lavender, warm)',
    isDark: false,
    accentHex: '#7C3AED',       // deep purple/amethyst
    bgHex: '#FAFAFA',          // near-white with warmth
    headlineFont: 'Manrope',
    bodyFont: 'Be Vietnam Pro',
    borderRadius: '16px',       // generous rounded corners
    archetype: 'warm-organic',
    category: 'light-gradient',
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────

function createSyntheticExtractedCss(brand) {
  const b = BRANDS[brand];
  return {
    extractedAt: new Date().toISOString(),
    sourceUrl: `synthetic-from-matrix/${brand}`,
    raw: {
      headings: [{ fontFamily: b.headlineFont, fontWeight: '700', fontSize: '48px', color: b.isDark ? '#ffffff' : '#1a1a1a' }],
      paragraphs: [{ fontFamily: b.bodyFont, fontWeight: '400', fontSize: '16px', color: b.isDark ? '#e0e0e0' : '#333333' }],
      buttons: [{ fontFamily: b.bodyFont, fontWeight: '600', fontSize: '14px', borderRadius: b.borderRadius }],
      cards: [],
      backgrounds: [],
      links: [],
      inputs: [],
      navItems: [],
    },
    summary: {
      headlineFont: b.headlineFont,
      bodyFont: b.bodyFont,
      dominantBorderRadius: b.borderRadius,
      buttonBorderRadius: b.borderRadius,
      dominantShadow: '',
      accentColors: [{ hex: b.accentHex, count: 5 }],
      backgroundColors: [{ hex: b.bgHex, count: 10 }],
      allColors: [
        { hex: b.bgHex, count: 10 },
        { hex: b.accentHex, count: 5 },
        { hex: b.isDark ? '#ffffff' : '#1a1a1a', count: 8 },
      ],
      allRadii: [{ value: b.borderRadius, count: 6 }],
      allFonts: [
        { family: b.headlineFont, count: 10 },
        { family: b.bodyFont, count: 15 },
      ],
    },
  };
}

function run(cmd, label) {
  console.log(`  [run] ${label || cmd}`);
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
    return { ok: true, output: out };
  } catch (err) {
    return { ok: false, output: err.stdout || '', error: err.stderr || err.message };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const brandArg = args.find((a, i) => args[i - 1] === '--brand');
  const buildOnly = args.includes('--build-only');
  const brandsToTest = brandArg ? [brandArg] : Object.keys(BRANDS);

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  Session 4 — Multi-Brand Calibration Test              ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  // Ensure reference layout exists
  if (!fs.existsSync(REF_LAYOUT)) {
    console.error('ERROR: reference-course-layout.json not found');
    process.exit(1);
  }

  // Copy reference layout to output
  fs.copyFileSync(REF_LAYOUT, path.join(OUTPUT, 'course-layout.json'));
  console.log('[ok] Using reference-course-layout.json as test course\n');

  const results = {};

  for (const brand of brandsToTest) {
    const b = BRANDS[brand];
    if (!b) { console.log(`[skip] Unknown brand: ${brand}`); continue; }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  BRAND: ${b.label}`);
    console.log(`  Archetype: ${b.archetype} | isDark: ${b.isDark}`);
    console.log(`  Accent: ${b.accentHex} | BG: ${b.bgHex}`);
    console.log(`${'═'.repeat(60)}\n`);

    const brandResult = { brand, archetype: b.archetype, category: b.category };

    if (!buildOnly) {
      // 1. Write synthetic extracted-css.json
      const css = createSyntheticExtractedCss(brand);
      fs.writeFileSync(path.join(OUTPUT, 'extracted-css.json'), JSON.stringify(css, null, 2));
      console.log('  [ok] Wrote synthetic extracted-css.json');

      // Copy brand-design.md from matrix if available
      const matrixDesign = path.join(MATRIX, brand, 'brand-design.md');
      if (fs.existsSync(matrixDesign)) {
        fs.copyFileSync(matrixDesign, path.join(OUTPUT, 'brand-design.md'));
        console.log('  [ok] Copied brand-design.md from matrix cache');
      }

      // Copy screenshot from matrix if available
      const matrixScreenshot = path.join(MATRIX, brand, 'brand-screenshot.png');
      if (fs.existsSync(matrixScreenshot)) {
        fs.copyFileSync(matrixScreenshot, path.join(OUTPUT, 'brand-screenshot.png'));
        console.log('  [ok] Copied brand-screenshot.png from matrix cache');
      }

      // 2. Generate design tokens (MD3 pipeline)
      const tokenResult = run('node engine/scripts/generate-design-tokens.js', 'generate-design-tokens.js');

      if (tokenResult.ok) {
        console.log('  [ok] Design tokens generated');

        // 3. Patch archetype (no Vision AI available)
        const tokensPath = path.join(OUTPUT, 'design-tokens.json');
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf-8'));
        tokens.archetype = {
          name: b.archetype,
          confidence: 0.9,
          reasoning: `Manually assigned for calibration test: ${b.label}`,
          styleParams: {},
        };
        fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
        console.log(`  [ok] Patched archetype → ${b.archetype}`);

        // Log key token values for calibration review
        console.log(`  [tokens] seed: ${tokens.seedColor}`);
        console.log(`  [tokens] primary: ${tokens.colors?.primary}`);
        console.log(`  [tokens] background: ${tokens.colors?.background}`);
        console.log(`  [tokens] surface-container: ${tokens.colors?.['surface-container']}`);
        console.log(`  [tokens] fonts: ${tokens.fonts?.headline} / ${tokens.fonts?.body}`);
        brandResult.seedColor = tokens.seedColor;
        brandResult.primary = tokens.colors?.primary;
        brandResult.background = tokens.colors?.background;
        brandResult.fonts = tokens.fonts;
      } else {
        console.log(`  [FAIL] Token generation failed`);
        console.log(tokenResult.error?.slice(0, 500));
        brandResult.tokenError = tokenResult.error?.slice(0, 200);
        results[brand] = brandResult;
        continue;
      }
    } else {
      console.log('  [skip] --build-only: reusing existing design-tokens.json');
    }

    // 4. Build course
    const buildResult = run('node engine/scripts/build-course.js', 'build-course.js');
    if (buildResult.ok) {
      console.log('  [ok] Course built');
      // Save a copy for comparison
      const courseOut = path.join(OUTPUT, 'course.html');
      const brandCopy = path.join(MATRIX, brand, `course-new-pipeline.html`);
      if (fs.existsSync(courseOut)) {
        fs.copyFileSync(courseOut, brandCopy);
        console.log(`  [ok] Saved to matrix/${brand}/course-new-pipeline.html`);
      }
      brandResult.buildOk = true;
    } else {
      console.log(`  [FAIL] Build failed`);
      console.log(buildResult.error?.slice(0, 500));
      brandResult.buildOk = false;
      brandResult.buildError = buildResult.error?.slice(0, 200);
      results[brand] = brandResult;
      continue;
    }

    // 5. Structural QA
    const qaResult = run('node engine/scripts/qa-course.js', 'qa-course.js');
    brandResult.qaOutput = qaResult.output;
    if (qaResult.ok) {
      // Count pass/fail from output
      const passMatch = qaResult.output.match(/(\d+)\s*passed/i);
      const failMatch = qaResult.output.match(/(\d+)\s*failed/i);
      const warnMatch = qaResult.output.match(/(\d+)\s*warn/i);
      brandResult.qaPassed = passMatch ? parseInt(passMatch[1]) : '?';
      brandResult.qaFailed = failMatch ? parseInt(failMatch[1]) : 0;
      brandResult.qaWarnings = warnMatch ? parseInt(warnMatch[1]) : 0;
      console.log(`  [qa] Passed: ${brandResult.qaPassed}, Failed: ${brandResult.qaFailed}, Warnings: ${brandResult.qaWarnings}`);
    } else {
      console.log(`  [FAIL] QA crashed`);
      console.log(qaResult.error?.slice(0, 300));
      brandResult.qaCrash = true;
    }

    results[brand] = brandResult;
  }

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  MULTI-BRAND CALIBRATION RESULTS                      ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const table = [];
  for (const [brand, r] of Object.entries(results)) {
    table.push({
      Brand: brand,
      Category: r.category,
      Archetype: r.archetype,
      Seed: r.seedColor || '-',
      Primary: r.primary || '-',
      Build: r.buildOk ? '✓' : '✗',
      'QA Pass': r.qaPassed ?? '-',
      'QA Fail': r.qaFailed ?? '-',
      'QA Warn': r.qaWarnings ?? '-',
    });
  }
  console.table(table);

  // Save results JSON
  const resultsPath = path.join(OUTPUT, 'calibration-results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n[ok] Results saved to engine/output/calibration-results.json`);
  console.log(`[ok] Course HTML copies saved to matrix/<brand>/course-new-pipeline.html`);
  console.log('\nNext: Open each course-new-pipeline.html in the browser to visually compare.\n');
}

main();
