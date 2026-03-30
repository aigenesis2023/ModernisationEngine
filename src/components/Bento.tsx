import { useRender } from '../context.js';
import { esc, stripTags, sectionOnly, bentoCardTextClass, bentoCardSubtextClass } from '../utils.js';
import type { Component } from '../types.js';

interface Props { comp: Component; variant: string; maxW: string }

const ICONS = ['bolt', 'speed', 'shield', 'memory', 'hub', 'star', 'lightbulb', 'science'];

export function Bento({ comp, variant, maxW }: Props) {
  const { AR, embedImage } = useRender();
  const items = comp._items || [];
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');
  const bentoCfg = AR.bento || {};
  const cardBgs = bentoCfg.cardBgs || ['glass-card', 'bg-surface-container-low', 'bg-surface-container-high', 'glass-card'];
  const imgHover = bentoCfg.imgHover || 'group-hover:scale-110 transition-transform duration-700';

  if (variant === 'wide-2') {
    return (
      <section class={secClass} data-component-type="bento">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h2 class="font-headline text-h2 mb-10" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="grid grid-cols-1 @3xl:grid-cols-2 gap-6" data-animate-stagger="fade-up">
            {items.map((item, i) => {
              const bg = cardBgs[i] || cardBgs[0] || 'glass-card';
              return (
                <div class={`${bg} rounded-3xl p-8 @3xl:p-10 flex items-start gap-6 min-h-[140px] overflow-hidden`}>
                  <div class="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-secondary text-2xl">{ICONS[i % ICONS.length]}</span>
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4 class={`font-headline text-h4 mb-2 ${bentoCardTextClass(bg)}`} data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.title || '') }} />
                    <p class={`${bentoCardSubtextClass(bg)} text-body`} data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'featured') {
    return (
      <section class={secClass} data-component-type="bento">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <h2 class="font-headline text-h2 mb-10" dangerouslySetInnerHTML={{ __html: title }} />
          <div class="grid grid-cols-1 @3xl:grid-cols-4 gap-5 auto-rows-auto" data-animate-stagger="fade-up">
            {items.map((item, i) => {
              const imgSrc = item._graphic ? embedImage(item._graphic.large || '') : '';
              if (i === 0) {
                const featBg = cardBgs[0] || 'bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent glass-card';
                return (
                  <div class={`@3xl:col-span-2 @3xl:row-span-2 rounded-3xl p-6 @3xl:p-8 flex flex-col justify-end relative overflow-hidden group min-h-[320px] ${featBg}`}>
                    {imgSrc && <img alt="" class={`absolute inset-0 w-full h-full object-cover opacity-15 ${imgHover}`} src={imgSrc} />}
                    <div class="relative z-10">
                      <span class="material-symbols-outlined text-primary text-5xl mb-4">{ICONS[0]}</span>
                      <h4 class="font-headline text-h3 mb-3 text-on-surface" data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.title || '') }} />
                      <p class="text-body text-on-surface-variant" data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                    </div>
                  </div>
                );
              }
              const bgN = cardBgs[i] || cardBgs[cardBgs.length - 1] || 'glass-card';
              return (
                <div class={`${bgN} rounded-3xl p-6 @3xl:p-8 flex flex-col min-h-[160px] overflow-hidden`}>
                  <span class="material-symbols-outlined text-secondary text-3xl mb-4">{ICONS[i % ICONS.length]}</span>
                  <h4 class={`font-headline text-h4 mb-2 ${bentoCardTextClass(bgN)}`} data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.title || '') }} />
                  <p class={`text-sm ${bentoCardSubtextClass(bgN)} leading-relaxed`} data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // Default: grid-4
  return (
    <section class={secClass} data-component-type="bento">
      <div class={`@container ${maxW} mx-auto px-8`}>
        <h2 class="font-headline text-h2 mb-10" dangerouslySetInnerHTML={{ __html: title }} />
        <div class="grid grid-cols-1 @3xl:grid-cols-4 gap-5 auto-rows-auto" data-animate-stagger="fade-up">
          {items.map((item, i) => {
            if (i === 0) {
              const imgSrc = item._graphic ? embedImage(item._graphic.large || '') : '';
              const bg0 = cardBgs[0] || 'glass-card';
              return (
                <div class={`@3xl:col-span-2 @3xl:row-span-2 ${bg0} rounded-3xl p-6 @3xl:p-8 flex flex-col justify-center relative overflow-hidden group min-h-[200px]`}>
                  {imgSrc && <img alt="" class={`absolute inset-0 w-full h-full object-cover opacity-20 ${imgHover}`} src={imgSrc} />}
                  <div class="relative z-10">
                    <span class="material-symbols-outlined text-secondary text-4xl mb-3">{ICONS[0]}</span>
                    <h4 class={`font-headline text-h4 mb-2 ${bentoCardTextClass(bg0)}`} data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.title || '') }} />
                    <p class={`${bentoCardSubtextClass(bg0)} text-body`} data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                  </div>
                </div>
              );
            }
            if (i <= 2 && items.length > 3) {
              const bgI = cardBgs[i] || 'glass-card';
              return (
                <div class={`@3xl:col-span-1 ${bgI} rounded-3xl p-6 @3xl:p-8 flex flex-col min-h-[180px] overflow-hidden`}>
                  <span class="material-symbols-outlined text-secondary text-3xl mb-4">{ICONS[i % ICONS.length]}</span>
                  <div class="min-w-0 flex-1">
                    <h4 class={`font-headline text-h4 mb-2 ${bentoCardTextClass(bgI)}`} data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.title || '') }} />
                    <p class={`${bentoCardSubtextClass(bgI)} text-body line-clamp-4`} data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
                  </div>
                </div>
              );
            }
            const bgN = cardBgs[i] || cardBgs[cardBgs.length - 1] || 'glass-card';
            const bgShadow = (bentoCfg.cardShadows || [])[i] || '';
            return (
              <div class={`${i >= 3 && items.length > 4 ? '@3xl:col-span-2' : ''} ${bgN} rounded-3xl p-6 @3xl:p-8 flex flex-col min-h-[160px] overflow-hidden ${bgShadow}`}>
                <span class="material-symbols-outlined text-secondary text-3xl mb-4">{ICONS[i % ICONS.length]}</span>
                <h4 class={`font-headline text-h4 mb-2 ${bentoCardTextClass(bgN)}`} data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.title || '') }} />
                <p class={`text-sm ${bentoCardSubtextClass(bgN)} leading-relaxed`} data-edit-path={`_items.${i}.body`}>{stripTags(item.body || '')}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
