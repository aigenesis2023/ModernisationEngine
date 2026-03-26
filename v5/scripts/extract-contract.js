#!/usr/bin/env node
/**
 * extract-contract.js — Design Contract Extraction
 *
 * Reads Stitch's component patterns (HTML files) using cheerio (a proper HTML parser)
 * and extracts all visual properties into a single design-contract.json file.
 *
 * This is the ONLY place that reads Stitch's raw HTML after pattern extraction.
 * build-course.js reads design-contract.json — never the raw HTML patterns.
 *
 * If Stitch changes how it writes HTML, you fix this file. Not 25 fill functions.
 *
 * Input:  v5/output/component-patterns/*.html + v5/output/component-patterns/_page-shell.json
 * Output: v5/output/design-contract.json
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const ROOT = path.resolve(__dirname, '..', '..');
const PATTERNS_DIR = path.resolve(ROOT, 'v5/output/component-patterns');
const SHELL_PATH = path.resolve(PATTERNS_DIR, '_page-shell.json');
const OUTPUT_PATH = path.resolve(ROOT, 'v5/output/design-contract.json');

// ─── Visual class filters ────────────────────────────────────────────
// These identify Tailwind classes that are purely visual (no layout impact)

const VISUAL_RE = /^(shadow-|hover:|group-hover:|transition-?|duration-|ring-|scale-|opacity-|mix-blend-|backdrop-blur|bg-gradient|from-|to-|via-|animate-)/;
const VISUAL_BORDER_COLOR_RE = /^border-(primary|secondary|tertiary|outline|error|surface|on-|transparent|white|black)/;
const VISUAL_BG_RE = /^bg-(primary|secondary|tertiary|error|surface|on-|white|black)/;

function isVisualClass(c) {
  return VISUAL_RE.test(c) || VISUAL_BORDER_COLOR_RE.test(c);
}

function isBgClass(c) {
  return VISUAL_BG_RE.test(c);
}

function visualOnly(cls) {
  if (!cls) return '';
  return cls.split(/\s+/).filter(isVisualClass).join(' ');
}

function bgOnly(cls) {
  if (!cls) return '';
  return cls.split(/\s+/).filter(isBgClass).join(' ');
}

function roundedOnly(cls) {
  if (!cls) return '';
  const m = cls.match(/rounded-\S+/);
  return m ? m[0] : '';
}

function shadowOnly(cls) {
  if (!cls) return '';
  return cls.split(/\s+/).filter(c => /^shadow-/.test(c)).join(' ');
}

function borderOnly(cls) {
  if (!cls) return '';
  return cls.split(/\s+/).filter(c => /^border-/.test(c)).join(' ');
}

// ─── Pattern loader ──────────────────────────────────────────────────

function loadPattern(type) {
  const p = path.resolve(PATTERNS_DIR, `${type}.html`);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  return null;
}

// ─── Per-component extraction ────────────────────────────────────────
// Each function takes cheerio-parsed HTML and returns a visual contract object

function extractHero(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Section class
  const sectionCls = $('section').attr('class') || $('[data-component-type="hero"]').attr('class') || '';
  contract.section = sectionCls;

  // Overlay gradient div — the div layered over the background image
  const overlayDiv = $('div.absolute').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('bg-gradient') || cls.includes('from-');
  }).first();
  const overlayCls = overlayDiv.attr('class') || '';
  contract.overlayGradient = overlayCls.split(/\s+/).filter(c => /^(bg-gradient|from-|to-|via-)/.test(c)).join(' ')
    || 'bg-gradient-to-t from-surface-dim via-surface-dim/80 to-surface-dim/40';

  // Image visual classes
  const img = $('img').first();
  contract.imgVisuals = visualOnly(img.attr('class') || '') || 'mix-blend-overlay opacity-40';

  // CTA buttons — extract first two
  const buttons = $('button');
  if (buttons.length > 0) {
    const btn1Cls = $(buttons[0]).attr('class') || '';
    contract.btn1 = {
      visual: visualOnly(btn1Cls),
      bg: bgOnly(btn1Cls) || 'bg-primary',
      gradient: btn1Cls.split(/\s+/).filter(c => /^(bg-gradient|from-|to-|via-)/.test(c)).join(' '),
      rounded: roundedOnly(btn1Cls) || 'rounded-xl',
      raw: btn1Cls
    };
  } else {
    contract.btn1 = { visual: '', bg: 'bg-primary', gradient: '', rounded: 'rounded-xl', raw: '' };
  }

  if (buttons.length > 1) {
    const btn2Cls = $(buttons[1]).attr('class') || '';
    contract.btn2 = {
      visual: visualOnly(btn2Cls) || 'hover:bg-surface-variant transition-colors',
      bg: bgOnly(btn2Cls),
      rounded: roundedOnly(btn2Cls) || 'rounded-xl'
    };
  } else {
    contract.btn2 = { visual: 'hover:bg-surface-variant transition-colors', bg: '', rounded: 'rounded-xl' };
  }

  // Check for primary-gradient custom class on button
  const btn1Raw = contract.btn1.raw;
  if (btn1Raw.includes('primary-gradient')) {
    contract.btn1.customClass = 'primary-gradient';
  }

  return contract;
}

function extractAccordion(html) {
  const $ = cheerio.load(html);
  const details = $('details').first();
  const detailsCls = details.attr('class') || 'group glass-card rounded-2xl p-6 transition-all duration-300';

  // Content div inside details (after summary)
  const contentDiv = details.find('div').first();
  const bodyCls = contentDiv.attr('class') || 'mt-4 text-on-surface-variant leading-relaxed';

  // Summary hover
  const summaryCls = details.find('summary').first().attr('class') || '';

  return {
    detailsClass: detailsCls,
    bodyClass: bodyCls,
    summaryClass: summaryCls
  };
}

function extractMCQ(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Section class
  contract.section = $('[data-component-type="mcq"]').attr('class') || 'py-32';

  // Quiz card container (the div with data-quiz)
  const quizCard = $('[data-quiz]');
  const quizCls = quizCard.attr('class') || '';
  contract.card = {
    bg: bgOnly(quizCls) || '',
    shadow: shadowOnly(quizCls),
    rounded: roundedOnly(quizCls) || 'rounded-[2rem]',
    border: borderOnly(quizCls),
    raw: quizCls
  };

  // Label/badge (the small uppercase text like "Knowledge Check")
  const labelSpan = quizCard.find('span').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('uppercase') || cls.includes('tracking-widest');
  }).first();
  contract.labelClass = labelSpan.attr('class') || 'text-secondary font-bold text-sm uppercase tracking-widest';

  // Choice buttons
  const choiceBtn = $('[data-choice]').first();
  const choiceCls = choiceBtn.attr('class') || '';
  contract.choice = {
    visual: visualOnly(choiceCls) || 'hover:bg-surface-container transition-all',
    rounded: roundedOnly(choiceCls) || 'rounded-xl',
    raw: choiceCls,
    isButton: choiceBtn.is('button')
  };

  // Detect radio icon on hover
  contract.hasRadioIcon = html.includes('radio_button_unchecked');
  // Detect check icon on hover
  contract.hasCheckIcon = html.includes('check_circle');

  return contract;
}

function extractGraphicText(html) {
  const $ = cheerio.load(html);
  const contract = {};

  contract.section = $('[data-component-type="graphic-text"]').attr('class') || '';

  // Image glow wrapper (absolute gradient blur behind image)
  const glowDiv = $('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('absolute') && cls.includes('blur');
  }).first();
  contract.glowClass = glowDiv.attr('class') || '';

  // Image container shadow
  const imgContainer = $('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('relative') && cls.includes('shadow');
  }).first();
  contract.imgShadow = shadowOnly(imgContainer.attr('class') || '');

  // Image class
  contract.imgClass = $('img').first().attr('class') || '';

  return contract;
}

function extractBento(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Extract per-card backgrounds from Stitch
  const cards = $('[class*="col-span"]');
  contract.cardBgs = [];
  contract.cardShadows = [];
  cards.each((_, el) => {
    const cls = $(el).attr('class') || '';
    contract.cardBgs.push(bgOnly(cls));
    contract.cardShadows.push(shadowOnly(cls));
  });

  // Image hover effect
  contract.imgHover = html.includes('group-hover:scale')
    ? 'group-hover:scale-105 transition-transform duration-700'
    : 'group-hover:scale-110 transition-transform duration-700';

  return contract;
}

function extractTimeline(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Detect if Stitch uses numbered circles with rings (vs border-l dots)
  contract.hasNumberedCircles = html.includes('ring-') && html.includes('rounded-full');

  // Extract circle styling
  const circleDiv = $('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('rounded-full') && (cls.includes('w-6') || cls.includes('w-12') || cls.includes('w-8'));
  }).first();
  const circleCls = circleDiv.attr('class') || '';
  contract.circleClass = circleCls;
  contract.circleVisuals = circleCls.split(/\s+/).filter(c =>
    /^(ring-|shadow-|bg-primary|bg-secondary|text-white|text-on|border-)/.test(c)
  ).join(' ');

  // Connector line
  const connector = $('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('w-0') || (cls.includes('bg-outline') && cls.includes('h-'));
  }).first();
  contract.connectorClass = connector.attr('class') || 'w-0.5 h-full bg-outline-variant/20 mt-4';

  // Active dot (for border-l layout)
  const activeDot = $('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('absolute') && cls.includes('bg-primary') && cls.includes('rounded-full');
  }).first();
  contract.activeDotClass = activeDot.attr('class') || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-primary shadow-[0_0_10px_rgba(37,216,252,0.5)]';

  // Inactive dot
  const inactiveDot = $('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('absolute') && cls.includes('rounded-full') && !cls.includes('bg-primary');
  }).first();
  contract.inactiveDotClass = inactiveDot.attr('class') || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-outline-variant';

  // Step title styling from Stitch
  const stepTitle = $('h4').first();
  contract.stepTitleClass = stepTitle.attr('class') || '';

  return contract;
}

function extractStatCallout(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Extract per-stat styling
  contract.stats = [];
  const statDivs = $('[data-component-type="stat-callout"]').children('div');
  statDivs.each((_, el) => {
    const cls = $(el).attr('class') || '';
    // Find the large number div inside
    const numDiv = $(el).find('div').filter((_, inner) => {
      const c = $(inner).attr('class') || '';
      return /text-\d+xl/.test(c);
    }).first();
    const numCls = numDiv.attr('class') || '';

    contract.stats.push({
      cardBg: bgOnly(cls),
      cardShadow: shadowOnly(cls),
      cardRounded: roundedOnly(cls) || 'rounded-lg',
      cardBorder: borderOnly(cls),
      numColor: numCls.split(/\s+/).filter(c => /^text-(primary|secondary|tertiary|error|gradient)/.test(c)).join(' ') || 'text-gradient',
      numWeight: numCls.split(/\s+/).filter(c => /^font-(black|extrabold|bold)/.test(c)).join(' ') || 'font-extrabold',
      raw: cls
    });
  });

  // Check if sublabel pattern exists
  contract.hasSublabel = html.includes('font-bold text-lg');

  return contract;
}

function extractPullquote(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Check for decorative giant quote character
  const decorativeSpan = $('span').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('pointer-events-none') || (cls.includes('text-') && /\d{2,}/.test(cls));
  }).first();
  contract.hasDecorativeQuote = decorativeSpan.length > 0;
  if (contract.hasDecorativeQuote) {
    contract.decorativeSpanHtml = $.html(decorativeSpan);
  }

  // Blockquote styling
  const bq = $('blockquote');
  const bqCls = bq.attr('class') || '';
  contract.blockquoteStyle = bqCls.split(/\s+/).filter(c =>
    /^(text-\d|md:text-|font-|italic|leading-)/.test(c)
  ).join(' ') || 'text-2xl font-headline font-bold leading-relaxed';

  // Citation styling
  const cite = $('cite');
  contract.citeClass = cite.attr('class') || 'text-on-surface-variant';

  return contract;
}

function extractChecklist(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Card container (data-checklist or parent wrapper)
  const container = $('[data-checklist]').length > 0
    ? $('[data-checklist]')
    : $('[data-component-type="checklist"]');
  const containerCls = container.attr('class') || '';
  contract.card = {
    bg: bgOnly(containerCls) || '',
    shadow: shadowOnly(containerCls),
    rounded: roundedOnly(containerCls) || 'rounded-3xl'
  };

  // Input styling
  const input = $('input[type="checkbox"]').first();
  contract.inputClass = input.attr('class') || 'w-6 h-6 rounded border-outline-variant text-secondary focus:ring-secondary bg-transparent';

  // Label styling
  const label = $('label').first();
  const labelCls = label.attr('class') || '';
  contract.labelClass = labelCls;
  contract.labelHover = labelCls.split(/\s+/).filter(c => /^(hover:|group-hover:|transition-)/.test(c)).join(' ')
    || 'hover:bg-surface-variant/50 transition-colors';

  // Span inside label (for text hover effects)
  const span = label.find('span').first();
  const spanCls = span.attr('class') || '';
  contract.spanHover = spanCls.split(/\s+/).filter(c => /^(group-hover:|transition-)/.test(c)).join(' ');

  return contract;
}

function extractTabs(html) {
  const $ = cheerio.load(html);
  const contract = {};

  contract.section = $('[data-component-type="tabs"]').attr('class') || 'py-32 bg-surface-container-low';

  // Active tab button (typically has bg-primary or bg-secondary)
  const tabBtns = $('[data-tab-trigger]');
  if (tabBtns.length > 0) {
    contract.activeBtn = $(tabBtns[0]).attr('class') || 'px-8 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm uppercase tracking-wider';
    if (tabBtns.length > 1) {
      contract.inactiveBtn = $(tabBtns[1]).attr('class') || 'px-8 py-3 rounded-full glass-card hover:bg-surface-variant transition-all text-on-surface-variant font-bold text-sm uppercase tracking-wider';
    } else {
      contract.inactiveBtn = contract.activeBtn.replace(/bg-(primary|secondary)/, 'glass-card');
    }
  } else {
    contract.activeBtn = 'px-8 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm uppercase tracking-wider';
    contract.inactiveBtn = 'px-8 py-3 rounded-full glass-card hover:bg-surface-variant transition-all text-on-surface-variant font-bold text-sm uppercase tracking-wider';
  }

  return contract;
}

function extractFlashcard(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Front face — the first backface-hidden div (or div with style containing backface)
  const frontFace = $('[class*="backface"], [style*="backface"]').first();
  // Also try the approach from build-course.js: find by style attribute
  const frontByStyle = $('div').filter((_, el) => {
    const s = $(el).attr('style') || '';
    const c = $(el).attr('class') || '';
    return (s.includes('backface') || c.includes('backface')) && !s.includes('rotateY') && !c.includes('rotate-y');
  }).first();

  const front = frontFace.length ? frontFace : frontByStyle;
  const frontCls = front.attr('class') || '';
  contract.front = {
    bg: bgOnly(frontCls),
    shadow: shadowOnly(frontCls) || 'shadow-md',
    rounded: roundedOnly(frontCls) || 'rounded-3xl',
    border: borderOnly(frontCls),
    useBoldPrimary: frontCls.includes('bg-primary'),
    raw: frontCls
  };

  // Back face — has rotateY in style or class
  const backFace = $('div').filter((_, el) => {
    const s = $(el).attr('style') || '';
    const c = $(el).attr('class') || '';
    return s.includes('rotateY') || c.includes('rotate-y');
  }).first();
  const backCls = backFace.attr('class') || '';
  contract.back = {
    bg: bgOnly(backCls) || 'bg-secondary-container',
    border: borderOnly(backCls),
    rounded: roundedOnly(backCls) || 'rounded-3xl'
  };

  return contract;
}

function extractBranching(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Choice buttons
  const btn = $('button').first();
  const btnCls = btn.attr('class') || '';
  contract.button = {
    visual: visualOnly(btnCls) || 'hover:bg-surface-variant transition-all border border-transparent hover:border-secondary/30',
    bg: bgOnly(btnCls) || 'bg-surface-variant/30',
    rounded: roundedOnly(btnCls) || 'rounded-2xl'
  };

  // Arrow animation
  contract.hasArrow = html.includes('group-hover:translate-x');
  const arrowSpan = $('span').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('group-hover:translate');
  }).first();
  contract.arrowClass = arrowSpan.attr('class') || 'mt-6 inline-flex items-center gap-2 text-primary font-bold group-hover:translate-x-2 transition-transform';

  return contract;
}

function extractTextInput(html) {
  const $ = cheerio.load(html);
  const contract = {};

  // Card wrapper
  const card = $('div').filter((_, el) => {
    const cls = $(el).attr('class') || '';
    return cls.includes('glass-card') || cls.includes('bg-surface-container') || cls.includes('shadow');
  }).first();
  contract.cardClass = card.attr('class') || 'glass-card p-12 rounded-[2rem]';

  // Input styling
  const input = $('input').first();
  contract.inputClass = input.attr('class') || 'w-full bg-surface-container-lowest border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50 focus:border-secondary';

  return contract;
}

function extractNav(shellJson) {
  // Nav is now fully built by build-course.js (slim header + drawer).
  // We only extract the navClass for background/blur styling reference.
  if (!shellJson || !shellJson.nav) return {};
  const $ = cheerio.load(shellJson.nav);
  return { navClass: $('nav').first().attr('class') || '' };
}

// Footer removed — e-learning courses don't need a website-style footer.

// ─── Main extraction ─────────────────────────────────────────────────

function extractAll() {
  console.log('Design Contract Extraction');
  console.log('==========================\n');

  const contract = {};
  const ALL_TYPES = [
    'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
    'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
    'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
    'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
    'image-gallery', 'full-bleed', 'video-transcript',
  ];

  // Extraction map — components with meaningful visual properties to extract
  const extractors = {
    'hero': extractHero,
    'accordion': extractAccordion,
    'mcq': extractMCQ,
    'graphic-text': extractGraphicText,
    'bento': extractBento,
    'timeline': extractTimeline,
    'stat-callout': extractStatCallout,
    'pullquote': extractPullquote,
    'checklist': extractChecklist,
    'tabs': extractTabs,
    'flashcard': extractFlashcard,
    'branching': extractBranching,
    'textinput': extractTextInput,
  };

  // For simpler components, extract just the section class
  const simpleTypes = [
    'text', 'graphic', 'data-table', 'media', 'narrative',
    'comparison', 'key-term', 'full-bleed', 'process-flow',
    'labeled-image', 'image-gallery', 'video-transcript',
  ];

  let extracted = 0;

  for (const type of ALL_TYPES) {
    const html = loadPattern(type);
    if (!html) {
      console.log(`  [skip] No pattern for: ${type}`);
      continue;
    }

    if (extractors[type]) {
      contract[type] = extractors[type](html);
      extracted++;
      console.log(`  [ok] ${type} — ${Object.keys(contract[type]).length} properties`);
    } else if (simpleTypes.includes(type)) {
      // Simple extraction: just the section/wrapper class
      const $ = cheerio.load(html);
      const root = $('[data-component-type]').first();
      contract[type] = {
        section: root.attr('class') || 'py-24'
      };
      extracted++;
      console.log(`  [ok] ${type} — section class`);
    }
  }

  // Extract nav from page shell (footer removed — not needed for e-learning)
  if (fs.existsSync(SHELL_PATH)) {
    const shell = JSON.parse(fs.readFileSync(SHELL_PATH, 'utf-8'));
    contract._nav = extractNav(shell);
    console.log(`  [ok] nav — ${Object.keys(contract._nav).length} properties`);
  }

  // Write contract
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(contract, null, 2));
  console.log(`\n[ok] Written: design-contract.json (${extracted} components)`);
  console.log(`     ${(JSON.stringify(contract).length / 1024).toFixed(1)} KB`);

  return contract;
}

// Run if called directly
extractAll();

module.exports = { extractAll };
