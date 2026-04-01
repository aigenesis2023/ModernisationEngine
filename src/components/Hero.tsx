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

  // Hero ALWAYS uses dark scrim + white text when image present.
  // Brand identity comes through CTA color, fonts, and archetype shape — not overlay color.
  // Archetype controls scrim intensity (luxury=subtler, brutalist=heavier) but all are dark-toned.
  const overlayGradient = h.overlayGradient || 'bg-gradient-to-t from-black/80 via-black/50 to-black/20';
  const imgVisuals = h.imgVisuals || 'opacity-60';

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
        {/* Full-bleed background image */}
        {imgSrc ? (
          <img alt={imgAlt} class={`absolute inset-0 w-full h-full object-cover ${imgVisuals}`} src={imgSrc} />
        ) : (
          <div class="absolute inset-0 bg-surface-container" />
        )}
        {/* Dark gradient: opaque on left for text readability, transparent on right to reveal image */}
        <div class="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/10" />
        {/* Text content left-aligned — always white on dark scrim */}
        <div class="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 py-20">
          <div class="max-w-xl">
            <h1
              class="font-headline text-display md:text-display-xl mb-8 pb-1 text-white"
              data-animate="fade-up"
              data-text-reveal
              dangerouslySetInnerHTML={{ __html: title }}
            />
            <p class="text-body-lg text-white/80 max-w-lg mb-12" data-animate="fade-up">
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

  if (variant === 'minimal-text') {
    // Minimal-text: subtle image + lighter scrim for a restrained hero
    return (
      <section class="relative min-h-screen flex items-center overflow-hidden" data-component-type="hero">
        {imgSrc ? (
          <img alt={imgAlt} class="absolute inset-0 w-full h-full object-cover opacity-30" src={imgSrc} />
        ) : null}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />
        <div class="@container w-full relative z-10 max-w-7xl mx-auto px-8 @3xl:px-16 py-20">
          <div class="border-l-4 border-primary pl-8 @3xl:pl-12">
            <h1
              class="font-headline text-display md:text-display-xl mb-8 pb-1 text-white"
              data-animate="fade-up"
              data-text-reveal
              dangerouslySetInnerHTML={{ __html: title }}
            />
            <p class="text-body-lg text-white/80 max-w-3xl mb-12" data-animate="fade-up">
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
      <div class="@container w-full relative z-10 text-center max-w-7xl mx-auto px-8">
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
