import { useRender } from '../context.js';
import { esc } from '../utils.js';
import type { Component } from '../types.js';

interface Props {
  comp: Component;
  variant: string;
}

export function Hero({ comp, variant }: Props) {
  const { AR, embedImage } = useRender();
  const h = AR.hero || {};
  const title = esc(comp.displayTitle || '');
  const bodyText = (comp.body || '').replace(/<[^>]*>/g, '');
  const imgSrc = comp._graphic ? embedImage(comp._graphic.large || '') : '';
  const imgAlt = esc(comp._graphic?.alt || '');

  const overlayGradient = h.overlayGradient || 'bg-gradient-to-t from-surface-dim via-surface-dim/80 to-surface-dim/40';
  const imgVisuals = h.imgVisuals || 'mix-blend-overlay opacity-40';

  const btn1Bg = h.btn1Bg || 'bg-primary';
  const btn1Round = h.btn1Round || 'rounded-xl';
  const btn1Visual = h.btn1Visual || '';
  const btn1Text = h.btn1Text || 'text-on-primary';

  const beginBtn = (
    <button
      class={`px-8 py-4 ${btn1Bg} ${btn1Text} ${btn1Round} font-bold ${btn1Visual}`}
      data-hero-cta="begin"
    >
      Begin Course
    </button>
  );

  if (variant === 'split-screen') {
    const sectionClass = h.sectionClass || 'relative min-h-screen flex items-center overflow-hidden';
    return (
      <section class={sectionClass} data-component-type="hero">
        <div class="@container relative z-10 w-full grid grid-cols-1 @3xl:grid-cols-2 min-h-screen">
          <div class="flex flex-col justify-center px-8 @3xl:px-16 py-20 @3xl:py-0">
            <h1
              class="font-headline text-display md:text-display-xl mb-8 pb-1 text-on-surface"
              data-animate="fade-up"
              data-text-reveal
              dangerouslySetInnerHTML={{ __html: title }}
            />
            <p class="text-body-lg text-on-surface-variant max-w-lg mb-12" data-animate="fade-up">
              {bodyText}
            </p>
            <div class="flex gap-4 flex-wrap" data-animate="fade-up">
              {beginBtn}
            </div>
          </div>
          <div class="relative hidden @3xl:block">
            {imgSrc ? (
              <img alt={imgAlt} class="absolute inset-0 w-full h-full object-cover" src={imgSrc} />
            ) : (
              <div class="absolute inset-0 bg-surface-container" />
            )}
            <div class="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
          </div>
        </div>
      </section>
    );
  }

  if (variant === 'minimal-text') {
    return (
      <section class="relative min-h-screen flex items-center overflow-hidden" data-component-type="hero">
        <div class="@container relative z-10 max-w-7xl mx-auto px-8 @3xl:px-16 py-20">
          <div class="border-l-4 border-primary pl-8 @3xl:pl-12">
            <h1
              class="font-headline text-display md:text-display-xl mb-8 pb-1 text-on-surface"
              data-animate="fade-up"
              data-text-reveal
              dangerouslySetInnerHTML={{ __html: title }}
            />
            <p class="text-body-lg text-on-surface-variant max-w-3xl mb-12" data-animate="fade-up">
              {bodyText}
            </p>
            <div class="flex gap-4 flex-wrap" data-animate="fade-up">
              {beginBtn}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: centered-overlay
  const sectionClass = h.sectionClass || 'relative min-h-screen flex items-center justify-center overflow-hidden';
  return (
    <section class={sectionClass} data-component-type="hero">
      {imgSrc ? (
        <img
          alt={imgAlt}
          class={`absolute inset-0 w-full h-full object-cover ${imgVisuals}`}
          src={imgSrc}
          data-parallax
        />
      ) : null}
      <div class={`absolute inset-0 ${overlayGradient}`} />
      <div class="@container relative z-10 text-center max-w-7xl mx-auto px-8">
        <h1
          class="font-headline text-display md:text-display-xl mb-8 pb-1 text-white"
          data-animate="fade-up"
          data-text-reveal
          dangerouslySetInnerHTML={{ __html: title }}
        />
        <p class="text-body-lg text-white/80 max-w-3xl mx-auto mb-12" data-animate="fade-up">
          {bodyText}
        </p>
        <div class="flex gap-4 justify-center flex-wrap" data-animate="fade-up">
          {beginBtn}
        </div>
      </div>
    </section>
  );
}
