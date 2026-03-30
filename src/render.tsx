/**
 * Preact SSR entry point — renders course-layout.json into HTML string.
 *
 * This replaces the section assembly + fill function dispatch in build-course.js.
 * generateHead() and file I/O remain in build-course.js (the orchestrator).
 *
 * Usage from build-course.js:
 *   const { renderCourse } = require('./dist/render.cjs');
 *   const html = renderCourse(layout, { AR, isDark, embedImage });
 */
import { h, Fragment } from 'preact';
import renderToString from 'preact-render-to-string';
import { setRenderContext } from './context.js';
import { COMPONENT_REGISTRY } from './components/index.js';
import {
  esc, getSectionMaxW, getComponentMaxW, VARIANT_MAP,
  CATEGORY_MAP, NEEDS_STANDARD, INTERACTIVE_TYPES,
} from './utils.js';
import type { CourseLayout, Section, Component, RenderContext } from './types.js';

// ─── Component data normalisation ───────────────────────────────────
// Preact components all read comp._items, comp._feedback, etc.
// course-layout.json uses public names: items, cards, tabs, choices, steps, etc.
// This function produces a normalised copy so we never mutate the original layout.

function normalizeComponent(raw: any): Component {
  const comp: any = { ...raw };

  if (!comp._items) {
    if (comp.type === 'flashcard') {
      // cards: [{front, back}] → _items: [{front, back}]
      comp._items = comp.cards || [];
    } else if (comp.type === 'tabs') {
      // tabs: [{label, body}] → _items: [{title, body}]
      comp._items = (comp.tabs || []).map((t: any) => ({ ...t, title: t.label || t.title || '' }));
    } else if (comp.type === 'mcq' || comp.type === 'branching') {
      // choices: [{id, text, label, body}] → _items with correct flag
      const correctId = comp.correct;
      comp._items = (comp.choices || []).map((ch: any) => ({
        ...ch,
        title: ch.text || ch.label || ch.title || '',
        body: ch.body || '',
        correct: ch.id === correctId || ch.correct || false,
      }));
    } else if (comp.type === 'process-flow') {
      // steps or nodes → _items
      comp._items = comp.steps || comp.nodes || comp.items || [];
    } else if (comp.type === 'stat-callout') {
      // stats: [{value, unit, label}] → _items with suffix=unit
      comp._items = (comp.stats || comp.items || []).map((s: any) => ({
        ...s,
        value: s.value || s.stat || '',
        suffix: s.unit || s.suffix || '',
        label: s.label || '',
      }));
    } else if (comp.type === 'textinput') {
      // May have an items array, or a single placeholder/instruction as one item
      comp._items = comp.items || (comp.placeholder
        ? [{ label: comp.instruction || comp.displayTitle || '', placeholder: comp.placeholder }]
        : []);
    } else {
      // accordion, timeline, bento, key-term, checklist, narrative, etc.
      comp._items = comp.items || [];
    }
  }

  // MCQ feedback: {correct, incorrect} → _feedback: {correct, _incorrect:{final}}
  if (!comp._feedback && comp.feedback) {
    comp._feedback = {
      correct: comp.feedback.correct || '',
      _incorrect: { final: comp.feedback.incorrect || '' },
    };
  }

  return comp as Component;
}

// ─── Component rendering ────────────────────────────────────────────

function renderComponentVariant(
  comp: Component,
  index: number,
  sectionWidth: string,
  variantOverride?: string,
): string | null {
  const type = (comp.type || 'text').toLowerCase();
  const variant = variantOverride !== undefined ? variantOverride : (comp.variant || '');
  const maxW = getComponentMaxW(type, variant, getSectionMaxW(sectionWidth));

  const entry = COMPONENT_REGISTRY[type];
  if (!entry) {
    console.log(`  [warn] Unknown component type: ${type}`);
    return null;
  }

  const Comp = entry.component;
  const props: any = { comp: normalizeComponent(comp) };

  if (!entry.noVariant) props.variant = variant;
  if (!entry.noMaxW) props.maxW = maxW;
  if (entry.indexed) props.index = index;

  let html = renderToString(h(Comp, props));
  if (!html) return null;

  // Inject data-variant
  if (variant) {
    html = html.replace(/^(<section\b[^>]*)>/, `$1 data-variant="${variant}">`);
  }
  // Inject data-category
  const category = CATEGORY_MAP[type];
  if (category) {
    html = html.replace(/^(<section\b[^>]*)>/, `$1 data-category="${category}">`);
  }

  return html;
}

