import { motion, useInView } from 'framer-motion';
import { useRef, useState } from 'react';

const textVariants = {
  hidden: { opacity: 0, x: -32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const imageVariants = {
  hidden: { opacity: 0, x: 32, scale: 0.95 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function GraphicText({ data = {} }) {
  var ref = useRef(null);
  var isInView = useInView(ref, { once: true, amount: 0.2 });
  var [imgError, setImgError] = useState(false);

  var title = data.displayTitle || '';
  var body = data.body || '';
  var graphic = data._graphic || null;
  var imgSrc = graphic ? (graphic.large || graphic.src || '') : '';
  var imgAlt = graphic ? (graphic.alt || title || '') : '';
  var showImage = imgSrc && !imgError;
  var imageOnLeft = data._imageAlign === 'left';

  return (
    <motion.section
      ref={ref}
      className="w-full px-4 sm:px-6 py-12 sm:py-20"
    >
      <div
        className="max-w-5xl mx-auto rounded-xl border overflow-hidden"
        style={{
          background: 'var(--ui-glass, rgba(255, 255, 255, 0.03))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'var(--ui-glass-border, rgba(255, 255, 255, 0.06))',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div
          className="graphic-text-grid"
          style={{
            display: 'grid',
            gap: 0,
            gridTemplateColumns: showImage ? '1fr 1fr' : '1fr',
          }}
        >
          {/* Text column */}
          <motion.div
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={textVariants}
            className="flex flex-col justify-center p-8 sm:p-12"
            style={{ order: imageOnLeft ? 2 : 1 }}
          >
            {title && (
              <h2
                className="text-2xl sm:text-3xl font-semibold tracking-tight mb-5 leading-snug"
                style={{ color: 'var(--brand-heading, #ffffff)' }}
              >
                {title}
              </h2>
            )}

            {body && (
              <div
                className="text-base sm:text-lg leading-relaxed [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-2"
                style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}
          </motion.div>

          {/* Image column */}
          {showImage && (
            <motion.div
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              variants={imageVariants}
              className="relative min-h-[240px] sm:min-h-[360px]"
              style={{ order: imageOnLeft ? 1 : 2 }}
            >
              <img
                src={imgSrc}
                alt={imgAlt}
                className="absolute inset-0 w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
              {/* Subtle inner shadow for depth */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: 'inset -8px 0 24px rgba(0, 0, 0, 0.3)',
                }}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Scoped responsive stacking for this component only */}
      <style>{`
        @media (max-width: 639px) {
          .graphic-text-grid { grid-template-columns: 1fr !important; }
          .graphic-text-grid > *:first-child { order: 2 !important; }
          .graphic-text-grid > *:last-child { order: 1 !important; }
        }
      `}</style>
    </motion.section>
  );
}
