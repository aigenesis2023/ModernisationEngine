import { motion, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

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
  const { style, rules, resolveSurface, getCycleColor, hasDNA } = useComponentStyle('stat-callout');
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];

  // DNA-driven values
  const gridCols = hasDNA && style?.layout?.gridCols ? style.layout.gridCols : Math.min(items.length, 4);
  const cardBg = hasDNA && style?.container?.primaryBg ? resolveSurface(style.container.primaryBg) : null;
  const hoverBg = hasDNA && style?.treatments?.hoverBg ? resolveSurface(style.treatments.hoverBg) : null;
  const useColorCycle = hasDNA && style?.treatments?.colorCycle;
  const labelTypo = hasDNA && rules?.typography?.label ? rules.typography.label : null;

  const getCardBackground = (index) => {
    if (!hasDNA) {
      return {
        background: 'var(--ui-glass, rgba(255, 255, 255, 0.06))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      };
    }
    const isHovered = hoveredIndex === index;
    const bg = isHovered && hoverBg ? hoverBg : (cardBg || 'var(--ui-glass, rgba(255, 255, 255, 0.06))');
    return {
      background: bg,
      backdropFilter: cardBg ? undefined : 'blur(16px)',
      WebkitBackdropFilter: cardBg ? undefined : 'blur(16px)',
      transition: 'background 0.25s ease',
    };
  };

  const getValueStyle = (index) => {
    if (useColorCycle) {
      const color = getCycleColor(index);
      return color ? { color } : {
        background: 'var(--brand-gradient, linear-gradient(135deg, var(--brand-primary), var(--brand-accent)))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      };
    }
    return {
      background: 'var(--brand-gradient, linear-gradient(135deg, var(--brand-primary), var(--brand-accent)))',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    };
  };

  const getLabelStyle = () => {
    if (labelTypo) {
      return {
        color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))',
        textTransform: labelTypo.transform || 'uppercase',
        letterSpacing: labelTypo.tracking || '0.05em',
        fontSize: labelTypo.size || '0.75rem',
        fontWeight: labelTypo.weight || '700',
      };
    }
    return { color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' };
  };

  const labelClasses = labelTypo
    ? 'leading-snug mt-1 block'
    : 'text-sm sm:text-base leading-snug mt-1';

  return (
    <section ref={ref} className="w-full py-6 sm:py-8">
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
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
          }}
        >
          {items.map((item, i) => (
            <motion.div
              key={i}
              custom={i}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={cardVariants}
              className={`${hasDNA && style?.container?.rounded ? style.container.rounded : 'rounded-xl'} border p-8 sm:p-10 text-center`}
              style={{
                ...getCardBackground(i),
                borderColor: 'var(--ui-glass-border, rgba(255, 255, 255, 0.12))',
                boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
              }}
              onMouseEnter={() => hoverBg && setHoveredIndex(i)}
              onMouseLeave={() => hoverBg && setHoveredIndex(null)}
            >
              <div
                className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-3"
                style={getValueStyle(i)}
              >
                {item.prefix || ''}
                <AnimatedNumber value={item.value || '0'} isInView={isInView} />
                {item.suffix || ''}
              </div>
              {item.label && (
                <div
                  className={labelClasses}
                  style={getLabelStyle()}
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
