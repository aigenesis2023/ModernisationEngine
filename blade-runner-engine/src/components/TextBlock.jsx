import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';

export default function TextBlock({ data = {} }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  const title = data.displayTitle || '';
  const body = data.body || '';
  const instruction = data.instruction || '';

  if (!title && !body && !instruction) return null;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {title && (
        <h3
          className="text-xl md:text-2xl font-semibold tracking-tight mb-4"
          style={{ color: 'var(--brand-heading, var(--brand-primary))', fontFamily: 'var(--font-heading)' }}
        >
          {title}
        </h3>
      )}

      {instruction && (
        <p
          className="text-sm mb-3 italic"
          style={{ color: 'var(--brand-text-muted)' }}
        >
          {instruction}
        </p>
      )}

      {body && (
        <div
          className="text-base leading-relaxed [&>p]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:mt-4 [&>h3]:mb-2"
          style={{ color: 'var(--brand-text)' }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
    </motion.div>
  );
}
