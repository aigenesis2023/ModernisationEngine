import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

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

// Variant for alternating layout — items slide in from their side
const stepVariantsAlternating = {
  hiddenLeft: { opacity: 0, x: -24 },
  hiddenRight: { opacity: 0, x: 24 },
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
  const { style, rules, resolveSurface, getCycleColor, hasDNA } = useComponentStyle('timeline');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];

  // ─── DNA-driven config ──────────────────────────────────────
  const useDNA = hasDNA && style;
  const useAlternating = useDNA && style.layout?.alternating;
  const useGradientLine = useDNA && style.treatments?.gradientLine;
  const useGlowDots = useDNA && style.treatments?.glowDots;
  const useColorCycle = useDNA && style.treatments?.colorCycle;
  const containerRounding = useDNA && style.container?.rounded
    ? style.container.rounded
    : '';

  // Format step number: DNA = "01." style, default = plain number
  const formatStepNum = (i) => {
    if (useDNA) {
      return `${String(i + 1).padStart(2, '0')}.`;
    }
    return i + 1;
  };

  // ─── Line style ─────────────────────────────────────────────
  const lineStyle = useGradientLine
    ? {
        background: `linear-gradient(to bottom, var(--brand-primary, #8b5cf6), var(--brand-secondary, #06b6d4), transparent)`,
      }
    : {
        background: 'var(--ui-glass-border, rgba(255, 255, 255, 0.12))',
      };

  // ─── Dot style per step ─────────────────────────────────────
  const getDotStyle = (i) => {
    const baseStyle = {
      background: 'var(--brand-gradient, linear-gradient(135deg, var(--brand-primary, #8b5cf6), var(--brand-accent, #06b6d4)))',
      color: '#ffffff',
    };

    if (useGlowDots) {
      const glowColor = getCycleColor(i) || 'var(--brand-primary, #8b5cf6)';
      return {
        ...baseStyle,
        boxShadow: `0 0 12px ${glowColor}, 0 0 24px ${glowColor}40`,
      };
    }

    return {
      ...baseStyle,
      boxShadow: '0 0 20px rgba(139, 92, 246, 0.25)',
    };
  };

  // ─── Step number/title color ────────────────────────────────
  const getStepColor = (i) => {
    if (useColorCycle) {
      return getCycleColor(i) || 'var(--brand-heading, #ffffff)';
    }
    return 'var(--brand-heading, #ffffff)';
  };

  // ─── Alternating layout (desktop only) ──────────────────────
  if (useAlternating) {
    return (
      <div ref={ref} className={`w-full max-w-5xl mx-auto py-6 sm:py-8 ${containerRounding}`}>
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
            className="text-base leading-relaxed mb-8 text-center max-w-2xl mx-auto"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        <div className="relative">
          {/* Center vertical line (desktop), left-aligned on mobile */}
          <div
            className="absolute top-0 bottom-0 w-px left-5 md:left-1/2 md:-translate-x-px"
            style={lineStyle}
          />

          <div className="flex flex-col gap-8">
            {items.map((item, i) => {
              const isLeft = i % 2 === 0;
              const stepColor = getStepColor(i);

              return (
                <motion.div
                  key={i}
                  custom={i}
                  initial={isLeft ? 'hiddenLeft' : 'hiddenRight'}
                  animate={isInView ? 'visible' : (isLeft ? 'hiddenLeft' : 'hiddenRight')}
                  variants={stepVariantsAlternating}
                  className="relative flex gap-5 md:gap-0"
                >
                  {/* Mobile: standard left-aligned layout */}
                  {/* Desktop: alternating left/right with center dot */}

                  {/* Mobile layout (shown below md) */}
                  <div className="flex gap-5 md:hidden w-full">
                    <div
                      className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={getDotStyle(i)}
                    >
                      {formatStepNum(i)}
                    </div>
                    <div
                      className="flex-1 rounded-xl border p-5"
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
                          style={{ color: stepColor }}
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
                  </div>

                  {/* Desktop layout (hidden below md) */}
                  <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr] md:gap-6 md:items-start w-full">
                    {/* Left content area */}
                    <div className={isLeft ? '' : 'order-1'}>
                      {isLeft && (
                        <div
                          className="rounded-xl border p-5 sm:p-6 text-right"
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
                              style={{ color: stepColor }}
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
                      )}
                    </div>

                    {/* Center dot */}
                    <div
                      className="relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold order-2"
                      style={getDotStyle(i)}
                    >
                      {formatStepNum(i)}
                    </div>

                    {/* Right content area */}
                    <div className={isLeft ? 'order-3' : 'order-3'}>
                      {!isLeft && (
                        <div
                          className="rounded-xl border p-5 sm:p-6"
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
                              style={{ color: stepColor }}
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
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ─── Default layout (no alternating) ────────────────────────
  return (
    <div ref={ref} className={`w-full max-w-4xl mx-auto py-6 sm:py-8 ${containerRounding}`}>
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
          style={lineStyle}
        />

        <div className="flex flex-col gap-8">
          {items.map((item, i) => {
            const stepColor = getStepColor(i);

            return (
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
                  style={getDotStyle(i)}
                >
                  {formatStepNum(i)}
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
                      style={{ color: stepColor }}
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
            );
          })}
        </div>
      </div>
    </div>
  );
}
