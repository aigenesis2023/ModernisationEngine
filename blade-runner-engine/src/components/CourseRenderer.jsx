/**
 * CourseRenderer — Recursive JSON → React component tree
 *
 * Deep-scroll single-page experience with visual rhythm:
 * - Alternating section backgrounds for visual separation
 * - Generous padding between sections
 * - Glass card containers for content blocks
 * - Scroll-triggered reveal animations
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
        position: 'fixed', top: 0, left: 0, height: '4px',
        width: `${progress}%`, zIndex: 9999,
        background: 'var(--brand-gradient)',
        transition: 'width 0.15s ease',
        boxShadow: '0 0 12px var(--brand-primary)',
      }}
    />
  );
}

// Article = Section wrapper with alternating backgrounds
function ArticleSection({ article, blocks, components, index }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-5%' });

  // Section-type-specific backgrounds for visual hierarchy
  const classes = article._classes || '';
  const isAssessment = classes.includes('section-assessment');
  const isResults = classes.includes('section-results');
  const isEven = index % 2 === 0;
  const sectionBg = isAssessment || isResults
    ? 'var(--brand-surface, #12121e)'
    : isEven ? 'transparent' : 'var(--section-alt-bg, var(--brand-surface, #12121e))';

  // Hero sections are full-width (no max-width container)
  const isHero = (article._classes || '').includes('section-hero');
  // Check if this section has a hero component (for full-bleed rendering)
  const hasHeroComponent = blocks.some((b) =>
    components.some((c) => c._parentId === b._id && c._component === 'hero')
  );

  if (hasHeroComponent || isHero) {
    // Hero sections render full-width with no padding
    return (
      <motion.section
        ref={ref}
        data-article-id={article._id}
        className="relative"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6 }}
      >
        {blocks.map((block, bi) => (
          <BlockRow
            key={block._id}
            block={block}
            components={components.filter((c) => c._parentId === block._id)}
            blockIndex={bi}
          />
        ))}
      </motion.section>
    );
  }

  return (
    <motion.section
      ref={ref}
      data-article-id={article._id}
      className={`relative ${article._classes || ''}`}
      style={{
        background: sectionBg,
        paddingTop: index === 0 ? 'calc(var(--spacing-section, 80px) * 0.85)' : 'var(--spacing-section, 80px)',
        paddingBottom: 'var(--spacing-section, 80px)',
      }}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
    >
      <div
        className="mx-auto"
        style={{
          maxWidth: 'var(--content-max-width, 1000px)',
          paddingLeft: 'var(--spacing-content-padding, 32px)',
          paddingRight: 'var(--spacing-content-padding, 32px)',
        }}
      >
        {/* Section title with accent bar */}
        {article.displayTitle && (
          <motion.div
            style={{ marginBottom: 'var(--spacing-section-heading, 48px)' }}
            initial={{ opacity: 0, x: -20 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <div
              className="rounded-full mb-5"
              style={{
                width: '48px',
                height: '4px',
                background: 'var(--brand-gradient)',
              }}
            />
            <h2
              className="tracking-tight"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(28px, 4vw, var(--font-h2, 36px))',
                fontWeight: 'var(--font-heading-weight, 700)',
                color: 'var(--brand-primary)',
                lineHeight: 1.15,
              }}
            >
              {article.displayTitle}
            </h2>
          </motion.div>
        )}

        {/* Blocks within this article */}
        <div className="flex flex-col" style={{ gap: 'var(--spacing-block-gap, 40px)' }}>
          {blocks.map((block, bi) => (
            <BlockRow
              key={block._id}
              block={block}
              components={components.filter((c) => c._parentId === block._id)}
              blockIndex={bi}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

// Block = Row of components, wrapped in a glass card
function BlockRow({ block, components, blockIndex }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-5%' });

  // Check if this is a split layout (left + right components)
  const hasLeft = components.some((c) => c._layout === 'left');
  const hasRight = components.some((c) => c._layout === 'right');
  const isSplit = hasLeft && hasRight;

  // Don't wrap components that handle their own styling (have their own glass cards/containers)
  const selfStyledTypes = [
    'graphic', 'hero', 'graphic-text', 'bento', 'media', 'branching', 'narrative',
    'data-table', 'textinput', 'mcq', 'comparison', 'stat-callout', 'full-bleed',
    'labeled-image', 'image-gallery', 'process-flow', 'flashcard', 'video-transcript',
    'tabs', 'timeline', 'pullquote', 'key-term', 'checklist',
  ];
  const isSelfStyled = components.length === 1 && selfStyledTypes.includes(components[0]._component);

  return (
    <motion.div
      ref={ref}
      data-block-id={block._id}
      className={`
        ${isSelfStyled ? '' : 'rounded-2xl'}
        ${isSplit ? 'grid grid-cols-1 md:grid-cols-2 gap-8 items-start' : ''}
      `}
      style={isSelfStyled ? {} : {
        background: 'var(--ui-glass)',
        border: '1px solid var(--ui-glass-border)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: 'var(--ui-card-shadow, 0 4px 16px rgba(0, 0, 0, 0.08))',
        padding: 'var(--spacing-block-padding, 32px)',
      }}
      initial={{ opacity: 0, y: 24 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: blockIndex * 0.06 }}
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
  const { course, contentObjects, articles, blocks, components, brand } = useCourseStore();
  const setScrollProgress = useCourseStore((s) => s.setScrollProgress);
  const logo = brand?.logo;

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

  // Deep-scroll: render all articles from the first page
  const page = contentObjects[0];
  const pageArticles = articles.filter((a) => a._parentId === page?._id);

  return (
    <div className="min-h-screen" style={{ background: 'var(--brand-bg)' }}>
      <ProgressBar />

      {/* Course title header — hide if there's a hero component (it handles its own title) */}
      {!components.some((c) => c._component === 'hero') && (
        <header
          className="pt-20 pb-12 px-6 md:px-10 text-center"
          style={{ background: 'var(--brand-surface)' }}
        >
          <div className="max-w-[1000px] mx-auto">
            {logo?.url && (
              <img
                src={logo.url}
                alt={logo.alt || 'Logo'}
                className="mx-auto mb-8"
                style={{ maxHeight: '60px', maxWidth: '200px', objectFit: 'contain' }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <h1
              className="tracking-tight mb-3"
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'var(--font-h1, 40px)',
                fontWeight: 'var(--font-heading-weight, 700)',
                color: 'var(--brand-text)',
                lineHeight: 1.1,
              }}
            >
              {course.displayTitle || course.title}
            </h1>
            <div
              className="w-20 h-1 rounded-full mx-auto mt-8"
              style={{ background: 'var(--brand-gradient)' }}
            />
          </div>
        </header>
      )}

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
        className="py-16 text-center text-sm"
        style={{
          color: 'var(--brand-text-muted)',
          background: 'var(--brand-surface)',
          borderTop: '1px solid var(--ui-glass-border)',
        }}
      >
        {logo?.url && (
          <img
            src={logo.url}
            alt={logo.alt || 'Logo'}
            className="mx-auto mb-6 opacity-60"
            style={{ maxHeight: '40px', maxWidth: '160px', objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        <p>Modernised with the Blade Runner Engine</p>
      </footer>
    </div>
  );
}
