#!/usr/bin/env node
/**
 * V5 Course Builder — Stitch Pattern Fill
 *
 * Uses Stitch's actual component patterns (extracted from the designed page)
 * and fills them with real SCORM content. The visual design is 100% Stitch's.
 * The content is 100% from the SCORM.
 *
 * For each component in course-layout.json:
 *   1. Load the matching pattern from component-patterns/
 *   2. Fill it with real content (title, body, items, quiz answers, etc.)
 *   3. Handle interactive data attributes for hydrate.js
 *
 * Usage: node v4/scripts/build-course.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PATTERNS_DIR = path.resolve(ROOT, 'v4/output/component-patterns');
const SHELL_PATH = path.resolve(PATTERNS_DIR, '_page-shell.json');
const TOKENS_PATH = path.resolve(ROOT, 'v4/output/design-tokens.json');
const STITCH_PATH = path.resolve(ROOT, 'v4/output/stitch-course-raw.html');
const LAYOUT_PATH = path.resolve(ROOT, 'v4/output/course-layout.json');
const HYDRATE_PATH = path.resolve(ROOT, 'v4/scripts/hydrate.js');
const OUTPUT_PATH = path.resolve(ROOT, 'v4/output/course.html');
const PAGES_PATH = path.resolve(ROOT, 'index.html');

// ─── HTML helpers ────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripTags(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

function embedImage(imagePath) {
  if (!imagePath) return '';
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) return imagePath;
  const fullPath = path.resolve(ROOT, 'v4/output', imagePath);
  if (!fs.existsSync(fullPath)) return imagePath;
  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
  return `data:${mimeMap[ext] || 'image/jpeg'};base64,${buffer.toString('base64')}`;
}

// ─── Load patterns ───────────────────────────────────────────────────
function loadPattern(type) {
  const p = path.resolve(PATTERNS_DIR, `${type}.html`);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8');
  return null;
}

function loadPageShell() {
  if (fs.existsSync(SHELL_PATH)) return JSON.parse(fs.readFileSync(SHELL_PATH, 'utf-8'));
  return null;
}

// ─── Simple DOM-like helpers (no library needed) ─────────────────────
// These do targeted string replacements on the pattern HTML.

/** Replace the text inside the first matching tag */
function replaceFirstTag(html, tag, newContent) {
  const re = new RegExp(`(<${tag}[^>]*>)([\\s\\S]*?)(</${tag}>)`, 'i');
  return html.replace(re, `$1${newContent}$3`);
}

/** Get all matches of a regex, returning array of { match, index } */
function findAll(html, re) {
  const results = [];
  let m;
  const regex = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = regex.exec(html)) !== null) {
    results.push({ match: m[0], groups: m, index: m.index });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════════
// FILL FUNCTIONS — one per component type
// Each takes the Stitch pattern HTML and real content, returns filled HTML
// ═══════════════════════════════════════════════════════════════════════

function fillHero(pattern, comp) {
  let html = pattern;
  // Replace h1 title
  html = replaceFirstTag(html, 'h1', esc(comp.displayTitle || ''));
  // Replace the subtitle paragraph
  const bodyText = stripTags(comp.body || '');
  html = replaceFirstTag(html, 'p', bodyText);
  // Replace image if we have one
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    const alt = esc(comp._graphic.alt || '');
    html = html.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
    html = html.replace(/data-alt="[^"]*"/g, `alt="${alt}"`);
  }
  return html;
}

