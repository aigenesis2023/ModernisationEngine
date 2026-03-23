import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const letterVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.035,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.8, duration: 0.6, ease: 'easeOut' },
  },
};

const bounce = {
  y: [0, -8, 0],
  transition: {
    duration: 1.6,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

export default function HeroSplash({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [imgError, setImgError] = useState(false);

  const title = data.displayTitle || '';
  const body = data.body || '';
  const graphic = data._graphic || null;
  const letters = title.split('');
  const showBgImage = graphic?.large && !imgError;

  return (
    <section
      ref={ref}
      className="relative flex items-center justify-center min-h-screen w-full overflow-hidden"
      style={{ background: 'var(--brand-gradient, linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%))' }}
    >
      {/* Background image */}
      {showBgImage && (
        <>
          <img
            src={graphic.large}
            alt={graphic.alt || ''}
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        </>
      )}

      {/* Glassmorphism card */}
      <div
        className="relative z-10 mx-auto max-w-3xl px-6 py-16 text-center rounded-2xl border"
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Animated title */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6"
            style={{ color: 'var(--brand-heading, #ffffff)' }}>
          {letters.map((char, i) => (
            <motion.span
              key={`${i}-${char}`}
              custom={i}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={letterVariants}
              className="inline-block"
              style={{ whiteSpace: char === ' ' ? 'pre' : undefined }}
            >
              {char === ' ' ? '\u00A0' : char}
            </motion.span>
          ))}
        </h1>

        {/* Body / subtitle */}
        {body && (
          <motion.div
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={fadeUp}
            className="text-lg sm:text-xl leading-relaxed max-w-xl mx-auto"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.4, duration: 0.5 }}
      >
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
        >
          Scroll to begin
        </span>
        <motion.svg
          animate={bounce}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--brand-accent, #8b5cf6)' }}
        >
          <path d="M12 5v14M5 12l7 7 7-7" />
        </motion.svg>
      </motion.div>
    </section>
  );
}
