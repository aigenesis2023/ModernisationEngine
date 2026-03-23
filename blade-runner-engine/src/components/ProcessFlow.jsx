import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const nodeVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.95 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.15 + i * 0.15,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const NODE_STYLES = {
  start: {
    borderColor: 'var(--brand-success, #10b981)',
    iconBg: 'rgba(16, 185, 129, 0.15)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M6 4l6 4-6 4V4z" fill="var(--brand-success, #10b981)" />
      </svg>
    ),
  },
  process: {
    borderColor: 'var(--ui-glass-border, rgba(255, 255, 255, 0.12))',
    iconBg: 'rgba(139, 92, 246, 0.12)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="2" y="2" width="12" height="12" rx="2" stroke="var(--brand-primary, #8b5cf6)" strokeWidth="1.5" />
      </svg>
    ),
  },
  decision: {
    borderColor: 'var(--brand-accent, #06b6d4)',
    iconBg: 'rgba(6, 182, 212, 0.12)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 1l7 7-7 7-7-7 7-7z" stroke="var(--brand-accent, #06b6d4)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    ),
  },
  end: {
    borderColor: 'var(--brand-error, #ef4444)',
    iconBg: 'rgba(239, 68, 68, 0.12)',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="var(--brand-error, #ef4444)" strokeWidth="1.5" />
        <circle cx="8" cy="8" r="3" fill="var(--brand-error, #ef4444)" />
      </svg>
    ),
  },
};

export default function ProcessFlow({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const { style, rules, resolveSurface, getCycleColor, hasDNA } = useComponentStyle('process-flow');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const nodes = data._nodes || [];

  // ─── DNA-driven layout ───────────────────────────────────────
  if (hasDNA && style) {
    const circularNodes = style.layout?.circularNodes || false;
    const icons = style.icons || [];
    const nodeBg = resolveSurface(style.container?.primaryBg) || 'var(--ui-glass, rgba(255, 255, 255, 0.06))';
    const labelTypo = rules?.typography?.label || {};
    const hasArrowConnector = icons.includes('arrow_forward');

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
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-base leading-relaxed mb-10 text-center max-w-xl mx-auto"
              style={{ color: 'var(--brand-text-muted)' }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}

          {/* Horizontal layout on desktop, vertical on mobile */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-0">
            {nodes.map((node, i) => {
              const isLast = i === nodes.length - 1;
              const iconName = icons.length > 0 ? icons[i % icons.length] : null;
              const cycleColor = getCycleColor(i);

              return (
                <div key={i} className="flex flex-col sm:flex-row items-center">
                  {/* Node */}
                  <motion.div
                    custom={i}
                    initial="hidden"
                    animate={isInView ? 'visible' : 'hidden'}
                    variants={nodeVariants}
                    className={`flex flex-col items-center justify-center text-center gap-2 ${
                      circularNodes ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-full sm:w-48 p-5'
                    }`}
                    style={{
                      background: nodeBg,
                      border: '1px solid var(--border-ghost, rgba(255, 255, 255, 0.08))',
                      borderRadius: circularNodes ? '9999px' : '0.75rem',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                    }}
                  >
                    {/* Material icon */}
                    {iconName && (
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: circularNodes ? '28px' : '24px',
                          color: cycleColor || 'var(--brand-primary)',
                        }}
                      >
                        {iconName}
                      </span>
                    )}

                    {/* Node label */}
                    <span
                      style={{
                        textTransform: labelTypo.transform || 'uppercase',
                        letterSpacing: labelTypo.tracking || '0.05em',
                        fontSize: labelTypo.size || '0.65rem',
                        fontWeight: labelTypo.weight || 700,
                        color: 'var(--brand-text, rgba(255, 255, 255, 0.9))',
                        lineHeight: 1.2,
                        padding: circularNodes ? '0 0.5rem' : '0',
                      }}
                    >
                      {node.title}
                    </span>
                  </motion.div>

                  {/* Arrow connector between nodes */}
                  {!isLast && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={isInView ? { opacity: 1 } : {}}
                      transition={{ delay: 0.3 + i * 0.15, duration: 0.3 }}
                      className="flex items-center justify-center"
                    >
                      {/* Vertical arrow on mobile */}
                      <div className="flex flex-col items-center py-1 sm:hidden">
                        <div
                          className="w-px h-6"
                          style={{ background: 'var(--border-ghost, rgba(255, 255, 255, 0.15))' }}
                        />
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: '18px',
                            color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))',
                          }}
                        >
                          keyboard_arrow_down
                        </span>
                      </div>

                      {/* Horizontal arrow on desktop */}
                      <div className="hidden sm:flex items-center px-2">
                        {hasArrowConnector ? (
                          <span
                            className="material-symbols-outlined"
                            style={{
                              fontSize: '22px',
                              color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))',
                            }}
                          >
                            arrow_forward
                          </span>
                        ) : (
                          <div
                            className="w-8 h-px"
                            style={{ background: 'var(--border-ghost, rgba(255, 255, 255, 0.15))' }}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  // ─── Default (no DNA) — original vertical card layout ───────
  return (
    <section ref={ref} className="w-full py-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
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
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base leading-relaxed mb-10 text-center max-w-xl mx-auto"
            style={{ color: 'var(--brand-text-muted)' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        <div className="flex flex-col items-center gap-0">
          {nodes.map((node, i) => {
            const nodeType = node.type || 'process';
            const nodeStyle = NODE_STYLES[nodeType] || NODE_STYLES.process;
            const isLast = i === nodes.length - 1;

            return (
              <div key={i} className="flex flex-col items-center w-full">
                {/* Node card */}
                <motion.div
                  custom={i}
                  initial="hidden"
                  animate={isInView ? 'visible' : 'hidden'}
                  variants={nodeVariants}
                  className="w-full max-w-2xl rounded-xl border p-5 sm:p-6 flex gap-4 items-start"
                  style={{
                    background: 'var(--ui-glass, rgba(255, 255, 255, 0.06))',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderColor: nodeStyle.borderColor,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: nodeStyle.iconBg }}
                  >
                    {nodeStyle.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-base font-semibold mb-1"
                      style={{ color: 'var(--brand-heading, #ffffff)' }}
                    >
                      {node.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                    >
                      {node.body}
                    </p>
                  </div>
                </motion.div>

                {/* Arrow connector */}
                {!isLast && (
                  <motion.div
                    initial={{ opacity: 0, scaleY: 0 }}
                    animate={isInView ? { opacity: 1, scaleY: 1 } : {}}
                    transition={{ delay: 0.3 + i * 0.15, duration: 0.3 }}
                    className="flex flex-col items-center py-1"
                  >
                    <div
                      className="w-px h-6"
                      style={{ background: 'var(--ui-glass-border, rgba(255, 255, 255, 0.15))' }}
                    />
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                      <path
                        d="M1 1l5 5 5-5"
                        stroke="var(--brand-primary, #8b5cf6)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