function fillText(pattern, comp) {
  let html = pattern;
  // Replace section title (h2)
  html = replaceFirstTag(html, 'h2', esc(comp.displayTitle || ''));
  // Replace body content - find the div with paragraphs
  const bodyDiv = html.match(/(<div class="space-y-6[^"]*">)([\s\S]*?)(<\/div>)/);
  if (bodyDiv) {
    html = html.replace(bodyDiv[0], `${bodyDiv[1]}${comp.body || ''}${bodyDiv[3]}`);
  } else {
    // Fallback: replace all <p> content
    const paragraphs = (comp.body || '').split(/<\/?p>/g).filter(s => s.trim());
    let pIdx = 0;
    html = html.replace(/<p[^>]*>[\s\S]*?<\/p>/gi, (match) => {
      if (pIdx === 0 && paragraphs.length > 0) {
        pIdx++;
        return paragraphs.map(p => `<p>${p}</p>`).join('\n');
      }
      pIdx++;
      return '';
    });
  }
  return html;
}

function fillAccordion(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 max-w-4xl mx-auto';

  // Extract the details class from pattern
  const detailsClass = pattern.match(/<details[^>]*class="([^"]*)"/)?.[1] || 'group glass-card rounded-2xl p-6 transition-all duration-300';
  const bodyClass = pattern.match(/<div class="(mt-4[^"]*)"/)?.[1] || 'mt-4 text-on-surface-variant leading-relaxed';

  const newDetails = items.map(item =>
    `<details class="${detailsClass}">
<summary class="flex justify-between items-center cursor-pointer font-headline font-bold text-lg">
${esc(item.title || '')}
<span class="material-symbols-outlined group-open:rotate-180 transition-transform">expand_more</span>
</summary>
<div class="${bodyClass}">
${item.body || ''}
</div>
</details>`
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="accordion">
<h3 class="font-headline text-2xl font-bold mb-12 text-center">${title}</h3>
<div class="space-y-4">
${newDetails}
</div>
</section>`;
}

function fillMCQ(pattern, comp) {
  const items = comp._items || [];
  const feedback = comp._feedback || {};
  const correctFeedback = stripTags(feedback.correct || 'Correct!');
  const incorrectFeedback = stripTags((feedback._incorrect && feedback._incorrect.final) || 'Not quite. Try again.');

  // Find correct answer index
  let correctIdx = items.findIndex(i => i.correct || i._shouldBeSelected);
  if (correctIdx < 0) correctIdx = 0;

  const questionText = stripTags(comp.body || '');
  const title = esc(comp.displayTitle || 'Knowledge Check');

  // Extract the first unselected choice as a template (data-choice="a" or "b")
  // Use the first choice div that has the standard unselected styling
  const firstChoice = pattern.match(/<div[^>]*data-choice="a"[^>]*>[\s\S]*?<\/span>\s*<\/div>/i);
  let choiceTemplate = '';
  if (firstChoice) {
    choiceTemplate = firstChoice[0];
  }

  // Build new choices from the template
  const newChoices = items.map((item, i) => {
    if (choiceTemplate) {
      let c = choiceTemplate;
      c = c.replace(/data-choice="[^"]*"/, `data-choice="${i}"`);
      // Replace the text span (last <span> that isn't material-symbols)
      c = c.replace(/<span>[\s\S]*?<\/span>$/, `<span>${esc(item.text || '')}</span>`);
      c = c.replace(/<span>([^<]*)<\/span>/i, `<span>${esc(item.text || '')}</span>`);
      return c;
    }
    // Fallback if no template found
    return `<div class="group flex items-center p-5 rounded-xl bg-surface-variant/30 hover:bg-surface-variant cursor-pointer transition-all border border-transparent hover:border-secondary/30" data-choice="${i}">
<div class="w-6 h-6 rounded-full border-2 border-outline-variant mr-4 group-hover:border-secondary"></div>
<span>${esc(item.text || '')}</span>
</div>`;
  }).join('\n');

  // Rebuild the entire MCQ section from scratch using the pattern's outer structure
  // Extract the section tag with its classes
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32 px-8 max-w-3xl mx-auto';
  // Extract the glass-card wrapper classes
  const cardClass = pattern.match(/<div[^>]*class="(glass-card[^"]*)"/)?.[1] || 'glass-card p-12 rounded-[2rem]';
  // Extract the label div (e.g., "KNOWLEDGE CHECK")
  const labelDiv = pattern.match(/<div class="text-secondary[^"]*">[^<]*<\/div>/)?.[0] || '';
  // Extract h3 classes
  const h3Class = pattern.match(/<h3[^>]*class="([^"]*)"/)?.[1] || 'font-headline text-2xl font-bold mb-8';

  return `<section class="${sectionClass}" data-component-type="mcq" data-quiz data-correct="${correctIdx}" data-feedback-correct="${esc(correctFeedback)}" data-feedback-incorrect="${esc(incorrectFeedback)}">
<div class="${cardClass}">
${labelDiv ? labelDiv.replace(/>.*</, `>${title}<`) : `<div class="text-secondary font-bold text-sm mb-4">${title}</div>`}
<h3 class="${h3Class}">${questionText}</h3>
<div class="space-y-4">
${newChoices}
</div>
<div class="mt-8 hidden" data-quiz-feedback></div>
</div>
</section>`;
}

function fillGraphicText(pattern, comp, index) {
  let html = pattern;
  // Replace title
  html = replaceFirstTag(html, 'h2', esc(comp.displayTitle || ''));

  const bodyContent = comp.body || '';
  const bodyPlain = stripTags(bodyContent);

  // Replace the main paragraph
  html = html.replace(/(<p class="text-lg[^"]*">)([\s\S]*?)(<\/p>)/i, `$1${bodyPlain}$3`);

  // Handle bullet points: replace the entire space-y-4 div with real content or remove it
  const bulletContainer = html.match(/<div class="space-y-4">([\s\S]*?)<\/div>/i);
  if (bulletContainer) {
    if (bodyContent.includes('<li>')) {
      // Extract list items from body HTML
      const lis = bodyContent.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const iconSpan = '<span class="material-symbols-outlined text-secondary">verified</span>';
      const newBullets = lis.map(li => {
        const text = stripTags(li);
        return `<div class="flex items-start gap-4">${iconSpan}<p class="text-on-surface">${text}</p></div>`;
      }).join('\n');
      html = html.replace(bulletContainer[0], `<div class="space-y-4">\n${newBullets}\n</div>`);
    } else {
      // No bullets in content — remove the bullet container entirely
      html = html.replace(bulletContainer[0], '');
    }
  }

  // Replace image
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    const alt = esc(comp._graphic.alt || '');
    html = html.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
    html = html.replace(/data-alt="[^"]*"/g, `alt="${alt}"`);
  }
  return html;
}

function fillBento(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32 px-8 max-w-7xl mx-auto';

  // Extract icon classes from pattern
  const icons = ['bolt', 'speed', 'shield', 'memory', 'hub', 'star', 'lightbulb', 'science'];

  // First card is large (col-span-2, row-span-2), rest are smaller
  const newCards = items.map((item, i) => {
    if (i === 0) {
      const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
      return `<div class="md:col-span-2 md:row-span-2 glass-card rounded-3xl p-8 flex flex-col justify-end relative overflow-hidden group">
${imgSrc ? `<img alt="" class="absolute inset-0 object-cover opacity-20 group-hover:scale-110 transition-transform duration-700" src="${imgSrc}"/>` : ''}
<div class="relative z-10">
<span class="material-symbols-outlined text-secondary text-4xl mb-4">${icons[0]}</span>
<h4 class="font-headline text-2xl font-bold mb-2">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }
    // Alternate between horizontal and vertical card styles
    if (i <= 2 && items.length > 3) {
      return `<div class="md:col-span-2 glass-card rounded-3xl p-8 flex items-center gap-8">
<div class="bg-secondary-container p-4 rounded-2xl">
<span class="material-symbols-outlined text-secondary text-4xl">${icons[i % icons.length]}</span>
</div>
<div>
<h4 class="font-headline text-xl font-bold mb-1">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>
</div>`;
    }
    return `<div class="glass-card rounded-3xl p-8 flex flex-col justify-center">
<span class="material-symbols-outlined text-secondary text-3xl mb-4">${icons[i % icons.length]}</span>
<h4 class="font-headline text-lg font-bold mb-1">${esc(item.title || '')}</h4>
<p class="text-sm text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${sectionClass}" data-component-type="bento">
<h2 class="font-headline text-4xl font-bold mb-16">${title}</h2>
<div class="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-6 h-auto md:h-[600px]">
${newCards}
</div>
</section>`;
}

