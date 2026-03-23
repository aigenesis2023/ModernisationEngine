import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const termVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.1 + i * 0.08,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function KeyTerm({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const { style, rules, resolveSurface, getCycleColor, hasDNA } = useComponentStyle('key-term');

  const title = data.displayTitle || '';
  const items = data._items || [];

  // ─── DNA-driven layout ───────────────────────────────────────
  if (hasDNA && style) {
    const gridCols = style.layout?.gridCols || 3;
    const cardBg = resolveSurface(style.container?.primaryBg) || 'var(--ui-glass, rgba(255, 255, 255, 0.06))';
    const labelTypo = rules?.typography?.label || {};
    const headingTypo = rules?.typography?.heading || {};

    return (
      <div ref={ref} className="w-full max-w-5xl mx-auto py-6 sm:py-8">
        {title && (
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-xl sm:text-2xl font-bold mb-5 tracking-tight"
            style={{
              color: 'var(--brand-heading, #ffffff)',
              letterSpacing: headingTypo.tracking || undefined,
              fontWeight: headingTypo.weight || undefined,
            }}
          >
            {title}
          </motion.h2>
        )}

        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          }}
        >
          {items.map((item, i) => {
            const cycleColor = getCycleColor(i);

            return (
              <motion.div
                key={i}
                custom={i}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                variants={termVariants}
                className="rounded-xl p-5 flex flex-col gap-2"
                style={{
                  background: cardBg,
                  border: '1px solid var(--border-ghost, rgba(255, 255, 255, 0.08))',
                }}
              >
                {/* Term name as visual anchor — no bookmark icon */}
                <h3
                  className="text-lg mb-1"
                  style={{
                    color: cycleColor || 'var(--brand-heading, var(--brand-primary, #ffffff))',
                    fontWeight: 900,
                  }}
                >
                  {item.term}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                >
                  {item.definition}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Default (no DNA) — original behavior ───────────────────
  return (
    <div ref={ref} className="w-full max-w-4xl mx-auto py-6 sm:py-8">
      {title && (
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="text-xl sm:text-2xl font-bold mb-5 tracking-tight"
          style={{ color: 'var(--brand-heading, #ffffff)' }}
        >
          {title}
        </motion.h2>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item, i) => (
          <motion.div
            key={i}
            custom={i}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={termVariants}
            className="rounded-xl border p-5 flex gap-4 items-start"
            style={{
              background: 'var(--ui-glass, rgba(255, 255, 255, 0.06))',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderColor: 'var(--ui-glass-border, rgba(255, 255, 255, 0.12))',
            }}
          >
            {/* Icon */}
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
              style={{
                background: 'rgba(139, 92, 246, 0.12)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 2h8a1 1 0 011 1v10l-4.5-2.5L4 13V3a1 1 0 011-1z"
                  stroke="var(--brand-accent, #8b5cf6)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h3
                className="text-base font-semibold mb-1"
                style={{ color: 'var(--brand-heading, var(--brand-primary, #ffffff))' }}
              >
                {item.term}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
              >
                {item.definition}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
