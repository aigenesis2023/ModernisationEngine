import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const contentVariants = {
  enter: { opacity: 0, y: 12 },
  center: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function TabPanel({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const { style, rules, resolveSurface, hasDNA } = useComponentStyle('tabs');

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];
  const [activeTab, setActiveTab] = useState(0);
  const [hoveredItem, setHoveredItem] = useState(-1);

  const currentItem = items[activeTab] || {};

  // DNA-driven values
  const tabBarBg = hasDNA && style?.container?.primaryBg
    ? resolveSurface(style.container.primaryBg)
    : null;
  const contentBg = hasDNA ? resolveSurface('surface-container-low') : null;
  const hoverBg = hasDNA && style?.treatments?.hoverBg
    ? resolveSurface(style.treatments.hoverBg)
    : null;
  const hasMoreHoriz = hasDNA && style?.icons?.includes('more_horiz');
  const labelTypo = hasDNA && rules?.typography?.label ? rules.typography.label : null;
  const borderStyle = hasDNA && rules?.borderStyle ? rules.borderStyle : null;

  // Ghost border for DNA mode
  const ghostBorder = borderStyle
    ? `1px solid rgba(255, 255, 255, ${borderStyle.outlineOpacity || 0.06})`
    : null;

  // Parse content body into individual items for numbered display
  const contentItems = (() => {
    if (!currentItem.body) return [];
    const div = typeof document !== 'undefined' ? document.createElement('div') : null;
    if (!div) return [currentItem.body];
    div.innerHTML = currentItem.body;
    const items = [];
    div.querySelectorAll('li, p').forEach(el => {
      const text = el.textContent.trim();
      if (text) items.push(text);
    });
    return items.length > 0 ? items : [currentItem.body];
  })();

  return (
    <div ref={ref} className="w-full max-w-4xl mx-auto py-6 sm:py-8">
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
        className="rounded-2xl overflow-hidden"
        style={hasDNA ? {
          background: contentBg || 'var(--ui-glass)',
          border: ghostBorder || '1px solid var(--ui-glass-border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        } : {
          background: 'var(--ui-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--ui-glass-border)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Tab buttons */}
        <div
          className={hasDNA ? 'flex justify-center p-3' : 'flex overflow-x-auto gap-2 p-3'}
          style={hasDNA ? {
            borderBottom: ghostBorder || '1px solid var(--ui-glass-border)',
          } : {
            borderBottom: '1px solid var(--ui-glass-border)',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          <div
            className={hasDNA ? 'inline-flex gap-1 rounded-full p-1 overflow-x-auto' : 'flex gap-2 w-full'}
            style={hasDNA ? {
              background: tabBarBg || 'rgba(255, 255, 255, 0.04)',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
            } : {
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
                  className="px-5 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer flex-shrink-0 rounded-full"
                  style={hasDNA ? {
                    color: isActive
                      ? '#ffffff'
                      : 'var(--brand-text-muted, rgba(255, 255, 255, 0.5))',
                    background: isActive
                      ? 'var(--brand-primary, #6366f1)'
                      : 'transparent',
                    border: 'none',
                    transition: 'all 0.2s ease',
                  } : {
                    color: isActive
                      ? '#ffffff'
                      : 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))',
                    background: isActive
                      ? 'var(--brand-primary, #6366f1)'
                      : 'rgba(255, 255, 255, 0.06)',
                    border: isActive
                      ? 'none'
                      : '1px solid var(--ui-glass-border, rgba(255, 255, 255, 0.1))',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {item.title || `Tab ${i + 1}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="relative" style={{ minHeight: '160px' }}>
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

              {/* DNA mode: numbered content items with hover and trailing icon */}
              {hasDNA && labelTypo && contentItems.length > 1 ? (
                <div className="flex flex-col gap-2">
                  {contentItems.map((text, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-4 rounded-xl px-4 py-3"
                      style={{
                        background: hoveredItem === idx && hoverBg
                          ? hoverBg
                          : 'transparent',
                        transition: 'background 0.2s ease',
                        cursor: 'default',
                      }}
                      onMouseEnter={() => setHoveredItem(idx)}
                      onMouseLeave={() => setHoveredItem(-1)}
                    >
                      {/* Numbered index */}
                      <span
                        className="flex-shrink-0 mt-0.5"
                        style={{
                          color: 'var(--brand-primary, #6366f1)',
                          fontSize: labelTypo.size || '0.75rem',
                          fontWeight: labelTypo.weight || 700,
                          textTransform: labelTypo.transform || 'uppercase',
                          letterSpacing: labelTypo.tracking || '0.05em',
                          lineHeight: '1.6',
                          minWidth: '1.5rem',
                        }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      {/* Content text */}
                      <span
                        className="flex-1 text-base leading-relaxed"
                        style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                      >
                        {typeof text === 'string' && text.startsWith('<')
                          ? <span dangerouslySetInnerHTML={{ __html: text }} />
                          : text}
                      </span>
                      {/* Trailing more_horiz icon */}
                      {hasMoreHoriz && (
                        <span
                          className="material-symbols-outlined flex-shrink-0 mt-0.5"
                          style={{
                            fontSize: '18px',
                            color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.4))',
                            opacity: hoveredItem === idx ? 1 : 0.4,
                            transition: 'opacity 0.2s ease',
                          }}
                        >
                          more_horiz
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Default: render body as HTML */
                currentItem.body && (
                  <div
                    className="text-base leading-relaxed [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3"
                    style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                    dangerouslySetInnerHTML={{ __html: currentItem.body }}
                  />
                )
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
