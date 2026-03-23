/**
 * CourseRenderer — Recursive JSON → React component tree
 *
 * Takes the Adapt JSON hierarchy and renders it as a scrollable
 * deep-scroll experience using the Component Registry.
 *
 * Hierarchy: Course → Page → Article → Block → Component
 * For deep-scroll: single page, articles = sections, blocks = rows
 */
import { motion, useInView } from 'framer-motion';
import { useRef, useEffect } from 'react';
import useCourseStore from '../store/courseStore';
import { getComponent } from './ComponentRegistry';

// Scroll progress tracker
function ProgressBar() {
  const progress = useCourseStore((s) => s.scrollProgress);
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, height: '3px',
        width: `${progress}%`, zIndex: 9999,
        background: 'var(--brand-gradient)',
        transition: 'width 0.15s ease',
      }}
    />
  );
}

// Article = Section wrapper
function ArticleSection({ article, blocks, components, index }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-10%' });

  return (
    <motion.section
      ref={ref}
      data-article-id={article._id}
      className={`relative py-16 md:py-24 ${article._classes || ''}`}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6, delay: 0.1 }}
    >
      <div className="max-w-[900px] mx-auto px-5 md:px-8">
        {/* Section title */}
        {article.displayTitle && (
          <motion.h2
            className="text-3xl md:text-4xl font-bold mb-8"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--brand-primary)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {article.displayTitle}
          </motion.h2>
        )}

        {/* Blocks within this article */}
        {blocks.map((block, bi) => (
          <BlockRow
            key={block._id}
            block={block}
            components={components.filter((c) => c._parentId === block._id)}
            blockIndex={bi}
          />
        ))}
      </div>

      {/* Section divider */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-px"
        style={{ background: 'var(--ui-glass-border)' }}
      />
    </motion.section>
  );
}

// Block = Row of components
function BlockRow({ block, components, blockIndex }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-5%' });

  // Check if this is a split layout (left + right components)
  const hasLeft = components.some((c) => c._layout === 'left');
  const hasRight = components.some((c) => c._layout === 'right');
  const isSplit = hasLeft && hasRight;

  return (
    <motion.div
      ref={ref}
      data-block-id={block._id}
      className={`mb-8 ${isSplit ? 'grid grid-cols-1 md:grid-cols-2 gap-8 items-center' : ''}`}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: blockIndex * 0.08 }}
    >
      {components.map((comp) => {
        const Component = getComponent(comp._component);
        return (
          <div
            key={comp._id}
            data-component-id={comp._id}
            data-component-type={comp._component}
          >
            <Component data={comp} />
          </div>
        );
      })}
    </motion.div>
  );
}

// Main Course Renderer
export default function CourseRenderer() {
  const { course, contentObjects, articles, blocks, components } = useCourseStore();
  const setScrollProgress = useCourseStore((s) => s.setScrollProgress);

  // Track scroll progress
  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [setScrollProgress]);

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
            style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }}
          />
          <p style={{ color: 'var(--brand-text-muted)' }}>Loading course...</p>
        </div>
      </div>
    );
  }

  // For deep-scroll: we render all articles from the first page
  const page = contentObjects[0];
  const pageArticles = articles.filter((a) => a._parentId === page?._id);

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-bg)' }}>
      <ProgressBar />

      {/* Course content */}
      <main>
        {pageArticles.map((article, index) => {
          const articleBlocks = blocks.filter((b) => b._parentId === article._id);
          return (
            <ArticleSection
              key={article._id}
              article={article}
              blocks={articleBlocks}
              components={components}
              index={index}
            />
          );
        })}
      </main>

      {/* Footer */}
      <footer
        className="py-12 text-center text-sm"
        style={{ color: 'var(--brand-text-muted)', borderTop: '1px solid var(--ui-glass-border)' }}
      >
        <p>Modernised with the Blade Runner Engine</p>
      </footer>
    </div>
  );
}