function renderComponent(
  comp: Component,
  index: number,
  sectionWidth: string,
): string | null {
  const type = (comp.type || 'text').toLowerCase();
  const variant = comp.variant || '';

  let html = renderComponentVariant(comp, index, sectionWidth);
  if (!html) return null;

  // Pre-render alternate variants as <template> tags for authoring layer
  const allVariants = VARIANT_MAP[type];
  if (allVariants && allVariants.length > 1) {
    const activeVariant = variant || allVariants[0];
    const altTemplates: string[] = [];
    for (const v of allVariants) {
      if (v === activeVariant) continue;
      const altHtml = renderComponentVariant(comp, index, sectionWidth, v);
      if (altHtml) {
        altTemplates.push(`<template data-variant-alt="${esc(v)}">${altHtml}</template>`);
      }
    }
    if (altTemplates.length > 0) {
      if (html.includes('</section>')) {
        html = html.replace(/<\/section>\s*$/, `${altTemplates.join('\n')}\n</section>`);
      } else {
        html += '\n' + altTemplates.join('\n');
      }
    }
  }

  return html;
}

// ─── Nav ─────────────────────────────────────────────────────────────

function buildNav(layout: CourseLayout): string {
  const courseTitle = esc(layout.course.title || 'Course');
  const sections = layout.sections.filter(s => s.title);

  const drawerLinks = sections.map((s, i) => {
    const sId = s.sectionId || `section-${i}`;
    return `<a class="drawer-link flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all" href="#${sId}" data-drawer-link="${sId}">
<span class="drawer-index text-xs font-bold text-outline-variant w-5 text-center">${String(i + 1).padStart(2, '0')}</span>
<span class="flex-1 truncate">${esc(s.title)}</span>
<span class="drawer-status material-symbols-outlined text-base text-outline-variant" style="font-size:16px"></span>
</a>`;
  }).join('\n');

  return `<!-- Slim sticky header -->
<nav class="fixed top-0 w-full z-50 h-14 px-4 md:px-8 flex items-center justify-between glass-nav bg-background/80 backdrop-blur-xl" data-component-type="navigation">
<button class="nav-hamburger p-2 -ml-2 rounded-lg hover:bg-on-surface/5 transition-colors" aria-label="Open section menu" data-nav-toggle>
<span class="material-symbols-outlined text-on-surface">menu</span>
</button>
<span class="text-sm font-bold tracking-tight text-on-surface truncate max-w-[60vw] md:max-w-none">${courseTitle}</span>
<div class="flex items-center gap-2">
<span class="text-xs font-medium text-on-surface-variant tabular-nums" data-progress-text>0%</span>
</div>
</nav>

<!-- Section drawer overlay -->
<div class="nav-drawer-overlay fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity duration-300" data-drawer-overlay></div>

<!-- Section drawer -->
<aside class="nav-drawer fixed top-0 left-0 z-[70] h-full w-80 max-w-[85vw] bg-surface-container shadow-2xl transform -translate-x-full transition-transform duration-300 ease-out flex flex-col" data-drawer>
<div class="flex items-center justify-between px-4 h-14 border-b border-outline-variant/20 shrink-0">
<span class="text-sm font-bold text-on-surface">Sections</span>
<button class="p-2 rounded-lg hover:bg-on-surface/5 transition-colors" data-drawer-close aria-label="Close menu">
<span class="material-symbols-outlined text-on-surface-variant">close</span>
</button>
</div>
<div class="flex-1 overflow-y-auto py-3 px-2 custom-scrollbar flex flex-col gap-0.5">
${drawerLinks}
</div>
<div class="shrink-0 px-4 py-3 border-t border-outline-variant/20">
<div class="flex items-center justify-between text-xs text-on-surface-variant mb-2">
<span>Progress</span>
<span data-drawer-progress-text>0%</span>
</div>
<div class="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
<div class="h-full rounded-full bg-primary transition-all duration-300" data-drawer-progress-bar style="width:0%"></div>
</div>
</div>
</aside>`;
}

// ─── Section assembly ────────────────────────────────────────────────