function fillDataTable(pattern, comp) {
  let html = pattern;
  html = replaceFirstTag(html, 'h2', esc(comp.displayTitle || ''));

  const rows = comp._rows || [];
  if (rows.length === 0) return html;

  // First row is headers
  const headers = rows[0];
  const dataRows = rows.slice(1);

  // Replace thead
  const theadMatch = html.match(/<thead[\s\S]*?<\/thead>/i);
  if (theadMatch) {
    const headerClass = theadMatch[0].match(/class="([^"]*)"/)?.[1] || '';
    const thClass = 'p-6 font-headline font-bold';
    const newThead = `<thead class="${headerClass}"><tr>${headers.map(h => `<th class="${thClass}">${esc(h)}</th>`).join('')}</tr></thead>`;
    html = html.replace(theadMatch[0], newThead);
  }

  // Replace tbody
  const tbodyMatch = html.match(/<tbody[\s\S]*?<\/tbody>/i);
  if (tbodyMatch) {
    const tbodyClass = tbodyMatch[0].match(/class="([^"]*)"/)?.[1] || '';
    const newRows = dataRows.map(row =>
      `<tr>${row.map(cell => `<td class="p-6">${esc(cell)}</td>`).join('')}</tr>`
    ).join('\n');
    html = html.replace(tbodyMatch[0], `<tbody class="${tbodyClass}">\n${newRows}\n</tbody>`);
  }

  return html;
}

