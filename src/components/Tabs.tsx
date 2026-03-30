import { useRender } from '../context.js';
import { esc, sectionOnly } from '../utils.js';
import type { Component } from '../types.js';

interface Props {
  comp: Component;
  variant: string;
  maxW: string;
}

export function Tabs({ comp, variant, maxW }: Props) {
  const { AR } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;
  const tabCfg = AR.tabs || {};

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16 bg-surface-container-low');

  const tabPad = tabCfg.tabPad || 'px-6 py-3';
  const tabRound = tabCfg.tabRound || AR.borderRadius?.pill || 'rounded-full';
  const activeBtn = `${tabPad} ${tabRound} ${tabCfg.activeTabBg || 'bg-primary-container text-on-primary-container font-bold text-sm uppercase tracking-wider'}`;
  const inactiveBtn = `${tabPad} ${tabRound} ${tabCfg.inactiveBtn || 'glass-card hover:bg-surface-container text-on-surface-variant font-bold text-sm uppercase tracking-wider'}`;

  if (variant === 'vertical') {
    const vertRound = AR.borderRadius?.card || 'rounded-xl';
    const vActiveBtn = activeBtn.replace(tabRound, vertRound) + ' text-left';
    const vInactiveBtn = inactiveBtn.replace(tabRound, vertRound) + ' text-left';

    return (
      <section class={`${secClass} overflow-x-hidden`} data-component-type="tabs" data-interactive data-animate="fade-up">
        <div class={`@container ${maxW} mx-auto px-4 @3xl:px-8`}>
          <h2 class="font-headline text-h2 mb-10" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="flex flex-col @3xl:flex-row gap-6 min-w-0" data-tabs>
            <div class="flex flex-row @3xl:flex-col gap-2 @3xl:w-64 flex-shrink-0 overflow-x-auto @3xl:overflow-visible">
              {items.map((item, i) => (
                <button
                  class={`flex-shrink-0 @3xl:w-full whitespace-nowrap @3xl:whitespace-normal ${i === 0 ? vActiveBtn : vInactiveBtn}`}
                  data-tab-trigger={String(i)}
                >
                  <span data-edit-path={`_items.${i}.title`}>{esc(item.title || `Tab ${i + 1}`)}</span>
                </button>
              ))}
            </div>
            <div class="flex-1 min-w-0">
              {items.map((item, i) => (
                <div
                  class="glass-card rounded-3xl p-6 @3xl:p-8 min-h-[300px] w-full min-w-0 overflow-hidden"
                  data-tab-panel={String(i)}
                  style={i > 0 ? 'display:none' : undefined}
                >
                  <h4 class="font-headline text-h4 mb-4" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</h4>
                  <div
                    class="text-body text-on-surface-variant overflow-hidden"
                    data-edit-path={`_items.${i}.body`}
                    data-edit-html
                    dangerouslySetInnerHTML={{ __html: item.body || '' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: horizontal
  return (
    <section class={`${secClass} overflow-x-hidden`} data-component-type="tabs" data-interactive data-animate="fade-up">
      <div class={`@container ${maxW} mx-auto px-4 @3xl:px-8`}>
        <h2 class="font-headline text-h2 mb-10 text-center" dangerouslySetInnerHTML={{ __html: title }} />
        <div data-tabs class="min-w-0">
          <div class="flex flex-wrap justify-center gap-3 mb-8">
            {items.map((item, i) => (
              <button
                class={i === 0 ? activeBtn : inactiveBtn}
                data-tab-trigger={String(i)}
              >
                <span data-edit-path={`_items.${i}.title`}>{esc(item.title || `Tab ${i + 1}`)}</span>
              </button>
            ))}
          </div>
          {items.map((item, i) => (
            <div
              class="glass-card rounded-3xl p-6 @3xl:p-8 min-h-[300px] w-full min-w-0 overflow-hidden"
              data-tab-panel={String(i)}
              style={i > 0 ? 'display:none' : undefined}
            >
              <h4 class="font-headline text-h4 mb-4" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</h4>
              <div
                class="text-body text-on-surface-variant overflow-hidden"
                data-edit-path={`_items.${i}.body`}
                data-edit-html
                dangerouslySetInnerHTML={{ __html: item.body || '' }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
