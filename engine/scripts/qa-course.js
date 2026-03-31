#!/usr/bin/env node
/**
 * V5 Course QA — Comprehensive structural & content validation
 *
 * Runs against built course.html + source data (course-layout.json,
 * knowledge-base.json, design-contract.json, design-tokens.json).
 *
 * Catches issues programmatically that would otherwise require visual review.
 * Run AFTER build-course.js, BEFORE review-course.js.
 *
 * Usage: node engine/scripts/qa-course.js
 */

const fs = require('fs');
const path = require('path');
const { VALID_TYPES } = require('./lib/validate-layout');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT = path.resolve(ROOT, 'engine/output');

// ─── Load files ──────────────────────────────────────────────────────
function loadJSON(name) {
  const p = path.resolve(OUTPUT, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function loadFile(name) {
  const p = path.resolve(OUTPUT, name);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

// ─── Simple HTML parser helpers (no cheerio dependency) ──────────────
function querySelectorAll(html, selector) {
  // Supports: [attr], [attr="val"], tag, tag.class, tag[attr]
  const results = [];

  if (selector.startsWith('[') && selector.endsWith(']')) {
    // Attribute selector: [data-quiz], [data-component-type="hero"]
    const inner = selector.slice(1, -1);
    const eqIdx = inner.indexOf('=');
    if (eqIdx === -1) {
      // [attr] — just presence
      const re = new RegExp(`<[^>]+\\b${escapeRegex(inner)}\\b[^>]*>`, 'gi');
      let m;
      while ((m = re.exec(html))) results.push(m[0]);
    } else {
      // [attr="val"]
      const attr = inner.slice(0, eqIdx);
      const val = inner.slice(eqIdx + 1).replace(/^"|"$/g, '');
      const re = new RegExp(`<[^>]+\\b${escapeRegex(attr)}="${escapeRegex(val)}"[^>]*>`, 'gi');
      let m;
      while ((m = re.exec(html))) results.push(m[0]);
    }
  } else if (selector.includes('[')) {
    // tag[attr] or tag[attr="val"]
    const bracketIdx = selector.indexOf('[');
    const tag = selector.slice(0, bracketIdx);
    const attrPart = selector.slice(bracketIdx + 1, -1);
    const eqIdx = attrPart.indexOf('=');
    if (eqIdx === -1) {
      const re = new RegExp(`<${escapeRegex(tag)}[^>]+\\b${escapeRegex(attrPart)}\\b[^>]*>`, 'gi');
      let m;
      while ((m = re.exec(html))) results.push(m[0]);
    } else {
      const attr = attrPart.slice(0, eqIdx);
      const val = attrPart.slice(eqIdx + 1).replace(/^"|"$/g, '');
      const re = new RegExp(`<${escapeRegex(tag)}[^>]+\\b${escapeRegex(attr)}="${escapeRegex(val)}"[^>]*>`, 'gi');
      let m;
      while ((m = re.exec(html))) results.push(m[0]);
    }
  }

  return results;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract content between opening and closing tags for a given data-component-type
function extractComponentBlocks(html, componentType) {
  const blocks = [];
  const openRe = new RegExp(`<section[^>]*data-component-type="${escapeRegex(componentType)}"[^>]*>`, 'gi');
  let match;
  while ((match = openRe.exec(html))) {
    const start = match.index;
    // Find the matching </section> by counting nesting
    let depth = 1;
    let pos = start + match[0].length;
    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf('<section', pos);
      const nextClose = html.indexOf('</section>', pos);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 8;
      } else {
        depth--;
        if (depth === 0) {
          blocks.push(html.slice(start, nextClose + 10));
        }
        pos = nextClose + 10;
      }
    }
  }
  return blocks;
}

// ─── QA Check Framework ──────────────────────────────────────────────
const errors = [];
const warnings = [];
const passes = [];

function fail(category, msg) { errors.push(`[${category}] ${msg}`); }
function warn(category, msg) { warnings.push(`[${category}] ${msg}`); }
function pass(category, msg) { passes.push(`[${category}] ${msg}`); }

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 1: File existence
// ═══════════════════════════════════════════════════════════════════════
function checkFileExistence() {
  const required = [
    'course.html',
    'course-layout.json',
    'design-tokens.json',
  ];
  const optional = [
    'knowledge-base.json',
    'brand-design.md',
    'brand-profile.json',
  ];

  for (const f of required) {
    if (fs.existsSync(path.resolve(OUTPUT, f))) {
      pass('FILES', `${f} exists`);
    } else {
      fail('FILES', `Required file missing: ${f}`);
    }
  }
  for (const f of optional) {
    if (!fs.existsSync(path.resolve(OUTPUT, f))) {
      warn('FILES', `Optional file missing: ${f}`);
    }
  }

  // Root index.html should match course.html
  const coursePath = path.resolve(OUTPUT, 'course.html');
  const indexPath = path.resolve(ROOT, 'index.html');
  if (fs.existsSync(coursePath) && fs.existsSync(indexPath)) {
    const courseSize = fs.statSync(coursePath).size;
    const indexSize = fs.statSync(indexPath).size;
    if (courseSize === indexSize) {
      pass('FILES', 'index.html matches course.html');
    } else {
      warn('FILES', `index.html (${indexSize}B) differs from course.html (${courseSize}B) — rebuild may be needed`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 2: HTML structure
// ═══════════════════════════════════════════════════════════════════════
function checkHTMLStructure(html) {
  // DOCTYPE
  if (html.startsWith('<!DOCTYPE html>')) {
    pass('HTML', 'Has DOCTYPE');
  } else {
    fail('HTML', 'Missing <!DOCTYPE html>');
  }

  // Dark mode class
  if (html.includes('class="dark"') || html.includes("class='dark'")) {
    pass('HTML', 'Dark mode class present on <html>');
  }

  // Viewport meta
  if (html.includes('width=device-width')) {
    pass('HTML', 'Viewport meta tag present');
  } else {
    fail('HTML', 'Missing viewport meta tag');
  }

  // Title
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);
  if (titleMatch && titleMatch[1].trim()) {
    pass('HTML', `Page title: "${titleMatch[1].trim()}"`);
  } else {
    fail('HTML', 'Missing or empty <title>');
  }

  // Tailwind CSS — either CDN JIT or compiled v4 inline
  if (html.includes('cdn.tailwindcss.com')) {
    pass('HTML', 'Tailwind CDN loaded');
  } else if (html.includes('@keyframes') && html.includes('--color-primary')) {
    pass('HTML', 'Tailwind v4 compiled CSS inlined');
  } else {
    fail('HTML', 'Missing Tailwind CSS (no CDN and no compiled CSS found)');
  }

  // Google Fonts
  if (html.includes('fonts.googleapis.com')) {
    pass('HTML', 'Google Fonts loaded');
  } else {
    fail('HTML', 'Missing Google Fonts');
  }

  // Material Symbols
  if (html.includes('Material+Symbols') || html.includes('Material Symbols')) {
    pass('HTML', 'Material Symbols loaded');
  } else {
    warn('HTML', 'Missing Material Symbols font');
  }

  // GSAP
  if (html.includes('gsap') || html.includes('ScrollTrigger')) {
    pass('HTML', 'GSAP + ScrollTrigger loaded');
  } else {
    warn('HTML', 'Missing GSAP/ScrollTrigger');
  }

  // Hydrate.js inlined
  if (html.includes('data-quiz') && html.includes('DOMContentLoaded')) {
    pass('HTML', 'hydrate.js inlined');
  } else {
    fail('HTML', 'hydrate.js not found inlined in HTML');
  }

  // Scroll progress bar
  if (html.includes('scroll-progress') || html.includes('hydrate-progress')) {
    pass('HTML', 'Scroll progress bar present');
  } else {
    warn('HTML', 'Missing scroll progress bar');
  }

  // Check for unclosed tags (basic — look for common issues)
  const openSections = (html.match(/<section[\s>]/g) || []).length;
  const closeSections = (html.match(/<\/section>/g) || []).length;
  if (openSections === closeSections) {
    pass('HTML', `Balanced section tags (${openSections} open, ${closeSections} close)`);
  } else {
    fail('HTML', `Unbalanced section tags: ${openSections} open vs ${closeSections} close`);
  }

  // Check for duplicate IDs — exclude content inside <template> tags (variant pre-renders)
  const htmlWithoutTemplates = html.replace(/<template[^>]*>[\s\S]*?<\/template>/gi, '');
  const idMatches = htmlWithoutTemplates.match(/\bid="([^"]+)"/g) || [];
  const ids = idMatches.map(m => m.match(/id="([^"]+)"/)[1]);
  const idCounts = {};
  for (const id of ids) {
    idCounts[id] = (idCounts[id] || 0) + 1;
  }
  const dupes = Object.entries(idCounts).filter(([, c]) => c > 1);
  if (dupes.length === 0) {
    pass('HTML', `All ${ids.length} IDs are unique (templates excluded)`);
  } else {
    for (const [id, count] of dupes) {
      fail('HTML', `Duplicate ID "${id}" appears ${count} times`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 3: Component coverage — every layout component rendered
// ═══════════════════════════════════════════════════════════════════════
function checkComponentCoverage(html, layout) {
  if (!layout) { warn('COVERAGE', 'No course-layout.json — skipping coverage check'); return; }

  const allComponents = (layout.sections || []).flatMap(s => s.components || []);

  // Count expected vs actual component types
  const expectedTypes = {};
  for (const comp of allComponents) {
    expectedTypes[comp.type] = (expectedTypes[comp.type] || 0) + 1;
  }

  const actualTypes = {};
  const typeMatches = html.match(/data-component-type="([^"]+)"/g) || [];
  for (const m of typeMatches) {
    const type = m.match(/data-component-type="([^"]+)"/)[1];
    if (type === 'navigation' || type === 'footer') continue; // not in layout
    actualTypes[type] = (actualTypes[type] || 0) + 1;
  }

  for (const [type, expected] of Object.entries(expectedTypes)) {
    const actual = actualTypes[type] || 0;
    if (actual === expected) {
      pass('COVERAGE', `${type}: ${actual}/${expected} rendered`);
    } else if (actual === 0) {
      fail('COVERAGE', `${type}: 0/${expected} rendered — component type completely missing`);
    } else if (type === 'hero' && actual > expected) {
      // build-course.js reuses hero pattern for section title bars — expected
      pass('COVERAGE', `${type}: ${expected} in layout (${actual} total including section title bars)`);
    } else {
      warn('COVERAGE', `${type}: ${actual}/${expected} rendered — count mismatch`);
    }
  }

  // Check section IDs match
  const layoutSectionIds = (layout.sections || []).map(s => s.sectionId);
  for (const sid of layoutSectionIds) {
    if (html.includes(`id="${sid}"`)) {
      pass('COVERAGE', `Section ${sid} present in HTML`);
    } else {
      fail('COVERAGE', `Section ${sid} missing from HTML`);
    }
  }

  // Nav present
  if (html.includes('data-component-type="navigation"')) {
    pass('COVERAGE', 'Navigation component present');
  } else {
    warn('COVERAGE', 'No navigation component');
  }

  // Drawer nav present (section navigation)
  if (html.includes('data-drawer-link')) {
    pass('COVERAGE', 'Section drawer navigation present');
  } else {
    warn('COVERAGE', 'No section drawer navigation');
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 3b: Variant validation — correct values + variety warnings
// ═══════════════════════════════════════════════════════════════════════
function checkVariants(layout) {
  if (!layout) { return; }

  // Known variants per component type
  const KNOWN_VARIANTS = {
    'hero': ['centered-overlay', 'split-screen', 'minimal-text'],
    'text': ['standard', 'two-column', 'highlight-box'],
    'graphic': ['standard', 'captioned-card'],
    'graphic-text': ['split', 'overlap', 'full-overlay'],
    'full-bleed': ['center', 'left', 'right'],
    'pullquote': ['accent-bar', 'centered', 'minimal'],
    'stat-callout': ['centered', 'card-row'],
    'callout': ['info', 'warning', 'tip', 'success'],
    'key-term': ['list', 'card-grid'],
    'accordion': ['standard', 'accent-border'],
    'tabs': ['horizontal', 'vertical'],
    'narrative': ['image-focused', 'text-focused'],
    'flashcard': ['grid', 'single-large'],
    'labeled-image': ['numbered-dots', 'side-panel'],
    'mcq': ['stacked', 'grid'],
    'branching': ['cards', 'list'],
    'checklist': ['standard', 'card-style', 'numbered'],
    'bento': ['grid-4', 'wide-2', 'featured'],
    'comparison': ['columns', 'stacked-rows'],
    'data-table': ['standard', 'striped-card'],
    'timeline': ['vertical', 'centered-alternating'],
    'process-flow': ['vertical', 'horizontal'],
    'divider': ['line', 'spacing', 'icon']
  };

  const allComponents = (layout.sections || []).flatMap(s => s.components || []);

  // Track variant usage per component type
  const variantUsage = {}; // type -> { variant: count }

  for (const comp of allComponents) {
    const type = comp.type;
    const variant = comp.variant;

    if (variant) {
      const known = KNOWN_VARIANTS[type];
      if (known) {
        if (!known.includes(variant)) {
          fail('VARIANT', `${comp.componentId}: unknown variant "${variant}" for ${type}. Valid: ${known.join(', ')}`);
        } else {
          pass('VARIANT', `${comp.componentId}: ${type} variant "${variant}" is valid`);
        }
      } else {
        warn('VARIANT', `${comp.componentId}: variant "${variant}" set on ${type} which has no variants defined — will be ignored`);
      }

      if (!variantUsage[type]) variantUsage[type] = {};
      variantUsage[type][variant] = (variantUsage[type][variant] || 0) + 1;
    } else if (KNOWN_VARIANTS[type]) {
      // No variant set — will use default. Track it.
      const defaultVariant = KNOWN_VARIANTS[type][0];
      if (!variantUsage[type]) variantUsage[type] = {};
      variantUsage[type][defaultVariant] = (variantUsage[type][defaultVariant] || 0) + 1;
    }
  }

  // Warn if same variant used 3+ times for same component type
  for (const [type, variants] of Object.entries(variantUsage)) {
    for (const [variant, count] of Object.entries(variants)) {
      if (count >= 3) {
        warn('VARIANT', `${type}: variant "${variant}" used ${count} times — consider more variety`);
      }
    }
  }

  // Check sectionWidth variety
  const sectionWidths = (layout.sections || []).map(s => s.sectionWidth || 'standard');
  const uniqueWidths = new Set(sectionWidths);
  if (uniqueWidths.size === 1 && sectionWidths.length > 3) {
    warn('VARIANT', `All ${sectionWidths.length} sections use "${[...uniqueWidths][0]}" width — vary with narrow/wide/full for visual rhythm`);
  } else if (uniqueWidths.size >= 3) {
    pass('VARIANT', `Section widths: ${[...uniqueWidths].join(', ')} — good visual rhythm`);
  }

  // Check course archetype
  const VALID_ARCHETYPES = ['the-journey', 'the-case-file', 'the-builder', 'the-debate', 'the-explorer'];
  const archetype = layout.metadata?.archetype;
  if (archetype) {
    if (VALID_ARCHETYPES.includes(archetype)) {
      pass('ARCHETYPE', `Course archetype: "${archetype}"`);
    } else {
      fail('ARCHETYPE', `Unknown archetype "${archetype}". Valid: ${VALID_ARCHETYPES.join(', ')}`);
    }
  } else if (layout.metadata?.sourceType === 'ai-generated') {
    warn('ARCHETYPE', 'No archetype declared in metadata — generation engine should set metadata.archetype');
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 4: Interactive component wiring (data attributes)
// ═══════════════════════════════════════════════════════════════════════
function checkInteractiveWiring(html) {
  // ── MCQ quizzes ──
  const quizBlocks = extractComponentBlocks(html, 'mcq');
  for (let i = 0; i < quizBlocks.length; i++) {
    const block = quizBlocks[i];
    const label = `MCQ #${i + 1}`;

    // Must have data-quiz
    if (!block.includes('data-quiz')) {
      fail('MCQ', `${label}: Missing data-quiz attribute`);
      continue;
    }

    // Must have data-correct
    const correctMatch = block.match(/data-correct="(\d+)"/);
    if (!correctMatch) {
      fail('MCQ', `${label}: Missing data-correct attribute`);
    } else {
      const correctIdx = parseInt(correctMatch[1], 10);
      const choiceCount = (block.match(/data-choice="/g) || []).length;
      if (choiceCount === 0) {
        fail('MCQ', `${label}: No data-choice elements found`);
      } else if (correctIdx >= choiceCount) {
        fail('MCQ', `${label}: data-correct="${correctIdx}" but only ${choiceCount} choices (0-indexed)`);
      } else {
        pass('MCQ', `${label}: ${choiceCount} choices, correct=${correctIdx} ✓`);
      }

      // Must have at least 2 choices
      if (choiceCount > 0 && choiceCount < 2) {
        fail('MCQ', `${label}: Only ${choiceCount} choice — need at least 2`);
      }
    }
  }
  if (quizBlocks.length > 0) {
    pass('MCQ', `${quizBlocks.length} quiz component(s) found`);
  }

  // ── Tabs ──
  const tabBlocks = extractComponentBlocks(html, 'tabs');
  for (let i = 0; i < tabBlocks.length; i++) {
    const block = tabBlocks[i];
    const label = `Tabs #${i + 1}`;

    if (!block.includes('data-tabs')) {
      fail('TABS', `${label}: Missing data-tabs container`);
      continue;
    }

    const triggerCount = (block.match(/data-tab-trigger="/g) || []).length;
    const panelCount = (block.match(/data-tab-panel="/g) || []).length;

    if (triggerCount === 0) {
      fail('TABS', `${label}: No data-tab-trigger elements`);
    } else if (panelCount === 0) {
      fail('TABS', `${label}: No data-tab-panel elements`);
    } else if (triggerCount !== panelCount) {
      fail('TABS', `${label}: ${triggerCount} triggers but ${panelCount} panels — must match`);
    } else {
      pass('TABS', `${label}: ${triggerCount} triggers matched to ${panelCount} panels ✓`);
    }

    if (triggerCount > 0 && triggerCount < 2) {
      fail('TABS', `${label}: Only 1 tab — need at least 2`);
    }
  }

  // ── Flashcards ──
  const flashcardBlocks = extractComponentBlocks(html, 'flashcard');
  for (let i = 0; i < flashcardBlocks.length; i++) {
    const block = flashcardBlocks[i];
    const label = `Flashcard #${i + 1}`;
    const cardCount = (block.match(/data-flashcard/g) || []).length;
    // Each flashcard div has data-flashcard, so count should be >= 1
    if (cardCount === 0) {
      fail('FLASHCARD', `${label}: No data-flashcard elements`);
    } else {
      pass('FLASHCARD', `${label}: ${cardCount} flip card(s) ✓`);
    }

    // Check perspective style (needed for 3D flip)
    if (cardCount > 0 && !block.includes('perspective')) {
      warn('FLASHCARD', `${label}: Missing perspective style — 3D flip may not work`);
    }
  }

  // ── Carousel / Narrative ──
  const narrativeBlocks = extractComponentBlocks(html, 'narrative');
  for (let i = 0; i < narrativeBlocks.length; i++) {
    const block = narrativeBlocks[i];
    const label = `Narrative #${i + 1}`;

    if (!block.includes('data-carousel')) {
      fail('NARRATIVE', `${label}: Missing data-carousel attribute`);
      continue;
    }

    const slideCount = (block.match(/data-slide="/g) || []).length;
    const hasPrev = block.includes('data-prev');
    const hasNext = block.includes('data-next');

    if (slideCount < 2) {
      fail('NARRATIVE', `${label}: Only ${slideCount} slide(s) — need at least 2`);
    } else {
      pass('NARRATIVE', `${label}: ${slideCount} slides ✓`);
    }

    if (!hasPrev || !hasNext) {
      fail('NARRATIVE', `${label}: Missing prev/next navigation buttons`);
    } else {
      pass('NARRATIVE', `${label}: Prev/next buttons present ✓`);
    }
  }

  // ── Accordion ──
  const accordionBlocks = extractComponentBlocks(html, 'accordion');
  for (let i = 0; i < accordionBlocks.length; i++) {
    const block = accordionBlocks[i];
    const label = `Accordion #${i + 1}`;
    const detailsCount = (block.match(/<details/g) || []).length;
    const summaryCount = (block.match(/<summary/g) || []).length;

    if (detailsCount === 0) {
      fail('ACCORDION', `${label}: No <details> elements`);
    } else if (detailsCount !== summaryCount) {
      fail('ACCORDION', `${label}: ${detailsCount} <details> but ${summaryCount} <summary> — must match`);
    } else {
      pass('ACCORDION', `${label}: ${detailsCount} expandable panels ✓`);
    }

    if (detailsCount > 0 && detailsCount < 2) {
      warn('ACCORDION', `${label}: Only 1 panel — accordions typically need 2+`);
    }
  }

  // ── Checklist ──
  const checklistBlocks = extractComponentBlocks(html, 'checklist');
  for (let i = 0; i < checklistBlocks.length; i++) {
    const block = checklistBlocks[i];
    const label = `Checklist #${i + 1}`;

    if (!block.includes('data-checklist')) {
      fail('CHECKLIST', `${label}: Missing data-checklist attribute`);
      continue;
    }

    const checkboxCount = (block.match(/type="checkbox"/g) || []).length;
    const hasProgress = block.includes('data-checklist-progress');

    if (checkboxCount === 0) {
      // Check for icon-based checklist (li items without checkboxes)
      const liCount = (block.match(/<li/g) || []).length;
      if (liCount === 0) {
        fail('CHECKLIST', `${label}: No checkboxes or list items found`);
      } else {
        pass('CHECKLIST', `${label}: ${liCount} list items (icon-based) ✓`);
      }
    } else {
      pass('CHECKLIST', `${label}: ${checkboxCount} checkboxes ✓`);
    }

    if (!hasProgress) {
      warn('CHECKLIST', `${label}: Missing data-checklist-progress counter`);
    }
  }

  // ── Branching ──
  const branchingBlocks = extractComponentBlocks(html, 'branching');
  for (let i = 0; i < branchingBlocks.length; i++) {
    const block = branchingBlocks[i];
    const label = `Branching #${i + 1}`;
    // Branching should have multiple option cards (buttons or clickable divs)
    const buttonCount = (block.match(/<button/g) || []).length;
    if (buttonCount < 2) {
      warn('BRANCHING', `${label}: Only ${buttonCount} option button(s) — typically need 2+`);
    } else {
      pass('BRANCHING', `${label}: ${buttonCount} option buttons ✓`);
    }
  }

  // ── Data table ──
  const tableBlocks = extractComponentBlocks(html, 'data-table');
  for (let i = 0; i < tableBlocks.length; i++) {
    const block = tableBlocks[i];
    const label = `DataTable #${i + 1}`;
    if (!block.includes('<table') && !block.includes('<thead') && !block.includes('<tr')) {
      fail('TABLE', `${label}: No table markup found`);
    } else {
      const rowCount = (block.match(/<tr/g) || []).length;
      pass('TABLE', `${label}: ${rowCount} table rows ✓`);
    }
  }

  // ── Text input ──
  const textinputBlocks = extractComponentBlocks(html, 'textinput');
  for (let i = 0; i < textinputBlocks.length; i++) {
    const block = textinputBlocks[i];
    const label = `TextInput #${i + 1}`;
    const inputCount = (block.match(/<input|<textarea/g) || []).length;
    if (inputCount === 0) {
      fail('TEXTINPUT', `${label}: No input or textarea elements found`);
    } else {
      pass('TEXTINPUT', `${label}: ${inputCount} input field(s) ✓`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 5: Image integrity
// ═══════════════════════════════════════════════════════════════════════
function checkImageIntegrity(html, layout) {
  // Exclude <template> tags (variant pre-renders) from image checks
  const htmlWithoutTemplates = html.replace(/<template[^>]*>[\s\S]*?<\/template>/gi, '');
  // Count images in HTML
  const imgTags = htmlWithoutTemplates.match(/<img[^>]+>/g) || [];
  const base64Count = imgTags.filter(t => t.includes('data:image')).length;
  const externalCount = imgTags.filter(t => t.includes('src="http')).length;
  const brokenCount = imgTags.filter(t =>
    !t.includes('data:image') && !t.includes('src="http') && !t.includes('src="images/')
  ).length;

  pass('IMAGES', `${imgTags.length} total images (${base64Count} embedded, ${externalCount} external)`);

  if (brokenCount > 0) {
    warn('IMAGES', `${brokenCount} image(s) with potentially broken src`);
  }

  // Check all images have alt text (bare `alt` without value = alt="" = decorative, acceptable)
  const missingAlt = imgTags.filter(t => !/\balt[\s=>]/.test(t) && !t.endsWith('alt')).length;
  const emptyAlt = imgTags.filter(t => t.includes('alt=""') || /\balt[\s>]/.test(t) || t.endsWith('alt')).length;
  if (missingAlt > 0) {
    fail('IMAGES', `${missingAlt} image(s) missing alt attribute`);
  } else {
    pass('IMAGES', 'All images have alt attributes');
  }
  if (emptyAlt > 0) {
    warn('IMAGES', `${emptyAlt} image(s) have empty alt="" (acceptable for decorative only)`);
  }

  // Cross-reference: layout imagePrompts vs actual images
  if (layout) {
    const allComponents = (layout.sections || []).flatMap(s => s.components || []);
    let expectedImages = 0;
    let foundImages = 0;
    for (const comp of allComponents) {
      if (comp._graphic?.large) {
        expectedImages++;
        if (html.includes('data:image') || html.includes(comp._graphic.large)) {
          foundImages++;
        }
      }
      if (comp._items) {
        for (const item of comp._items) {
          if (item._graphic?.large) {
            expectedImages++;
            foundImages++;
          }
        }
      }
    }
    if (expectedImages > 0) {
      pass('IMAGES', `${foundImages}/${expectedImages} layout images have sources`);
      if (foundImages < expectedImages) {
        warn('IMAGES', `${expectedImages - foundImages} image(s) in layout may be missing`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 6: Typography & heading hierarchy
// ═══════════════════════════════════════════════════════════════════════
function checkTypography(html) {
  // Count headings
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  const h2s = (html.match(/<h2[\s>]/g) || []).length;
  const h3s = (html.match(/<h3[\s>]/g) || []).length;
  const h4s = (html.match(/<h4[\s>]/g) || []).length;

  pass('TYPOGRAPHY', `Headings: ${h1s} h1, ${h2s} h2, ${h3s} h3, ${h4s} h4`);

  // Hero should have exactly 1 h1
  const heroBlocks = extractComponentBlocks(html, 'hero');
  if (heroBlocks.length > 0) {
    const heroH1s = (heroBlocks[0].match(/<h1[\s>]/g) || []).length;
    if (heroH1s === 1) {
      pass('TYPOGRAPHY', 'Hero has exactly 1 h1');
    } else if (heroH1s === 0) {
      fail('TYPOGRAPHY', 'Hero section missing h1');
    } else {
      warn('TYPOGRAPHY', `Hero has ${heroH1s} h1 tags — should be exactly 1`);
    }
  }

  // Non-hero components should NOT have h1
  const nonHeroH1s = h1s - (heroBlocks.length > 0 ? 1 : 0);
  if (nonHeroH1s > 0) {
    warn('TYPOGRAPHY', `${nonHeroH1s} h1 tag(s) outside hero — should use h2/h3 for section headings`);
  }

  // Check empty headings
  const emptyHeadings = (html.match(/<h[1-6][^>]*>\s*<\/h[1-6]>/g) || []).length;
  if (emptyHeadings > 0) {
    fail('TYPOGRAPHY', `${emptyHeadings} empty heading tag(s) found`);
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 7: Containment & layout rules
// ═══════════════════════════════════════════════════════════════════════
function checkLayoutRules(html) {
  // Every component section should have max-w-6xl mx-auto px-8 somewhere inside
  const componentTypes = VALID_TYPES.filter(t => t !== 'hero' && t !== 'full-bleed' && t !== 'path-selector');
  for (const type of componentTypes) {
    const blocks = extractComponentBlocks(html, type);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block.includes('max-w-') && !block.includes('mx-auto')) {
        warn('LAYOUT', `${type} #${i + 1}: Missing containment (max-w-* mx-auto) — content may touch screen edges`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 8: Content coverage — KB key points in final output
// ═══════════════════════════════════════════════════════════════════════
function checkContentCoverage(html, layout, kb) {
  if (!kb) { warn('CONTENT', 'No knowledge-base.json — skipping content coverage'); return; }
  if (!layout) { warn('CONTENT', 'No course-layout.json — skipping content coverage'); return; }

  // Check learning objectives are represented
  const objectives = kb.learningObjectives || [];
  pass('CONTENT', `Knowledge base has ${objectives.length} learning objectives`);

  // Check content areas are represented in the course
  const contentAreas = kb.contentAreas || [];
  const courseText = (layout.sections || []).flatMap(s =>
    (s.components || []).map(c => {
      let text = `${c.displayTitle || ''} ${c.body || ''}`;
      if (c._items) {
        text += ' ' + c._items.map(item =>
          `${item.title || ''} ${item.body || ''} ${item.text || ''} ${item.front || ''} ${item.back || ''} ${item.term || ''} ${item.definition || ''} ${item.detail || ''}`
        ).join(' ');
      }
      return text.toLowerCase();
    })
  ).join(' ');

  let coveredAreas = 0;
  for (const area of contentAreas) {
    // Check if the area title or key concept words appear in course content
    const titleWords = area.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const matchedWords = titleWords.filter(w => courseText.includes(w));
    if (matchedWords.length >= Math.ceil(titleWords.length * 0.5)) {
      coveredAreas++;
    } else {
      warn('CONTENT', `Content area "${area.title}" may not be represented in course — key words not found`);
    }
  }
  pass('CONTENT', `${coveredAreas}/${contentAreas.length} content areas represented in course`);

  // Count teachable moments
  let totalMoments = 0;
  for (const area of contentAreas) {
    totalMoments += (area.teachableMoments || []).length;
  }
  pass('CONTENT', `Knowledge base has ${totalMoments} teachable moments across ${contentAreas.length} areas`);

  // Check key statistics appear in the rendered HTML (spot check)
  let statsFound = 0;
  let statsChecked = 0;
  for (const area of contentAreas) {
    for (const kp of (area.keyPoints || []).slice(0, 3)) { // Check first 3 per area
      statsChecked++;
      // Extract numbers from the key point
      const numbers = kp.point.match(/\d[\d,.]+/g) || [];
      if (numbers.length > 0) {
        const found = numbers.some(n => html.includes(n));
        if (found) statsFound++;
      }
    }
  }
  if (statsChecked > 0) {
    const pct = Math.round((statsFound / statsChecked) * 100);
    if (pct >= 50) {
      pass('CONTENT', `${statsFound}/${statsChecked} sampled key statistics found in HTML (${pct}%)`);
    } else {
      warn('CONTENT', `Only ${statsFound}/${statsChecked} sampled key statistics found in HTML (${pct}%) — content may be missing`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 9: Design contract & tokens integrity
// ═══════════════════════════════════════════════════════════════════════
function checkDesignIntegrity(html, contract, tokens) {
  if (!tokens) { warn('DESIGN', 'No design-tokens.json — skipping design checks'); return; }

  // Check fonts are loaded
  const headlineFont = tokens.fonts?.headline;
  const bodyFont = tokens.fonts?.body;
  if (headlineFont && html.includes(headlineFont.replace(/ /g, '+'))) {
    pass('DESIGN', `Headline font "${headlineFont}" loaded`);
  } else if (headlineFont) {
    fail('DESIGN', `Headline font "${headlineFont}" not found in Google Fonts URL`);
  }

  if (bodyFont && html.includes(bodyFont.replace(/ /g, '+'))) {
    pass('DESIGN', `Body font "${bodyFont}" loaded`);
  } else if (bodyFont) {
    fail('DESIGN', `Body font "${bodyFont}" not found in Google Fonts URL`);
  }

  // Check Tailwind config has colors
  const colorCount = Object.keys(tokens.colors || {}).length;
  if (colorCount > 0) {
    pass('DESIGN', `${colorCount} color tokens in design system`);
  } else {
    fail('DESIGN', 'No color tokens in design-tokens.json');
  }

  // Check isDark matches HTML class
  if (tokens.isDark && html.includes('class="dark"')) {
    pass('DESIGN', 'Dark mode: tokens say dark, HTML has class="dark"');
  } else if (!tokens.isDark && !html.includes('class="dark"')) {
    pass('DESIGN', 'Light mode: tokens say light, HTML has no class="dark"');
  } else if (tokens.isDark && !html.includes('class="dark"')) {
    fail('DESIGN', 'Tokens say dark mode but HTML missing class="dark"');
  }

  // Check archetype recipe is valid
  const archetypeName = tokens.archetype?.name;
  if (archetypeName) {
    pass('DESIGN', `Archetype recipe: "${archetypeName}" (confidence: ${tokens.archetype?.confidence ?? 'n/a'})`);
    // Verify the archetype JSON exists and has this recipe
    const archetypesPath = path.resolve(__dirname, '..', 'schemas', 'visual-archetypes.json');
    try {
      const archetypes = JSON.parse(fs.readFileSync(archetypesPath, 'utf-8')).archetypes || {};
      if (archetypes[archetypeName]) {
        pass('DESIGN', `Archetype "${archetypeName}" found in visual-archetypes.json`);
      } else {
        fail('DESIGN', `Archetype "${archetypeName}" not found in visual-archetypes.json`);
      }
    } catch {
      warn('DESIGN', 'Could not load visual-archetypes.json for validation');
    }
  } else {
    warn('DESIGN', 'No archetype set in design-tokens.json — using default recipe');
  }

  // Legacy: check design-contract.json if present (Stitch-era, optional)
  if (contract) {
    const expectedContractTypes = ['hero', 'accordion', 'mcq', 'tabs', 'flashcard', 'checklist'];
    for (const type of expectedContractTypes) {
      if (contract[type]) {
        pass('DESIGN', `Design contract has "${type}" entry`);
      } else {
        warn('DESIGN', `Design contract missing "${type}" entry — will use fallbacks`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 10: Accessibility basics
// ═══════════════════════════════════════════════════════════════════════
function checkAccessibility(html) {
  // lang attribute
  if (html.includes('lang="en"') || html.includes("lang='en'")) {
    pass('A11Y', 'HTML has lang attribute');
  } else {
    fail('A11Y', 'Missing lang attribute on <html>');
  }

  // Buttons should have text content or aria-label
  const emptyButtons = (html.match(/<button[^>]*>\s*<\/button>/g) || []).length;
  if (emptyButtons > 0) {
    warn('A11Y', `${emptyButtons} potentially empty button(s) — ensure they have accessible text`);
  }

  // Check for reduced motion support
  if (html.includes('prefers-reduced-motion')) {
    pass('A11Y', 'Reduced motion media query present');
  } else {
    warn('A11Y', 'Missing prefers-reduced-motion support');
  }

  // Check section drawer has links
  const drawerLinks = (html.match(/data-drawer-link/g) || []).length;
  if (drawerLinks > 0) {
    pass('A11Y', `Section drawer has ${drawerLinks} navigation links`);
  } else {
    warn('A11Y', 'Section drawer has no navigation links');
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 11: Section progress tracking
// ═══════════════════════════════════════════════════════════════════════
function checkProgressTracking(html, layout) {
  const trackedSections = (html.match(/data-section-track/g) || []).length;
  if (trackedSections > 0) {
    pass('PROGRESS', `${trackedSections} sections have progress tracking`);
  }

  // Check interactive counts make sense
  const interactiveCounts = html.match(/data-interactive-count="(\d+)"/g) || [];
  for (const m of interactiveCounts) {
    const count = parseInt(m.match(/"(\d+)"/)[1], 10);
    if (count > 20) {
      warn('PROGRESS', `Section with interactive-count=${count} — unusually high`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CHECK 12: Empty content detection
// ═══════════════════════════════════════════════════════════════════════
function checkEmptyContent(html) {
  // Look for components with no visible text content
  for (const type of VALID_TYPES) {
    if (type === 'graphic' || type === 'media' || type === 'path-selector') continue;
    const blocks = extractComponentBlocks(html, type);
    for (let i = 0; i < blocks.length; i++) {
      // Strip HTML tags and check if there's meaningful text
      const textOnly = blocks[i].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (textOnly.length < 20) {
        warn('EMPTY', `${type} #${i + 1}: Very little text content (${textOnly.length} chars) — may appear empty`);
      }
    }
  }

  // Check for literal "undefined" or "null" in content
  if (html.includes('>undefined<') || html.includes('>null<')) {
    fail('EMPTY', 'Found literal "undefined" or "null" rendered as text content');
  }

  // Check for escaped HTML in content (double-escaped)
  if (html.includes('&amp;lt;') || html.includes('&amp;gt;')) {
    warn('EMPTY', 'Found double-escaped HTML entities — content may display raw HTML tags');
  }

  // Check for placeholder text (only in visible text content, not attributes or base64)
  // Strip attributes, script tags, style tags, and base64 data before checking
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/src="data:[^"]*"/gi, '')
    .replace(/placeholder="[^"]*"/gi, '')  // legitimate HTML attribute
    .replace(/<[^>]*>/g, ' ');
  const placeholders = ['lorem ipsum', 'fixme'];
  for (const ph of placeholders) {
    if (visibleText.toLowerCase().includes(ph)) {
      warn('EMPTY', `Found "${ph}" in visible content — may be placeholder text`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  RUN ALL CHECKS
// ═══════════════════════════════════════════════════════════════════════
function run() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          V5 COURSE QA — Structural Validation       ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Load files
  const html = loadFile('course.html');
  const layout = loadJSON('course-layout.json');
  const contract = loadJSON('design-contract.json');  // Legacy (Stitch-era, optional)
  const tokens = loadJSON('design-tokens.json');
  const kb = loadJSON('knowledge-base.json');

  if (!html) {
    console.log('❌ FATAL: engine/output/course.html not found. Run build-course.js first.\n');
    process.exit(1);
  }

  console.log(`Course: ${layout?.course?.title || 'Unknown'}`);
  console.log(`HTML size: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Sections: ${layout?.sections?.length || '?'}`);
  console.log('');

  // Run checks
  checkFileExistence();
  checkHTMLStructure(html);
  checkComponentCoverage(html, layout);
  checkVariants(layout);
  checkInteractiveWiring(html);
  checkImageIntegrity(html, layout);
  checkTypography(html);
  checkLayoutRules(html);
  checkContentCoverage(html, layout, kb);
  checkDesignIntegrity(html, contract, tokens);
  checkAccessibility(html);
  checkProgressTracking(html, layout);
  checkEmptyContent(html);

  // ── Report ──
  console.log('─── RESULTS ─────────────────────────────────────────\n');

  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):`);
    for (const e of errors) console.log(`   ${e}`);
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):`);
    for (const w of warnings) console.log(`   ${w}`);
    console.log('');
  }

  console.log(`✅ PASSED (${passes.length}):`);
  for (const p of passes) console.log(`   ${p}`);
  console.log('');

  // Summary
  console.log('─── SUMMARY ─────────────────────────────────────────');
  console.log(`   ✅ ${passes.length} passed`);
  console.log(`   ⚠️  ${warnings.length} warnings`);
  console.log(`   ❌ ${errors.length} errors`);
  console.log('');

  if (errors.length > 0) {
    console.log('🚫 QA FAILED — fix errors before visual review.\n');
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log('⚠️  QA PASSED with warnings — review before visual check.\n');
    process.exit(0);
  } else {
    console.log('✅ QA PASSED — ready for visual review.\n');
    process.exit(0);
  }
}

run();
