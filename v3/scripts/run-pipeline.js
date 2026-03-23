#!/usr/bin/env node
/**
 * V3 Pipeline Orchestrator
 *
 * Runs the full Stitch-enhanced pipeline in order:
 * 1. Plan visual media (agent decides HF photo vs Stitch illustration per component)
 * 2. Generate Design DNA (Stitch brand styling)
 * 3. Generate Stitch illustrations (for components marked "illustration")
 * 4. Build course (with DNA tokens + illustrations)
 *
 * Prerequisites:
 * - v3/output/course-layout.json exists (from design-course.js)
 * - v3/output/brand-profile.json exists (from scrape-brand.js)
 * - v3/output/images/ exists (from generate-images.js — HF photos)
 * - STITCH_API_KEY set in environment
 *
 * Usage:
 *   STITCH_API_KEY=... node v3/scripts/run-pipeline.js
 *   STITCH_API_KEY=... node v3/scripts/run-pipeline.js --skip-illustrations
 *   STITCH_API_KEY=... node v3/scripts/run-pipeline.js --skip-dna
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
const skipIllustrations = args.includes('--skip-illustrations');
const skipDNA = args.includes('--skip-dna');

function run(label, command) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(60)}\n`);
  execSync(command, { stdio: 'inherit', cwd: resolve('.') });
}

function check(filePath, label) {
  if (!existsSync(resolve(filePath))) {
    console.error(`ERROR: ${label} not found at ${filePath}`);
    console.error('Run the pipeline first (extract → scrape-brand → design-course → generate-images)');
    process.exit(1);
  }
}

// Verify prerequisites
check('v3/output/course-layout.json', 'Course layout');
check('v3/output/brand-profile.json', 'Brand profile');

if (!process.env.STITCH_API_KEY) {
  console.error('ERROR: Set STITCH_API_KEY environment variable');
  process.exit(1);
}

console.log('\n🔧 V3 STITCH-ENHANCED PIPELINE\n');

// Step 1: Plan visual media
run('Step 1: Planning visual media (HF photo vs Stitch illustration)',
  'node v3/scripts/plan-visual-media.js');

// Step 2: Generate Design DNA
if (!skipDNA) {
  run('Step 2: Generating Design DNA from Stitch',
    'node v3/scripts/generate-design-dna.js');
} else {
  console.log('\nSkipping Design DNA generation (--skip-dna)');
}

// Step 3: Generate Stitch illustrations
if (!skipIllustrations) {
  run('Step 3: Generating Stitch illustrations',
    'node v3/scripts/generate-stitch-illustrations.js');
} else {
  console.log('\nSkipping illustration generation (--skip-illustrations)');
}

// Step 4: Build course
run('Step 4: Building course with enhanced theme + illustrations',
  'node v3/scripts/build-course.js');

console.log(`\n${'═'.repeat(60)}`);
console.log('  V3 PIPELINE COMPLETE');
console.log(`${'═'.repeat(60)}`);
console.log('\nPreview: open index.html in browser');
console.log('Codespace: https://your-codespace-url:9090/index.html');
