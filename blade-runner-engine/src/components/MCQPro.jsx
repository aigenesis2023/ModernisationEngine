import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

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

// Map Tailwind-style rounding classes to CSS border-radius
const roundingMap = {
  'rounded-none': '0px', 'rounded-sm': '0.125rem', 'rounded': '0.25rem',
  'rounded-md': '0.375rem', 'rounded-lg': '0.5rem', 'rounded-xl': '0.75rem',
  'rounded-2xl': '1rem', 'rounded-3xl': '1.5rem', 'rounded-full': '9999px',
};

// Map Tailwind-style weight classes to CSS font-weight
const weightMap = {
  'font-thin': 100, 'font-extralight': 200, 'font-light': 300,
  'font-normal': 400, 'font-medium': 500, 'font-semibold': 600,
  'font-bold': 700, 'font-extrabold': 800, 'font-black': 900,
};

// Map Tailwind tracking classes to CSS letter-spacing
const trackingMap = {
  'tracking-tighter': '-0.05em', 'tracking-tight': '-0.025em',
  'tracking-normal': '0em', 'tracking-wide': '0.025em',
  'tracking-wider': '0.05em', 'tracking-widest': '0.1em',
};

export default function MCQPro({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const { style, rules, resolveSurface, hasDNA } = useComponentStyle('mcq');

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

  // DNA-driven values
  const badge = hasDNA && style?.badge?.found ? style.badge : null;
  const labelTypo = rules?.typography?.label || {};
  const containerBg = hasDNA && style?.container?.primaryBg
    ? resolveSurface(style.container.primaryBg)
    : null;
  const containerRounding = hasDNA && style?.container?.rounded
    ? (roundingMap[style.container.rounded] || '0.75rem')
    : null;
  const containerBorders = hasDNA ? (style?.container?.borders || []) : [];
  const icons = hasDNA ? (style?.icons || []) : [];
  // Icon assignments: first = unselected, second = selected/correct
  const unselectedIcon = icons[0] || null;
  const selectedIcon = icons[1] || null;

  // ─── DNA-driven render ────────────────────────────────────────────
  if (hasDNA) {
    // Derive border style from DNA borders array
    const borderStyle = {};
    if (containerBorders.length > 0) {
      const b = containerBorders[0]; // use first border definition
      if (typeof b === 'string') {
        // Simple token like 'outline-variant'
        borderStyle.border = `1px solid ${resolveSurface(b) || 'var(--ui-glass-border)'}`;
      } else if (b && typeof b === 'object') {
        borderStyle.border = `${b.width || 1}px ${b.style || 'solid'} ${resolveSurface(b.color) || b.color || 'var(--ui-glass-border)'}`;
      }
    } else {
      borderStyle.border = '1px solid var(--ui-glass-border)';
    }

    return (
      <div
        ref={ref}
        className="w-full max-w-4xl mx-auto py-6 sm:py-8 px-6 sm:px-8"
        style={{
          background: containerBg || 'var(--ui-glass)',
          borderRadius: containerRounding || '0.75rem',
          ...borderStyle,
        }}
      >
        {/* Badge pill */}
        {badge && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.4 }}
            className="mb-4"
          >
            <span
              className="inline-block px-3 py-1"
              style={{
                borderRadius: '9999px',
                background: 'var(--brand-accent, #8b5cf6)',
                color: '#ffffff',
                fontSize: labelTypo.size ? undefined : '0.65rem',
                fontWeight: weightMap[labelTypo.weight] || 600,
                textTransform: labelTypo.transform || 'uppercase',
                letterSpacing: trackingMap[labelTypo.tracking] || '0.1em',
              }}
            >
              {badge.text}
            </span>
          </motion.div>
        )}

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

            let borderColor = 'var(--ui-glass-border)';
            let glowShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
            let accentColor = 'var(--brand-accent, #8b5cf6)';

            if (submitted) {
              if (shouldBeSelected) {
                borderColor = 'var(--brand-success, #22c55e)';
                glowShadow = '0 0 16px rgba(34, 197, 94, 0.15)';
                accentColor = 'var(--brand-success, #22c55e)';
              } else if (isSelected && !shouldBeSelected) {
                borderColor = 'var(--brand-error, #ef4444)';
                glowShadow = '0 0 16px rgba(239, 68, 68, 0.15)';
                accentColor = 'var(--brand-error, #ef4444)';
              }
            } else if (isSelected) {
              borderColor = 'var(--brand-accent, #8b5cf6)';
              glowShadow = '0 0 20px rgba(139, 92, 246, 0.12)';
            }

            // Determine which icon to show
            const showSelected = isSelected || (submitted && shouldBeSelected);
            let iconName = unselectedIcon || 'radio_button_unchecked';
            if (submitted && shouldBeSelected) {
              iconName = 'check_circle';
            } else if (submitted && isSelected && !shouldBeSelected) {
              iconName = 'cancel';
            } else if (isSelected) {
              iconName = selectedIcon || 'check_circle';
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
                className="w-full flex items-center gap-4 px-5 py-4 border text-left cursor-pointer disabled:cursor-default"
                style={{
                  borderRadius: containerRounding || '0.75rem',
                  background: 'var(--ui-glass)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderColor,
                  boxShadow: glowShadow,
                  transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                }}
              >
                {/* Material icon indicator */}
                <span
                  className="material-symbols-outlined flex-shrink-0"
                  style={{
                    fontSize: '24px',
                    color: showSelected ? accentColor : 'rgba(255, 255, 255, 0.35)',
                    transition: 'color 0.25s ease',
                  }}
                >
                  {iconName}
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
              className="mt-6 px-5 py-4 border overflow-hidden"
              style={{
                borderRadius: containerRounding || '0.75rem',
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
                  className="material-symbols-outlined"
                  style={{
                    fontSize: '24px',
                    color: isCorrect
                      ? 'var(--brand-success, #22c55e)'
                      : 'var(--brand-error, #ef4444)',
                  }}
                >
                  {isCorrect ? 'check_circle' : 'cancel'}
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

  // ─── Fallback: original behavior (no DNA) ─────────────────────────
  return (
    <div ref={ref} className="w-full max-w-4xl mx-auto py-6 sm:py-8">
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

          let borderColor = 'var(--ui-glass-border)';
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
                background: 'var(--ui-glass)',
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
