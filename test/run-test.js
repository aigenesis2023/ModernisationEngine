/**
 * Test Harness — Runs the engine pipeline headlessly in Node.js.
 * Reads a real SCORM folder, runs parsing + content planning + generation,
 * and saves the output HTML + a detailed report.
 *
 * Usage: node test/run-test.js
 *
 * Requires: npm install --save-dev jsdom
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// ---- Browser API shims ----

// Set up a fake window/document environment
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = global;
global.document = dom.window.document;
global.DOMParser = dom.window.DOMParser;
global.Set = Set;
global.Map = Map;
global.Promise = Promise;
global.URL = URL;
global.React = { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({ current: null }), createElement: () => null };
global.ReactDOM = { createRoot: () => ({ render: () => {} }) };
global.IntersectionObserver = class { observe() {} disconnect() {} };
global.JSZip = class {
  constructor() { this.files = {}; }
  file(name, data) { this.files[name] = data; return this; }
  folder(name) { return this; }
  generateAsync() { return Promise.resolve(new Uint8Array()); }
};

// ---- Load engine modules in order ----

function loadModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf-8');
  try {
    const fn = new Function('window', 'document', 'DOMParser', 'Set', 'Map', 'URL', 'React', 'ReactDOM', 'IntersectionObserver', 'JSZip', 'fetch', 'console', code);
    fn(global, global.document, global.DOMParser, Set, Map, URL, global.React, global.ReactDOM, global.IntersectionObserver, global.JSZip, global.fetch, console);
  } catch (e) {
    console.error('Failed to load ' + filePath + ':', e.message);
  }
}

const engineDir = path.join(__dirname, '..', 'engine');
loadModule(path.join(engineDir, 'scorm-parser.js'));
loadModule(path.join(engineDir, 'content-planner.js'));
loadModule(path.join(engineDir, 'brand-scraper.js'));
loadModule(path.join(engineDir, 'image-generator.js'));
loadModule(path.join(engineDir, 'generator-css.js'));
loadModule(path.join(engineDir, 'generator-data.js'));
loadModule(path.join(engineDir, 'generator-app.js'));

console.log('Modules loaded.');
console.log('  SCORMParser:', typeof global.SCORMParser);
console.log('  ContentPlanner:', typeof global.ContentPlanner);
console.log('  BrandScraper:', typeof global.BrandScraper);
console.log('  GeneratorCSS:', typeof global.GeneratorCSS);
console.log('  GeneratorData:', typeof global.GeneratorData);
console.log('  GeneratorApp:', typeof global.GeneratorApp);

// ---- Build file map from SCORM folder ----

function buildFileMap(scormDir) {
  const fileMap = new Map();

  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = prefix ? prefix + '/' + entry.name : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else {
        // Create a File-like object with .text() and .arrayBuffer() methods
        fileMap.set(relativePath, {
          name: entry.name,
          text: () => Promise.resolve(fs.readFileSync(fullPath, 'utf-8')),
          arrayBuffer: () => Promise.resolve(fs.readFileSync(fullPath).buffer),
        });
      }
    }
  }

  walk(scormDir, '');
  return fileMap;
}

// ---- Hardcoded brand profile (scraped from backgrounds.supply) ----

function getTestBrandProfile() {
  return {
    sourceUrl: 'https://www.backgrounds.supply/?ref=onepagelove',
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#ec4899',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#1a1a2e',
      textMuted: '#6b7280',
      success: '#10b981',
      error: '#ef4444',
      warning: '#f59e0b',
      gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    },
    typography: {
      headingFont: 'Inter',
      bodyFont: 'Inter',
      fontImportUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
      baseSize: 16,
      headingSizes: { h1: 40, h2: 32, h3: 24 },
      lineHeight: 1.6,
      headingWeight: 700,
      bodyWeight: 400,
    },
    style: {
      borderRadius: '12px',
      cardStyle: 'elevated',
      buttonStyle: 'gradient',
      imageStyle: 'rounded',
      mood: 'creative',
      spacing: { unit: 8, section: 64, element: 16 },
    },
    logo: undefined,
  };
}

// ---- Main test runner ----

async function runTest() {
  const scormDir = path.join(__dirname, '..', 'TEST SCORM');
  const outputDir = path.join(__dirname);

  if (!fs.existsSync(scormDir)) {
    console.error('SCORM folder not found at:', scormDir);
    process.exit(1);
  }

  const log = (msg) => console.log(msg);

  // Phase 1: Parse SCORM
  console.log('\n=== PHASE 1: SCORM EXTRACTION ===');
  const fileMap = buildFileMap(scormDir);
  console.log('File map built:', fileMap.size, 'files');

  const course = await global.SCORMParser.extractCourse(fileMap, log);
  console.log('\nExtracted:', course.slides.length, 'slides');
  console.log('Question banks:', course.questionBanks.length);
  console.log('Variables:', course.variables.length);

  // Save raw extraction report
  const extractionReport = {
    meta: course.meta,
    slideCount: course.slides.length,
    slides: course.slides.map(s => ({
      id: s.id,
      title: s.title,
      type: s.type,
      slideNumber: s.slideNumber,
      elementCount: s.elements.length,
      elementTypes: s.elements.map(e => e.type),
      layerCount: s.layers.length,
      layerNames: s.layers.map(l => l.name),
      triggerCount: s.triggers.length,
      hasAudio: !!s.audioNarrationId || s.elements.some(e => e.type === 'audio'),
    })),
    questionBanks: course.questionBanks.map(qb => ({
      id: qb.id,
      title: qb.title,
      group: qb.group,
      questionCount: qb.questions.length,
    })),
    variables: course.variables.slice(0, 20),
    navigation: course.navigation,
    extractionReport: course.extractionReport,
  };

  // Phase 2: Content Planning
  console.log('\n=== PHASE 2: CONTENT PLANNING ===');
  const coursePlan = global.ContentPlanner.planCourse(course, log);

  const planReport = {
    sectionCount: coursePlan.sections.length,
    sections: coursePlan.sections.map(s => ({
      id: s.id,
      type: s.type,
      title: s.title,
      slideCount: s.slides.length,
      slides: s.slides.map(sl => ({
        id: sl.id,
        title: sl.originalTitle,
        type: sl.type,
        presentation: sl.presentation,
        headingCount: sl.content.headings.length,
        bodyTextCount: sl.content.bodyTexts.length,
        calloutCount: sl.content.callouts.length,
        imageCount: sl.content.images.length,
        videoCount: sl.content.videos.length,
        audioCount: sl.content.audio.length,
        layerCount: sl.layers.length,
        interactionCount: sl.interactions.length,
        triggerCount: sl.triggers.length,
        stateCount: sl.states.length,
        hasQuiz: !!sl.quizData,
        hasForm: sl.formFields.length > 0,
        // Include actual content for review
        headings: sl.content.headings.map(h => h.text),
        bodyTexts: sl.content.bodyTexts,
        callouts: sl.content.callouts,
        layerNames: sl.layers.map(l => l.name),
      })),
    })),
    verification: coursePlan.verification,
  };

  // Phase 3: Brand (use hardcoded profile)
  console.log('\n=== PHASE 3: BRAND ===');
  const brand = getTestBrandProfile();
  console.log('Using test brand profile (backgrounds.supply)');

  // Phase 4: Skip image generation (no network in test)
  console.log('\n=== PHASE 4: IMAGE GENERATION (SKIPPED) ===');
  const images = { entries: [] };
  console.log('Skipping image generation for test run');

  // Phase 5: Generate HTML
  console.log('\n=== PHASE 5: HTML GENERATION ===');
  const html = global.GeneratorApp.generateHtml(coursePlan, brand, images);
  console.log('Generated HTML:', (html.length / 1024).toFixed(0), 'KB');

  // Save outputs
  fs.writeFileSync(path.join(outputDir, 'output.html'), html);
  console.log('\nSaved: test/output.html');

  const fullReport = {
    generatedAt: new Date().toISOString(),
    extraction: extractionReport,
    plan: planReport,
    brandProfile: brand,
    outputSizeKB: Math.round(html.length / 1024),
  };
  fs.writeFileSync(path.join(outputDir, 'report.json'), JSON.stringify(fullReport, null, 2));
  console.log('Saved: test/report.json');

  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log('Slides extracted:', course.slides.length);
  console.log('Sections planned:', coursePlan.sections.length);
  console.log('Content retention:', coursePlan.verification.contentRetention + '%');
  console.log('Output size:', (html.length / 1024).toFixed(0), 'KB');
  console.log('\nDone! Open test/output.html in a browser to preview.');
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
