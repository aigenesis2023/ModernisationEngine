import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const stepVariants = {
  hidden: { opacity: 0, x: -24 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.15 + i * 0.12,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function TimelineStepper({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];

  return (
    <div ref={ref} className="w-full max-w-3xl mx-auto px-4 py-8">
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
          className="text-base leading-relaxed mb-8"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      <div className="relative">
        {/* Vertical connecting line */}
        <div
          className="absolute left-5 top-0 bottom-0 w-px"
          style={{ background: 'var(--ui-glass-border, rgba(255, 255, 255, 0.12))' }}
        />

        <div className="flex flex-col gap-8">
          {items.map((item, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={stepVariants}
              className="relative flex gap-5"
            >
              {/* Step number badge */}
              <div
                className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  background: 'var(--brand-gradient, linear-gradient(135deg, var(--brand-primary, #8b5cf6), var(--brand-accent, #06b6d4)))',
                  color: '#ffffff',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)',
                }}
              >
                {i + 1}
              </div>

              {/* Content card */}
              <div
                className="flex-1 rounded-xl border p-5 sm:p-6"
                style={{
                  background: 'var(--ui-glass, rgba(255, 255, 255, 0.06))',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderColor: 'var(--ui-glass-border, rgba(255, 255, 255, 0.12))',
                  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
                }}
              >
                {item.title && (
                  <h3
                    className="text-lg font-semibold mb-2 tracking-tight"
                    style={{ color: 'var(--brand-heading, #ffffff)' }}
                  >
                    {item.title}
                  </h3>
                )}
                {item.body && (
                  <div
                    className="text-sm leading-relaxed [&>p]:mb-2"
                    style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                    dangerouslySetInnerHTML={{ __html: item.body }}
                  />
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
