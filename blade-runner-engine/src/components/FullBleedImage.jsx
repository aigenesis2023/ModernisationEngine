import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';

export default function FullBleedImage({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const [imgError, setImgError] = useState(false);

  const title = data.displayTitle || '';
  const body = data.body || '';
  const graphic = data._graphic || {};
  const imgSrc = graphic.large || graphic.src || '';
  const overlayPosition = data.overlayPosition || 'center';

  // Parallax effect
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  if (!imgSrc || imgError) return null;

  const alignmentClasses = {
    center: 'items-center justify-center text-center',
    left: 'items-start justify-center text-left pl-8 sm:pl-16',
    right: 'items-end justify-center text-right pr-8 sm:pr-16',
  };

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="relative w-full overflow-hidden"
      style={{ minHeight: '400px', maxHeight: '600px' }}
    >
      {/* Parallax background image */}
      <motion.div
        className="absolute inset-0"
        style={{ y }}
      >
        <img
          src={imgSrc}
          alt={graphic.alt || ''}
          className="w-full h-[120%] object-cover"
          style={{ marginTop: '-10%' }}
          onError={() => setImgError(true)}
        />
      </motion.div>

      {/* Dark overlay with gradient for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Content overlay */}
      {(title || body) && (
        <div
          className={`relative z-10 flex flex-col h-full min-h-[400px] max-h-[600px] px-6 py-16 ${alignmentClasses[overlayPosition] || alignmentClasses.center}`}
        >
          <div className="max-w-2xl">
            {title && (
              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight"
                style={{ color: '#ffffff' }}
              >
                {title}
              </motion.h2>
            )}
            {body && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="text-base sm:text-lg leading-relaxed"
                style={{ color: 'rgba(255, 255, 255, 0.8)' }}
                dangerouslySetInnerHTML={{ __html: body }}
              />
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
}
