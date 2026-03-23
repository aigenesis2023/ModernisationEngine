import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

export default function PullQuote({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });
  const { style, rules, hasDNA } = useComponentStyle('pullquote');

  const body = data.body || '';
  const attribution = data.attribution || '';
  const role = data.role || '';

  if (!body) return null;

  // DNA-driven values
  const accentWidth = hasDNA ? (style?.treatments?.borderLeftAccent || 6) : 4;
  const titleSizeClass = hasDNA && style?.typography?.titleSize ? style.typography.titleSize : null;
  const showPersonIcon = hasDNA && style?.icons?.includes('person');
  const labelTypo = hasDNA && rules?.typography?.label ? rules.typography.label : null;

  // Quote text classes
  const quoteClasses = titleSizeClass
    ? `${titleSizeClass} leading-relaxed font-medium italic`
    : 'text-xl sm:text-2xl leading-relaxed font-medium italic';

  return (
    <motion.blockquote
      ref={ref}
      initial={{ opacity: 0, x: -24 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-3xl mx-auto py-6 sm:py-8"
    >
      <div className="relative pl-6 sm:pl-8">
        {/* Accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full"
          style={{
            width: `${accentWidth}px`,
            background: 'var(--brand-gradient, linear-gradient(180deg, var(--brand-primary, #8b5cf6), var(--brand-accent, #06b6d4)))',
          }}
        />

        {/* Quote text */}
        <p
          className={quoteClasses}
          style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.9))' }}
        >
          {body}
        </p>

        {/* Attribution */}
        {(attribution || role) && (
          <div className="mt-4 flex items-center gap-3">
            {/* Avatar circle with person icon (DNA only) */}
            {showPersonIcon && (
              <span
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--brand-primary, #8b5cf6)',
                  opacity: 0.85,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '22px', color: '#ffffff' }}
                >
                  person
                </span>
              </span>
            )}

            {!showPersonIcon && (
              <div
                className="w-8 h-px"
                style={{ background: 'var(--brand-text-muted, rgba(255, 255, 255, 0.3))' }}
              />
            )}

            <div className="flex flex-col">
              {attribution && (
                <span
                  className="text-sm font-semibold"
                  style={{ color: 'var(--brand-heading, var(--brand-primary))' }}
                >
                  {attribution}
                </span>
              )}
              {role && (
                <span
                  style={{
                    color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))',
                    ...(labelTypo ? {
                      fontSize: labelTypo.size || '0.7rem',
                      textTransform: labelTypo.transform || 'uppercase',
                      letterSpacing: labelTypo.tracking || '0.05em',
                      fontWeight: labelTypo.weight || '600',
                    } : { fontSize: '0.875rem' }),
                  }}
                >
                  {role}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.blockquote>
  );
}
