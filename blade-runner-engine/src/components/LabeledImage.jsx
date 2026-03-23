import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const fadeIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const markerVariants = {
  hidden: { opacity: 0, scale: 0 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.5 + i * 0.1,
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function LabeledImage({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const instruction = data.instruction || '';
  const graphic = data._graphic || {};
  const markers = data._markers || [];
  const imgSrc = graphic.large || graphic.src || '';

  const [activeMarker, setActiveMarker] = useState(null);
  const [imgError, setImgError] = useState(false);

  if (!imgSrc || imgError) return null;

  return (
    <section ref={ref} className="w-full py-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
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

        {instruction && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="text-sm mb-6 italic"
            style={{ color: 'var(--brand-text-muted)' }}
          >
            {instruction}
          </motion.p>
        )}

        <motion.div
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          variants={fadeIn}
          className="relative rounded-xl overflow-hidden border"
          style={{
            borderColor: 'var(--ui-glass-border)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <img
            src={imgSrc}
            alt={graphic.alt || title || ''}
            className="w-full h-auto block"
            onError={() => setImgError(true)}
          />

          {/* Markers */}
          {markers.map((marker, i) => {
            const isActive = activeMarker === i;
            return (
              <motion.button
                key={i}
                custom={i}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                variants={markerVariants}
                onClick={() => setActiveMarker(isActive ? null : i)}
                className="absolute cursor-pointer"
                style={{
                  left: `${marker.x}%`,
                  top: `${marker.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isActive ? 20 : 10,
                }}
              >
                {/* Pulse ring */}
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{
                    background: 'var(--brand-primary, #8b5cf6)',
                    opacity: isActive ? 0 : 0.3,
                    width: '32px',
                    height: '32px',
                  }}
                />
                {/* Badge */}
                <span
                  className="relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold"
                  style={{
                    background: isActive
                      ? 'var(--brand-primary, #8b5cf6)'
                      : 'var(--brand-gradient, linear-gradient(135deg, var(--brand-primary), var(--brand-accent)))',
                    color: '#ffffff',
                    boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {i + 1}
                </span>
              </motion.button>
            );
          })}

          {/* Tooltip */}
          <AnimatePresence>
            {activeMarker !== null && markers[activeMarker] && (
              <motion.div
                key={activeMarker}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.25 }}
                className="absolute z-30 max-w-xs rounded-xl border p-4"
                style={{
                  left: `${Math.min(75, Math.max(25, markers[activeMarker].x))}%`,
                  top: `${Math.min(85, markers[activeMarker].y + 5)}%`,
                  transform: 'translateX(-50%)',
                  background: 'var(--brand-surface, rgba(10, 10, 26, 0.95))',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderColor: 'var(--brand-primary, #8b5cf6)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                }}
              >
                <h4
                  className="text-sm font-semibold mb-1"
                  style={{ color: 'var(--brand-heading, #ffffff)' }}
                >
                  {markers[activeMarker].label}
                </h4>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                >
                  {markers[activeMarker].body}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
