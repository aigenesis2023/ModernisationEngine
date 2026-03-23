import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

const fadeInUp = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function TextBlock({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const instruction = data.instruction || '';

  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={fadeInUp}
      className="w-full flex justify-center px-4 sm:px-6 py-12 sm:py-20"
    >
      <div
        className="w-full rounded-xl border p-8 sm:p-12"
        style={{
          maxWidth: '680px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderColor: 'rgba(255, 255, 255, 0.06)',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Heading */}
        {title && (
          <h2
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6 leading-snug"
            style={{ color: 'var(--brand-heading, #ffffff)' }}
          >
            {title}
          </h2>
        )}

        {/* Instruction */}
        {instruction && (
          <p
            className="text-sm mb-4 leading-relaxed"
            style={{ color: 'var(--brand-text-muted, rgba(255, 255, 255, 0.45))' }}
          >
            {instruction}
          </p>
        )}

        {/* Body */}
        {body && (
          <div
            className="text-base sm:text-lg leading-relaxed [&>p]:mb-4 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-6 [&>h3]:mb-3"
            style={{ color: 'var(--brand-text, rgba(255, 255, 255, 0.8))' }}
            dangerouslySetInnerHTML={{ __html: body }}
          />
        )}
      </div>
    </motion.section>
  );
}
