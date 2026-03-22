/**
 * Test harness — runs the engine pipeline in Node.js and saves output HTML.
 * Usage: node test/generate.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Set up browser-like globals for the IIFE modules
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
global.window = dom.window;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Set = Set;
global.Map = Map;

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

// Expose window modules as globals (modules reference each other via window.X or just X)
for (const key of Object.keys(global.window)) {
  if (typeof global[key] === 'undefined') {
    global[key] = global.window[key];
  }
}

// Build fileMap from TEST SCORM folder
const scormDir = path.join(__dirname, '..', 'TEST SCORM');

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
      // Create a File-like object with .text() and .arrayBuffer()
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
  console.log('Building file map from TEST SCORM folder...');
  const fileMap = buildFileMap(scormDir, '');
  console.log('Loaded ' + fileMap.size + ' files');

  const log = (msg) => console.log('  ' + msg);

  // Phase 1: Parse SCORM
  console.log('\nPhase 1: Parsing SCORM...');
  const course = await window.SCORMParser.extractCourse(fileMap, log);

  // Phase 2: Content Planning
  console.log('\nPhase 2: Content Planning...');
  const coursePlan = window.ContentPlanner.planCourse(course, log);

  // Phase 3: Brand (use fallback)
  console.log('\nPhase 3: Using fallback brand...');
  const brand = {
    sourceUrl: 'https://www.backgrounds.supply',
    colors: {
      primary: '#2D1B69', secondary: '#6B4C9A', accent: '#9B6DFF',
      background: '#FFFFFF', surface: '#F8F6FF', text: '#1A1A2E',
      textMuted: '#6B7280', success: '#10B981', error: '#EF4444',
      warning: '#F59E0B',
      gradient: 'linear-gradient(135deg, #2D1B69 0%, #6B4C9A 100%)',
    },
    typography: {
      headingFont: "'Inter', sans-serif",
      bodyFont: "'Inter', sans-serif",
      headingWeight: '700',
      baseSize: '16px',
      lineHeight: '1.6',
      headingSizes: { h1: '3rem', h2: '2.25rem', h3: '1.5rem' },
      fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    },
    style: {
      borderRadius: '12px',
      buttonStyle: 'gradient',
      cardStyle: 'glass',
      spacing: '1.5rem',
      mood: 'elegant',
    },
    logo: { url: '', alt: '' },
  };

  // Phase 4: Skip images
  console.log('\nPhase 4: Skipping image generation...');
  const images = { entries: [] };

  // Phase 5: Generate HTML
  console.log('\nPhase 5: Generating HTML...');
  const html = window.GeneratorApp.generateHtml(coursePlan, brand, images);

  // Save output
  const outputPath = path.join(__dirname, 'output.html');
  fs.writeFileSync(outputPath, html);
  console.log('\nSaved output: ' + outputPath + ' (' + (html.length / 1024).toFixed(0) + ' KB)');

  // Quick sanity check
  const hasNaN = html.includes('NaNpx');
  const hasUndefined = html.includes('undefinedpx');
  const hasDoublePx = html.includes('pxpx');
  if (hasNaN || hasUndefined || hasDoublePx) {
    console.error('\n*** CSS BUGS DETECTED ***');
    if (hasNaN) console.error('  - NaNpx found');
    if (hasUndefined) console.error('  - undefinedpx found');
    if (hasDoublePx) console.error('  - pxpx (double unit) found');
  } else {
    console.log('\nCSS sanity check: PASSED');
  }
}

run().catch(err => {
  console.error('Pipeline error:', err);
  process.exit(1);
});
