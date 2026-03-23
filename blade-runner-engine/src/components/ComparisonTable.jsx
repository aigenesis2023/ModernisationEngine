import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="13" fill="var(--brand-success, #10b981)" fillOpacity="0.2" />
      <path d="M8 13l3.5 3.5 6.5-6.5" stroke="var(--brand-success, #10b981)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
      <circle cx="13" cy="13" r="13" fill="var(--brand-error, #ef4444)" fillOpacity="0.2" />
      <path d="M9 9l8 8M17 9l-8 8" stroke="var(--brand-error, #ef4444)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ComparisonTable({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const columns = data.columns || [];
  const rows = data.rows || [];

  if (columns.length === 0 || rows.length === 0) return null;

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className="w-full flex justify-center py-6 sm:py-8"
    >
      <div
        className="w-full rounded-xl border overflow-hidden"
        style={{
          maxWidth: '900px',
          background: 'var(--ui-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'var(--ui-glass-border)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Title */}
        {title && (
          <div
            className="px-6 sm:px-8 py-5 border-b"
            style={{ borderColor: 'var(--ui-glass-border)' }}
          >
            <h2
              className="text-xl sm:text-2xl font-semibold tracking-tight"
              style={{ color: 'var(--brand-heading, #ffffff)' }}
            >
              {title}
            </h2>
            {body && (
              <div
                className="text-sm mt-2 leading-relaxed"
                style={{ color: 'var(--brand-text-muted)' }}
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Column headers */}
            <thead>
              <tr>
                <th className="px-6 py-4 text-left" style={{ width: '40%' }} />
                {columns.map((col, ci) => (
                  <th
                    key={ci}
                    className="px-6 py-4 text-center"
                    style={{
                      color: 'var(--brand-heading, #ffffff)',
                      borderLeft: '1px solid var(--ui-glass-border)',
                    }}
                  >
                    <div className="text-base sm:text-lg font-bold">{col.title}</div>
                    {col.subtitle && (
                      <div
                        className="text-xs mt-1 font-normal"
                        style={{ color: 'var(--brand-text-muted)' }}
                      >
                        {col.subtitle}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Rows */}
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  style={{
                    background: ri % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                    borderTop: '1px solid var(--ui-glass-border)',
                  }}
                >
                  <td
                    className="px-6 py-4 text-sm font-medium"
                    style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.85))' }}
                  >
                    {row.label}
                  </td>
                  {(row.values || []).map((val, vi) => (
                    <td
                      key={vi}
                      className="px-6 py-4 text-center"
                      style={{ borderLeft: '1px solid var(--ui-glass-border)' }}
                    >
                      {val === true ? (
                        <span className="inline-flex justify-center"><CheckIcon /></span>
                      ) : val === false ? (
                        <span className="inline-flex justify-center"><CrossIcon /></span>
                      ) : (
                        <span
                          className="text-sm"
                          style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                        >
                          {val}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.section>
  );
}
