/**
 * Remaining 22 components — direct Preact ports of fill functions from build-course.js.
 * Each produces identical HTML to the original string-template version.
 *
 * Components in this file:
 *   DataTable, TextInput, PathSelector, Branching, Timeline, Comparison,
 *   StatCallout, Pullquote, Checklist, Flashcard, Narrative, KeyTerm,
 *   FullBleed, Graphic, ProcessFlow, Media, VideoTranscript, ImageGallery,
 *   LabeledImage, Divider, Callout
 */
import { useRender } from '../context.js';
import { esc, stripTags, sectionOnly, mc } from '../utils.js';
import type { Component } from '../types.js';

// ─── DataTable ───────────────────────────────────────────────────────
export function DataTable({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');
  const body = comp.body || '';

  let columns = comp.columns || [];
  let rows = comp.rows || comp._rows || [];
  let bodyUsedForTable = false;

  if (columns.length === 0 && rows.length === 0 && body) {
    const liMatches = body.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    if (liMatches.length >= 2) {
      const parsedRows = liMatches.map(li => stripTags(li).split('|').map(c => c.trim()));
      if (parsedRows.length > 0 && parsedRows[0].length >= 2) {
        rows = parsedRows;
        bodyUsedForTable = true;
      }
    }
  }

  let headerHtml = '';
  let bodyHtml = '';

  if (columns.length > 0) {
    headerHtml = '<th class="px-8 py-4 text-label-text uppercase text-on-surface-variant"></th>' +
      columns.map(c => `<th class="px-8 py-4 text-label-text uppercase text-on-surface-variant">${esc(c.title || '')}</th>`).join('');
    bodyHtml = rows.map((row: any, ri: number) => {
      const label = row.label || '';
      const vals = row.values || [];
      const cells = vals.map((v: any) => {
        if (v === true || v === 'true') return '<td class="px-8 py-4 text-secondary">&#10003;</td>';
        if (v === false || v === 'false') return '<td class="px-8 py-4 text-error">&#10007;</td>';
        return `<td class="px-8 py-4 text-on-surface-variant">${esc(String(v))}</td>`;
      }).join('');
      return `<tr class="${ri % 2 === 0 ? 'bg-on-surface/[0.02]' : ''} hover:bg-on-surface/5 transition-colors"><td class="px-8 py-4 font-medium">${esc(label)}</td>${cells}</tr>`;
    }).join('\n');
  } else if (rows.length > 0 && Array.isArray(rows[0])) {
    const headers = rows[0];
    headerHtml = headers.map((h: string) => `<th class="px-8 py-4 text-label-text uppercase text-on-surface-variant">${esc(h)}</th>`).join('');
    bodyHtml = rows.slice(1).map((row: string[], ri: number) =>
      `<tr class="${ri % 2 === 0 ? 'bg-on-surface/[0.02]' : ''} hover:bg-on-surface/5 transition-colors">${row.map((cell, ci) => `<td class="px-8 py-4${ci === 0 ? ' font-medium' : ' text-on-surface-variant'}">${esc(cell)}</td>`).join('')}</tr>`
    ).join('\n');
  }

  const bodyAbove = body && !bodyUsedForTable ? `<div class="mb-6 text-on-surface-variant">${body}</div>` : '';

  if (variant === 'striped-card') {
    return (
      <section class={secClass} data-component-type="data-table" data-animate="fade-up">
        <div class={`@container ${maxW} mx-auto px-8`}>
          {bodyAbove && <div dangerouslySetInnerHTML={{ __html: bodyAbove }} />}
          <div class="overflow-hidden rounded-2xl glass-card shadow-lg">
            <div class="px-8 py-6 bg-surface-container border-b border-on-surface/10">
              <h3 class="text-h3 tracking-tight" dangerouslySetInnerHTML={{ __html: title }} />
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead dangerouslySetInnerHTML={{ __html: `<tr class="bg-primary/10">${headerHtml.replace(/text-on-surface-variant/g, 'text-on-surface')}</tr>` }} />
                <tbody class="divide-y divide-on-surface/5" dangerouslySetInnerHTML={{ __html: bodyHtml.replace(/bg-on-surface\/\[0\.02\]/g, 'bg-surface-container/50') }} />
              </table>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section class={secClass} data-component-type="data-table" data-animate="fade-up">
      <div class={`@container ${maxW} mx-auto px-8`}>
        {bodyAbove && <div dangerouslySetInnerHTML={{ __html: bodyAbove }} />}
        <div class="overflow-hidden rounded-xl border border-on-surface/5 glass">
          <div class="px-8 py-6 border-b border-on-surface/5">
            <h3 class="text-h3 tracking-tight" dangerouslySetInnerHTML={{ __html: title }} />
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead dangerouslySetInnerHTML={{ __html: `<tr class="bg-on-surface/5">${headerHtml}</tr>` }} />
              <tbody class="divide-y divide-on-surface/5" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── TextInput ───────────────────────────────────────────────────────
export function TextInput({ comp, maxW }: { comp: Component; maxW: string }) {
  const { AR } = useRender();
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16 bg-surface-container-low');
  const cardClass = `${AR.surface?.card || 'glass-card'} p-6 @3xl:p-12 ${AR.borderRadius?.cardLarge || 'rounded-3xl'}`;
  const inputClass = 'w-full bg-surface-container-lowest border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50 focus:border-secondary';

  return (
    <section class={secClass} data-component-type="textinput" data-animate="fade-up">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <div class={cardClass}>
          <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="space-y-8">
            {items.map((item, i) => (
              <div>
                <label class="block text-label-text uppercase text-on-surface mb-3" data-edit-path={`_items.${i}.label`}>{esc(item.prefix || item.label || '')}</label>
                <textarea class={`${inputClass} min-h-[80px] resize-y`} placeholder={item.placeholder || ''} rows={2} />
              </div>
            ))}
            <button class="btn-primary px-8 py-4 rounded-xl font-bold text-on-primary w-full">Submit</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PathSelector ────────────────────────────────────────────────────
export function PathSelector({ comp, maxW }: { comp: Component; maxW: string }) {
  const { AR } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;
  const title = esc(comp.displayTitle || 'Choose Your Learning Path');
  const bodyText = stripTags(comp.body || '');
  const instruction = esc(comp.instruction || 'Select your role below.');
  const brCfg = AR.branching || {};
  const secClass = sectionOnly('py-16');
  const btnBg = brCfg.buttonBg || AR.surface?.card || 'glass-card border border-outline-variant/20';
  const btnRound = AR.borderRadius?.cardLarge || 'rounded-2xl';
  const btnVisuals = brCfg.buttonHover || 'hover:border-primary/40 hover:bg-surface-container transition-all duration-300';

  return (
    <section class={secClass} data-component-type="path-selector" data-interactive data-path-selector>
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h3 class="font-headline text-h3 mb-4 text-center" dangerouslySetInnerHTML={{ __html: title }} />
        {bodyText && <p class="text-body-lg text-on-surface-variant mb-4 text-center">{bodyText}</p>}
        <p class="text-sm text-on-surface-variant mb-10 text-center italic">{instruction}</p>
        <div class={`grid grid-cols-1 @3xl:grid-cols-${Math.min(items.length, 3)} gap-6`} data-animate-stagger="scale-in">
          {items.map((item, i) => (
            <button class={`group p-6 @3xl:p-8 ${btnBg} ${btnRound} text-left ${btnVisuals}`} data-path-option data-path-variable={item.variable || ''}>
              <div class="text-h4 mb-2" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</div>
              <div class="text-sm text-on-surface-variant" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Branching ───────────────────────────────────────────────────────
export function Branching({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  let items = comp._items || [];
  let scenarioText = '';
  if (items.length === 0 && comp.body) {
    const liMatches = comp.body.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    if (liMatches.length > 0) {
      items = liMatches.map(li => ({ title: stripTags(li) }));
      if (items.length > 2) {
        const first = items[0].title || '';
        const hasLetterPrefix = /^[A-D][\.\):\s—–-]/.test(first.trim());
        const isLong = first.length > 80;
        const avgRest = items.slice(1).reduce((s, it) => s + (it.title || '').length, 0) / (items.length - 1);
        if (!hasLetterPrefix && isLong && first.length > avgRest * 2) {
          scenarioText = first;
          items = items.slice(1);
        }
      }
      items = items.map(item => ({ ...item, title: (item.title || '').replace(/^[A-Z][\.\):\s—–-]\s*/i, '') }));
    }
  }
  const title = esc(comp.displayTitle || '');
  const bodyText = scenarioText || (items.length > 0 ? '' : stripTags(comp.body || ''));
  const brCfg = AR.branching || {};
  const secClass = sectionOnly('py-16');
  const btnBg = brCfg.buttonBg || AR.surface?.card || 'glass-card border border-outline-variant/20';
  const btnRound = AR.borderRadius?.cardLarge || 'rounded-2xl';
  const btnVisuals = brCfg.buttonHover || 'hover:border-primary/40 hover:bg-surface-container transition-all duration-200';

  if (variant === 'list') {
    return (
      <section class={secClass} data-component-type="branching" data-interactive>
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h3 class="font-headline text-h3 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
          {bodyText && <p class="text-body-lg text-on-surface-variant mb-8 italic">{bodyText}</p>}
          <div class="flex flex-col gap-3" data-animate-stagger="fade-up">
            {items.map((item, i) => (
              <button class={`group flex items-start gap-5 p-5 @3xl:p-6 ${btnBg} rounded-xl text-left ${btnVisuals} w-full`}>
                <div class="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold">{String.fromCharCode(65 + i)}</div>
                <div class="flex-1 min-w-0">
                  <div class="text-h4 text-on-surface" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</div>
                  {(item.body || '') && <div class="text-body text-on-surface-variant mt-1" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</div>}
                </div>
                <span class="material-symbols-outlined text-on-surface-variant/40 group-hover:text-secondary transition-colors self-center">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default: cards
  return (
    <section class={secClass} data-component-type="branching" data-interactive>
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h3 class="font-headline text-h3 mb-8 text-center" dangerouslySetInnerHTML={{ __html: title }} />
        {bodyText && <p class="text-body-lg text-on-surface-variant mb-8 text-center italic">{bodyText}</p>}
        <div class="grid grid-cols-1 @3xl:grid-cols-2 gap-5" data-animate-stagger="fade-up">
          {items.map((item, i) => (
            <button class={`group p-6 @3xl:p-8 ${btnBg} ${btnRound} text-left ${btnVisuals} relative overflow-hidden`}>
              <span class="absolute bottom-2 right-3 text-4xl font-headline font-black text-primary/8 group-hover:text-secondary/15 transition-colors select-none leading-none">{String.fromCharCode(65 + i)}</span>
              <div class="relative z-10">
                <div class="text-h4 text-on-surface mb-2" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</div>
                <div class="text-body text-on-surface-variant" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────
export function Timeline({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;
  const tlCfg = AR.timeline || {};
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');

  if (variant === 'centered-alternating') {
    return (
      <section class={secClass} data-component-type="timeline">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h2 class="font-headline text-h2 mb-12 text-center" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="relative">
            <div class="hidden @3xl:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-outline-variant/30 -translate-x-1/2" />
            <div class="space-y-8" data-animate-stagger="fade-up">
              {items.map((item, i) => {
                const num = String(i + 1).padStart(2, '0');
                const isLeft = i % 2 === 0;
                return (
                  <div class={`relative flex items-center ${isLeft ? '@3xl:flex-row' : '@3xl:flex-row-reverse'} gap-8`}>
                    <div class={`hidden @3xl:block @3xl:w-[calc(50%-2rem)] ${isLeft ? 'text-right' : 'text-left'}`}>
                      <div class={`glass-card rounded-2xl p-5 @3xl:p-6 inline-block ${isLeft ? 'ml-auto' : 'mr-auto'}`}>
                        <h4 class="font-headline text-h4 mb-2" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</h4>
                        <p class="text-on-surface-variant text-sm leading-normal" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                      </div>
                    </div>
                    <div class="relative z-10 flex-shrink-0">
                      <div class="w-10 h-10 rounded-full bg-primary border-4 border-background flex items-center justify-center text-on-primary text-sm font-bold shadow-lg">{num}</div>
                    </div>
                    <div class="@3xl:w-[calc(50%-2rem)] @3xl:hidden">
                      <h4 class="font-headline text-h4 mb-2" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</h4>
                      <p class="text-on-surface-variant text-sm leading-normal" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                    </div>
                    <div class="hidden @3xl:block @3xl:w-[calc(50%-2rem)]" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: vertical (border-l dot layout)
  const activeDotClass = (tlCfg as any).activeDotClass || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-primary shadow-[0_0_10px_rgba(100,100,255,0.4)]';
  const inactiveDotClass = (tlCfg as any).inactiveDotClass || 'absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-outline-variant/60';

  return (
    <section class={secClass} data-component-type="timeline">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h2 class="font-headline text-h2 mb-10 text-center" dangerouslySetInnerHTML={{ __html: title }} />
        <div class="relative border-l-2 border-outline-variant ml-4 space-y-10" data-animate-stagger="fade-up">
          {items.map((item, i) => {
            const num = String(i + 1).padStart(2, '0');
            const dotClass = i === 0 ? activeDotClass : inactiveDotClass;
            const titleClass = i === 0 ? 'font-headline text-h4 text-secondary mb-2' : 'font-headline text-h4 mb-2';
            return (
              <div class="relative pl-14">
                <div class={dotClass} />
                <div class="text-primary/30 font-headline font-black text-sm uppercase tracking-widest mb-1">{num}</div>
                <div class={titleClass} data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</div>
                <p class="text-body text-on-surface-variant" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Comparison ──────────────────────────────────────────────────────
export function Comparison({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly('py-16');
  const columns = (comp as any).columns || (comp as any)._columns || [];
  const rows = comp.rows || [];
  if (columns.length === 0) return null;

  if (variant === 'stacked-rows' && columns.length === 2) {
    const renderVal = (v: any) => {
      if (v === true || v === 'true') return '<span class="material-symbols-outlined text-secondary text-xl">check_circle</span>';
      if (v === false || v === 'false') return '<span class="material-symbols-outlined text-error/60 text-xl">cancel</span>';
      return `<span class="text-on-surface-variant text-sm">${esc(String(v))}</span>`;
    };
    return (
      <section class={secClass} data-component-type="comparison" data-animate="fade-up">
        <div class={`@container ${maxW} mx-auto px-4 @3xl:px-8`}>
          <h2 class="font-headline text-h2 mb-8 text-center" dangerouslySetInnerHTML={{ __html: title }} />
          {body && <p class="text-center text-on-surface-variant mb-8">{stripTags(body)}</p>}
          <div class="flex justify-between mb-6 px-4">
            <span class="font-headline text-h4 text-primary" data-edit-path="columns.0.title">{esc(columns[0].title || '')}</span>
            <span class="font-headline text-h4 text-secondary" data-edit-path="columns.1.title">{esc(columns[1].title || '')}</span>
          </div>
          <div class="space-y-3" data-animate-stagger="fade-up">
            {rows.map((row: any, ri: number) => {
              const vals = row.values || [];
              return (
                <div class={`${AR.surface?.card || 'glass-card'} ${AR.borderRadius?.button || 'rounded-xl'} px-5 py-3 flex flex-col @3xl:flex-row items-center gap-2 @3xl:gap-4`}>
                  <div class="flex-shrink-0 px-3 py-1 bg-surface-container rounded-full text-label-text uppercase text-on-surface text-center @3xl:order-2" data-edit-path={`rows.${ri}.label`}>{esc(row.label || '')}</div>
                  <div class="flex-1 text-center @3xl:text-right @3xl:order-1" dangerouslySetInnerHTML={{ __html: renderVal(vals[0]) }} />
                  <div class="flex-1 text-center @3xl:text-left @3xl:order-3" dangerouslySetInnerHTML={{ __html: renderVal(vals[1]) }} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // Default: columns
  const headerHtml = '<th class="px-5 py-3 font-bold uppercase tracking-widest text-sm text-on-surface-variant"></th>' +
    columns.map((c: any) => `<th class="px-5 py-3 font-bold uppercase tracking-widest text-sm text-primary">${esc(c.title || '')}</th>`).join('');
  const rowsHtml = rows.map((row: any, ri: number) => {
    const vals = (row.values || []).map((v: any) => {
      if (v === true || v === 'true') return '<td class="px-5 py-3 text-center"><span class="material-symbols-outlined text-secondary text-xl">check_circle</span></td>';
      if (v === false || v === 'false') return '<td class="px-5 py-3 text-center"><span class="material-symbols-outlined text-error/60 text-xl">cancel</span></td>';
      return `<td class="px-5 py-3 text-on-surface-variant">${esc(String(v))}</td>`;
    }).join('');
    return `<tr class="${ri % 2 === 0 ? 'bg-on-surface/[0.02]' : ''} hover:bg-on-surface/5 transition-colors border-b border-on-surface/5 last:border-0"><td class="px-5 py-3 font-bold">${esc(row.label || '')}</td>${vals}</tr>`;
  }).join('\n');

  return (
    <section class={secClass} data-component-type="comparison" data-animate="fade-up">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h2 class="font-headline text-h2 mb-8 text-center" dangerouslySetInnerHTML={{ __html: title }} />
        {body && <p class="text-center text-on-surface-variant mb-10">{stripTags(body)}</p>}
        <div class="overflow-x-auto glass rounded-3xl border border-on-surface/5">
          <table class="w-full text-left">
            <thead class="bg-on-surface/5" dangerouslySetInnerHTML={{ __html: `<tr>${headerHtml}</tr>` }} />
            <tbody class="divide-y divide-on-surface/5" dangerouslySetInnerHTML={{ __html: rowsHtml }} />
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── StatCallout ─────────────────────────────────────────────────────
export function StatCallout({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;
  const statCfg = (AR as any).stat || {};
  const secClass = sectionOnly('py-16 bg-surface-container-low');
  const unifiedNumColor = statCfg.numColor || 'text-gradient';
  const statCardBg = statCfg.cardBg || AR.surface?.card || 'glass-card';
  const statCardRound = statCfg.cardRound || AR.borderRadius?.card || 'rounded-2xl';

  if (variant === 'card-row') {
    const numericValues = items.map(item => {
      const numMatch = ((item as any).stat || item.value || '').replace(/,/g, '').match(/[\d.]+/);
      return numMatch ? parseFloat(numMatch[0]) : 0;
    });
    const maxVal = Math.max(...numericValues, 1);
    const colCount = Math.min(items.length, 4);
    return (
      <section class={secClass} data-component-type="stat-callout">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <div class={`grid grid-cols-1 @xl:grid-cols-2 ${colCount > 2 ? `@3xl:grid-cols-${colCount}` : ''} gap-6`} data-animate-stagger="fade-up">
            {items.map((item, i) => {
              const displayValue = (item.prefix || '') + ((item as any).stat || item.value || '') + (item.suffix || '');
              const barWidth = Math.max(Math.round((numericValues[i] / maxVal) * 100), 5);
              return (
                <div class={`${statCardBg} ${statCardRound} p-6 @3xl:p-8 min-w-[200px] flex flex-col`}>
                  <div class={`text-stat font-headline font-extrabold ${unifiedNumColor} mb-2`} data-counter data-edit-path={`_items.${i}.value`} data-stat-prefix={item.prefix || ''} data-stat-suffix={item.suffix || ''}>{esc(displayValue)}</div>
                  <p class="text-on-surface-variant text-sm font-medium mb-4 flex-1" data-edit-path={`_items.${i}.label`}>{esc(item.label || '')}</p>
                  <div class="h-1.5 bg-surface-container rounded-full overflow-hidden mt-auto">
                    <div class="h-full bg-gradient-to-r from-primary to-secondary rounded-full" style={`width:${barWidth}%`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // Default: centered
  const colCount = Math.min(items.length, 4);
  return (
    <section class={secClass} data-component-type="stat-callout">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <div class={`grid grid-cols-2 @3xl:grid-cols-${colCount} gap-8 text-center`} data-animate-stagger="fade-up">
          {items.map((item, i) => {
            const displayValue = (item.prefix || '') + ((item as any).stat || item.value || '') + (item.suffix || '');
            return (
              <div class={mc('p-8', statCardRound, statCardBg, 'min-w-[120px]')}>
                <div class={`text-stat font-headline font-extrabold ${unifiedNumColor} mb-3`} data-counter data-edit-path={`_items.${i}.value`} data-stat-prefix={item.prefix || ''} data-stat-suffix={item.suffix || ''}>{esc(displayValue)}</div>
                <p class="text-on-surface-variant text-sm leading-snug font-medium mt-2" data-edit-path={`_items.${i}.label`}>{esc(item.label || '')}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Pullquote ───────────────────────────────────────────────────────
export function Pullquote({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  const quote = stripTags(comp.body || '');
  const attribution = esc((comp as any).attribution || '');
  const role = esc((comp as any).role || '');
  const pqCfg = AR.pullquote || {};
  const secClass = sectionOnly('py-16');
  const bqStyle = (pqCfg as any).blockquoteStyle || 'text-blockquote font-headline';

  if (variant === 'centered') {
    return (
      <section class={secClass} data-component-type="pullquote">
        <div class="@container max-w-5xl mx-auto px-8 text-center">
          <div class="flex justify-center mb-2">
            <span class="text-primary/10 text-[6rem] font-serif leading-none select-none pointer-events-none" aria-hidden="true">&ldquo;</span>
          </div>
          <blockquote class={mc('font-headline', bqStyle)} data-text-reveal data-edit-path="body">{quote}</blockquote>
          {attribution && <cite class={`mt-6 block not-italic ${(pqCfg as any).citeClass || 'text-on-surface-variant'}`} data-animate="fade-up" data-edit-path="attribution">— {attribution}{role ? `, ${role}` : ''}</cite>}
        </div>
      </section>
    );
  }

  if (variant === 'minimal') {
    return (
      <section class={sectionOnly('py-20 bg-surface-container-low')} data-component-type="pullquote">
        <div class="@container max-w-4xl mx-auto px-8 text-center">
          <blockquote class="font-headline text-blockquote text-on-surface" data-animate="fade-up" data-edit-path="body">{quote}</blockquote>
          {attribution && <p class="mt-6 text-sm text-on-surface-variant uppercase tracking-widest" data-animate="fade-up" data-edit-path="attribution">— {attribution}{role ? ` · ${role}` : ''}</p>}
        </div>
      </section>
    );
  }

  // Default: accent-bar
  return (
    <section class={secClass} data-component-type="pullquote">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <div class="relative pl-8 border-l-4 border-primary" data-animate="fade-up" data-accent-bar>
          <span class="text-primary/20 text-7xl font-serif absolute -top-6 -left-1 leading-none select-none" aria-hidden="true">&ldquo;</span>
          <blockquote class={mc('font-headline', bqStyle)} data-text-reveal data-edit-path="body">{quote}</blockquote>
          {attribution && <p class="mt-4 text-on-surface-variant" data-animate="fade-up" data-edit-path="attribution">— {attribution}{role && <span class="block text-sm mt-1 text-on-surface-variant/60">{role}</span>}</p>}
        </div>
      </div>
    </section>
  );
}

// ─── Checklist ───────────────────────────────────────────────────────
export function Checklist({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const clCfg = AR.checklist || {};
  const secClass = sectionOnly('py-16');
  const cardClass = mc((clCfg as any).cardBg || AR.surface?.card || 'glass-card', 'p-6 @3xl:p-8', (clCfg as any).cardRound || AR.borderRadius?.cardLarge || 'rounded-3xl');
  const inputClass = (clCfg as any).inputClass || 'w-7 h-7 rounded border-outline-variant text-secondary focus:ring-secondary bg-transparent cursor-pointer';
  const labelHover = (clCfg as any).labelHover || 'hover:bg-surface-variant/50 transition-colors';

  if (variant === 'card-style') {
    return (
      <section class={secClass} data-component-type="checklist" data-interactive>
        <div class={`@container ${maxW} mx-auto px-8`} data-checklist data-animate="fade-up">
          <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
            {items.map((item, i) => (
              <label class={`flex items-center gap-5 p-6 glass-card rounded-2xl cursor-pointer group border border-outline-variant/10 ${labelHover}`}>
                <input class={inputClass} type="checkbox" />
                <span class="text-on-surface font-medium" data-edit-path={`_items.${i}.text`}>{esc(item.text || item.title || '')}</span>
              </label>
            ))}
          </div>
          <div class="mt-6 text-sm text-on-surface-variant font-bold" data-checklist-progress>0 / {items.length} complete</div>
        </div>
      </section>
    );
  }

  if (variant === 'numbered') {
    return (
      <section class={secClass} data-component-type="checklist" data-interactive>
        <div class={`@container ${maxW} mx-auto px-8`}>
          <div class={cardClass} data-checklist data-animate="fade-up">
            <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
            <div class="space-y-2">
              {items.map((item, i) => (
                <label class={`flex items-center gap-5 p-5 rounded-xl cursor-pointer group bg-surface-container/30 border border-outline-variant/10 ${labelHover}`}>
                  <div class="w-8 h-8 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary font-bold text-sm">{i + 1}</div>
                  <input class={inputClass} type="checkbox" />
                  <span class="text-on-surface font-medium" data-edit-path={`_items.${i}.text`}>{esc(item.text || item.title || '')}</span>
                </label>
              ))}
            </div>
            <div class="mt-6 text-sm text-on-surface-variant font-bold" data-checklist-progress>0 / {items.length} complete</div>
          </div>
        </div>
      </section>
    );
  }

  // Default: standard
  return (
    <section class={secClass} data-component-type="checklist" data-interactive>
      <div class={`@container ${maxW} mx-auto px-8`}>
        <div class={cardClass} data-checklist data-animate="fade-up">
          <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="space-y-2">
            {items.map((item, i) => (
              <label class={`flex items-center gap-5 p-5 rounded-xl cursor-pointer group bg-surface-container/30 border border-outline-variant/10 ${labelHover}`}>
                <input class={inputClass} type="checkbox" />
                <span class="text-on-surface font-medium" data-edit-path={`_items.${i}.text`}>{esc(item.text || item.title || '')}</span>
              </label>
            ))}
          </div>
          <div class="mt-6 text-sm text-on-surface-variant font-bold" data-checklist-progress>0 / {items.length} complete</div>
        </div>
      </div>
    </section>
  );
}

// ─── Flashcard ───────────────────────────────────────────────────────
export function Flashcard({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;
  const fcCfg = AR.flashcard || {};
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16 bg-surface-container-low overflow-hidden');
  const icons = ['info', 'local_fire_department', 'pan_tool', 'bolt', 'shield', 'warning', 'speed', 'memory'];
  const fcRound = (fcCfg as any).frontRound || AR.borderRadius?.cardLarge || 'rounded-3xl';
  const backRound = (fcCfg as any).backRound || fcRound;

  const makeCard = (item: any, i: number, large: boolean) => {
    const frontText = esc(item.front || item.title || item.term || '');
    const backText = item.back || item.definition || item.body || '';
    const frontFaceClass = mc((fcCfg as any).frontBg || AR.surface?.card || 'glass-card', fcRound, 'border border-outline-variant/10', large ? 'p-10 @3xl:p-14' : 'p-6 @3xl:p-8');
    const backFaceClass = mc((fcCfg as any).backBg || 'bg-secondary-container', backRound, large ? 'p-8 @3xl:p-12 text-center' : 'p-4 @3xl:p-5 text-center');
    return (
      <div class="group cursor-pointer h-full" style="perspective:1000px" data-flashcard>
        <div class="relative w-full h-full transition-transform duration-500" style="transform-style:preserve-3d">
          <div class={`flex items-center justify-center h-full ${frontFaceClass}`} style="backface-visibility:hidden">
            <div class="text-center">
              <div class={`material-symbols-outlined text-secondary text-${large ? '4' : '3'}xl mb-3`}>{icons[i % icons.length]}</div>
              <div class={`font-headline ${large ? 'text-h4' : 'text-body'} leading-snug`} data-edit-path={`_items.${i}.front`}>{frontText}</div>
              <div class="mt-2 text-xs text-on-surface-variant/60 uppercase tracking-wider">Tap to reveal</div>
            </div>
          </div>
          <div class={`absolute inset-0 flex items-center justify-center ${backFaceClass} overflow-y-auto`} style="backface-visibility:hidden;transform:rotateY(180deg)">
            <p class={`${(fcCfg as any).backText || 'text-on-primary-container'} font-medium text-${large ? 'base' : 'xs'} leading-snug`} data-edit-path={`_items.${i}.back`}>{backText}</p>
          </div>
        </div>
      </div>
    );
  };

  if (variant === 'single-large') {
    return (
      <section class={secClass} data-component-type="flashcard" data-interactive data-carousel>
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h2 class="font-headline text-h2 mb-10 text-center" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="max-w-4xl mx-auto">
            {items.map((item, i) => (
              <div data-slide={String(i + 1)} style={i > 0 ? 'display:none' : undefined}>{makeCard(item, i, true)}</div>
            ))}
          </div>
          <div class="flex justify-center gap-3 mt-8">
            <button class="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center hover:bg-secondary/20 transition-colors" data-prev><span class="material-symbols-outlined">chevron_left</span></button>
            <span class="flex items-center text-sm text-on-surface-variant font-bold" data-slide-counter>1 / {items.length}</span>
            <button class="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center" data-next><span class="material-symbols-outlined">chevron_right</span></button>
          </div>
        </div>
      </section>
    );
  }

  // Default: grid
  const n = items.length;
  const gridCols = n <= 3 ? `@3xl:grid-cols-${n}` : n === 4 ? '' : n === 5 ? '@3xl:grid-cols-5' : n === 6 ? '@3xl:grid-cols-3' : '@3xl:grid-cols-4';
  return (
    <section class={secClass} data-component-type="flashcard" data-interactive>
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h2 class="font-headline text-h2 mb-10 text-center" dangerouslySetInnerHTML={{ __html: title }} />
        <div class={`grid grid-cols-1 @xl:grid-cols-2 ${gridCols} gap-6`} data-animate-stagger="scale-in">
          {items.map((item, i) => makeCard(item, i, false))}
        </div>
      </div>
    </section>
  );
}

// ─── Narrative ───────────────────────────────────────────────────────
export function Narrative({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { embedImage } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16').replace(/\bpy-(\d+)\b/g, (_m: string, n: string) => parseInt(n) > 16 ? 'py-16' : _m);

  const navButtons = (
    <div class="flex justify-center gap-3 mt-6">
      <button class="w-11 h-11 rounded-full border border-outline-variant flex items-center justify-center hover:bg-secondary/20 transition-colors" data-prev><span class="material-symbols-outlined">chevron_left</span></button>
      <button class="w-11 h-11 rounded-full bg-secondary text-on-secondary flex items-center justify-center" data-next><span class="material-symbols-outlined">chevron_right</span></button>
    </div>
  );

  if (variant === 'image-focused') {
    return (
      <section class={secClass} data-component-type="narrative" data-interactive data-carousel data-animate="fade-up">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="glass-card rounded-[2.5rem] p-4 @3xl:p-6 relative overflow-hidden">
            {items.map((item, i) => {
              const imgSrc = item._graphic ? embedImage(item._graphic.large || '') : '';
              const imgAlt = esc(item._graphic?.alt || item.title || '');
              const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
              return (
                <div data-slide={String(i + 1)} style={i > 0 ? 'display:none' : undefined}>
                  {imgSrc && <img alt={imgAlt} class="w-full h-[400px] object-cover rounded-2xl mb-6" src={imgSrc} />}
                  <div class="text-on-surface-variant font-bold mb-2">{counter}</div>
                  <h4 class="font-headline text-h4 mb-2 text-on-surface" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</h4>
                  <p class="text-on-surface-variant text-sm" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                </div>
              );
            })}
            {navButtons}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'text-focused') {
    return (
      <section class={secClass} data-component-type="narrative" data-interactive data-carousel data-animate="fade-up">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="glass-card rounded-[2.5rem] p-6 @3xl:p-8 relative">
            {items.map((item, i) => {
              const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
              return (
                <div data-slide={String(i + 1)} style={i > 0 ? 'display:none' : undefined}>
                  <div class="text-on-surface-variant font-bold mb-4">{counter}</div>
                  <h4 class="font-headline text-h3 mb-4 text-on-surface" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</h4>
                  <div class="text-body text-on-surface-variant leading-normal" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</div>
                </div>
              );
            })}
            {navButtons}
          </div>
        </div>
      </section>
    );
  }

  // Default (image-focused is default per library)
  return (
    <section class={secClass} data-component-type="narrative" data-interactive data-carousel data-animate="fade-up">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
        <div class="glass-card rounded-[2.5rem] p-6 @3xl:p-8 relative">
          {items.map((item, i) => {
            const counter = `${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
            return (
              <div data-slide={String(i + 1)} style={i > 0 ? 'display:none' : undefined}>
                <div class="text-on-surface-variant font-bold mb-4">{counter}</div>
                <h4 class="font-headline text-h4 mb-4 text-on-surface" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</h4>
                <p class="text-sm text-on-surface-variant leading-normal" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
              </div>
            );
          })}
          {navButtons}
        </div>
      </div>
    </section>
  );
}

// ─── KeyTerm ─────────────────────────────────────────────────────────
export function KeyTerm({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { AR } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');
  const ktCfg = (AR as any).keyTerm || {};

  if (variant === 'list') {
    return (
      <section class={secClass} data-component-type="key-term">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
          <div class={`${ktCfg.cardBg || AR.surface?.card || 'glass-card'} ${ktCfg.cardRound || AR.borderRadius?.card || 'rounded-2xl'} overflow-hidden`} data-animate="fade-up">
            {items.map((item, i) => (
              <div class="flex gap-6 p-5 border-b border-on-surface/5 last:border-0">
                <div class="text-on-surface font-headline text-h4 w-48 flex-shrink-0" data-edit-path={`_items.${i}.term`}>{esc((item as any).term || item.title || '')}</div>
                <p class="text-on-surface-variant text-body flex-1" data-edit-path={`_items.${i}.definition`}>{esc((item as any).definition || item.body || '')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Default: card-grid
  const cols = items.length <= 2 ? items.length : items.length === 4 ? 2 : 3;
  return (
    <section class={secClass} data-component-type="key-term">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />
        <div class={`grid grid-cols-1 @xl:grid-cols-2 ${cols === 3 ? '@3xl:grid-cols-3' : ''} gap-6`} data-animate-stagger="fade-up">
          {items.map((item, i) => (
            <div class={`${ktCfg.cardBg || AR.surface?.card || 'glass-card'} p-6 @3xl:p-8 ${ktCfg.cardRound || AR.borderRadius?.card || 'rounded-2xl'} overflow-hidden ${ktCfg.accentBorder || 'border-l-4 border-primary'}`}>
              <div class="text-on-surface font-headline text-h4 mb-3" data-edit-path={`_items.${i}.term`}>{esc((item as any).term || item.title || '')}</div>
              <p class="text-on-surface-variant text-body" data-edit-path={`_items.${i}.definition`}>{esc((item as any).definition || item.body || '')}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FullBleed ───────────────────────────────────────────────────────
export function FullBleed({ comp, variant }: { comp: Component; variant: string }) {
  const { embedImage } = useRender();
  const title = esc(comp.displayTitle || '');
  const bodyText = stripTags(comp.body || '');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large || '') : '';
  const imgAlt = esc(comp._graphic?.alt || '');
  const pos = variant || (comp as any).overlayPosition || 'center';

  const img = imgSrc ? <img alt={imgAlt} class="absolute inset-0 w-full h-full object-cover" src={imgSrc} data-parallax /> : null;

  if (pos === 'left') {
    return (
      <section class="relative h-[60vh] flex items-center overflow-x-hidden overflow-y-hidden" data-component-type="full-bleed">
        {img}
        <div class="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
        <div class="@container relative z-10 w-full max-w-6xl mx-auto px-8 text-left" data-animate="fade-up">
          <h2 class="font-headline text-h2 @3xl:text-display tracking-tight mb-4 text-white max-w-2xl" data-edit-path="displayTitle" dangerouslySetInnerHTML={{ __html: title }} />
          {bodyText && <p class="text-lg @3xl:text-xl text-white/80 max-w-xl" data-edit-path="body">{bodyText}</p>}
        </div>
      </section>
    );
  }

  if (pos === 'right') {
    return (
      <section class="relative h-[60vh] flex items-center overflow-x-hidden overflow-y-hidden" data-component-type="full-bleed">
        {img}
        <div class="absolute inset-0 bg-gradient-to-l from-black/90 via-black/50 to-transparent" />
        <div class="@container relative z-10 w-full max-w-6xl mx-auto px-8 text-right flex flex-col items-end" data-animate="fade-up">
          <h2 class="font-headline text-h2 @3xl:text-display tracking-tight mb-4 text-white max-w-2xl" data-edit-path="displayTitle" dangerouslySetInnerHTML={{ __html: title }} />
          {bodyText && <p class="text-lg @3xl:text-xl text-white/80 max-w-xl" data-edit-path="body">{bodyText}</p>}
        </div>
      </section>
    );
  }

  // Default: center
  return (
    <section class="relative h-[60vh] flex items-center overflow-hidden" data-component-type="full-bleed">
      {img}
      <div class="absolute inset-0 bg-black/60" />
      <div class="@container relative z-10 w-full max-w-6xl mx-auto px-8 text-center" data-animate="fade-up">
        <h2 class="font-headline text-h2 @3xl:text-display tracking-tight mb-4 text-white" data-edit-path="displayTitle" dangerouslySetInnerHTML={{ __html: title }} />
        {bodyText && <p class="text-lg @3xl:text-xl text-white/80 max-w-3xl mx-auto" data-edit-path="body">{bodyText}</p>}
      </div>
    </section>
  );
}

// ─── Graphic ─────────────────────────────────────────────────────────
export function Graphic({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { embedImage } = useRender();
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly('py-12');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large || '') : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  if (variant === 'captioned-card') {
    return (
      <section class={secClass} data-component-type="graphic">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <div class="glass-card rounded-2xl overflow-hidden" data-animate="fade-up">
            <div class="relative">
              {imgSrc ? <img alt={imgAlt} class="w-full h-auto max-h-[50vh] object-cover" src={imgSrc} /> : <div class="w-full h-64 bg-surface-container" />}
              {title && <div class="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-8 pb-6 pt-16"><h2 class="font-headline text-h3 text-white" dangerouslySetInnerHTML={{ __html: title }} /></div>}
            </div>
            {body && <div class="px-8 py-5 text-on-surface-variant" dangerouslySetInnerHTML={{ __html: body }} />}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section class={secClass} data-component-type="graphic">
      <div class={`@container ${maxW} mx-auto px-8`}>
        {title && <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />}
        <div class="rounded-2xl overflow-hidden" data-animate="clip-up">
          {imgSrc ? <img alt={imgAlt} class="w-full h-auto max-h-[60vh] object-cover" src={imgSrc} /> : <div class="w-full h-64 bg-surface-container rounded-2xl" />}
        </div>
        {body && <div class="mt-4 text-on-surface-variant" dangerouslySetInnerHTML={{ __html: body }} />}
      </div>
    </section>
  );
}

// ─── ProcessFlow ─────────────────────────────────────────────────────
export function ProcessFlow({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const items = (comp._items || (comp as any)._nodes || []) as any[];
  if (items.length === 0) return null;
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16 bg-surface-container-low');

  if (variant === 'horizontal') {
    const arrow = <div class="flex items-center flex-shrink-0 px-1"><span class="material-symbols-outlined text-outline-variant/50 text-lg">arrow_forward</span></div>;
    return (
      <section class={secClass} data-component-type="process-flow">
        <div class={`@container ${maxW} mx-auto px-8`}>
          {title && <h2 class="font-headline text-h2 mb-10 text-center" dangerouslySetInnerHTML={{ __html: title }} />}
          <div class="flex flex-col @3xl:flex-row gap-2 items-stretch" data-animate="fade-up">
            {items.map((item, i) => {
              const borderColor = i === 0 ? 'border-secondary' : i === items.length - 1 ? 'border-primary' : 'border-outline-variant/30';
              return (
                <>
                  <div class={`glass-card px-4 py-4 rounded-xl border-t-4 ${borderColor} flex-1 min-w-0 text-center`}>
                    <div class="font-headline text-body mb-1" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</div>
                    {item.body && <div class="text-body text-on-surface-variant" data-edit-path={`_items.${i}.body`}>{stripTags(item.body)}</div>}
                  </div>
                  {i < items.length - 1 && arrow}
                </>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // Default: vertical
  const downArrow = <div class="flex justify-center py-1"><span class="material-symbols-outlined text-outline-variant/50 text-lg">arrow_downward</span></div>;
  return (
    <section class={secClass} data-component-type="process-flow">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h2 class="font-headline text-h2 mb-12 text-center" dangerouslySetInnerHTML={{ __html: title }} />
        <div class="flex flex-col gap-2" data-animate-stagger="fade-up">
          {items.map((item, i) => {
            const borderClass = i === 0 ? 'border-l-4 border-secondary' : i === items.length - 1 ? 'border-l-4 border-primary' : 'border-l-4 border-outline-variant/30';
            const numColor = i === 0 ? 'text-secondary' : i === items.length - 1 ? 'text-primary' : 'text-primary/40';
            const stepNum = String(i + 1).padStart(2, '0');
            return (
              <>
                <div class={`glass-card px-6 @3xl:px-8 py-5 @3xl:py-6 rounded-xl ${borderClass} flex items-start gap-5`}>
                  <span class={`${numColor} font-headline font-black text-2xl mt-0.5 flex-shrink-0`}>{stepNum}</span>
                  <div class="min-w-0">
                    <div class="font-headline text-h4 mb-1" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</div>
                    {item.body && <div class="text-body text-on-surface-variant" data-edit-path={`_items.${i}.body`}>{stripTags(item.body)}</div>}
                  </div>
                </div>
                {i < items.length - 1 && downArrow}
              </>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Media ───────────────────────────────────────────────────────────
export function Media({ comp, maxW }: { comp: Component; maxW: string }) {
  const { embedImage } = useRender();
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large || '') : '';
  return (
    <section class={secClass} data-component-type="media" data-animate="clip-up">
      <div class={`@container ${maxW} mx-auto px-8`}>
        {title && <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />}
        <div class="relative bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center">
          {imgSrc ? <img alt="" class="w-full h-full object-cover" src={imgSrc} /> : <span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span>}
        </div>
      </div>
    </section>
  );
}

// ─── VideoTranscript ─────────────────────────────────────────────────
export function VideoTranscript({ comp, maxW }: { comp: Component; maxW: string }) {
  const title = esc(comp.displayTitle || 'Transcript');
  const secClass = sectionOnly('py-16');
  return (
    <section class={secClass} data-component-type="video-transcript" data-animate="fade-up">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <div class="bg-surface-container rounded-3xl overflow-hidden aspect-video flex items-center justify-center mb-6">
          <span class="material-symbols-outlined text-6xl text-on-surface-variant">play_circle</span>
        </div>
        <details class="bg-surface-container-low rounded-2xl">
          <summary class="p-6 cursor-pointer font-bold flex justify-between items-center">
            <span dangerouslySetInnerHTML={{ __html: title }} />
            <span class="material-symbols-outlined">expand_more</span>
          </summary>
          <div class="p-8 text-on-surface-variant" data-edit-path="body" data-edit-html dangerouslySetInnerHTML={{ __html: comp.body || '' }} />
        </details>
      </div>
    </section>
  );
}

// ─── ImageGallery ────────────────────────────────────────────────────
export function ImageGallery({ comp, maxW }: { comp: Component; maxW: string }) {
  const { embedImage } = useRender();
  const title = esc(comp.displayTitle || '');
  const items = comp._items || [];
  const secClass = sectionOnly('py-16');
  return (
    <section class={secClass} data-component-type="image-gallery">
      <div class={`@container ${maxW} mx-auto px-8`}>
        {title && <h2 class="font-headline text-h2 mb-12" dangerouslySetInnerHTML={{ __html: title }} />}
        <div class={`grid grid-cols-2 @3xl:grid-cols-3 gap-6 ${items.length % 3 === 1 ? '[&>:last-child]:@3xl:col-start-2' : ''}`} data-animate-stagger="scale-in">
          {items.map((item, i) => {
            const imgSrc = item._graphic ? embedImage(item._graphic.large || '') : '';
            const imgAlt = esc(item._graphic?.alt || (item as any).caption || '');
            const caption = esc((item as any).caption || '');
            return (
              <div class="bg-surface-container rounded-2xl overflow-hidden">
                {imgSrc
                  ? <div class="aspect-square"><img alt={imgAlt} class="w-full h-full object-cover" src={imgSrc} /></div>
                  : <div class="aspect-square flex items-center justify-center"><span class="material-symbols-outlined text-4xl text-on-surface-variant">image</span></div>
                }
                {caption && <p class="px-4 py-3 text-sm text-on-surface-variant" data-edit-path={`_items.${i}.caption`}>{caption}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── LabeledImage ────────────────────────────────────────────────────
export function LabeledImage({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const { embedImage } = useRender();
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large || '') : '';
  const imgAlt = esc(comp._graphic?.alt || '');
  const markers = (comp as any)._markers || [];

  if (variant === 'side-panel') {
    return (
      <section class={secClass} data-component-type="labeled-image">
        <div class={`@container ${maxW} mx-auto px-8`}>
          {title && <h2 class="font-headline text-h2 mb-12" dangerouslySetInnerHTML={{ __html: title }} />}
          <div class="flex flex-col @3xl:flex-row gap-8" data-animate="fade-up">
            <div class="flex-1 relative bg-surface-container rounded-3xl overflow-hidden min-h-[300px]">
              {imgSrc ? <img alt={imgAlt} class="w-full h-full object-cover rounded-3xl" src={imgSrc} /> : <div class="w-full h-[400px] bg-surface-container rounded-3xl flex items-center justify-center"><span class="material-symbols-outlined text-6xl text-on-surface-variant/30">image</span></div>}
            </div>
            <div class="@3xl:w-80 flex-shrink-0 glass-card rounded-2xl p-4 space-y-1 self-start">
              {markers.map((m: any, i: number) => (
                <div class="flex items-start gap-4 p-4 rounded-xl hover:bg-surface-container/50 transition-colors">
                  <div class="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary text-xs font-bold">{i + 1}</div>
                  <div>
                    <div class="font-bold text-on-surface text-sm" data-edit-path={`_markers.${i}.label`}>{esc(m.label || '')}</div>
                    {m.description && <p class="text-xs text-on-surface-variant mt-1" data-edit-path={`_markers.${i}.description`}>{esc(m.description || '')}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: numbered-dots
  const hasImage = !!imgSrc;
  return (
    <section class={secClass} data-component-type="labeled-image">
      <div class={`@container ${maxW} mx-auto px-8`}>
        {title && <h2 class="font-headline text-h2 mb-12" dangerouslySetInnerHTML={{ __html: title }} />}
        <div class="relative bg-surface-container rounded-3xl overflow-hidden min-h-[300px]" data-animate="clip-up">
          {imgSrc ? <img alt={imgAlt} class="w-full max-h-[65vh] object-cover rounded-3xl" src={imgSrc} /> : <div class="w-full h-[400px] bg-surface-container rounded-3xl flex items-center justify-center"><span class="material-symbols-outlined text-6xl text-on-surface-variant/30">image</span></div>}
          {hasImage && markers.map((m: any, i: number) => (
            <div class="absolute group z-10" style={`left:${m.x}%;top:${m.y}%`}>
              <div class="w-8 h-8 rounded-full bg-primary border-2 border-white shadow-lg cursor-pointer hover:scale-125 transition-transform flex items-center justify-center text-on-primary text-xs font-bold">{i + 1}</div>
              <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 glass-card rounded-xl text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">{esc(m.label || '')}</div>
            </div>
          ))}
        </div>
        {!hasImage && markers.length > 0 && (
          <div class="grid grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 gap-4 mt-8">
            {markers.map((m: any, i: number) => (
              <div class="glass-card rounded-xl p-4 flex items-center gap-3 border border-outline-variant/20">
                <div class="w-8 h-8 rounded-full bg-primary flex-shrink-0 flex items-center justify-center text-on-primary text-xs font-bold">{i + 1}</div>
                <span class="text-sm font-medium" data-edit-path={`_markers.${i}.label`}>{esc(m.label || '')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────
export function Divider({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const style = variant || (comp as any).style || 'line';
  const icon = esc((comp as any).icon || 'more_horiz');

  if (style === 'spacing') {
    return <section class="py-4" data-component-type="divider"><div class="h-4" /></section>;
  }
  if (style === 'icon') {
    return (
      <section class="py-4" data-component-type="divider">
        <div class={`@container ${maxW} mx-auto px-8 flex items-center gap-4`}>
          <div class="flex-1 h-px bg-outline-variant/20" />
          <span class="material-symbols-outlined text-on-surface-variant/40 text-xl">{icon}</span>
          <div class="flex-1 h-px bg-outline-variant/20" />
        </div>
      </section>
    );
  }
  return (
    <section class="py-4" data-component-type="divider">
      <div class={`@container ${maxW} mx-auto px-8`}><hr class="border-0 h-px bg-outline-variant/20" /></div>
    </section>
  );
}

// ─── Callout ─────────────────────────────────────────────────────────
export function Callout({ comp, variant, maxW }: { comp: Component; variant: string; maxW: string }) {
  const title = esc(comp.displayTitle || '');
  const body = comp.body || '';
  const secClass = sectionOnly('py-16');
  const calloutType = variant || (comp as any).calloutType || 'info';
  const typeConfig: Record<string, { icon: string; border: string; bg: string; iconColor: string }> = {
    info:    { icon: 'info',             border: 'border-primary',      bg: 'bg-primary/5',     iconColor: 'text-primary' },
    warning: { icon: 'warning',          border: 'border-amber-500',    bg: 'bg-amber-500/5',   iconColor: 'text-amber-500' },
    tip:     { icon: 'tips_and_updates', border: 'border-emerald-500',  bg: 'bg-emerald-500/5', iconColor: 'text-emerald-500' },
    success: { icon: 'check_circle',     border: 'border-teal-500',     bg: 'bg-teal-500/5',    iconColor: 'text-teal-500' },
  };
  const cfg = typeConfig[calloutType] || typeConfig.info;

  return (
    <section class={secClass} data-component-type="callout">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <div class={`border-l-4 ${cfg.border} ${cfg.bg} rounded-r-xl p-6 @3xl:p-8`} data-animate="fade-up">
          <div class="flex items-start gap-4">
            <span class={`material-symbols-outlined ${cfg.iconColor} text-2xl flex-shrink-0 mt-0.5`}>{cfg.icon}</span>
            <div>
              {title && <h4 class="font-headline text-h4 text-on-surface mb-2" dangerouslySetInnerHTML={{ __html: title }} />}
              <div class="text-body text-on-surface-variant" dangerouslySetInnerHTML={{ __html: body }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
