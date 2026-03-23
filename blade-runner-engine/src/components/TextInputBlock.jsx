import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const inputVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.2 + i * 0.1,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function TextInputBlock({ data = {} }) {
  var ref = useRef(null);
  var isInView = useInView(ref, { once: true, amount: 0.2 });
  const { style, rules, resolveSurface, hasDNA } = useComponentStyle('textinput');

  var title = data.displayTitle || '';
  var body = data.body || '';
  var items = data._items || [];
  var [values, setValues] = useState({});
  var [focusedIndex, setFocusedIndex] = useState(-1);

  function handleChange(index, value) {
    setValues(function (prev) {
      var next = Object.assign({}, prev);
      next[index] = value;
      return next;
    });
  }

  // DNA-driven values
  const labelTypo = hasDNA && rules?.typography?.label ? rules.typography.label : null;
  const inputBg = hasDNA ? resolveSurface('surface-container-lowest') : null;
  const borderStyle = hasDNA && rules?.borderStyle ? rules.borderStyle : null;
  const ghostBorder = borderStyle
    ? `1px solid rgba(255, 255, 255, ${borderStyle.outlineOpacity || 0.06})`
    : null;

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className="w-full flex justify-center py-6 sm:py-8"
    >
      <div
        className="w-full rounded-xl p-8 sm:p-12"
        style={{
          maxWidth: '780px',
          background: 'var(--ui-glass)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: hasDNA && ghostBorder ? ghostBorder : '1px solid var(--ui-glass-border)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Heading */}
        {title && (
          <h2
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 leading-snug"
            style={{ color: 'var(--brand-heading, #ffffff)' }}
          >
            {title}
          </h2>
        )}

        {/* Body / instruction text */}
        {body && (
          <div
            className="text-base leading-relaxed mb-8 [&>p]:mb-3"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.6))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        {/* Input fields */}
        <div className="flex flex-col gap-5">
          {items.map(function (item, i) {
            var isFocused = focusedIndex === i;
            return (
              <motion.div
                key={i}
                custom={i}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                variants={inputVariants}
              >
                {/* Label */}
                {item.prefix && (
                  <label
                    className="block mb-2"
                    style={hasDNA && labelTypo ? {
                      color: 'var(--brand-primary, #8b5cf6)',
                      fontSize: labelTypo.size || '0.75rem',
                      fontWeight: labelTypo.weight || 700,
                      textTransform: labelTypo.transform || 'uppercase',
                      letterSpacing: labelTypo.tracking || '0.05em',
                    } : {
                      color: 'var(--brand-text, rgba(255, 255, 255, 0.85))',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      letterSpacing: '0.025em',
                    }}
                  >
                    {item.prefix}
                  </label>
                )}

                {/* Input */}
                <input
                  type="text"
                  placeholder={item.placeholder || ''}
                  value={values[i] || ''}
                  onChange={function (e) { handleChange(i, e.target.value); }}
                  onFocus={function () { setFocusedIndex(i); }}
                  onBlur={function () { setFocusedIndex(-1); }}
                  className="w-full rounded-lg px-4 py-3 text-base outline-none"
                  style={{
                    background: hasDNA && inputBg ? inputBg : 'var(--ui-glass)',
                    border: isFocused
                      ? '1px solid var(--brand-primary, #8b5cf6)'
                      : (hasDNA && ghostBorder ? ghostBorder : '1px solid rgba(255, 255, 255, 0.08)'),
                    color: 'var(--brand-text, rgba(255, 255, 255, 0.9))',
                    boxShadow: isFocused
                      ? '0 0 0 3px rgba(139, 92, 246, 0.15), 0 0 20px rgba(139, 92, 246, 0.1)'
                      : 'none',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  }}
                />
              </motion.div>
            );
          })}

          {/* Submit button */}
          {items.length > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
              transition={{ delay: 0.3 + items.length * 0.1, duration: 0.4 }}
              className={hasDNA
                ? 'w-full mt-2 px-6 py-3 font-black tracking-widest uppercase cursor-pointer'
                : 'self-start mt-2 px-6 py-3 text-sm font-medium tracking-wide cursor-pointer'}
              style={{
                borderRadius: 'var(--ui-button-radius, 9999px)',
                background: 'var(--brand-primary, #8b5cf6)',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 2px 12px rgba(139, 92, 246, 0.3)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                ...(hasDNA ? { fontSize: '0.875rem' } : {}),
              }}
              whileHover={{
                scale: 1.03,
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
              }}
              whileTap={{ scale: 0.97 }}
            >
              Submit
            </motion.button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
