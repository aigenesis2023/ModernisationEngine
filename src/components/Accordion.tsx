import { useRender } from '../context.js';
import { esc, sectionOnly } from '../utils.js';
import type { Component } from '../types.js';

interface Props {
  comp: Component;
  variant: string;
  maxW: string;
}

const ACCENT_ICONS = ['lightbulb', 'warning', 'verified', 'psychology', 'explore', 'tips_and_updates', 'auto_awesome', 'school'];

export function Accordion({ comp, variant, maxW }: Props) {
  const { AR } = useRender();
  const items = comp._items || [];
  if (items.length === 0) return null;

  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');
  const bodyClass = 'mt-4 text-on-surface/80 leading-relaxed';

  if (variant === 'accent-border') {
    return (
      <section class={secClass} data-component-type="accordion">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h3 class="font-headline text-h3 mb-8" data-animate="fade-up" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="space-y-4" data-animate-stagger="fade-up">
            {items.map((item, i) => {
              const icon = ACCENT_ICONS[i % ACCENT_ICONS.length];
              return (
                <details class="group glass-card rounded-2xl border-l-4 border-primary transition-all duration-300">
                  <summary class="flex items-center gap-4 cursor-pointer font-headline text-h4 px-8 py-6 hover:bg-on-surface/[0.03] transition-colors">
                    <span class="material-symbols-outlined text-primary flex-shrink-0">{icon}</span>
                    <span class="flex-1" data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</span>
                    <span class="material-symbols-outlined group-open:rotate-180 transition-transform flex-shrink-0 ml-4 text-on-surface-variant/50">expand_more</span>
                  </summary>
                  <div
                    class={`${bodyClass} px-8 pb-8 ml-10`}
                    data-edit-path={`_items.${i}.body`}
                    data-edit-html
                    dangerouslySetInnerHTML={{ __html: item.body || '' }}
                  />
                </details>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // Default: standard
  const detailsClass = `group ${AR.surface?.card || 'glass-card'} ${AR.borderRadius?.card || 'rounded-2xl'} transition-all duration-300`;

  return (
    <section class={secClass} data-component-type="accordion">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h3 class="font-headline text-h3 mb-8" data-animate="fade-up" dangerouslySetInnerHTML={{ __html: title }} />
        <div class="space-y-4" data-animate-stagger="fade-up">
          {items.map((item, i) => (
            <details class={detailsClass}>
              <summary class="flex justify-between items-center cursor-pointer font-headline text-h4 px-8 py-6 hover:bg-on-surface/[0.03] transition-colors">
                <span data-edit-path={`_items.${i}.title`}>{esc(item.title || '')}</span>
                <span class="material-symbols-outlined group-open:rotate-180 transition-transform flex-shrink-0 ml-4 text-secondary">expand_more</span>
              </summary>
              <div
                class={`${bodyClass} px-8 pb-8`}
                data-edit-path={`_items.${i}.body`}
                data-edit-html
                dangerouslySetInnerHTML={{ __html: item.body || '' }}
              />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
