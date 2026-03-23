import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (direction) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function NarrativeSlider({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const { style, rules, resolveSurface, hasDNA } = useComponentStyle('narrative');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];

  const [[currentIndex, direction], setPage] = useState([0, 0]);
  const total = items.length;

  const paginate = (newDirection) => {
    const next = currentIndex + newDirection;
    if (next < 0 || next >= total) return;
    setPage([next, newDirection]);
  };

  const currentItem = items[currentIndex] || {};
  const graphic = currentItem._graphic || {};

  // DNA-driven values
  const containerBg = hasDNA && style?.container?.primaryBg
    ? resolveSurface(style.container.primaryBg)
    : null;
  const containerRounded = hasDNA && style?.container?.rounded
    ? style.container.rounded
    : 'rounded-2xl';
  const badge = hasDNA && style?.badge?.found ? style.badge : null;
  const labelTypo = hasDNA && rules?.typography?.label ? rules.typography.label : null;
  const activeDotColor = hasDNA ? 'var(--brand-primary, #8b5cf6)' : 'var(--brand-accent, #8b5cf6)';
  const borderStyle = hasDNA ? rules?.borderStyle : null;

  // Ghost border style from rules
  const ghostBorder = borderStyle?.type === 'luminous'
    ? `1px solid rgba(255,255,255,${borderStyle.outlineOpacity || 0.08})`
    : undefined;

  // Container card style
  const cardStyle = containerBg
    ? {
        background: containerBg,
        borderColor: ghostBorder ? undefined : 'var(--ui-glass-border)',
        border: ghostBorder || undefined,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      }
    : {
        background: 'var(--ui-glass)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: 'var(--ui-glass-border)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      };

  return (
    <div ref={ref} className="w-full max-w-4xl mx-auto py-6 sm:py-8">
      {/* Section heading */}
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

      {/* Body text */}
      {body && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="text-base leading-relaxed mb-6"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      {/* Slider card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
        className={`${containerRounded} ${containerBg ? '' : 'border'} overflow-hidden`}
        style={cardStyle}
      >
        {/* Slide content */}
        <div className="relative overflow-hidden" style={{ minHeight: '200px' }}>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col sm:flex-row w-full"
            >
              {/* Image (left on desktop, top on mobile) */}
              {(graphic.large || graphic.src) && (
                <div className="sm:w-1/2 flex-shrink-0 relative">
                  <img
                    src={graphic.large || graphic.src}
                    alt={graphic.alt || currentItem.title || ''}
                    className="w-full h-48 sm:h-full object-cover"
                    style={{ minHeight: '200px' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  {/* DNA: primary color overlay on image */}
                  {hasDNA && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'var(--brand-primary, transparent)',
                        mixBlendMode: 'overlay',
                        opacity: 0.15,
                      }}
                    />
                  )}
                </div>
              )}

              {/* Text (right on desktop, bottom on mobile) */}
              <div
                className="flex-1 flex flex-col justify-center p-6 sm:p-8"
                style={{ minWidth: 0 }}
              >
                {/* DNA: Badge label above slide title */}
                {badge && (
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      style={{
                        width: '3px',
                        height: '16px',
                        background: 'var(--brand-primary, #8b5cf6)',
                        borderRadius: '2px',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        color: 'var(--brand-primary, #8b5cf6)',
                        fontSize: labelTypo?.size || '0.7rem',
                        fontWeight: labelTypo?.weight || 700,
                        textTransform: labelTypo?.transform || 'uppercase',
                        letterSpacing: labelTypo?.tracking || '0.1em',
                      }}
                    >
                      {badge.text}
                    </span>
                  </div>
                )}

                {currentItem.title && (
                  <h3
                    className="text-lg sm:text-xl font-semibold mb-3"
                    style={{ color: 'var(--brand-heading, #ffffff)' }}
                  >
                    {currentItem.title}
                  </h3>
                )}
                {currentItem.body && (
                  <div
                    className="text-sm sm:text-base leading-relaxed"
                    style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                    dangerouslySetInnerHTML={{ __html: currentItem.body }}
                  />
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation bar */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderTop: '1px solid var(--ui-glass-border)' }}
        >
          {/* Previous button */}
          <button
            onClick={() => paginate(-1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
            style={{
              color: 'var(--brand-text, rgba(255, 255, 255, 0.8))',
              background: 'var(--ui-glass)',
              transition: 'background 0.2s ease',
            }}
            aria-label="Previous item"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Prev
          </button>

          {/* Dots + counter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {items.map((_, i) => (
                <span
                  key={i}
                  className="block rounded-full transition-all duration-300"
                  style={{
                    width: i === currentIndex ? '20px' : '8px',
                    height: '8px',
                    background: i === currentIndex
                      ? activeDotColor
                      : 'rgba(255, 255, 255, 0.2)',
                  }}
                />
              ))}
            </div>
            <span
              className="text-xs tabular-nums"
              style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
            >
              {currentIndex + 1} of {total}
            </span>
          </div>

          {/* Next button */}
          <button
            onClick={() => paginate(1)}
            disabled={currentIndex === total - 1}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
            style={{
              color: 'var(--brand-text, rgba(255, 255, 255, 0.8))',
              background: 'var(--ui-glass)',
              transition: 'background 0.2s ease',
            }}
            aria-label="Next item"
          >
            Next
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