function fillTextInput(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 bg-surface-container-low';
  const cardClass = pattern.match(/<div[^>]*class="([^"]*glass-card[^"]*)"/)?.[1] || 'max-w-3xl mx-auto glass-card p-12 rounded-[2rem]';
  const inputClass = pattern.match(/<input[^>]*class="([^"]*)"/)?.[1] || 'w-full bg-surface-container-lowest border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50 focus:border-secondary';

  const newInputs = items.map(item =>
    `<div>
<label class="block text-sm font-bold text-on-surface-variant mb-3 uppercase tracking-wider">${esc(item.prefix || item.label || '')}</label>
<input class="${inputClass}" placeholder="${esc(item.placeholder || '')}" type="text"/>
</div>`
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="textinput">
<div class="${cardClass}">
<h2 class="font-headline text-3xl font-bold mb-8">${title}</h2>
<div class="space-y-8">
${newInputs}
<button class="btn-primary px-8 py-4 rounded-xl font-bold text-on-primary-container w-full">Submit</button>
</div>
</div>
</section>`;
}

function fillBranching(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32 px-8 max-w-4xl mx-auto';

  const newButtons = items.map(item =>
    `<button class="p-6 rounded-2xl bg-surface-variant/30 text-left hover:bg-surface-variant transition-all border border-transparent hover:border-secondary/30">
<div class="font-bold mb-1">${esc(item.title || '')}</div>
<div class="text-sm text-on-surface-variant">${stripTags(item.body || '')}</div>
</button>`
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="branching">
<div class="glass-card p-12 rounded-3xl border-l-8 border-secondary">
<h3 class="font-headline text-2xl font-bold mb-6">${title}</h3>
<p class="text-lg text-on-surface-variant mb-10 italic">${bodyText}</p>
<div class="grid gap-4">
${newButtons}
</div>
</div>
</section>`;
}

