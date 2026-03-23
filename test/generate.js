/**
 * Test harness — runs the FULL engine pipeline in Node.js and saves output HTML.
 *
 * Usage:
 *   node test/generate.js          # Full pipeline (brand scraping + image generation)
 *   node test/generate.js --fast   # Skip image generation for quick iteration
 *
 * Reads: TEST SCORM/ folder + WEBSITE BRANDING REF.rtf for brand URL
 * Outputs: test/output.html
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const FAST_MODE = process.argv.includes('--fast');
const CORS_PROXY = 'https://cors-proxy.leoduncan-elearning.workers.dev';

// Allow specifying SCORM folder: node test/generate.js --scorm EV
const scormArgIdx = process.argv.indexOf('--scorm');
const SCORM_FOLDER = scormArgIdx !== -1 && process.argv[scormArgIdx + 1]
  ? process.argv[scormArgIdx + 1]
  : 'TEST SCORM';

// Set up browser-like globals for the IIFE modules
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Set = Set;
global.Map = Map;

// Node 18+ has native fetch, but ensure it's available globally
if (typeof global.fetch === 'undefined') {
  console.error('Node 18+ required for native fetch');
  process.exit(1);
}

// Also expose fetch on window for the engine modules
global.window.fetch = global.fetch;

// FileReader shim for image-generator (converts blob to data URL)
global.FileReader = class FileReader {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(buf => {
      const b64 = Buffer.from(buf).toString('base64');
      const mime = blob.type || 'image/png';
      this.result = 'data:' + mime + ';base64,' + b64;
      if (this.onload) this.onload();
    }).catch(() => {
      if (this.onerror) this.onerror(new Error('FileReader failed'));
    });
  }
};

// Load engine modules in order
const engineDir = path.join(__dirname, '..', 'engine');
const loadOrder = [
  'scorm-parser.js',
  'content-planner.js',
  'brand-scraper.js',
  'image-generator.js',
  'generator-css.js',
  'generator-data.js',
  'generator-app.js',
  'packager.js',
];

for (const file of loadOrder) {
  const code = fs.readFileSync(path.join(engineDir, file), 'utf8');
  try {
    new Function(code)();
  } catch (e) {
    console.error('Error loading ' + file + ':', e.message);
  }
}

// Expose window modules as globals
for (const key of Object.keys(global.window)) {
  if (typeof global[key] === 'undefined') {
    global[key] = global.window[key];
  }
}

// Read brand URL from the RTF file
function readBrandUrl() {
  const rtfPath = path.join(__dirname, '..', 'WEBSITE BRANDING REF.rtf');
  if (!fs.existsSync(rtfPath)) return null;
  const rtf = fs.readFileSync(rtfPath, 'utf8');
  const match = rtf.match(/https?:\/\/[^\s}]+/);
  return match ? match[0] : null;
}

// Build fileMap from SCORM folder
const scormDir = path.join(__dirname, '..', SCORM_FOLDER);

function buildFileMap(dir, prefix) {
  const map = new Map();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      const sub = buildFileMap(fullPath, relPath);
      for (const [k, v] of sub) map.set(k, v);
    } else {
      const buffer = fs.readFileSync(fullPath);
      map.set(relPath, {
        name: entry.name,
        text: () => Promise.resolve(buffer.toString('utf8')),
        arrayBuffer: () => Promise.resolve(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)),
      });
    }
  }
  return map;
}

async function run() {
  console.log('=== Modernisation Engine Test Pipeline ===');
  console.log('Mode: ' + (FAST_MODE ? 'FAST (no images)' : 'FULL (with brand scraping + AI images)'));
  console.log('SCORM folder: ' + SCORM_FOLDER);
  console.log('');

  // Build file map
  console.log('Building file map from ' + SCORM_FOLDER + ' folder...');
  const fileMap = buildFileMap(scormDir, '');
  console.log('Loaded ' + fileMap.size + ' files');

  const log = (msg) => console.log('  ' + msg);

  // Phase 1: Parse SCORM
  console.log('\n--- Phase 1: Parsing SCORM ---');
  const course = await window.SCORMParser.extractCourse(fileMap, log);

  // Phase 2: Content Planning
  console.log('\n--- Phase 2: Content Planning ---');
  const coursePlan = window.ContentPlanner.planCourse(course, log);

  // Phase 3: Brand Scraping
  var brand;
  const brandUrl = readBrandUrl();
  if (brandUrl && !FAST_MODE) {
    console.log('\n--- Phase 3: Brand Scraping ---');
    console.log('  Brand URL: ' + brandUrl);
    console.log('  CORS Proxy: ' + CORS_PROXY);
    brand = await window.BrandScraper.scrapeBrand(brandUrl, CORS_PROXY, log);
    console.log('  Primary color: ' + brand.colors.primary);
    console.log('  Heading font: ' + brand.typography.headingFont);
    console.log('  Mood: ' + brand.style.mood);
  } else {
    console.log('\n--- Phase 3: Using fallback brand ---');
    brand = {
      sourceUrl: brandUrl || 'https://example.com',
      colors: {
        primary: '#2D1B69', secondary: '#6B4C9A', accent: '#9B6DFF',
        background: '#FFFFFF', surface: '#F8F6FF', text: '#1A1A2E',
        textMuted: '#6B7280', success: '#10B981', error: '#EF4444',
        warning: '#F59E0B',
        gradient: 'linear-gradient(135deg, #2D1B69 0%, #6B4C9A 100%)',
      },
      typography: {
        headingFont: "'Inter', sans-serif", bodyFont: "'Inter', sans-serif",
        headingWeight: '700', baseSize: '16px', lineHeight: '1.6',
        headingSizes: { h1: '3rem', h2: '2.25rem', h3: '1.5rem' },
        fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      },
      style: { borderRadius: '12px', buttonStyle: 'gradient', cardStyle: 'glass', spacing: '1.5rem', mood: 'elegant' },
      logo: { url: '', alt: '' },
    };
  }

  // Phase 4: AI Image Generation
  var images;
  if (FAST_MODE) {
    console.log('\n--- Phase 4: Skipping image generation (fast mode) ---');
    images = { entries: [] };
  } else {
    console.log('\n--- Phase 4: AI Image Generation ---');
    images = await window.ImageGenerator.generateImages(course, brand, log, fileMap);
  }

  // Phase 5: Generate HTML
  console.log('\n--- Phase 5: Generating HTML ---');
  const html = window.GeneratorApp.generateHtml(coursePlan, brand, images);

  // Save output
  const outputPath = path.join(__dirname, 'output.html');
  fs.writeFileSync(outputPath, html);
  console.log('\nSaved output: ' + outputPath + ' (' + (html.length / 1024).toFixed(0) + ' KB)');

  // Sanity checks
  const hasNaN = html.includes('NaNpx');
  const hasUndefined = html.includes('undefinedpx');
  const hasDoublePx = html.includes('pxpx');
  if (hasNaN || hasUndefined || hasDoublePx) {
    console.error('\n*** CSS BUGS DETECTED ***');
    if (hasNaN) console.error('  - NaNpx found');
    if (hasUndefined) console.error('  - undefinedpx found');
    if (hasDoublePx) console.error('  - pxpx (double unit) found');
  } else {
    console.log('CSS sanity check: PASSED');
  }

  // Summary
  console.log('\n=== Pipeline Complete ===');
  console.log('Sections: ' + coursePlan.sections.length);
  console.log('Quiz banks: ' + coursePlan.quizBanks.length);
  console.log('Images generated: ' + (images.entries ? images.entries.filter(e => e.status === 'generated').length : 0));
  console.log('Brand: ' + brand.colors.primary + ' / ' + brand.typography.headingFont);
  console.log('Output: test/output.html');
}

run().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
