import { useRender } from '../context.js';
import { esc, stripTags, sectionOnly, mc } from '../utils.js';
import type { Component } from '../types.js';

interface Props {
  comp: Component;
  variant: string;
  maxW: string;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function MCQ({ comp, variant, maxW }: Props) {
  const { AR } = useRender();
  const items = comp._items || [];
  const feedback = comp._feedback || {};
  const correctFeedback = stripTags(feedback.correct || 'Correct!');
  const incorrectFeedback = stripTags((feedback._incorrect && feedback._incorrect.final) || 'Not quite. Try again.');
  const m = AR.mcq || {};

  let correctIdx = items.findIndex(i => i.correct || i._shouldBeSelected);
  if (correctIdx < 0) correctIdx = 0;

  const questionText = stripTags(comp.instruction || comp.body || '');
  const title = esc(comp.displayTitle || 'Knowledge Check');
  const secClass = sectionOnly('py-20');

  const cardClass = mc(
    m.cardBg || AR.surface?.card || 'glass-card',
    m.cardPad || 'p-6 @3xl:p-8',
    m.cardRound || AR.borderRadius?.cardLarge || 'rounded-3xl'
  );

  const labelClass = 'text-label-text text-on-surface-variant';

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
        <div class={`@container ${maxW} mx-auto px-8`}>
          <div class={cardClass}>
            <span class={labelClass} data-edit-path="displayTitle">{title}</span>
            <h3 class="font-headline text-h3 mt-2 mb-10 text-center text-on-surface" data-edit-path="instruction">{questionText}</h3>
            <div class="grid grid-cols-1 @xl:grid-cols-2 gap-4">
              {items.map((item, i) => (
                <button
                  class={mc(
                    'flex flex-col items-center justify-center gap-3 p-6 @3xl:p-8',
                    m.choiceRound || AR.borderRadius?.card || 'rounded-2xl',
                    m.choiceBg || 'glass-card border border-outline-variant/20',
                    m.choiceHover || 'hover:bg-surface-container hover:border-secondary/50 transition-all',
                    'cursor-pointer group text-center'
                  )}
                  data-choice={String(i)}
                >
                  <span class={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all ${m.letterBg || 'border-2 border-outline-variant/40 group-hover:border-secondary group-hover:bg-secondary/10'} ${m.letterText || 'text-on-surface-variant group-hover:text-secondary'}`}>
                    {OPTION_LETTERS[i] || ''}
                  </span>
                  <span class="text-on-surface font-medium leading-snug" data-edit-path={`_items.${i}.title`}>
                    {esc(item.text || item.title || '')}
                  </span>
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
      <div class={`@container ${maxW} mx-auto px-8`}>
        <div class={cardClass}>
          <span class={labelClass} data-edit-path="displayTitle">{title}</span>
          <h3 class="font-headline text-h3 mt-2 mb-8 text-on-surface" data-edit-path="instruction">{questionText}</h3>
          <div class="space-y-4">
            {items.map((item, i) => (
              <button
                class={mc(
                  'w-full text-left flex items-center gap-5 p-5 @3xl:p-6',
                  m.choiceRound || AR.borderRadius?.button || 'rounded-xl',
                  m.choiceBg || 'bg-surface-container/60 border border-outline-variant/20',
                  m.choiceHover || 'hover:bg-surface-container hover:border-secondary/50 transition-all',
                  'cursor-pointer group'
                )}
                data-choice={String(i)}
              >
                <span class={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all flex-shrink-0 ${m.letterBg || 'border-2 border-outline-variant/40 group-hover:border-secondary group-hover:bg-secondary/10'} ${m.letterText || 'text-on-surface-variant group-hover:text-secondary'}`}>
                  {OPTION_LETTERS[i] || ''}
                </span>
                <span class="text-on-surface leading-relaxed" data-edit-path={`_items.${i}.title`}>
                  {esc(item.text || item.title || '')}
                </span>
              </button>
            ))}
          </div>
          <div class="mt-8 hidden" data-quiz-feedback />
        </div>
      </div>
    </section>
  );
}
