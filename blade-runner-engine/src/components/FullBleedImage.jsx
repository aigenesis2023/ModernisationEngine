import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import { useComponentStyle } from '../theme/ComponentStyleProvider';

export default function FullBleedImage({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });
  const [imgError, setImgError] = useState(false);
  const { style, hasDNA } = useComponentStyle('full-bleed');

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

  // DNA-driven gradient direction
  const gradientDir = hasDNA && style?.treatments?.overlayGradientDirection
    ? style.treatments.overlayGradientDirection
    : null;

  // Map direction codes to CSS gradient direction
  const gradientMap = {
    r: 'to right',
    l: 'to left',
    b: 'to bottom',
    t: 'to top',
    br: 'to bottom right',
    bl: 'to bottom left',
  };
  const cssGradientDir = gradientDir ? (gradientMap[gradientDir] || 'to bottom') : 'to bottom';

  // DNA: When gradient is left-to-right ('r'), anchor text to left
  const isFromLeft = gradientDir === 'r';
  const dnaOverlayPosition = hasDNA && isFromLeft ? 'left' : overlayPosition;

  // DNA-driven title weight
  const titleWeight = hasDNA && style?.typography?.titleWeight
    ? style.typography.titleWeight
    : 'font-bold';

  // DNA: larger title size
  const titleSizeClass = hasDNA
    ? 'text-4xl sm:text-5xl md:text-6xl'
    : 'text-3xl sm:text-4xl md:text-5xl';

  const alignmentClasses = {
    center: 'items-center justify-center text-center',
    left: 'items-start justify-center text-left pl-8 sm:pl-16',
    right: 'items-end justify-center text-right pr-8 sm:pr-16',
  };

  // Build gradient overlay
  const overlayGradient = hasDNA && gradientDir
    ? `linear-gradient(${cssGradientDir}, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 100%)`
    : 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.6) 100%)';

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
        style={{ background: overlayGradient }}
      />

      {/* Content overlay */}
      {(title || body) && (
        <div
          className={`relative z-10 flex flex-col h-full min-h-[400px] max-h-[600px] px-6 py-16 ${alignmentClasses[dnaOverlayPosition] || alignmentClasses.center}`}
        >
          <div className="max-w-2xl">
            {title && (
              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className={`${titleSizeClass} ${titleWeight} tracking-tight mb-4 leading-tight`}
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