function fillTimeline(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32 px-8 max-w-4xl mx-auto';

  // Extract dot classes from pattern
  const activeDotClass = pattern.match(/class="(absolute[^"]*bg-secondary[^"]*)"/)?.[1] || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-secondary shadow-[0_0_10px_rgba(37,216,252,0.5)]';
  const inactiveDotClass = pattern.match(/class="(absolute[^"]*bg-outline-variant[^"]*)"/)?.[1] || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-outline-variant';

  const newSteps = items.map((item, i) => {
    const num = String(i + 1).padStart(2, '0');
    const dotClass = i === 0 ? activeDotClass : inactiveDotClass;
    const titleClass = i === 0 ? 'font-headline text-xl font-bold text-secondary mb-2' : 'font-headline text-xl font-bold mb-2';
    return `<div class="relative pl-12">
<div class="${dotClass}"></div>
<div class="${titleClass}">${num}. ${esc(item.title || '')}</div>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${sectionClass}" data-component-type="timeline">
<h2 class="font-headline text-4xl font-bold mb-20 text-center">${title}</h2>
<div class="relative border-l-2 border-outline-variant ml-4 space-y-16">
${newSteps}
</div>
</section>`;
}

function fillComparison(pattern, comp) {
  const columns = comp._columns || [];
  if (columns.length < 2) return pattern;

  const title = esc(comp.displayTitle || '');
  // Extract section classes from pattern
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 max-w-6xl mx-auto';

  // For multi-column comparison data, render as a table (more flexible than 2-col layout)
  const headers = columns.map(c => c.title || '');
  const rowCount = Math.max(...columns.map(c => (c.items || []).length));

  const headerHtml = headers.map(h =>
    `<th class="p-6 font-headline font-bold text-on-surface">${esc(h)}</th>`
  ).join('');

  const rowsHtml = [];
  for (let r = 0; r < rowCount; r++) {
    const cells = columns.map(col => {
      const val = (col.items || [])[r] || '';
      return `<td class="p-6 text-on-surface-variant">${esc(val)}</td>`;
    }).join('');
    rowsHtml.push(`<tr>${cells}</tr>`);
  }

  return `<section class="${sectionClass}" data-component-type="comparison">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">${title}</h2>
<div class="overflow-x-auto glass-card rounded-3xl">
<table class="w-full text-left">
<thead class="bg-surface-container-high border-b border-outline-variant">
<tr>${headerHtml}</tr>
</thead>
<tbody class="divide-y divide-outline-variant/30">
${rowsHtml.join('\n')}
</tbody>
</table>
</div>
</section>`;
}

function fillStatCallout(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  // Extract section and grid classes from pattern
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 bg-surface-container-low';
  const gridClass = pattern.match(/<div[^>]*class="([^"]*grid[^"]*)"/)?.[1] || 'max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-center';

  // Extract one stat block as template
  const statMatch = pattern.match(/<div class="space-y-2">[\s\S]*?<\/div>\s*<\/div>/i);
  const numClass = statMatch
    ? (statMatch[0].match(/<div class="(text-5xl[^"]*)"/)?.[1] || 'text-5xl font-headline font-extrabold text-gradient')
    : 'text-5xl font-headline font-extrabold text-gradient';
  const labelClass = statMatch
    ? (statMatch[0].match(/<p class="([^"]*)"/)?.[1] || 'text-on-surface-variant text-sm uppercase tracking-widest font-bold')
    : 'text-on-surface-variant text-sm uppercase tracking-widest font-bold';

  const newStats = items.map(item =>
    `<div class="space-y-2">
<div class="${numClass}">${esc(item.stat || item.value || '')}</div>
<p class="${labelClass}">${esc(item.label || '')}</p>
</div>`
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="stat-callout">
<div class="${gridClass}">
${newStats}
</div>
</section>`;
}

function fillPullquote(pattern, comp) {
  let html = pattern;
  const quote = stripTags(comp.body || '');
  // Replace blockquote text
  html = html.replace(/(<blockquote[^>]*>)([\s\S]*?)(<\/blockquote>)/i,
    `$1\n${quote}\n$3`);
  // Also try if it's just text inside the section
  if (!html.includes('<blockquote')) {
    // Some patterns have the quote directly in a styled element
    const h3Match = html.match(/<h3[^>]*>[\s\S]*?<\/h3>/i);
    if (!h3Match) {
      // Replace the main paragraph
      html = replaceFirstTag(html, 'p', quote);
    }
  }
  return html;
}

function fillChecklist(pattern, comp) {
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 max-w-3xl mx-auto';
  const cardClass = pattern.match(/<div[^>]*class="(glass-card[^"]*)"[^>]*data-checklist/)?.[1] || 'glass-card p-12 rounded-3xl';

  // Extract checkbox input classes from pattern
  const inputClass = pattern.match(/<input[^>]*class="([^"]*)"/)?.[1] || 'w-6 h-6 rounded border-outline-variant text-secondary focus:ring-secondary bg-transparent';

  const newLabels = items.map(item =>
    `<label class="flex items-center gap-4 p-4 rounded-xl hover:bg-surface-variant/50 cursor-pointer transition-colors">
<input class="${inputClass}" type="checkbox"/>
<span class="text-on-surface-variant">${esc(item.text || '')}</span>
</label>`
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="checklist">
<div class="${cardClass}" data-checklist>
<h2 class="font-headline text-2xl font-bold mb-8">${title}</h2>
<div class="space-y-4">
${newLabels}
</div>
</div>
</section>`;
}

function fillTabs(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32 px-8 bg-surface-container-low';

  // Extract button classes from pattern
  const activeBtn = pattern.match(/<button[^>]*class="([^"]*bg-secondary[^"]*)"[^>]*data-tab-trigger/)?.[1]
    || 'px-8 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm uppercase tracking-wider';
  const inactiveBtn = pattern.match(/<button[^>]*class="([^"]*glass-card[^"]*)"[^>]*data-tab-trigger/)?.[1]
    || 'px-8 py-3 rounded-full glass-card hover:bg-surface-variant transition-all text-on-surface-variant font-bold text-sm uppercase tracking-wider';

  const triggers = items.map((item, i) =>
    `<button class="${i === 0 ? activeBtn : inactiveBtn}" data-tab-trigger="${i}">${esc(item.title || `Tab ${i + 1}`)}</button>`
  ).join('\n');

  const panels = items.map((item, i) =>
    `<div class="glass-card rounded-3xl p-12 min-h-[300px]" data-tab-panel="${i}"${i > 0 ? ' style="display:none"' : ''}>
<h4 class="font-headline text-2xl font-bold mb-4">${esc(item.title || '')}</h4>
<div class="text-on-surface-variant leading-relaxed">${item.body || ''}</div>
</div>`
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="tabs">
<div class="max-w-5xl mx-auto">
<h2 class="font-headline text-4xl font-bold mb-16 text-center">${title}</h2>
<div class="flex flex-wrap justify-center gap-4 mb-12" data-tabs>
${triggers}
</div>
${panels}
</div>
</section>`;
}

function fillFlashcard(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 bg-surface-container-low overflow-hidden';
  const icons = ['info', 'local_fire_department', 'pan_tool', 'bolt', 'shield', 'warning', 'speed', 'memory'];

  const newCards = items.map((item, i) => {
    const front = esc(item.front || item.title || item.term || '');
    const back = esc(item.back || item.definition || item.body || '');
    return `<div class="perspective-1000 h-64 group cursor-pointer" data-flashcard>
<div class="relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d]">
<div class="absolute inset-0 flex items-center justify-center p-8 glass-card rounded-3xl [backface-visibility:hidden]">
<div class="text-center">
<div class="material-symbols-outlined text-secondary text-4xl mb-4">${icons[i % icons.length]}</div>
<div class="font-headline font-bold text-xl">${front}</div>
</div>
</div>
<div class="absolute inset-0 flex items-center justify-center p-8 bg-secondary-container rounded-3xl [backface-visibility:hidden] [transform:rotateY(180deg)] text-center">
<p class="text-on-secondary-container font-medium">${back}</p>
</div>
</div>
</div>`;
  }).join('\n');

  return `<section class="${sectionClass}" data-component-type="flashcard">
<div class="max-w-7xl mx-auto">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">${title}</h2>
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
${newCards}
</div>
</div>
</section>`;
}

function fillNarrative(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-32 px-8 max-w-5xl mx-auto';

  const newSlides = items.map((item, i) => {
    const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
    return `<div data-slide="${i + 1}"${i > 0 ? ' style="display:none"' : ''}>
<div class="text-secondary font-bold mb-4">${counter}</div>
<h4 class="font-headline text-2xl font-bold mb-4">${esc(item.title || '')}</h4>
<p class="text-on-surface-variant">${stripTags(item.body || '')}</p>
</div>`;
  }).join('\n');

  return `<section class="${sectionClass}" data-component-type="narrative" data-carousel>
<h2 class="font-headline text-3xl font-bold mb-12">${title}</h2>
<div class="glass-card rounded-[2.5rem] p-12 relative">
${newSlides}
<div class="flex gap-4 mt-8">
<button class="w-12 h-12 rounded-full border border-outline-variant flex items-center justify-center hover:bg-secondary/20 transition-colors" data-prev>
<span class="material-symbols-outlined">chevron_left</span>
</button>
<button class="w-12 h-12 rounded-full bg-secondary text-on-secondary flex items-center justify-center" data-next>
<span class="material-symbols-outlined">chevron_right</span>
</button>
</div>
</div>
</section>`;
}

function fillKeyTerm(pattern, comp) {
  const items = comp._items || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 max-w-6xl mx-auto';

  const newCards = items.map(item =>
    `<div class="glass-card p-8 rounded-2xl">
<div class="text-secondary font-headline font-bold text-xl mb-3">${esc(item.term || item.title || '')}</div>
<p class="text-on-surface-variant text-sm">${esc(item.definition || item.body || '')}</p>
</div>`
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="key-term">
<h2 class="font-headline text-3xl font-bold mb-16">${title}</h2>
<div class="grid md:grid-cols-3 gap-8">
${newCards}
</div>
</section>`;
}

function fillFullBleed(pattern, comp) {
  let html = pattern;
  // Replace heading
  html = replaceFirstTag(html, 'h2', esc(comp.displayTitle || ''));
  // Replace body text
  const bodyText = stripTags(comp.body || '');
  html = html.replace(/<p class="text-2xl[^"]*">[^<]*<\/p>/i,
    `<p class="text-2xl text-secondary font-medium italic">${bodyText}</p>`);
  // Replace image
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    html = html.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
  }
  return html;
}

function fillGraphic(pattern, comp) {
  let html = pattern;
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    const alt = esc(comp._graphic.alt || '');
    html = html.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
    html = html.replace(/data-alt="[^"]*"/g, `alt="${alt}"`);
  }
  html = replaceFirstTag(html, 'h2', esc(comp.displayTitle || ''));
  return html;
}

function fillProcessFlow(pattern, comp) {
  const items = comp._items || comp._nodes || [];
  if (items.length === 0) return pattern;

  const title = esc(comp.displayTitle || '');
  const sectionClass = pattern.match(/<section[^>]*class="([^"]*)"/)?.[1] || 'py-24 px-8 bg-surface-container-low';

  const arrowHtml = '<span class="material-symbols-outlined text-outline-variant">arrow_forward</span>';

  const newNodes = items.map((item, i) => {
    const nodeClass = i === 0
      ? 'glass-card px-8 py-6 rounded-2xl border-secondary/30 text-center w-full max-w-xs'
      : 'glass-card px-8 py-6 rounded-2xl text-center w-full max-w-xs';
    return `<div class="${nodeClass}">
<div class="font-headline font-bold">${esc(item.title || '')}</div>
${item.body ? `<div class="text-sm text-on-surface-variant mt-2">${stripTags(item.body)}</div>` : ''}
</div>`;
  });

  const withArrows = newNodes.flatMap((n, i) =>
    i < newNodes.length - 1 ? [n, arrowHtml] : [n]
  ).join('\n');

  return `<section class="${sectionClass}" data-component-type="process-flow">
<div class="max-w-6xl mx-auto">
<h2 class="font-headline text-3xl font-bold mb-16 text-center">${title}</h2>
<div class="flex flex-col md:flex-row items-center justify-center gap-8">
${withArrows}
</div>
</div>
</section>`;
}