function assembleSection(
  section: Section,
  sectionIndex: number,
): string | null {
  const components = section.components || [];
  if (components.length === 0) return null;

  const sectionId = section.sectionId || `section-${String(sectionIndex).padStart(2, '0')}`;

  // Width safeguards
  let sectionWidth = section.sectionWidth || 'standard';
  if (sectionWidth === 'narrow') {
    const hasWideComponent = components.some(c => NEEDS_STANDARD.has((c.type || '').toLowerCase()));
    if (hasWideComponent) sectionWidth = 'standard';
  }

  const componentHtmls: string[] = [];
  let interactiveCount = 0;

  components.forEach((comp, compIndex) => {
    const type = (comp.type || 'text').toLowerCase();
    if (INTERACTIVE_TYPES.has(type)) interactiveCount++;

    let filled = renderComponent(comp, compIndex, sectionWidth);
    if (filled) {
      // Inject authoring data attributes
      filled = filled.replace(
        /data-component-type="/g,
        `data-section-index="${sectionIndex}" data-component-index="${compIndex}" data-component-type="`
      );
      if (comp.requiredItems && INTERACTIVE_TYPES.has(type)) {
        filled = filled.replace(
          /data-component-type="/,
          `data-required-items="${comp.requiredItems}" data-component-type="`
        );
      }
      if (comp.showIf && Object.keys(comp.showIf).length > 0) {
        const condition = Object.entries(comp.showIf)
          .map(([k, v]) => `${k}=${v}`)
          .join('|');
        filled = `<div data-show-if="${esc(condition)}" style="display:none">\n${filled}\n</div>`;
      }
      componentHtmls.push(filled);
    }
  });

  if (componentHtmls.length === 0) return null;

  const sectionTitle = section.title || '';
  const trackAttr = interactiveCount > 0 ? ` data-section-track="${sectionId}" data-interactive-count="${interactiveCount}"` : '';
  const secMaxW = getSectionMaxW(sectionWidth);

  const titleBar = sectionTitle
    ? `<div class="${secMaxW} mx-auto px-8 pt-24 pb-8" id="${sectionId}"${trackAttr}>
<div class="flex items-center gap-6">
<div class="h-px flex-1 bg-gradient-to-r from-primary/60 to-transparent"></div>
<h2 class="font-headline text-label-text uppercase text-primary">${esc(sectionTitle)}</h2>
<div class="h-px flex-1 bg-gradient-to-l from-primary/60 to-transparent"></div>
</div>
</div>`
    : '';

  const wrapped = componentHtmls.map((h, i) => {
    if (h.trim().startsWith('<section') || h.trim().startsWith('<div data-show-if')) {
      if (i === 0 && !sectionTitle) {
        if (h.trim().startsWith('<div data-show-if')) {
          return h.replace(/<div data-show-if/, `<div id="${sectionId}" data-show-if`);
        }
        return h.replace(/<section/, `<section id="${sectionId}"`);
      }
      return h;
    }
    return `<div class="py-12 ${secMaxW} mx-auto px-8">\n${h}\n</div>`;
  }).join('\n\n');

  let sectionBlock = titleBar + '\n' + wrapped;
  if (section.showIf && Object.keys(section.showIf).length > 0) {
    const condition = Object.entries(section.showIf)
      .map(([k, v]) => `${k}=${v}`)
      .join('|');
    sectionBlock = `<div data-show-if="${esc(condition)}" style="display:none">\n${sectionBlock}\n</div>`;
  }

  return sectionBlock;
}

// ─── Main render function ────────────────────────────────────────────

export function renderCourseBody(
  layout: CourseLayout,
  ctx: RenderContext,
): { sectionsHtml: string; navHtml: string; filledCount: number; fallbackCount: number } {
  // Set the module-level context for all components to access via useRender()
  setRenderContext(ctx);

  let filledCount = 0;
  let fallbackCount = 0;
  const sectionsHtml: string[] = [];

  layout.sections.forEach((section, sectionIndex) => {
    const result = assembleSection(section, sectionIndex);
    if (result) {
      const comps = section.components || [];
      filledCount += comps.length;
      sectionsHtml.push(result);
    }
  });

  // Course gating
  const gateIndex = sectionsHtml.findIndex(h => h.includes('data-path-selector'));
  if (gateIndex >= 0 && gateIndex < sectionsHtml.length - 1) {
    const before = sectionsHtml.slice(0, gateIndex + 1);
    const after = sectionsHtml.slice(gateIndex + 1);
    const gatedBlock = `<div data-course-gate class="gated">\n${after.join('\n\n')}\n</div>`;
    sectionsHtml.length = 0;
    sectionsHtml.push(...before, gatedBlock);
    console.log(`[ok] Course gate: content after section ${gateIndex} wrapped in gate (${after.length} sections gated)`);
  }

  const navHtml = buildNav(layout);

  return {
    sectionsHtml: sectionsHtml.join('\n\n'),
    navHtml,
    filledCount,
    fallbackCount,
  };
}
