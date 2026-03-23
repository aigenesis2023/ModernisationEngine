import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const contentVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function TabPanel({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];
  const [activeTab, setActiveTab] = useState(0);

  const currentItem = items[activeTab] || {};

  return (
    <div ref={ref} className="w-full max-w-4xl mx-auto px-4 py-8">
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
          className="text-base leading-relaxed mb-6"
          style={{ color: 'var(--brand-text-muted)' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl border overflow-hidden"
        style={{
          background: 'var(--ui-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'var(--ui-glass-border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Tab buttons */}
        <div
          className="flex overflow-x-auto gap-0 scrollbar-hide"
          style={{
            borderBottom: '2px solid var(--ui-glass-border)',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {items.map((item, i) => {
            const isActive = activeTab === i;
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className="relative px-5 py-4 text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer flex-shrink-0"
                style={{
                  color: isActive
                    ? 'var(--brand-heading, #ffffff)'
                    : 'var(--brand-text-muted, rgba(255, 255, 255, 0.5))',
                  background: 'transparent',
                  transition: 'color 0.2s ease',
                  marginBottom: '-2px',
                  borderBottom: isActive
                    ? '2px solid var(--brand-primary, #8b5cf6)'
                    : '2px solid transparent',
                }}
              >
                {item.title || `Tab ${i + 1}`}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="relative" style={{ minHeight: '120px' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={contentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="p-6 sm:p-8"
            >
              {currentItem._graphic?.large && (
                <div className="mb-6 rounded-lg overflow-hidden">
                  <img
                    src={currentItem._graphic.large}
                    alt={currentItem._graphic.alt || currentItem.title || ''}
                    className="w-full h-auto max-h-80 object-cover"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}
              {currentItem.body && (
                <div
                  className="text-base leading-relaxed [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3"
                  style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                  dangerouslySetInnerHTML={{ __html: currentItem.body }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
