import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const cardVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.1 + i * 0.1,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function FlipCard({ item, index, isInView }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={cardVariants}
      className="cursor-pointer"
      style={{ perspective: '1000px' }}
      onClick={() => setFlipped(!flipped)}
    >
      <div
        className="relative w-full"
        style={{
          minHeight: '200px',
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.5s ease',
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-xl border p-6 flex flex-col items-center justify-center text-center"
          style={{
            backfaceVisibility: 'hidden',
            background: 'var(--ui-glass, rgba(255, 255, 255, 0.06))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'var(--ui-glass-border)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="mb-3 opacity-40"
          >
            <path
              d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1" fill="currentColor" />
          </svg>
          <p
            className="text-base sm:text-lg leading-relaxed font-medium"
            style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.9))' }}
          >
            {item.front}
          </p>
          <span
            className="text-xs mt-4 uppercase tracking-widest"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.3))' }}
          >
            Click to reveal
          </span>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-xl border p-6 flex flex-col items-center justify-center text-center"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'var(--brand-surface, rgba(255, 255, 255, 0.08))',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderColor: 'var(--brand-primary, #8b5cf6)',
            boxShadow: '0 0 24px rgba(139, 92, 246, 0.12)',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="mb-3"
            style={{ color: 'var(--brand-success, #10b981)' }}
          >
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p
            className="text-sm sm:text-base leading-relaxed"
            style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.85))' }}
          >
            {item.back}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function Flashcard({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const instruction = data.instruction || '';
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

        {instruction && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm mb-8 italic text-center"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
          >
            {instruction}
          </motion.p>
        )}

        <div
          className="grid gap-4 sm:gap-6"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}
        >
          {items.map((item, i) => (
            <FlipCard key={i} item={item} index={i} isInView={isInView} />
          ))}
        </div>
      </div>
    </section>
  );
}
