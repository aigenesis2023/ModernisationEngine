import { useRender } from '../context.js';
import { esc, stripTags, sectionOnly, mc } from '../utils.js';
import type { Component } from '../types.js';

interface Props {
  comp: Component;
  variant: string;
  maxW: string;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function MCQ({ comp, variant }: Props) {
  const { AR } = useRender();
  const items = comp._items || [];
  const feedback = comp._feedback || {};
  const correctFeedback = stripTags(feedback.correct || 'Correct!');
  const incorrectFeedback = stripTags((feedback._incorrect && feedback._incorrect.final) || 'Not quite. Try again.');
  const m = AR.mcq || {};

  let correctIdx = items.findIndex(i => i.correct || i._shouldBeSelected);
  if (correctIdx < 0) correctIdx = 0;

  // AI puts the question in displayTitle. instruction/body are fallbacks.
  const questionText = stripTags(comp.instruction || comp.body || comp.displayTitle || '');
  const label = 'Knowledge Check';
  const secClass = sectionOnly('py-20');

  // MCQ always renders narrower than the page — signals "assessment moment"
  const containerW = 'max-w-[54rem]';

  const cardClass = mc(
    m.cardBg || AR.surface?.card || 'glass-card',
    m.cardPad || 'p-8 @3xl:p-10',
    m.cardRound || AR.borderRadius?.cardLarge || 'rounded-3xl',
  );

  // Badge pill for the "Knowledge Check" label
  const badgeClass = mc(
    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest',
    m.badgeBg || 'bg-primary/10 border border-primary/25 text-primary'
  );

  // Draw metadata
  const dm = comp.drawMetadata || {};
  const drawAttrs: Record<string, string | boolean> = {};
  if (dm.drawCount && dm.poolSize) {
    drawAttrs['data-draw-count'] = String(dm.drawCount);
    drawAttrs['data-draw-pool'] = String(dm.poolSize);
    if (dm.shuffle) drawAttrs['data-draw-shuffle'] = true;
  }

  const sectionAttrs = {
    'data-component-type': 'mcq',
    'data-interactive': true,
    'data-animate': 'fade-up',
    'data-quiz': true,
    'data-correct': String(correctIdx),
    'data-feedback-correct': correctFeedback,
    'data-feedback-incorrect': incorrectFeedback,
    ...drawAttrs,
  };

  if (variant === 'grid' && items.length <= 4) {
    return (
      <section class={secClass} {...sectionAttrs}>
        <div class={`@container ${containerW} mx-auto px-8`}>
          <div class={cardClass}>
            {/* Badge label */}
            <div class="mb-5">
              <span class={badgeClass}>
                <span class="material-symbols-outlined" style="font-size:13px;line-height:1">quiz</span>
                {label}
              </span>
            </div>
            <h3 class="font-headline text-h3 mb-8 text-center text-on-surface" data-edit-path="displayTitle">{questionText}</h3>
            <div class="grid grid-cols-1 @xl:grid-cols-2 gap-4">
              {items.map((item, i) => (
                <button
                  class={mc(
                    'flex flex-col items-center justify-center gap-3 p-6 @3xl:p-8',
                    m.choiceRound || AR.borderRadius?.card || 'rounded-2xl',
                    m.choiceBg || 'glass-card border border-outline-variant/20',
                    m.choiceHover || 'hover:bg-surface-container hover:border-primary/40 transition-all',
                    'cursor-pointer group text-center'
                  )}
                  data-choice={String(i)}
                >
                  <span class={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all flex-shrink-0 ${m.letterBg || 'border-2 border-outline-variant/40 group-hover:border-primary group-hover:bg-primary/10'} ${m.letterText || 'text-on-surface-variant group-hover:text-primary'}`}>
                    {OPTION_LETTERS[i] || ''}
                  </span>
                  <span class="text-on-surface font-medium leading-snug" data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.text || item.title || '') }} />
                </button>
              ))}
            </div>
            <div class="mt-8 hidden" data-quiz-feedback />
          </div>
        </div>
      </section>
    );
  }

  // Default: stacked
  return (
    <section class={secClass} {...sectionAttrs}>
      <div class={`@container ${containerW} mx-auto px-8`}>
        <div class={cardClass}>
          {/* Badge label */}
          <div class="mb-5">
            <span class={badgeClass}>
              <span class="material-symbols-outlined" style="font-size:13px;line-height:1">quiz</span>
              {label}
            </span>
          </div>
          <h3 class="font-headline text-h3 mb-8 text-on-surface" data-edit-path="displayTitle">{questionText}</h3>
          <div class="space-y-3">
            {items.map((item, i) => (
              <button
                class={mc(
                  'w-full text-left flex items-center gap-4 p-5 @3xl:p-6',
                  m.choiceRound || AR.borderRadius?.button || 'rounded-xl',
                  m.choiceBg || 'bg-surface-container/60 border border-outline-variant/20',
                  m.choiceHover || 'hover:bg-surface-container hover:border-primary/40 transition-all',
                  'cursor-pointer group'
                )}
                data-choice={String(i)}
              >
                <span class={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all flex-shrink-0 ${m.letterBg || 'border-2 border-outline-variant/40 group-hover:border-primary group-hover:bg-primary/10'} ${m.letterText || 'text-on-surface-variant group-hover:text-primary'}`}>
                  {OPTION_LETTERS[i] || ''}
                </span>
                <span class="text-on-surface leading-relaxed" data-edit-path={`_items.${i}.title`} dangerouslySetInnerHTML={{ __html: esc(item.text || item.title || '') }} />
              </button>
            ))}
          </div>
          <div class="mt-8 hidden" data-quiz-feedback />
        </div>
      </div>
    </section>
  );
}
