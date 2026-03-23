import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const choiceVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.2 + i * 0.07,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const feedbackVariants = {
  hidden: { opacity: 0, height: 0, y: -8 },
  visible: {
    opacity: 1,
    height: 'auto',
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.25 },
  },
};

export default function MCQPro({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const instruction = data.instruction || '';
  const items = data._items || [];
  const selectable = data._selectable || 1;
  const feedback = data._feedback || {};
  const isMulti = selectable > 1;

  const [selected, setSelected] = useState(new Set());
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (index) => {
    if (submitted) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (isMulti) {
        if (next.has(index)) {
          next.delete(index);
        } else if (next.size < selectable) {
          next.add(index);
        }
      } else {
        next.clear();
        next.add(index);
      }
      return next;
    });
  };

  const handleSubmit = () => {
    if (selected.size === 0) return;
    setSubmitted(true);
  };

  const handleRetry = () => {
    setSelected(new Set());
    setSubmitted(false);
  };

  const isCorrect = submitted && items.every((item, i) =>
    item._shouldBeSelected ? selected.has(i) : !selected.has(i)
  );

  const feedbackText = submitted
    ? isCorrect
      ? feedback.correct || 'Correct!'
      : (feedback._incorrect?.final || feedback.incorrect || 'Incorrect. Try again.')
    : '';

  return (
    <div ref={ref} className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Question heading */}
      {title && (
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight"
          style={{ color: 'var(--brand-heading, #ffffff)' }}
        >
          {title}
        </motion.h2>
      )}

      {/* Question body */}
      {body && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="text-base leading-relaxed mb-4"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      {/* Instruction */}
      {instruction && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-sm mb-6 italic"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
        >
          {instruction}
        </motion.p>
      )}

      {/* Choices */}
      <div className="flex flex-col gap-3 mb-6">
        {items.map((item, index) => {
          const isSelected = selected.has(index);
          const shouldBeSelected = item._shouldBeSelected;

          // After submit: determine visual state
          let borderColor = 'rgba(255, 255, 255, 0.08)';
          let glowShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
          let indicatorBg = 'transparent';

          if (submitted) {
            if (shouldBeSelected) {
              borderColor = 'var(--brand-success, #22c55e)';
              glowShadow = '0 0 16px rgba(34, 197, 94, 0.15)';
              indicatorBg = 'var(--brand-success, #22c55e)';
            } else if (isSelected && !shouldBeSelected) {
              borderColor = 'var(--brand-error, #ef4444)';
              glowShadow = '0 0 16px rgba(239, 68, 68, 0.15)';
              indicatorBg = 'var(--brand-error, #ef4444)';
            }
          } else if (isSelected) {
            borderColor = 'var(--brand-accent, #8b5cf6)';
            glowShadow = '0 0 20px rgba(139, 92, 246, 0.12)';
            indicatorBg = 'var(--brand-accent, #8b5cf6)';
          }

          return (
            <motion.button
              key={index}
              custom={index}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={choiceVariants}
              onClick={() => handleSelect(index)}
              disabled={submitted}
              className="w-full flex items-center gap-4 px-5 py-4 rounded-xl border text-left cursor-pointer disabled:cursor-default"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderColor,
                boxShadow: glowShadow,
                transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
              }}
            >
              {/* Radio / Checkbox indicator */}
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: isMulti ? '6px' : '50%',
                  border: `2px solid ${isSelected || (submitted && shouldBeSelected) ? indicatorBg : 'rgba(255, 255, 255, 0.25)'}`,
                  background: isSelected || (submitted && shouldBeSelected) ? indicatorBg : 'transparent',
                  transition: 'all 0.25s ease',
                }}
              >
                {(isSelected || (submitted && shouldBeSelected)) && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>

              {/* Choice text */}
              <span
                className="text-base leading-snug"
                style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.85))' }}
              >
                {item.text || ''}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Submit / Retry buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="flex gap-3"
      >
        {!submitted && (
          <button
            onClick={handleSubmit}
            disabled={selected.size === 0}
            className="px-8 py-3 font-semibold text-sm tracking-wide text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{
              borderRadius: 'var(--ui-button-radius, 9999px)',
              background: selected.size > 0
                ? 'var(--brand-gradient, linear-gradient(135deg, var(--brand-accent, #8b5cf6), var(--brand-primary, #6d28d9)))'
                : 'rgba(255, 255, 255, 0.1)',
              boxShadow: selected.size > 0 ? '0 4px 16px rgba(139, 92, 246, 0.3)' : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            Submit
          </button>
        )}
        {submitted && !isCorrect && (
          <button
            onClick={handleRetry}
            className="px-8 py-3 font-semibold text-sm tracking-wide cursor-pointer border"
            style={{
              borderRadius: 'var(--ui-button-radius, 9999px)',
              background: 'transparent',
              borderColor: 'var(--brand-primary, #8b5cf6)',
              color: 'var(--brand-primary, #8b5cf6)',
              transition: 'all 0.3s ease',
            }}
          >
            Try Again
          </button>
        )}
      </motion.div>

      {/* Feedback */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            key="feedback"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={feedbackVariants}
            className="mt-6 px-5 py-4 rounded-xl border overflow-hidden"
            style={{
              background: isCorrect
                ? 'rgba(34, 197, 94, 0.08)'
                : 'rgba(239, 68, 68, 0.08)',
              borderColor: isCorrect
                ? 'rgba(34, 197, 94, 0.25)'
                : 'rgba(239, 68, 68, 0.25)',
            }}
          >
            {/* Status icon */}
            <div className="flex items-center gap-3 mb-2">
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: isCorrect
                    ? 'var(--brand-success, #22c55e)'
                    : 'var(--brand-error, #ef4444)',
                }}
              >
                {isCorrect ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7L6 10L11 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M4 4L10 10M10 4L4 10" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                )}
              </span>
              <span
                className="text-base font-semibold"
                style={{
                  color: isCorrect
                    ? 'var(--brand-success, #22c55e)'
                    : 'var(--brand-error, #ef4444)',
                }}
              >
                {isCorrect ? 'Correct' : 'Incorrect'}
              </span>
            </div>
            <div
              className="text-sm leading-relaxed"
              style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
              dangerouslySetInnerHTML={{ __html: feedbackText }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
