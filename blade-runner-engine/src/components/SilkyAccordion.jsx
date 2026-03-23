import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import useCourseStore from '../store/courseStore';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

const contentVariants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: { height: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } },
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { height: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.25, delay: 0.1 } },
  },
};

const chevronVariants = {
  collapsed: { rotate: 0 },
  expanded: { rotate: 180 },
};

export default function SilkyAccordion({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const store = useCourseStore();
  const { style, rules, resolveSurface, hasDNA } = useComponentStyle('accordion');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const instruction = data.instruction || '';
  const items = data._items || [];

  // Track which items have ever been opened for completion indicator
  const [everOpened, setEverOpened] = useState({});

  const isOpen = (index) => !!store.activeAccordions[`${data._id}_${index}`];

  const handleToggle = (index) => {
    store.toggleAccordion(data._id, index);
    if (!everOpened[index]) {
      setEverOpened((prev) => ({ ...prev, [index]: true }));
    }
  };

  // ─── DNA-driven config ──────────────────────────────────────
  const useDNA = hasDNA && style;
  const containerBg = useDNA && style.container?.primaryBg
    ? resolveSurface(style.container.primaryBg)
    : null;
  const containerRounding = useDNA && style.container?.rounded
    ? style.container.rounded
    : 'rounded-xl';
  const isLuminousBorder = useDNA && rules?.borderStyle?.type === 'luminous';
  const useDivideY = useDNA && style.treatments?.divideY;

  // Icons from DNA: last icon is chevron, rest are item icons
  const dnaIcons = useDNA && style.icons?.length > 0 ? style.icons : null;
  const chevronIcon = dnaIcons && dnaIcons.length > 0 ? dnaIcons[dnaIcons.length - 1] : null;
  const itemIcons = dnaIcons && dnaIcons.length > 1 ? dnaIcons.slice(0, -1) : null;

  // Helper to get cycling item icon
  const getItemIcon = (index) => {
    if (!itemIcons || itemIcons.length === 0) return null;
    return itemIcons[index % itemIcons.length];
  };

  // ─── Chevron element (DNA material icon or fallback SVG) ────
  const renderChevron = (open) => {
    if (useDNA && chevronIcon) {
      return (
        <motion.span
          initial={false}
          animate={open ? 'expanded' : 'collapsed'}
          variants={chevronVariants}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="material-symbols-outlined flex-shrink-0 ml-3"
          style={{
            color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.5))',
            fontSize: '20px',
            display: 'inline-block',
          }}
        >
          {chevronIcon}
        </motion.span>
      );
    }
    return (
      <motion.svg
        initial={false}
        animate={open ? 'expanded' : 'collapsed'}
        variants={chevronVariants}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        className="flex-shrink-0 ml-3"
        style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.5))' }}
      >
        <path
          d="M5 7.5L10 12.5L15 7.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    );
  };

  // ─── Container style ────────────────────────────────────────
  const outerContainerStyle = useDNA && containerBg
    ? { background: containerBg, borderRadius: '16px', padding: '8px' }
    : {};

  // ─── Item border style (DNA vs default) ─────────────────────
  const getItemBorderStyle = (open) => {
    if (useDNA && isLuminousBorder) {
      return {
        borderColor: open
          ? 'var(--brand-accent, rgba(139, 92, 246, 0.5))'
          : 'var(--border-ghost, rgba(255, 255, 255, 0.06))',
        boxShadow: open
          ? '0 0 20px rgba(139, 92, 246, 0.08)'
          : 'none',
      };
    }
    return {
      borderColor: open
        ? 'var(--brand-accent, rgba(139, 92, 246, 0.5))'
        : 'var(--ui-glass-border, rgba(255, 255, 255, 0.15))',
      boxShadow: open
        ? '0 0 20px rgba(139, 92, 246, 0.08)'
        : '0 2px 8px rgba(0, 0, 0, 0.2)',
    };
  };

  return (
    <div ref={ref} className="w-full">
      {/* Section heading */}
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

      {/* Body text */}
      {body && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="text-base leading-relaxed mb-4"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      {/* Instruction */}
      {instruction && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-sm mb-6 italic"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))' }}
        >
          {instruction}
        </motion.p>
      )}

      {/* Accordion items */}
      <div
        className={`flex flex-col ${useDivideY ? '' : 'gap-3'}`}
        style={outerContainerStyle}
      >
        {items.map((item, index) => {
          const open = isOpen(index);
          const visited = everOpened[index] || open;
          const iconName = getItemIcon(index);
          const borderStyle = getItemBorderStyle(open);
          const isLast = index === items.length - 1;

          return (
            <motion.div
              key={`${data._id}_${index}`}
              custom={index}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={itemVariants}
              className={`${useDivideY ? '' : `${containerRounding} border`} overflow-hidden`}
              style={{
                background: useDivideY ? 'transparent' : 'var(--ui-glass, rgba(255, 255, 255, 0.08))',
                backdropFilter: useDivideY ? 'none' : 'blur(16px)',
                WebkitBackdropFilter: useDivideY ? 'none' : 'blur(16px)',
                ...(useDivideY
                  ? {
                      borderBottom: isLast ? 'none' : `1px solid ${isLuminousBorder ? 'var(--border-ghost, rgba(255, 255, 255, 0.06))' : 'var(--ui-glass-border, rgba(255, 255, 255, 0.15))'}`,
                    }
                  : {
                      ...borderStyle,
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
                    }),
              }}
            >
              {/* Header */}
              <button
                onClick={() => handleToggle(index)}
                className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer"
                style={{ background: 'transparent' }}
                aria-expanded={open}
              >
                <span className="flex items-center gap-3 flex-1 min-w-0">
                  {/* DNA item icon */}
                  {useDNA && iconName && (
                    <span
                      className="material-symbols-outlined flex-shrink-0"
                      style={{
                        color: 'var(--brand-accent, var(--brand-primary, #8b5cf6))',
                        fontSize: '20px',
                      }}
                    >
                      {iconName}
                    </span>
                  )}
                  {/* Completion indicator */}
                  {visited && (
                    <span
                      className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: 'var(--brand-success, rgba(34, 197, 94, 0.2))',
                        border: '1px solid var(--brand-success, rgba(34, 197, 94, 0.4))',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6L5 8.5L9.5 4"
                          stroke="var(--brand-success, #22c55e)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  <span
                    className="text-base font-semibold truncate"
                    style={{ color: 'var(--brand-heading, #ffffff)' }}
                  >
                    {item.title || `Item ${index + 1}`}
                  </span>
                </span>

                {/* Chevron */}
                {renderChevron(open)}
              </button>

              {/* Collapsible content */}
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="content"
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                    variants={contentVariants}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-5 pb-5 text-sm leading-relaxed"
                      style={{
                        color: 'var(--brand-text, rgba(255, 255, 255, 0.8))',
                        borderTop: useDivideY
                          ? 'none'
                          : '1px solid var(--ui-glass-border)',
                        paddingTop: '1rem',
                      }}
                      dangerouslySetInnerHTML={{ __html: item.body || '' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
