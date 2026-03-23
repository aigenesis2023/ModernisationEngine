import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

const cardVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.1 + i * 0.12,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function AnimatedNumber({ value, isInView }) {
  const [display, setDisplay] = useState('0');
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''));
  const isNumeric = !isNaN(numericValue);

  useEffect(() => {
    if (!isInView || !isNumeric) {
      setDisplay(value);
      return;
    }

    const duration = 1200;
    const steps = 30;
    const stepTime = duration / steps;
    let current = 0;

    const timer = setInterval(() => {
      current++;
      const progress = current / steps;
      const eased = 1 - Math.pow(1 - progress, 3);
      const num = Math.round(numericValue * eased);
      setDisplay(String(num));

      if (current >= steps) {
        clearInterval(timer);
        setDisplay(value);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, value, numericValue, isNumeric]);

  return <>{display}</>;
}

export default function StatCallout({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];

  return (
    <section ref={ref} className="w-full px-4 sm:px-6 py-12 sm:py-20">
      <div className="max-w-5xl mx-auto">
        {title && (
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight text-center"
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
            className="text-base leading-relaxed mb-10 text-center max-w-xl mx-auto"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
          }}
        >
          {items.map((item, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={cardVariants}
              className="rounded-xl border p-6 sm:p-8 text-center"
              style={{
                background: 'var(--ui-glass, rgba(255, 255, 255, 0.06))',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderColor: 'var(--ui-glass-border, rgba(255, 255, 255, 0.12))',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
              }}
            >
              <div
                className="text-4xl sm:text-5xl font-bold tracking-tight mb-2"
                style={{
                  background: 'var(--brand-gradient, linear-gradient(135deg, var(--brand-primary), var(--brand-accent)))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {item.prefix || ''}
                <AnimatedNumber value={item.value || '0'} isInView={isInView} />
                {item.suffix || ''}
              </div>
              {item.label && (
                <div
                  className="text-sm leading-snug"
                  style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
                >
                  {item.label}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 639px) {
          .grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </section>
  );
}
