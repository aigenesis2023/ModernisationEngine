import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

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

// Map Tailwind-style weight classes to CSS font-weight values
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

export default function HeroSplash({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const [imgError, setImgError] = useState(false);
  const { style, rules, hasDNA } = useComponentStyle('hero');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const graphic = data._graphic || null;
  const showBgImage = graphic?.large && !imgError;

  // Split title into words, then each word into letters for animation
  const words = title.split(' ');
  let charIndex = 0;

  // DNA-driven values
  const badge = hasDNA && style?.badge?.found ? style.badge : null;
  const labelTypo = rules?.typography?.label || {};
  const headingTypo = rules?.typography?.heading || {};
  const titleWeight = style?.typography?.titleWeight || 'font-bold';
  const ctaIcon = style?.icons?.[0] || null;
  const overlayDirection = style?.treatments?.overlayGradientDirection || 'to top';

  // ─── DNA-driven render ────────────────────────────────────────────
  if (hasDNA) {
    return (
      <section
        ref={ref}
        className="relative flex items-end min-h-screen w-full overflow-hidden"
        style={{ background: 'var(--brand-gradient, linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%))' }}
      >
        {/* Background image */}
        {showBgImage && (
          <img
            src={graphic.large}
            alt={graphic.alt || ''}
            className="absolute inset-0 w-full h-full object-cover"
            aria-hidden="true"
            onError={() => setImgError(true)}
          />
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(${overlayDirection}, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)`,
          }}
        />

        {/* Content — directly over the background, no glass card */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 sm:px-10 pb-24 sm:pb-32 pt-40">
          {/* Badge / label */}
          {badge && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-5"
            >
              <span
                style={{
                  color: 'var(--brand-accent, #8b5cf6)',
                  textTransform: labelTypo.transform || 'uppercase',
                  letterSpacing: trackingMap[labelTypo.tracking] || '0.1em',
                  fontSize: labelTypo.size ? undefined : '0.75rem',
                  fontWeight: weightMap[labelTypo.weight] || 600,
                }}
                className={labelTypo.size || 'text-xs'}
              >
                {badge.text}
              </span>
            </motion.div>
          )}

          {/* Animated title */}
          <h1
            className="text-3xl sm:text-5xl md:text-7xl leading-tight mb-6"
            style={{
              color: 'var(--brand-heading, #ffffff)',
              fontWeight: weightMap[titleWeight] || 700,
              letterSpacing: trackingMap[headingTypo.tracking] || '-0.025em',
            }}
          >
            {words.map((word, wi) => {
              const wordChars = word.split('');
              const startIdx = charIndex;
              charIndex += word.length + 1;
              return (
                <span key={wi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                  {wordChars.map((char, ci) => (
                    <motion.span
                      key={`${startIdx + ci}-${char}`}
                      custom={startIdx + ci}
                      initial="hidden"
                      animate={isInView ? 'visible' : 'hidden'}
                      variants={letterVariants}
                      className="inline-block"
                    >
                      {char}
                    </motion.span>
                  ))}
                  {wi < words.length - 1 && <span>&nbsp;</span>}
                </span>
              );
            })}
          </h1>

          {/* Body / subtitle */}
          {body && (
            <motion.div
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={fadeUp}
              className="text-lg sm:text-xl leading-relaxed max-w-2xl mb-8"
              style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}

          {/* CTA button with icon */}
          {ctaIcon && (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 font-semibold text-sm tracking-wide text-white cursor-pointer"
              style={{
                borderRadius: 'var(--ui-button-radius, 9999px)',
                background: 'var(--brand-gradient, linear-gradient(135deg, var(--brand-accent, #8b5cf6), var(--brand-primary, #6d28d9)))',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
              }}
              onClick={() => {
                const next = ref.current?.nextElementSibling;
                if (next) next.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              Get Started
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                {ctaIcon}
              </span>
            </motion.button>
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

  // ─── Fallback: original behavior (no DNA) ─────────────────────────
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
        className="relative z-10 mx-4 sm:mx-auto max-w-3xl px-5 sm:px-8 py-12 sm:py-16 text-center rounded-2xl border"
        style={{
          background: 'var(--ui-glass)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderColor: 'var(--ui-glass-border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Animated title */}
        <h1 className="text-2xl sm:text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6"
            style={{ color: 'var(--brand-heading, #ffffff)' }}>
          {words.map((word, wi) => {
            const wordChars = word.split('');
            const startIdx = charIndex;
            charIndex += word.length + 1;
            return (
              <span key={wi} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                {wordChars.map((char, ci) => (
                  <motion.span
                    key={`${startIdx + ci}-${char}`}
                    custom={startIdx + ci}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                    variants={letterVariants}
                    className="inline-block"
                  >
                    {char}
                  </motion.span>
                ))}
                {wi < words.length - 1 && <span>&nbsp;</span>}
              </span>
            );
          })}
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
