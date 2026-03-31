import { useRender } from '../context.js';
import { esc, sectionOnly } from '../utils.js';
import type { Component } from '../types.js';

interface Props {
  comp: Component;
  index: number;
  variant: string;
  maxW: string;
}

export function GraphicText({ comp, index, variant, maxW }: Props) {
  const { AR, embedImage } = useRender();
  const imgRound = AR.borderRadius?.image || 'rounded-2xl';
  const cardRound = AR.borderRadius?.card || 'rounded-2xl';
  const cardSurface = AR.surface?.card || 'glass-card';
  const title = esc(comp.displayTitle || '');
  const bodyText = comp.body || '';
  const secClass = sectionOnly('py-16');
  const align = comp._imageAlign || (index % 2 === 0 ? 'right' : 'left');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large || '') : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  if (variant === 'overlap') {
    return (
      <section class={secClass} data-component-type="graphic-text">
        <div class={`@container ${maxW} mx-auto px-8`}>
          <div class="relative @3xl:min-h-[450px]" data-animate="fade-up">
            <div class={`w-full @3xl:w-[55%] ${align === 'left' ? '@3xl:ml-auto' : ''} ${imgRound} overflow-hidden aspect-[3/2] bg-surface-container`}>
              {imgSrc ? (
                <img alt={imgAlt} class="w-full h-full object-cover" src={imgSrc} />
              ) : (
                <div class="w-full h-full bg-surface-container" />
              )}
            </div>
            <div class={`relative @3xl:absolute ${align === 'left' ? '@3xl:left-0' : '@3xl:right-0'} @3xl:top-1/2 @3xl:-translate-y-1/2 @3xl:w-[55%] glass-card ${cardRound} p-8 @3xl:p-10 mt-[-2rem] @3xl:mt-0 mx-4 @3xl:mx-0`}>
              <h2 class="font-headline text-h2 tracking-tight mb-4" dangerouslySetInnerHTML={{ __html: title }} />
              <div class="text-body leading-snug text-on-surface-variant space-y-4" dangerouslySetInnerHTML={{ __html: bodyText }} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'full-overlay') {
    const gradientDir = align === 'left' ? 'bg-gradient-to-r' : 'bg-gradient-to-l';
    return (
      <section class="relative min-h-[60vh] flex items-center overflow-hidden" data-component-type="graphic-text">
        {imgSrc ? (
          <img alt={imgAlt} class="absolute inset-0 w-full h-full object-cover" src={imgSrc} data-parallax />
        ) : (
          <div class="absolute inset-0 bg-surface-container" />
        )}
        <div class={`absolute inset-0 ${gradientDir} from-background via-background/85 to-background/20`} />
        <div class={`@container w-full ${maxW} mx-auto px-8 relative z-10 py-20`} data-animate="fade-up">
          <div class={`w-full @3xl:w-1/2 ${align === 'right' ? '@3xl:ml-auto' : ''}`}>
            <h2 class="font-headline text-h2 tracking-tight mb-6" dangerouslySetInnerHTML={{ __html: title }} />
            <div class="text-body leading-snug text-on-surface-variant space-y-4" dangerouslySetInnerHTML={{ __html: bodyText }} />
          </div>
        </div>
      </section>
    );
  }

  // Default: split
  const imageDiv = (
    <div
      class={`w-full @3xl:w-1/2 flex-shrink-0 min-w-0${align === 'left' ? ' order-2 @3xl:order-1' : ''}`}
      data-animate={align === 'left' ? 'slide-in-left' : 'slide-in-right'}
    >
      <div class="relative group overflow-hidden">
        <div class={`relative ${imgRound} overflow-hidden aspect-[4/3] bg-surface-container`}>
          {imgSrc ? (
            <img alt={imgAlt} class={`w-full h-full object-cover ${imgRound}`} src={imgSrc} />
          ) : (
            <div class={`w-full h-full bg-surface-container ${imgRound}`} />
          )}
        </div>
      </div>
    </div>
  );

  const textDiv = (
    <div
      class={`w-full @3xl:w-1/2 flex-shrink-0 min-w-0${align === 'left' ? ' order-1 @3xl:order-2' : ''} flex flex-col justify-center`}
      data-animate="fade-up"
    >
      <h2 class="font-headline text-h2 tracking-tight mb-6" dangerouslySetInnerHTML={{ __html: title }} />
      <div class="text-body leading-snug text-on-surface-variant space-y-4" dangerouslySetInnerHTML={{ __html: bodyText }} />
    </div>
  );

  return (
    <section class={`${secClass} min-h-[70vh] overflow-x-hidden`} data-component-type="graphic-text">
      <div class={`@container ${maxW} mx-auto px-4 @3xl:px-8`}>
        <div class="flex flex-col @3xl:flex-row gap-8 @3xl:gap-12 items-center">
          {align === 'left' ? <>{imageDiv}{textDiv}</> : <>{textDiv}{imageDiv}</>}
        </div>
      </div>
    </section>
  );
}
