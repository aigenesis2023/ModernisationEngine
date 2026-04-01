import { esc, sectionOnly } from '../utils.js';
import { useRender } from '../context.js';
import type { Component } from '../types.js';

interface Props {
  comp: Component;
  variant: string;
  maxW: string;
}

export function Text({ comp, variant, maxW }: Props) {
  const { AR } = useRender();
  const title = esc(comp.displayTitle || '');
  const secClass = sectionOnly('py-16');
  const textW = maxW === 'max-w-3xl' ? 'max-w-3xl' : 'max-w-6xl';

  if (variant === 'two-column') {
    return (
      <section class={secClass} data-component-type="text" data-animate="fade-up">
        <div class={`@container ${maxW} mx-auto px-8`}>
          {title && <h2 class="font-headline text-h2 mb-8" dangerouslySetInnerHTML={{ __html: title }} />}
          <div
            class="columns-1 @3xl:columns-2 gap-12 text-body-lg text-on-surface-variant"
            dangerouslySetInnerHTML={{ __html: comp.body || '' }}
          />
        </div>
      </section>
    );
  }

  if (variant === 'highlight-box') {
    return (
      <section class={secClass} data-component-type="text" data-animate="fade-up">
        <div class={`@container ${textW} mx-auto px-8`}>
          <div class={`border-l-4 border-primary bg-surface-container/50 ${AR.borderRadius?.card || 'rounded-r-2xl'} p-8 @3xl:p-10`}>
            {title && <h2 class="font-headline text-h3 mb-4" dangerouslySetInnerHTML={{ __html: title }} />}
            <div
              class="space-y-4 text-body-lg text-on-surface-variant"
              dangerouslySetInnerHTML={{ __html: comp.body || '' }}
            />
          </div>
        </div>
      </section>
    );
  }

  // Default: standard
  return (
    <section class={secClass} data-component-type="text" data-animate="fade-up">
      <div class={`@container ${textW} mx-auto px-8`}>
        {title && <h2 class="font-headline text-h2 mb-6" dangerouslySetInnerHTML={{ __html: title }} />}
        <div
          class="space-y-4 text-body-lg text-on-surface-variant"
          dangerouslySetInnerHTML={{ __html: comp.body || '' }}
        />
      </div>
    </section>
  );
}
