import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function BentoCard({ item, index, isFirst, isInView, totalItems, dnaProps }) {
  var [imgError, setImgError] = useState(false);
  var [isHovered, setIsHovered] = useState(false);
  var hasGraphic = !imgError && item._graphic && (item._graphic.src || item._graphic.large);
  var imgSrc = hasGraphic ? (item._graphic.large || item._graphic.src) : null;
  // Only span 2 on first item when there are 3+ items (otherwise grid looks odd)
  var shouldSpan = isFirst && totalItems >= 3;

  const { hasDNA, style, resolveSurface, rules, getCycleColor } = dnaProps;

  // DNA-driven backgrounds for non-image cards
  const surfaceBg = hasDNA && !hasGraphic && style?.container?.primaryBg
    ? resolveSurface(style.container.primaryBg)
    : null;

  // DNA-driven hover background
  const hoverBg = hasDNA && style?.treatments?.hoverBg
    ? resolveSurface(style.treatments.hoverBg)
    : null;

  // DNA-driven ghost border
  const borderStyle = hasDNA ? rules?.borderStyle : null;
  const ghostBorder = borderStyle?.type === 'luminous'
    ? `1px solid rgba(255,255,255,${borderStyle.outlineOpacity || 0.08})`
    : undefined;

  // DNA icon for non-image cards
  const icons = hasDNA && style?.icons ? style.icons : [];
  const cardIcon = !hasGraphic && icons.length > 0 ? icons[index % icons.length] : null;
  const iconColor = hasDNA ? getCycleColor(index) : null;

  // Compute card background
  const cardBg = isHovered && hoverBg
    ? hoverBg
    : (surfaceBg || 'var(--ui-glass, rgba(255, 255, 255, 0.03))');

  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={cardVariants}
      className="bento-card group relative rounded-xl overflow-hidden cursor-default"
      style={{
        gridColumn: shouldSpan ? 'span 2' : 'span 1',
        minHeight: hasGraphic ? '300px' : 'auto',
        background: cardBg,
        backdropFilter: surfaceBg ? undefined : 'blur(16px)',
        WebkitBackdropFilter: surfaceBg ? undefined : 'blur(16px)',
        border: ghostBorder || '1px solid var(--ui-glass-border, rgba(255, 255, 255, 0.06))',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease, background 0.3s ease',
      }}
      whileHover={{
        y: -4,
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image background */}
      {hasGraphic && (
        <>
          <img
            src={imgSrc}
            alt={item._graphic.alt || item.title || ''}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
            }}
          />
        </>
      )}

      {/* Content overlay */}
      <div
        className="relative z-10 flex flex-col justify-end h-full p-6 sm:p-8"
        style={{ minHeight: hasGraphic ? '300px' : undefined }}
      >
        {/* DNA: decorative icon on non-image cards */}
        {cardIcon && (
          <span
            className="material-symbols-outlined mb-4"
            style={{
              fontSize: '2.5rem',
              color: iconColor || 'var(--brand-primary, #8b5cf6)',
              opacity: 0.7,
            }}
          >
            {cardIcon}
          </span>
        )}

        {item.title && (
          <h3
            className="text-lg sm:text-xl font-semibold tracking-tight mb-2 leading-snug"
            style={{ color: 'var(--brand-heading, #ffffff)' }}
          >
            {item.title}
          </h3>
        )}
        {item.body && (
          <div
            className="text-sm leading-relaxed [&>p]:mb-2 line-clamp-4"
            style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.7))' }}
            dangerouslySetInnerHTML={{ __html: item.body }}
          />
        )}
      </div>

      {/* Hover border glow */}
      {hasDNA && borderStyle?.type === 'luminous' ? (
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{
            transition: 'opacity 0.3s ease',
            boxShadow: `inset 0 0 0 1px var(--brand-primary, #8b5cf6), 0 0 12px rgba(139,92,246,${borderStyle.glowOpacity || 0.15})`,
          }}
        />
      ) : (
        <div
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none"
          style={{
            transition: 'opacity 0.3s ease',
            boxShadow: 'inset 0 0 0 1px var(--brand-primary, #8b5cf6)',
          }}
        />
      )}
    </motion.div>
  );
}

export default function BentoGrid({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const { style, rules, resolveSurface, getCycleColor, hasDNA } = useComponentStyle('bento');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];

  const dnaProps = { hasDNA, style, resolveSurface, rules, getCycleColor };

  return (
    <motion.section
      ref={ref}
      className="w-full py-6 sm:py-8"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section heading */}
        {title && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 leading-snug"
            style={{ color: 'var(--brand-heading, #ffffff)' }}
          >
            {title}
          </motion.h2>
        )}

        {body && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="text-base leading-relaxed mb-10 max-w-2xl [&>p]:mb-3"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        {/* Bento grid */}
        <div
          className="bento-grid grid gap-4 sm:gap-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          }}
        >
          {items.map(function (item, i) {
            return (
              <BentoCard
                key={i}
                item={item}
                index={i}
                isFirst={i === 0}
                isInView={isInView}
                totalItems={items.length}
                dnaProps={dnaProps}
              />
            );
          })}
        </div>
      </div>

      {/* On mobile (single col), never span 2 */}
      <style>{`
        @media (max-width: 639px) {
          .bento-card { grid-column: span 1 !important; }
        }
      `}</style>
    </motion.section>
  );
}
