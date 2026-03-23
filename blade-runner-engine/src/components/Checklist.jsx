import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

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
