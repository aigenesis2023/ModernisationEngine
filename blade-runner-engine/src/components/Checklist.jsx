import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const itemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.15 + i * 0.06,
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function Checklist({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const { style, rules, resolveSurface, getCycleColor, hasDNA } = useComponentStyle('checklist');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const instruction = data.instruction || '';
  const items = data._items || [];

  const [checked, setChecked] = useState({});
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = items.length > 0 ? (checkedCount / items.length) * 100 : 0;

  const toggleItem = (index) => {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  // DNA-driven values
  const useDNALayout = hasDNA && style;
  const gridCols = useDNALayout && style.layout?.gridCols ? style.layout.gridCols : 3;
  const cardBg = useDNALayout && style.container?.primaryBg ? resolveSurface(style.container.primaryBg) : null;
  const borderLeftAccent = useDNALayout && style.treatments?.borderLeftAccent ? style.treatments.borderLeftAccent : 0;
  const icons = useDNALayout && style.icons ? style.icons : [];
  const labelTypo = hasDNA && rules?.typography?.label ? rules.typography.label : null;
  const progressBg = hasDNA ? resolveSurface('surface-container-lowest') : null;

  // ─── DNA Layout (grid of cards) ─────────────────────────────────────
  if (useDNALayout) {
    return (
      <div ref={ref} className="w-full max-w-5xl mx-auto py-6 sm:py-8">
        {/* Header row: title + progress tracker */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div className="flex-1">
            {title && (
              <motion.h2
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                style={{ color: 'var(--brand-heading, #ffffff)' }}
              >
                {title}
              </motion.h2>
            )}

            {body && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
                className="text-base leading-relaxed mt-2"
                style={{ color: 'var(--brand-text-muted)' }}
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}

            {instruction && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={isInView ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="text-sm mt-2 italic"
                style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
              >
                {instruction}
              </motion.p>
            )}
          </div>

          {/* Progress tracker — top-right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ delay: 0.2 }}
            className="flex-shrink-0 px-4 py-3 rounded-xl text-center"
            style={{
              background: progressBg || 'var(--ui-glass, rgba(255, 255, 255, 0.06))',
              minWidth: '100px',
            }}
          >
            <div
              className="text-2xl font-bold"
              style={{ color: progress === 100 ? 'var(--brand-success, #10b981)' : 'var(--brand-primary, #8b5cf6)' }}
            >
              {Math.round(progress)}%
            </div>
            <div
              className="text-xs font-medium mt-1"
              style={{
                color: 'var(--brand-text-muted)',
                ...(labelTypo ? {
                  textTransform: labelTypo.transform || 'uppercase',
                  letterSpacing: labelTypo.tracking || '0.05em',
                  fontWeight: labelTypo.weight || '700',
                } : {}),
              }}
            >
              {checkedCount}/{items.length}
            </div>
            {/* Mini progress bar */}
            <div
              className="h-1 rounded-full overflow-hidden mt-2"
              style={{ background: 'var(--ui-glass-border, rgba(255, 255, 255, 0.1))' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress}%`,
                  background: progress === 100
                    ? 'var(--brand-success, #10b981)'
                    : 'var(--brand-gradient, var(--brand-primary, #8b5cf6))',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* Grid of cards */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
        >
          {items.map((item, i) => {
            const isChecked = !!checked[i];
            const icon = icons.length > 0 ? icons[i % icons.length] : null;

            return (
              <motion.button
                key={i}
                custom={i}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                variants={itemVariants}
                onClick={() => toggleItem(i)}
                className="w-full flex flex-col gap-2 p-4 rounded-xl border text-left cursor-pointer"
                style={{
                  background: isChecked
                    ? 'rgba(16, 185, 129, 0.06)'
                    : (cardBg || 'var(--ui-glass)'),
                  borderColor: isChecked
                    ? 'var(--brand-success, rgba(16, 185, 129, 0.3))'
                    : 'var(--ui-glass-border)',
                  borderLeftWidth: borderLeftAccent ? `${borderLeftAccent}px` : undefined,
                  borderLeftColor: borderLeftAccent
                    ? (isChecked ? 'var(--brand-text-muted, rgba(255,255,255,0.2))' : 'var(--brand-primary, #8b5cf6)')
                    : undefined,
                  transition: 'all 0.25s ease',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon or checkbox */}
                  {icon ? (
                    <span
                      className="material-symbols-outlined flex-shrink-0 mt-0.5"
                      style={{
                        fontSize: '20px',
                        color: isChecked ? 'var(--brand-success, #10b981)' : 'var(--brand-primary, #8b5cf6)',
                        opacity: isChecked ? 0.5 : 1,
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {isChecked ? 'check_circle' : icon}
                    </span>
                  ) : (
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded mt-0.5 flex items-center justify-center"
                      style={{
                        border: `2px solid ${isChecked ? 'var(--brand-success, #10b981)' : 'rgba(255, 255, 255, 0.25)'}`,
                        background: isChecked ? 'var(--brand-success, #10b981)' : 'transparent',
                        borderRadius: '6px',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {isChecked && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  )}

                  <span
                    className="text-sm font-medium leading-snug"
                    style={{
                      color: isChecked ? 'var(--brand-text-muted)' : 'var(--brand-text, rgba(255, 255, 255, 0.85))',
                      textDecoration: isChecked ? 'line-through' : 'none',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {item.text}
                  </span>
                </div>

                {item.detail && (
                  <span
                    className="block leading-relaxed pl-8"
                    style={{
                      color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))',
                      ...(labelTypo ? {
                        fontSize: labelTypo.size || '0.7rem',
                        textTransform: labelTypo.transform || 'uppercase',
                        letterSpacing: labelTypo.tracking || '0.05em',
                        fontWeight: labelTypo.weight || '600',
                      } : { fontSize: '0.75rem' }),
                    }}
                  >
                    {item.detail}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        <style>{`
          @media (max-width: 767px) {
            .grid { grid-template-columns: repeat(1, 1fr) !important; }
          }
          @media (min-width: 768px) and (max-width: 1023px) {
            .grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
        `}</style>
      </div>
    );
  }

  // ─── Fallback: original stacked layout (no DNA) ─────────────────────
  return (
    <div ref={ref} className="w-full max-w-4xl mx-auto py-6 sm:py-8">
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

      {body && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="text-base leading-relaxed mb-2"
          style={{ color: 'var(--brand-text-muted)' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      {instruction && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="text-sm mb-4 italic"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
        >
          {instruction}
        </motion.p>
      )}

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--brand-text-muted)' }}
          >
            {checkedCount} of {items.length} completed
          </span>
          <span
            className="text-xs font-bold"
            style={{ color: progress === 100 ? 'var(--brand-success, #10b981)' : 'var(--brand-primary, #8b5cf6)' }}
          >
            {Math.round(progress)}%
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--ui-glass-border, rgba(255, 255, 255, 0.1))' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: progress === 100
                ? 'var(--brand-success, #10b981)'
                : 'var(--brand-gradient, var(--brand-primary, #8b5cf6))',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </motion.div>

      {/* Checklist items */}
      <div className="flex flex-col gap-2">
        {items.map((item, i) => {
          const isChecked = !!checked[i];

          return (
            <motion.button
              key={i}
              custom={i}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={itemVariants}
              onClick={() => toggleItem(i)}
              className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left cursor-pointer"
              style={{
                background: isChecked ? 'rgba(16, 185, 129, 0.06)' : 'var(--ui-glass)',
                borderColor: isChecked
                  ? 'var(--brand-success, rgba(16, 185, 129, 0.3))'
                  : 'var(--ui-glass-border)',
                transition: 'all 0.25s ease',
              }}
            >
              {/* Checkbox */}
              <span
                className="flex-shrink-0 w-5 h-5 rounded mt-0.5 flex items-center justify-center"
                style={{
                  border: `2px solid ${isChecked ? 'var(--brand-success, #10b981)' : 'rgba(255, 255, 255, 0.25)'}`,
                  background: isChecked ? 'var(--brand-success, #10b981)' : 'transparent',
                  borderRadius: '6px',
                  transition: 'all 0.25s ease',
                }}
              >
                {isChecked && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>

              <div className="flex-1 min-w-0">
                <span
                  className="text-sm font-medium leading-snug block"
                  style={{
                    color: isChecked ? 'var(--brand-text-muted)' : 'var(--brand-text, rgba(255, 255, 255, 0.85))',
                    textDecoration: isChecked ? 'line-through' : 'none',
                    transition: 'all 0.25s ease',
                  }}
                >
                  {item.text}
                </span>
                {item.detail && (
                  <span
                    className="text-xs mt-1 block leading-relaxed"
                    style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
                  >
                    {item.detail}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
