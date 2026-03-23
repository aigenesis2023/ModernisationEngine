#!/usr/bin/env node
/**
 * V4 Course Builder — Stitch Design DNA
 *
 * Takes Stitch's exact design patterns (CSS, Tailwind config, class conventions)
 * and fills them with actual SCORM content from course-layout.json.
 *
 * Usage: node v4/scripts/build-course.js
 * Input:  v4/output/stitch-course-raw.html  (design DNA source)
 *         v4/output/course-layout.json       (content source)
 *         v4/output/images/                  (generated images, optional)
 * Output: v4/output/course.html + root index.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STITCH_PATH = path.resolve(ROOT, 'v4/output/stitch-course-raw.html');
const LAYOUT_PATH = path.resolve(ROOT, 'v4/output/course-layout.json');
const IMAGES_DIR = path.resolve(ROOT, 'v4/output/images');
const HYDRATE_PATH = path.resolve(ROOT, 'v4/scripts/hydrate.js');
const OUTPUT_PATH = path.resolve(ROOT, 'v4/output/course.html');
const PAGES_PATH = path.resolve(ROOT, 'index.html');

// ─── Image embedding ─────────────────────────────────────────────────
function embedImage(imagePath) {
  if (!imagePath) return '';
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) return imagePath;

  const fullPath = path.resolve(ROOT, 'v4/output', imagePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  [img] not found locally: ${imagePath}`);
    return imagePath; // return as-is, might be a relative path for later
  }

  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml',
  };
  const mime = mimeMap[ext] || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

// ─── HTML helpers ────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTags(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

function slugify(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Extract design DNA from Stitch HTML ──────────────────────────────
function extractDesignDNA(stitchHtml) {
  const headMatch = stitchHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headContent = headMatch ? headMatch[1] : '';

  // Extract trailing <style> blocks (perspective, backface, etc.)
  const trailingStyles = [];
  const styleRegex = /<style>([\s\S]*?)<\/style>/gi;
  let m;
  // Get styles AFTER </main> or near end of body
  const afterMain = stitchHtml.split('</main>')[1] || '';
  while ((m = styleRegex.exec(afterMain)) !== null) {
    trailingStyles.push(m[1]);
  }

  return { headContent, trailingStyles };
}

// ─── Background color cycling for sections ────────────────────────────
const BG_CLASSES = [
  'bg-surface',
  'bg-surface-container-low',
  'bg-surface-container-lowest',
  'bg-black',
];

// ─── Flashcard icon cycling ───────────────────────────────────────────
const CARD_ICONS = ['bolt', 'speed', 'power', 'memory', 'hub', 'shield', 'star', 'lightbulb', 'science', 'engineering'];

// ═══════════════════════════════════════════════════════════════════════
// COMPONENT TEMPLATE FUNCTIONS
// Each returns an HTML string using Stitch's exact Tailwind class patterns
// ═══════════════════════════════════════════════════════════════════════

function renderHero(comp) {
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = comp._graphic ? esc(comp._graphic.alt || '') : '';
  const title = esc(comp.displayTitle || '');
  const body = stripTags(comp.body || '');

  return `<section class="relative h-screen flex items-center px-8 md:px-24 overflow-hidden">
  <div class="absolute inset-0 z-0">
    <div class="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent z-10"></div>
    ${imgSrc ? `<img alt="${imgAlt}" class="w-full h-full object-cover" src="${imgSrc}"/>` : '<div class="w-full h-full bg-gradient-to-br from-surface-container-lowest to-black"></div>'}
  </div>
  <div class="relative z-20 max-w-4xl">
    <div class="inline-block px-3 py-1 bg-primary-container/20 text-primary border border-primary/30 text-[10px] font-bold tracking-[0.3em] mb-6 uppercase">Module 01: Core Systems</div>
    <h1 class="text-6xl md:text-8xl font-black text-white leading-[0.9] tracking-tighter mb-8 font-headline">${title}</h1>
    <p class="text-xl text-on-surface-variant max-w-2xl leading-relaxed mb-12 border-l-2 border-primary-container pl-8">${body}</p>
    <button class="bg-primary-container text-on-primary-container px-10 py-4 font-black tracking-widest text-sm uppercase transition-all hover:brightness-110 active:scale-95" onclick="window.scrollBy({top:window.innerHeight,behavior:'smooth'})">BEGIN COURSE</button>
  </div>
</section>`;
}

function renderText(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  return `<div class="max-w-3xl">
    <h3 class="text-4xl font-black text-white mb-8 tracking-tight">${title}</h3>
    <div class="text-on-surface-variant text-lg leading-loose">${body}</div>
  </div>`;
}

function renderAccordion(comp) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];
  const itemsHtml = items.map(item => `<details class="group glass-panel rounded-none">
    <summary class="flex justify-between items-center p-6 cursor-pointer list-none">
      <span class="text-sm font-bold tracking-widest uppercase text-white">${esc(item.title)}</span>
      <span class="material-symbols-outlined transition-transform group-open:rotate-180 text-primary">expand_more</span>
    </summary>
    <div class="px-6 pb-6 text-on-surface-variant text-sm leading-relaxed border-t border-white/5 pt-4">${item.body || ''}</div>
  </details>`).join('\n  ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-6 tracking-tight">${title}</h3>` : ''}
  <div class="space-y-4">
    ${itemsHtml}
  </div>
</div>`;
}

function renderMCQ(comp) {
  const title = esc(comp.displayTitle || 'Knowledge Check');
  const question = stripTags(comp.body || '');
  const items = comp._items || [];
  const feedback = comp._feedback || {};
  const correctFeedback = stripTags(feedback.correct || 'Correct!');
  const incorrectFeedback = stripTags((feedback._incorrect && feedback._incorrect.final) || 'Not quite. Try again.');

  // Find correct index
  let correctIndex = 0;
  items.forEach((item, i) => { if (item._shouldBeSelected) correctIndex = i; });

  const choicesHtml = items.map((item, i) =>
    `<button class="w-full py-4 bg-surface-container-high border border-white/5 text-sm font-bold tracking-widest text-white/60 hover:border-primary-container hover:text-white transition-all" data-choice="${i}">${esc(item.text)}</button>`
  ).join('\n        ');

  return `<section class="py-40 bg-black flex justify-center px-8">
  <div class="max-w-2xl w-full glass-panel p-12 text-center" data-quiz data-correct="${correctIndex}" data-feedback-correct="${esc(correctFeedback)}" data-feedback-incorrect="${esc(incorrectFeedback)}">
    <h3 class="text-[10px] font-bold tracking-[0.4em] text-primary uppercase mb-8">${title}</h3>
    <p class="text-2xl font-black text-white mb-10 tracking-tight">${question}</p>
    <div class="grid gap-4">
      ${choicesHtml}
    </div>
    <div class="mt-8 hidden" data-quiz-feedback></div>
  </div>
</section>`;
}

function renderTextInput(comp) {
  const title = esc(comp.displayTitle || '');
  const body = stripTags(comp.body || '');
  const items = comp._items || [];

  const fieldsHtml = items.map(item => `<div class="space-y-2">
        <label class="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">${esc(item.prefix || item.label || '')}</label>
        <input class="w-full bg-surface-container-highest border-0 border-b border-outline/30 focus:border-primary-container focus:ring-0 text-white p-4 transition-colors" placeholder="${esc(item.placeholder || '')}" type="text"/>
      </div>`).join('\n      ');

  return `<section class="py-40 bg-surface-container-low px-8 md:px-24">
  <div class="max-w-4xl mx-auto glass-panel p-12 md:p-20">
    <div class="mb-12">
      <h3 class="text-2xl font-black text-white tracking-tight uppercase mb-2">${title}</h3>
      <p class="text-xs tracking-widest text-on-surface-variant uppercase">${body}</p>
    </div>
    <form class="grid md:grid-cols-2 gap-8">
      ${fieldsHtml}
      <div class="md:col-span-2 pt-8">
        <button class="w-full bg-primary-container text-on-primary-container py-5 font-black tracking-[0.3em] uppercase text-xs" type="button">SUBMIT</button>
      </div>
    </form>
  </div>
</section>`;
}

function renderGraphicText(comp, index) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = comp._graphic ? esc(comp._graphic.alt || '') : '';
  const imageRight = comp._imageAlign === 'right' || (!comp._imageAlign && index % 2 === 0);

  const imageBlock = imgSrc
    ? `<div class="relative group">
      <img alt="${imgAlt}" class="w-full grayscale group-hover:grayscale-0 transition-all duration-700" src="${imgSrc}"/>
    </div>`
    : `<div class="relative group bg-surface-container-high w-full aspect-video flex items-center justify-center">
      <span class="material-symbols-outlined text-6xl text-white/10">image</span>
    </div>`;

  const textBlock = `<div>
      <h3 class="text-2xl font-bold text-white mb-6">${title}</h3>
      <div class="text-on-surface-variant text-sm leading-relaxed">${body}</div>
    </div>`;

  const cols = imageRight ? `${textBlock}\n    ${imageBlock}` : `${imageBlock}\n    ${textBlock}`;

  return `<div class="grid lg:grid-cols-2 gap-12 items-center">
    ${cols}
  </div>`;
}

function renderChecklist(comp) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];

  const itemsHtml = items.map(item => `<li class="flex items-start gap-4 group">
      <span class="material-symbols-outlined text-primary mt-1">check_circle</span>
      <div>
        <p class="text-white font-bold tracking-tight mb-1">${esc(item.text || item.title || '')}</p>
        ${item.detail ? `<p class="text-xs text-on-surface-variant leading-relaxed">${esc(item.detail)}</p>` : ''}
      </div>
    </li>`).join('\n    ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-6 tracking-tight">${title}</h3>` : ''}
  <ul class="space-y-6" data-checklist>
    ${itemsHtml}
  </ul>
</div>`;
}

function renderPullquote(comp) {
  const quote = stripTags(comp.body || '');
  const attribution = esc(comp.attribution || '');
  const role = esc(comp.role || '');
  const cite = [attribution, role].filter(Boolean).join(', ');

  return `<blockquote class="border-l-4 border-primary p-8 bg-primary/5">
  <p class="text-2xl italic text-white leading-relaxed mb-4">${quote}</p>
  ${cite ? `<cite class="text-sm text-on-surface-variant not-italic">&mdash; ${cite}</cite>` : ''}
</blockquote>`;
}

function renderStatCallout(comp) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];

  const statsHtml = items.map(item => {
    const val = esc((item.value || '') + (item.suffix || ''));
    const label = esc(item.label || '');
    return `<div class="text-center">
      <div class="text-5xl font-black text-white mb-2">${val}</div>
      <div class="text-[10px] font-bold text-primary tracking-widest uppercase">${label}</div>
    </div>`;
  }).join('\n    ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-10 tracking-tight">${title}</h3>` : ''}
  <div class="flex flex-wrap justify-center gap-16">
    ${statsHtml}
  </div>
</div>`;
}

function renderBento(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const items = comp._items || [];
  const defaultIcons = ['bolt', 'speed', 'shield', 'memory', 'hub', 'star'];

  let cardsHtml = '';
  items.forEach((item, i) => {
    const itemTitle = esc(item.title || '');
    const itemBody = stripTags(item.body || '');
    const imgSrc = item._graphic ? embedImage(item._graphic.large) : '';
    const icon = defaultIcons[i % defaultIcons.length];

    if (i === 0 && imgSrc) {
      // First item spans 2 cols with background image
      cardsHtml += `<div class="md:col-span-2 glass-panel p-10 flex flex-col justify-end relative overflow-hidden group min-h-[300px]">
      <img alt="" class="absolute inset-0 w-full h-full object-cover opacity-20 group-hover:scale-110 transition-transform duration-700" src="${imgSrc}"/>
      <div class="relative z-10">
        <span class="text-[10px] font-bold tracking-widest text-primary mb-2 block">FEATURED</span>
        <h4 class="text-3xl font-black text-white mb-4">${itemTitle}</h4>
        <p class="text-on-surface-variant text-sm max-w-md mb-6">${itemBody}</p>
      </div>
    </div>\n    `;
    } else {
      cardsHtml += `<div class="glass-panel p-10 flex flex-col justify-between min-h-[250px]">
      <span class="material-symbols-outlined text-4xl text-primary">${icon}</span>
      <div>
        <span class="text-[10px] font-bold tracking-widest text-primary mb-2 block">CATEGORY</span>
        <h4 class="text-2xl font-black text-white mb-4">${itemTitle}</h4>
        <p class="text-on-surface-variant text-sm">${itemBody}</p>
      </div>
    </div>\n    `;
    }
  });

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-4 tracking-tight">${title}</h3>` : ''}
  ${body ? `<div class="text-on-surface-variant text-sm mb-10">${body}</div>` : ''}
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    ${cardsHtml}
  </div>
</div>`;
}

function renderComparison(comp) {
  const title = esc(comp.displayTitle || '');
  const columns = comp.columns || [];
  const rows = comp.rows || [];

  const thHtml = columns.map(col => `<th class="pb-4 uppercase">${esc(col.title || '')}</th>`).join('\n          ');

  const rowsHtml = rows.map(row => {
    const label = esc(row.label || '');
    const vals = (row.values || []).map(v => {
      if (v === true) return '<span class="material-symbols-outlined text-primary text-sm">check</span>';
      if (v === false) return '<span class="material-symbols-outlined text-error text-sm">close</span>';
      return esc(String(v));
    }).map(v => `<td class="py-4">${v}</td>`).join('\n          ');
    return `<tr>
          <td class="py-4 font-normal text-on-surface-variant">${label}</td>
          ${vals}
        </tr>`;
  }).join('\n        ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-6 tracking-tight">${title}</h3>` : ''}
  <div class="glass-panel overflow-x-auto p-10">
    <table class="w-full text-left">
      <thead>
        <tr class="text-[10px] font-bold tracking-[0.2em] text-white/40 border-b border-white/10">
          <th class="pb-4 uppercase">Feature</th>
          ${thHtml}
        </tr>
      </thead>
      <tbody class="text-xs font-bold text-white divide-y divide-white/5">
        ${rowsHtml}
      </tbody>
    </table>
  </div>
</div>`;
}

function renderTimeline(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const items = comp._items || [];

  const stepsHtml = items.map((item, i) => {
    const dotBg = i === 0 ? 'bg-primary' : 'bg-white/20';
    const labelColor = i === 0 ? 'text-primary' : 'text-white/40';
    const stepNum = String(i + 1).padStart(2, '0');
    return `<div class="relative">
      <div class="absolute -left-[37px] top-1 w-4 h-4 rounded-full ${dotBg} ring-4 ring-primary/20"></div>
      <p class="text-[10px] font-black ${labelColor} tracking-widest uppercase mb-1">Step ${stepNum}</p>
      <p class="text-white font-bold text-sm mb-2">${esc(item.title || '')}</p>
      <p class="text-xs text-on-surface-variant">${stripTags(item.body || '')}</p>
    </div>`;
  }).join('\n    ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-6 tracking-tight">${title}</h3>` : ''}
  ${body ? `<div class="text-on-surface-variant text-sm mb-8">${body}</div>` : ''}
  <div class="relative border-l border-white/10 pl-8 space-y-12">
    ${stepsHtml}
  </div>
</div>`;
}

function renderProcessFlow(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const nodes = comp._nodes || [];

  const nodesHtml = nodes.map((node, i) => {
    const stepNum = String(i + 1).padStart(2, '0');
    return `<li class="flex gap-4">
      <span class="text-xl font-black text-primary/40">${stepNum}</span>
      <div>
        <p class="text-white font-bold text-sm mb-1">${esc(node.title || '')}</p>
        <p class="text-sm text-on-surface-variant leading-relaxed">${esc(node.body || '')}</p>
      </div>
    </li>`;
  }).join('\n    ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-6 tracking-tight">${title}</h3>` : ''}
  ${body ? `<div class="text-on-surface-variant text-sm mb-8">${body}</div>` : ''}
  <ol class="space-y-6">
    ${nodesHtml}
  </ol>
</div>`;
}

function renderTabs(comp) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];

  const triggersHtml = items.map((item, i) => {
    const active = i === 0
      ? 'text-white border-b-2 border-primary'
      : 'text-white/40 hover:text-white';
    return `<button class="px-8 py-3 bg-surface-container-highest text-[10px] font-bold tracking-widest uppercase ${active}" data-tab-trigger="${i}">${esc(item.title || `Tab ${i + 1}`)}</button>`;
  }).join('\n      ');

  const panelsHtml = items.map((item, i) => {
    const display = i === 0 ? '' : ' style="display:none"';
    return `<div data-tab-panel="${i}"${display}>
        <h4 class="text-xl font-black text-white mb-4 tracking-tight">${esc(item.title || '')}</h4>
        <div class="text-on-surface-variant text-sm leading-relaxed">${item.body || ''}</div>
      </div>`;
  }).join('\n      ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-8 tracking-tight">${title}</h3>` : ''}
  <div data-tabs>
    <div class="flex flex-wrap justify-center gap-2 mb-12" data-tab-triggers>
      ${triggersHtml}
    </div>
    <div class="glass-panel p-12 min-h-[400px]">
      ${panelsHtml}
    </div>
  </div>
</div>`;
}

function renderFlashcard(comp) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];

  const cardsHtml = items.map((item, i) => {
    const icon = CARD_ICONS[i % CARD_ICONS.length];
    const front = esc(item.front || item.title || item.term || '');
    const back = esc(item.back || item.definition || item.body || '');
    return `<div class="group h-80 perspective" data-flashcard>
      <div class="relative w-full h-full transition-transform duration-700 preserve-3d group-hover:rotate-y-180 cursor-pointer">
        <div class="absolute inset-0 backface-hidden glass-panel flex flex-col items-center justify-center p-8 text-center">
          <span class="material-symbols-outlined text-4xl text-primary mb-4">${icon}</span>
          <h5 class="text-lg font-black text-white uppercase tracking-widest">${front}</h5>
        </div>
        <div class="absolute inset-0 backface-hidden rotate-y-180 bg-primary-container p-8 flex items-center justify-center text-center">
          <p class="text-on-primary-container font-bold text-sm leading-relaxed">${back}</p>
        </div>
      </div>
    </div>`;
  }).join('\n    ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-8 tracking-tight">${title}</h3>` : ''}
  <div class="grid md:grid-cols-3 gap-8">
    ${cardsHtml}
  </div>
</div>`;
}

function renderNarrative(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const items = comp._items || [];

  const slidesHtml = items.map((item, i) => {
    const display = i === 0 ? '' : ' style="display:none"';
    const stepNum = String(i + 1).padStart(2, '0');
    return `<div data-slide${display}>
        <h5 class="text-xs font-black tracking-widest text-primary uppercase mb-2">${stepNum} / ${String(items.length).padStart(2, '0')}</h5>
        <p class="text-white font-bold text-lg mb-4">${esc(item.title || '')}</p>
        <div class="text-sm text-on-surface-variant leading-relaxed">${item.body || ''}</div>
      </div>`;
  }).join('\n      ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-6 tracking-tight">${title}</h3>` : ''}
  ${body ? `<div class="text-on-surface-variant text-sm mb-6">${body}</div>` : ''}
  <div class="glass-panel p-8" data-carousel>
    <div data-slide-container>
      ${slidesHtml}
    </div>
    <div class="flex gap-4 mt-8">
      <button class="material-symbols-outlined text-white/40 hover:text-white" data-prev>chevron_left</button>
      <span class="text-xs text-white/40 font-bold tracking-widest self-center" data-slide-counter>1 / ${items.length}</span>
      <button class="material-symbols-outlined text-white/40 hover:text-white" data-next>chevron_right</button>
    </div>
  </div>
</div>`;
}

function renderKeyTerm(comp) {
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];

  const termsHtml = items.map((item, i) => {
    const icon = CARD_ICONS[i % CARD_ICONS.length];
    const term = esc(item.term || item.title || '');
    const def = esc(item.definition || item.body || '');
    return `<div class="glass-panel p-8 cursor-pointer group h-64" data-flashcard>
      <div class="relative w-full h-full transition-transform duration-700 preserve-3d group-hover:rotate-y-180">
        <div class="absolute inset-0 backface-hidden flex flex-col items-center justify-center text-center">
          <span class="material-symbols-outlined text-4xl text-primary mb-4">${icon}</span>
          <h5 class="text-lg font-black text-white uppercase tracking-widest">${term}</h5>
        </div>
        <div class="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center text-center p-4">
          <p class="text-on-surface-variant text-sm leading-relaxed">${def}</p>
        </div>
      </div>
    </div>`;
  }).join('\n    ');

  return `<div>
  ${title ? `<h3 class="text-2xl font-black text-white mb-8 tracking-tight">${title}</h3>` : ''}
  <div class="grid md:grid-cols-3 gap-8">
    ${termsHtml}
  </div>
</div>`;
}

function renderFullBleed(comp) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const bgStyle = imgSrc ? `background-image: url('${imgSrc}');` : '';

  return `<section class="relative min-h-screen bg-fixed bg-center bg-cover flex flex-col items-center justify-center px-8 md:px-24" style="${bgStyle}">
  <div class="absolute inset-0 bg-black/90 z-0"></div>
  <div class="relative z-10 max-w-5xl w-full text-center">
    <h2 class="text-6xl md:text-8xl font-black text-white tracking-tighter uppercase mb-6">${title}</h2>
    <div class="h-1 w-24 bg-primary mx-auto mb-12"></div>
    <div class="text-on-surface-variant text-xl leading-relaxed">${body}</div>
  </div>
</section>`;
}

function renderGraphic(comp) {
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large) : '';
  const imgAlt = comp._graphic ? esc(comp._graphic.alt || '') : '';

  if (!imgSrc) return '';
  return `<div class="relative group">
  <img alt="${imgAlt}" class="w-full object-cover" src="${imgSrc}"/>
</div>`;
}

// ─── Component dispatcher ─────────────────────────────────────────────
// Returns { html, selfWrapped } — selfWrapped means the component renders its own <section>
function renderComponent(comp, index) {
  const type = (comp.type || 'text').toLowerCase();
  switch (type) {
    case 'hero':        return { html: renderHero(comp), selfWrapped: true };
    case 'text':        return { html: renderText(comp), selfWrapped: false };
    case 'accordion':   return { html: renderAccordion(comp), selfWrapped: false };
    case 'mcq':         return { html: renderMCQ(comp), selfWrapped: true };
    case 'textinput':   return { html: renderTextInput(comp), selfWrapped: true };
    case 'graphic-text': return { html: renderGraphicText(comp, index), selfWrapped: false };
    case 'checklist':   return { html: renderChecklist(comp), selfWrapped: false };
    case 'pullquote':   return { html: renderPullquote(comp), selfWrapped: false };
    case 'stat-callout': return { html: renderStatCallout(comp), selfWrapped: false };
    case 'bento':       return { html: renderBento(comp), selfWrapped: false };
    case 'comparison':  return { html: renderComparison(comp), selfWrapped: false };
    case 'timeline':    return { html: renderTimeline(comp), selfWrapped: false };
    case 'process-flow': return { html: renderProcessFlow(comp), selfWrapped: false };
    case 'tabs':        return { html: renderTabs(comp), selfWrapped: false };
    case 'flashcard':   return { html: renderFlashcard(comp), selfWrapped: false };
    case 'narrative':   return { html: renderNarrative(comp), selfWrapped: false };
    case 'key-term':    return { html: renderKeyTerm(comp), selfWrapped: false };
    case 'full-bleed':  return { html: renderFullBleed(comp), selfWrapped: true };
    case 'graphic':     return { html: renderGraphic(comp), selfWrapped: false };
    default:
      console.log(`  [warn] Unknown component type: ${type}, falling back to text`);
      return { html: renderText(comp), selfWrapped: false };
  }
}

// ─── Render a full section ────────────────────────────────────────────
function renderSection(section, sectionIndex) {
  const components = section.components || [];
  if (components.length === 0) return '';

  const sectionTitle = section.title || '';
  const sectionId = section.sectionId || `section-${String(sectionIndex).padStart(2, '0')}`;
  const bgClass = BG_CLASSES[sectionIndex % BG_CLASSES.length];

  // Separate self-wrapped components from inline ones
  const output = [];
  let inlineBuffer = [];

  function flushInline() {
    if (inlineBuffer.length === 0) return;

    const sectionLabel = sectionTitle
      ? `<h2 class="text-[10px] font-bold tracking-[0.4em] text-primary uppercase mb-4">${esc(sectionTitle)}</h2>`
      : '';

    // Only show section label before the first inline group
    const showLabel = output.length === 0 && sectionLabel;

    output.push(`<section id="${sectionId}" class="py-40 px-8 md:px-24 ${bgClass} max-w-7xl mx-auto">
  ${showLabel ? sectionLabel : ''}
  <div class="space-y-16">
    ${inlineBuffer.join('\n    ')}
  </div>
</section>`);
    inlineBuffer = [];
  }

  let graphicTextIndex = 0;
  components.forEach((comp) => {
    const idx = comp.type === 'graphic-text' ? graphicTextIndex++ : 0;
    const { html, selfWrapped } = renderComponent(comp, idx);
    if (!html) return;

    if (selfWrapped) {
      flushInline();
      output.push(html);
    } else {
      inlineBuffer.push(html);
    }
  });

  flushInline();
  return output.join('\n\n');
}

// ─── Build nav bar ────────────────────────────────────────────────────
function buildNav(layout) {
  const courseTitle = esc(layout.course.title || 'Course');
  const sections = layout.sections.filter(s => s.title);
  const navLinks = sections.slice(0, 5).map(s =>
    `<a class="font-['Inter'] font-extrabold tracking-tighter uppercase text-[#ffffff]/60 hover:text-white transition-colors" href="#${s.sectionId}">${esc(s.title)}</a>`
  ).join('\n    ');

  return `<nav class="fixed top-0 w-full z-50 bg-[#131313]/80 backdrop-blur-xl border-b border-[#ffffff]/10 shadow-[0_0_40px_rgba(99,102,241,0.15)] flex justify-between items-center px-8 py-4">
  <div class="text-xl font-black tracking-[0.2em] text-[#c0c1ff] font-headline">${courseTitle.toUpperCase().replace(/\s+/g, '_')}</div>
  <div class="hidden md:flex gap-8 items-center">
    ${navLinks}
  </div>
  <button class="bg-primary-container text-on-primary-container px-6 py-2 rounded-sm font-bold tracking-widest text-xs transition-transform scale-95 active:scale-90" onclick="window.scrollTo({top:0,behavior:'smooth'})">TOP</button>
</nav>`;
}

// ─── Build footer ─────────────────────────────────────────────────────
function buildFooter(layout) {
  const courseTitle = esc(layout.course.title || 'Course');
  return `<footer class="w-full py-20 border-t border-[#ffffff]/5 bg-[#000000]">
  <div class="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-8 font-['Inter'] text-[10px] tracking-[0.1em] uppercase text-[#ffffff]/40">
    <div class="opacity-80">&copy; ${new Date().getFullYear()} ${courseTitle.toUpperCase()}. ALL RIGHTS RESERVED.</div>
    <div class="flex gap-12">
      <a class="hover:text-[#ffffff] transition-opacity" href="#">PRIVACY</a>
      <a class="hover:text-[#ffffff] transition-opacity" href="#">TERMS</a>
    </div>
  </div>
</footer>`;
}

// ─── Get hydration script ─────────────────────────────────────────────
function getHydrationScript() {
  if (fs.existsSync(HYDRATE_PATH)) {
    return fs.readFileSync(HYDRATE_PATH, 'utf-8');
  }
  // Inline fallback hydration for tabs, carousels, quizzes, flashcards
  return `
(function(){
  // ─── Tabs ───
  document.querySelectorAll('[data-tabs]').forEach(function(tabRoot){
    var triggers = tabRoot.querySelectorAll('[data-tab-trigger]');
    var panels = tabRoot.querySelectorAll('[data-tab-panel]');
    triggers.forEach(function(btn){
      btn.addEventListener('click', function(){
        var idx = btn.getAttribute('data-tab-trigger');
        triggers.forEach(function(t){
          t.classList.remove('border-b-2','border-primary','text-white');
          t.classList.add('text-white/40');
        });
        btn.classList.add('border-b-2','border-primary','text-white');
        btn.classList.remove('text-white/40');
        panels.forEach(function(p){
          p.style.display = p.getAttribute('data-tab-panel') === idx ? '' : 'none';
        });
      });
    });
  });

  // ─── Carousels ───
  document.querySelectorAll('[data-carousel]').forEach(function(carousel){
    var slides = carousel.querySelectorAll('[data-slide]');
    var counter = carousel.querySelector('[data-slide-counter]');
    var current = 0;
    function show(i){
      slides.forEach(function(s,j){ s.style.display = j === i ? '' : 'none'; });
      if(counter) counter.textContent = (i+1) + ' / ' + slides.length;
    }
    var prev = carousel.querySelector('[data-prev]');
    var next = carousel.querySelector('[data-next]');
    if(prev) prev.addEventListener('click', function(){ current = (current - 1 + slides.length) % slides.length; show(current); });
    if(next) next.addEventListener('click', function(){ current = (current + 1) % slides.length; show(current); });
  });

  // ─── Quizzes ───
  document.querySelectorAll('[data-quiz]').forEach(function(quiz){
    var correct = parseInt(quiz.getAttribute('data-correct'), 10);
    var feedbackCorrect = quiz.getAttribute('data-feedback-correct') || 'Correct!';
    var feedbackIncorrect = quiz.getAttribute('data-feedback-incorrect') || 'Not quite. Try again.';
    var feedbackEl = quiz.querySelector('[data-quiz-feedback]');
    var buttons = quiz.querySelectorAll('[data-choice]');
    buttons.forEach(function(btn){
      btn.addEventListener('click', function(){
        var chosen = parseInt(btn.getAttribute('data-choice'), 10);
        var isCorrect = chosen === correct;
        // Reset all buttons
        buttons.forEach(function(b){
          b.classList.remove('border-primary','border-error','bg-primary/10','bg-error/10');
          b.classList.add('border-white/5');
        });
        if(isCorrect){
          btn.classList.remove('border-white/5');
          btn.classList.add('border-primary','bg-primary/10');
          if(feedbackEl){
            feedbackEl.className = 'mt-8 p-6 bg-primary/10 border border-primary/30 text-primary text-sm font-bold';
            feedbackEl.textContent = feedbackCorrect;
          }
        } else {
          btn.classList.remove('border-white/5');
          btn.classList.add('border-error','bg-error/10');
          if(feedbackEl){
            feedbackEl.className = 'mt-8 p-6 bg-error/10 border border-error/30 text-error text-sm font-bold';
            feedbackEl.textContent = feedbackIncorrect;
          }
        }
      });
    });
  });

  // ─── Flashcard click toggle ───
  document.querySelectorAll('[data-flashcard]').forEach(function(card){
    card.addEventListener('click', function(){
      var inner = card.querySelector('.preserve-3d');
      if(inner){
        inner.classList.toggle('rotate-y-180');
      }
    });
  });

  // ─── Smooth scroll for nav links ───
  document.querySelectorAll('nav a[href^="#"]').forEach(function(link){
    link.addEventListener('click', function(e){
      e.preventDefault();
      var target = document.querySelector(link.getAttribute('href'));
      if(target) target.scrollIntoView({behavior:'smooth'});
    });
  });
})();
`;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN BUILD
// ═══════════════════════════════════════════════════════════════════════
function build() {
  console.log('V4 Build Course — Stitch Design DNA');
  console.log('====================================\n');

  // Read inputs
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error(`ERROR: course-layout.json not found at ${LAYOUT_PATH}`);
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  console.log(`[ok] Loaded course-layout.json (${layout.sections.length} sections)`);

  let stitchHtml = '';
  if (fs.existsSync(STITCH_PATH)) {
    stitchHtml = fs.readFileSync(STITCH_PATH, 'utf-8');
    console.log(`[ok] Loaded stitch-course-raw.html (${stitchHtml.length} chars)`);
  } else {
    console.log('[warn] No stitch-course-raw.html found — using default design DNA');
  }

  // Extract design DNA
  const dna = extractDesignDNA(stitchHtml);

  // Build all sections
  const sectionsHtml = layout.sections.map((s, i) => renderSection(s, i)).filter(Boolean).join('\n\n');
  console.log(`[ok] Rendered ${layout.sections.length} sections`);

  // Build nav and footer
  const navHtml = buildNav(layout);
  const footerHtml = buildFooter(layout);

  // Get hydration script
  const hydrateScript = getHydrationScript();

  // Assemble final HTML
  const courseTitle = layout.course.title || 'Course';
  const trailingStyleBlock = dna.trailingStyles.length > 0
    ? `<style>\n${dna.trailingStyles.join('\n')}\n</style>`
    : `<style>
  .perspective { perspective: 1000px; }
  .preserve-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
</style>`;

  // Use Stitch's head if available, otherwise construct one
  const headContent = dna.headContent || `
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"><\/script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100;300;400;700;800;900&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<script id="tailwind-config">
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          "primary": "#c0c1ff", "primary-container": "#8083ff",
          "on-primary-container": "#0d0096", "on-primary": "#1000a9",
          "secondary": "#ddb7ff", "secondary-container": "#6f00be",
          "tertiary": "#adc6ff", "tertiary-container": "#4d8eff",
          "error": "#ffb4ab", "error-container": "#93000a",
          "surface": "#131313", "surface-container": "#1f1f1f",
          "surface-container-low": "#1b1b1b", "surface-container-high": "#2a2a2a",
          "surface-container-highest": "#353535", "surface-container-lowest": "#0e0e0e",
          "on-surface": "#e2e2e2", "on-surface-variant": "#c7c4d7",
          "background": "#131313", "on-background": "#e2e2e2",
          "outline": "#908fa0", "outline-variant": "#464554",
        },
        fontFamily: { "headline": ["Inter"], "body": ["Inter"], "label": ["Inter"] },
        borderRadius: { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem" },
      },
    },
  }
<\/script>
<style>
  .material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24; }
  details > summary::-webkit-details-marker { display: none; }
  .glass-panel {
    background: rgba(53, 53, 53, 0.4);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(144, 143, 160, 0.15);
  }
</style>`;

  // Replace <title> in head content
  const headWithTitle = headContent.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${esc(courseTitle)}</title>`
  );
  // If no <title> was replaced, we need to check
  const finalHead = headWithTitle.includes('<title>')
    ? headWithTitle
    : `<title>${esc(courseTitle)}</title>\n${headWithTitle}`;

  const finalHtml = `<!DOCTYPE html>
<html class="dark" lang="en">
<head>
${finalHead}
</head>
<body class="bg-background text-on-background font-body selection:bg-primary-container selection:text-on-primary-container">

${navHtml}

<main class="min-h-screen bg-black overflow-x-hidden pt-16">
${sectionsHtml}

<!-- Course Completion -->
<section class="py-40 bg-surface-container-highest px-8 md:px-24">
  <div class="max-w-4xl mx-auto text-center">
    <span class="material-symbols-outlined text-6xl text-primary mb-8">verified_user</span>
    <h2 class="text-4xl font-black text-white mb-8 tracking-tight uppercase">Course Complete</h2>
    <p class="text-on-surface-variant text-xl leading-relaxed mb-12">
      You have completed ${esc(courseTitle)}. Review any sections as needed.
    </p>
    <button class="bg-primary-container text-on-primary-container px-12 py-5 font-black tracking-[0.3em] uppercase text-xs" onclick="window.scrollTo({top:0,behavior:'smooth'})">RETURN TO TOP</button>
  </div>
</section>

${footerHtml}
</main>

${trailingStyleBlock}

<script>
${hydrateScript}
</script>
</body>
</html>`;

  // Write outputs
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, finalHtml, 'utf-8');
  console.log(`\n[ok] Written: ${OUTPUT_PATH} (${(finalHtml.length / 1024).toFixed(0)} KB)`);

  fs.writeFileSync(PAGES_PATH, finalHtml, 'utf-8');
  console.log(`[ok] Written: ${PAGES_PATH}`);

  console.log('\nBuild complete!');
}

build();
