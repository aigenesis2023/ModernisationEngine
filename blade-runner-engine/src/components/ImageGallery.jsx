import { motion, AnimatePresence, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const imageVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: 0.1 + i * 0.08,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

export default function ImageGallery({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const items = data._items || [];

  const [lightboxIndex, setLightboxIndex] = useState(null);

  return (
    <section ref={ref} className="w-full px-4 sm:px-6 py-12 sm:py-20">
      <div className="max-w-6xl mx-auto">
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
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base leading-relaxed mb-8 max-w-2xl"
            style={{ color: 'var(--brand-text-muted)' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}

        {/* Grid */}
        <div
          className="grid gap-4 sm:gap-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}
        >
          {items.map((item, i) => {
            const graphic = item._graphic || {};
            const imgSrc = graphic.large || graphic.src || '';
            if (!imgSrc) return null;

            return (
              <motion.figure
                key={i}
                custom={i}
                initial="hidden"
                animate={isInView ? 'visible' : 'hidden'}
                variants={imageVariants}
                className="group relative rounded-xl overflow-hidden border cursor-pointer"
                style={{
                  borderColor: 'var(--ui-glass-border)',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                }}
                onClick={() => setLightboxIndex(i)}
                whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0, 0, 0, 0.35)' }}
              >
                <img
                  src={imgSrc}
                  alt={graphic.alt || item.caption || ''}
                  className="w-full aspect-[3/2] object-cover"
                  onError={(e) => { e.target.parentElement.style.display = 'none'; }}
                />

                {/* Hover overlay with caption */}
                {item.caption && (
                  <div
                    className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100"
                    style={{
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                      transition: 'opacity 0.3s ease',
                    }}
                  >
                    <p
                      className="text-xs leading-snug"
                      style={{ color: 'rgba(255, 255, 255, 0.9)' }}
                    >
                      {item.caption}
                    </p>
                  </div>
                )}

                {/* Zoom icon */}
                <div
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100"
                  style={{
                    background: 'rgba(0, 0, 0, 0.5)',
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.5" />
                    <path d="M9.5 9.5L13 13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </motion.figure>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0, 0, 0, 0.9)' }}
            onClick={() => setLightboxIndex(null)}
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
              src={items[lightboxIndex]?._graphic?.large || ''}
              alt={items[lightboxIndex]?._graphic?.alt || ''}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Caption */}
            {items[lightboxIndex]?.caption && (
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-8 text-center text-sm max-w-lg"
                style={{ color: 'rgba(255, 255, 255, 0.7)' }}
              >
                {items[lightboxIndex].caption}
              </motion.p>
            )}

            {/* Close button */}
            <button
              className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'rgba(255, 255, 255, 0.1)' }}
              onClick={() => setLightboxIndex(null)}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>

            {/* Nav arrows */}
            {lightboxIndex > 0 && (
              <button
                className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1); }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8l4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
            {lightboxIndex < items.length - 1 && (
              <button
                className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1); }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