function fillMedia(pattern, comp) {
  // Media component is mostly visual — just replace image if available
  let html = pattern;
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    html = html.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
  }
  return html;
}

function fillVideoTranscript(pattern, comp) {
  let html = pattern;
  // Replace summary text
  html = html.replace(/<span>([^<]*)<\/span>/i, `<span>${esc(comp.displayTitle || 'Transcript')}</span>`);
  // Replace transcript body
  html = html.replace(/(<div class="p-8[^"]*">)([\s\S]*?)(<\/div>\s*<\/details>)/i,
    `$1${comp.body || ''}$3`);
  return html;
}

function fillImageGallery(pattern, comp) {
  let html = pattern;
  html = replaceFirstTag(html, 'h2', esc(comp.displayTitle || ''));
  // Image gallery doesn't usually appear in SCORM data, so mostly keep pattern as-is
  return html;
}

function fillLabeledImage(pattern, comp) {
  let html = pattern;
  html = replaceFirstTag(html, 'h2', esc(comp.displayTitle || ''));
  if (comp._graphic) {
    const src = embedImage(comp._graphic.large);
    html = html.replace(/src="https:\/\/lh3\.googleusercontent\.com[^"]*"/g, `src="${src}"`);
  }
  return html;
}

// ─── Component dispatcher ─────────────────────────────────────────────
function fillComponent(pattern, comp, index) {
  const type = (comp.type || 'text').toLowerCase();
  switch (type) {
    case 'hero':            return fillHero(pattern, comp);
    case 'text':            return fillText(pattern, comp);
    case 'accordion':       return fillAccordion(pattern, comp);
    case 'mcq':             return fillMCQ(pattern, comp);
    case 'graphic-text':    return fillGraphicText(pattern, comp, index);
    case 'bento':           return fillBento(pattern, comp);
    case 'data-table':      return fillDataTable(pattern, comp);
    case 'textinput':       return fillTextInput(pattern, comp);
    case 'branching':       return fillBranching(pattern, comp);
    case 'timeline':        return fillTimeline(pattern, comp);
    case 'comparison':      return fillComparison(pattern, comp);
    case 'stat-callout':    return fillStatCallout(pattern, comp);
    case 'pullquote':       return fillPullquote(pattern, comp);
    case 'checklist':       return fillChecklist(pattern, comp);
    case 'tabs':            return fillTabs(pattern, comp);
    case 'flashcard':       return fillFlashcard(pattern, comp);
    case 'narrative':       return fillNarrative(pattern, comp);
    case 'key-term':        return fillKeyTerm(pattern, comp);
    case 'full-bleed':      return fillFullBleed(pattern, comp);
    case 'graphic':         return fillGraphic(pattern, comp);
    case 'process-flow':    return fillProcessFlow(pattern, comp);
    case 'media':           return fillMedia(pattern, comp);
    case 'video-transcript':return fillVideoTranscript(pattern, comp);
    case 'image-gallery':   return fillImageGallery(pattern, comp);
    case 'labeled-image':   return fillLabeledImage(pattern, comp);
    default:
      console.log(`  [warn] Unknown component type: ${type}`);
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE ASSEMBLY
// ═══════════════════════════════════════════════════════════════════════

function buildNav(shell, layout) {
  if (!shell || !shell.nav) return '';
  let nav = shell.nav;
  const courseTitle = esc(layout.course.title || 'Course');

  // Replace the site name
  nav = nav.replace(/>Workplace Safety Fundamentals</, `>${courseTitle}<`);

  // Replace nav links with real section links
  const sections = layout.sections.filter(s => s.title).slice(0, 4);
  const linkRe = /<a[^>]*href="#[^"]*"[^>]*>[^<]*<\/a>/gi;
  const allLinks = findAll(nav, linkRe);

  if (allLinks.length > 0 && sections.length > 0) {
    const activeTemplate = allLinks[0].match;
    const inactiveTemplate = allLinks.length > 1 ? allLinks[1].match : activeTemplate;

    const newLinks = sections.map((s, i) => {
      let link = i === 0 ? activeTemplate : inactiveTemplate;
      link = link.replace(/href="#[^"]*"/, `href="#${s.sectionId || `section-${i}`}"`);
      link = link.replace(/>([^<]*)<\/a>/, `>${esc(s.title)}</a>`);
      return link;
    }).join('\n');

    // Replace all existing links
    let result = nav;
    allLinks.forEach(l => { result = result.replace(l.match, ''); });
    result = result.replace(/(hidden md:flex[^>]*>)\s*/i, `$1\n${newLinks}\n`);
    nav = result;
  }

  return nav;
}

function buildFooter(shell, layout) {
  if (!shell || !shell.footer) return '';
  let footer = shell.footer;
  const courseTitle = esc(layout.course.title || 'Course');

  // Replace generic names
  footer = footer.replace(/The Ethereal Archive\./g, courseTitle);
  footer = footer.replace(/Workplace Safety Fundamentals/g, courseTitle);
  footer = footer.replace(/© \d{4}/g, `© ${new Date().getFullYear()}`);

  return footer;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN BUILD
// ═══════════════════════════════════════════════════════════════════════
function build() {
  console.log('V5 Course Builder — Stitch Pattern Fill');
  console.log('=========================================\n');

  // Read inputs
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('ERROR: course-layout.json not found');
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  console.log(`[ok] Loaded course-layout.json (${layout.sections.length} sections)`);

  // Load page shell
  const shell = loadPageShell();
  if (shell) {
    console.log(`[ok] Loaded page shell (nav: ${(shell.nav || '').length} chars, footer: ${(shell.footer || '').length} chars)`);
  }

  // Load Stitch raw HTML for <head> content
  let stitchHtml = '';
  if (fs.existsSync(STITCH_PATH)) {
    stitchHtml = fs.readFileSync(STITCH_PATH, 'utf-8');
    console.log(`[ok] Loaded stitch-course-raw.html (${stitchHtml.length} chars)`);
  }

  // Extract <head> from Stitch HTML
  const headMatch = stitchHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  // Count patterns available
  const patternFiles = fs.readdirSync(PATTERNS_DIR).filter(f => f.endsWith('.html'));
  console.log(`[ok] ${patternFiles.length} component patterns available`);

  // Build all sections
  let filledCount = 0;
  let fallbackCount = 0;
  const sectionsHtml = [];

  layout.sections.forEach((section, sectionIndex) => {
    const components = section.components || [];
    if (components.length === 0) return;

    const sectionId = section.sectionId || `section-${String(sectionIndex).padStart(2, '0')}`;

    const componentHtmls = [];
    components.forEach((comp, compIndex) => {
      const type = (comp.type || 'text').toLowerCase();
      const pattern = loadPattern(type);

      if (pattern) {
        const filled = fillComponent(pattern, comp, compIndex);
        if (filled) {
          componentHtmls.push(filled);
          filledCount++;
        } else {
          console.log(`  [warn] Fill returned null for ${type}`);
          fallbackCount++;
        }
      } else {
        console.log(`  [warn] No pattern for: ${type}, skipping`);
        fallbackCount++;
      }
    });

    if (componentHtmls.length > 0) {
      // Wrap non-section components in a section container
      const wrapped = componentHtmls.map(h => {
        // If it already has a <section> wrapper, use as-is
        if (h.trim().startsWith('<section')) return h;
        // Otherwise wrap it
        return `<section class="py-24 px-8 max-w-7xl mx-auto" id="${sectionId}">\n${h}\n</section>`;
      }).join('\n\n');

      sectionsHtml.push(wrapped);
    }
  });

  console.log(`[ok] Filled ${filledCount} components (${fallbackCount} fallbacks)\n`);

  // Build nav and footer from Stitch's shell
  const navHtml = buildNav(shell, layout);
  const footerHtml = buildFooter(shell, layout);

  // Get hydration script
  let hydrateScript = '';
  if (fs.existsSync(HYDRATE_PATH)) {
    hydrateScript = fs.readFileSync(HYDRATE_PATH, 'utf-8');
  }

  // Determine theme
  let isDark = true;
  if (fs.existsSync(TOKENS_PATH)) {
    const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
    isDark = tokens.isDark !== false;
  }

  // Course title
  const courseTitle = layout.course.title || 'Course';

  // Replace title in head
  let finalHead = headContent;
  if (finalHead.includes('<title>')) {
    finalHead = finalHead.replace(/<title>[^<]*<\/title>/i, `<title>${esc(courseTitle)}</title>`);
  } else {
    finalHead = `<title>${esc(courseTitle)}</title>\n${finalHead}`;
  }

  const finalHtml = `<!DOCTYPE html>
<html class="${isDark ? 'dark' : ''}" lang="en">
<head>
${finalHead}
</head>
<body class="bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">

${navHtml}

<main class="min-h-screen bg-background overflow-x-hidden pt-20">
${sectionsHtml.join('\n\n')}

<!-- Course Completion -->
<section class="py-32 px-8 text-center max-w-4xl mx-auto">
  <span class="material-symbols-outlined text-6xl text-secondary mb-8">verified_user</span>
  <h2 class="font-headline text-4xl font-bold mb-8">Course Complete</h2>
  <p class="text-on-surface-variant text-xl leading-relaxed mb-12">
    You have completed ${esc(courseTitle)}. Review any sections as needed.
  </p>
  <button class="btn-primary px-12 py-5 rounded-full font-bold text-lg" onclick="window.scrollTo({top:0,behavior:'smooth'})">Return to Top</button>
</section>

${footerHtml}
</main>

<script>
${hydrateScript}
</script>
</body>
</html>`;

  // Write outputs
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, finalHtml, 'utf-8');
  console.log(`[ok] Written: ${OUTPUT_PATH} (${(finalHtml.length / 1024).toFixed(0)} KB)`);

  fs.writeFileSync(PAGES_PATH, finalHtml, 'utf-8');
  console.log(`[ok] Written: ${PAGES_PATH}`);

  console.log('\nBuild complete!');
}

build();
