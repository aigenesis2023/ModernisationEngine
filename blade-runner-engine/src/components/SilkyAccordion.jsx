import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import useCourseStore from '../store/courseStore';

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
      <div className="flex flex-col gap-3">
        {items.map((item, index) => {
          const open = isOpen(index);
          const visited = everOpened[index] || open;

          return (
            <motion.div
              key={`${data._id}_${index}`}
              custom={index}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={itemVariants}
              className="rounded-xl border overflow-hidden"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderColor: open
                  ? 'var(--brand-accent, rgba(139, 92, 246, 0.5))'
                  : 'rgba(255, 255, 255, 0.08)',
                boxShadow: open
                  ? '0 0 20px rgba(139, 92, 246, 0.08)'
                  : '0 2px 8px rgba(0, 0, 0, 0.2)',
                transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
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
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
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
