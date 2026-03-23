import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.9 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: 0.15 + i * 0.1,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

/**
 * Parse options from body HTML.
 * Handles: <li> items, <p> elements, or plain text lines.
 */
function parseOptions(html) {
  if (!html) return [];

  var temp = document.createElement('div');
  temp.innerHTML = html;

  // Try <li> elements first
  var listItems = temp.querySelectorAll('li');
  if (listItems.length > 0) {
    var options = [];
    listItems.forEach(function (li) {
      var text = li.textContent.trim();
      if (text) options.push(text);
    });
    return options;
  }

  // Try <p> elements
  var paragraphs = temp.querySelectorAll('p');
  if (paragraphs.length > 1) {
    var opts = [];
    paragraphs.forEach(function (p) {
      var text = p.textContent.trim();
      if (text) opts.push(text);
    });
    return opts;
  }

  // Fall back to line-break splitting
  var raw = temp.innerHTML.replace(/<br\s*\/?>/gi, '\n');
  var textContent = raw.replace(/<[^>]+>/g, '');
  return textContent.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
}

export default function BranchingCards({ data = {} }) {
  var ref = useRef(null);
  var isInView = useInView(ref, { once: true, amount: 0.15 });
  var [selected, setSelected] = useState(-1);

  var title = data.displayTitle || '';
  var body = data.body || '';
  var options = parseOptions(body);

  return (
    <motion.section
      ref={ref}
      className="w-full px-4 sm:px-6 py-12 sm:py-20"
    >
      <div className="max-w-5xl mx-auto">
        {/* Section heading */}
        {title && (
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-8 leading-snug text-center"
            style={{ color: 'var(--brand-heading, #ffffff)' }}
          >
            {title}
          </motion.h2>
        )}

        {/* Cards grid */}
        <div
          className="grid gap-4 sm:gap-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {options.map(function (option, i) {
            var isSelected = selected === i;

            return (
              <motion.button
                key={i}
                custom={i}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                variants={cardVariants}
                onClick={function () { setSelected(i); }}
                className="relative text-left rounded-xl border p-6 sm:p-8 cursor-pointer group"
                style={{
                  background: isSelected
                    ? 'rgba(139, 92, 246, 0.08)'
                    : 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  borderColor: isSelected
                    ? 'var(--brand-primary, #8b5cf6)'
                    : 'rgba(255, 255, 255, 0.06)',
                  boxShadow: isSelected
                    ? '0 0 0 1px var(--brand-primary, #8b5cf6), 0 8px 32px rgba(139, 92, 246, 0.15)'
                    : '0 4px 24px rgba(0, 0, 0, 0.2)',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  transition: 'all 0.3s ease',
                }}
                whileHover={!isSelected ? {
                  y: -4,
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)',
                } : undefined}
              >
                {/* Gradient border on hover */}
                <div
                  className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{
                    opacity: isSelected ? 0 : undefined,
                    background: 'linear-gradient(135deg, var(--brand-primary, #8b5cf6), var(--brand-accent, #06b6d4)) border-box',
                    mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                    WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'xor',
                    WebkitMaskComposite: 'xor',
                    padding: '1px',
                    transition: 'opacity 0.3s ease',
                  }}
                  // Show gradient border on hover via group-hover
                />

                {/* Option number */}
                <span
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mb-4"
                  style={{
                    background: isSelected
                      ? 'var(--brand-primary, #8b5cf6)'
                      : 'rgba(255, 255, 255, 0.06)',
                    color: isSelected
                      ? '#ffffff'
                      : 'var(--brand-text-muted, rgba(255, 255, 255, 0.5))',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {String.fromCharCode(65 + i)}
                </span>

                {/* Option text */}
                <p
                  className="text-base sm:text-lg leading-relaxed"
                  style={{
                    color: isSelected
                      ? 'var(--brand-heading, #ffffff)'
                      : 'var(--brand-text, rgba(255, 255, 255, 0.8))',
                    transition: 'color 0.3s ease',
                  }}
                >
                  {option}
                </p>

                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-4 right-4"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: 'var(--brand-primary, #8b5cf6)' }}
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
