import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function PullQuote({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const body = data.body || '';
  const attribution = data.attribution || '';
  const role = data.role || '';

  if (!body) return null;

  return (
    <motion.blockquote
      ref={ref}
      initial={{ opacity: 0, x: -24 }}
      animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -24 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-3xl mx-auto px-4 py-10 sm:py-16"
    >
      <div className="relative pl-6 sm:pl-8">
        {/* Accent bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-full"
          style={{
            background: 'var(--brand-gradient, linear-gradient(180deg, var(--brand-primary, #8b5cf6), var(--brand-accent, #06b6d4)))',
          }}
        />

        {/* Quote text */}
        <p
          className="text-xl sm:text-2xl leading-relaxed font-medium italic"
          style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.9))' }}
        >
          {body}
        </p>

        {/* Attribution */}
        {(attribution || role) && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className="w-8 h-px"
              style={{ background: 'var(--brand-text-muted, rgba(255, 255, 255, 0.3))' }}
            />
            <div>
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
                  className="text-sm ml-2"
                  style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
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
