import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const scaleUp = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const captionFade = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { delay: 0.3, duration: 0.5, ease: 'easeOut' },
  },
};

export default function GraphicBlock({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.15 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const graphic = data._graphic || {};
  const imgSrc = graphic.large || graphic.small || '';
  const altText = graphic.alt || title || '';

  if (!imgSrc) return null;

  return (
    <motion.figure
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={scaleUp}
      className="w-full px-4 sm:px-6 py-10 sm:py-16 flex flex-col items-center"
    >
      {/* Title above image */}
      {title && (
        <h2
          className="text-xl sm:text-2xl font-semibold tracking-tight mb-6 text-center max-w-2xl"
          style={{ color: 'var(--brand-heading, #ffffff)' }}
        >
          {title}
        </h2>
      )}

      {/* Image container with hover zoom */}
      <div
        className="w-full max-w-4xl overflow-hidden"
        style={{ borderRadius: 'var(--ui-radius, 12px)' }}
      >
        <motion.img
          src={imgSrc}
          alt={altText}
          className="w-full h-auto block"
          style={{ borderRadius: 'var(--ui-radius, 12px)' }}
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Caption from body */}
      {body && (
        <motion.figcaption
          variants={captionFade}
          className="mt-4 text-sm text-center max-w-xl leading-relaxed"
          style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.5))' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
    </motion.figure>
  );
}
