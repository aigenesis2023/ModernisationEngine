/**
 * RepresentationAgent — AI-driven component selection
 *
 * Analyzes content structure and decides the best UI component
 * based on pedagogical patterns. This is the "intelligent bit."
 */

/**
 * Analyze a slide/block's content and assign the best component type.
 * Returns the Adapt-compatible _component string.
 */
export function chooseComponent(slide, sectionType) {
  const headings = (slide.content?.headings || []).map(textVal);
  const bodyTexts = (slide.content?.bodyTexts || []).map(textVal);
  const callouts = (slide.content?.callouts || []).map(textVal);
  const allTexts = [...bodyTexts, ...callouts];
  const images = slide.content?.images || [];
  const videos = slide.content?.videos || [];
  const layers = slide.layers || [];
  const interactions = slide.interactions || [];
  const formFields = slide.formFields || [];
  const quizData = slide.quizData;

  const totalTextLen = allTexts.reduce((s, t) => s + t.length, 0);
  const hasImages = images.length > 0;
  const hasVideo = videos.length > 0;
  const hasLayers = layers.length > 0;

  // === Decision tree based on content characteristics ===

  // Quiz/Assessment
  if (quizData || slide.type === 'quiz') {
    return 'mcq';
  }

  // Form fields
  if (formFields.length > 0 || slide.presentation === 'form') {
    return 'textinput';
  }

  // Video content
  if (hasVideo) {
    return 'media';
  }

  // Results slide
  if (sectionType === 'results' || slide.type === 'results') {
    return 'assessmentResults';
  }

  // Hero/title slide
  if (sectionType === 'hero' || slide.presentation === 'hero') {
    return 'hero';
  }

  // Interactive layers → choose based on layer characteristics
  if (hasLayers && layers.length >= 2) {
    const avgLayerTextLen = layers.reduce((s, l) => {
      const texts = (l.texts || []).map(textVal);
      return s + texts.reduce((a, t) => a + t.length, 0);
    }, 0) / layers.length;

    // Short layers with images → bento grid
    if (layers.length >= 3 && avgLayerTextLen < 80 && layers.some(l => l.images?.length > 0)) {
      return 'bento';
    }

    // Sequential layers with substantial text → narrative slider
    if (layers.length >= 3 && avgLayerTextLen > 100) {
      return 'narrative';
    }

    // Default interactive → accordion
    return 'accordion';
  }

  // Branching options
  if (interactions.length >= 2 || slide.presentation === 'branching') {
    return 'branching';
  }

  // Image + text → split layout (graphic narrative)
  if (hasImages && totalTextLen > 50) {
    return 'graphic-text';
  }

  // Image only → full graphic
  if (hasImages && totalTextLen < 20) {
    return 'graphic';
  }

  // Many short text items → bento grid
  if (allTexts.length >= 4 && allTexts.every(t => t.length < 100)) {
    return 'bento';
  }

  // Heavy text with headings → structured text
  if (totalTextLen > 300 && headings.length > 0) {
    return 'text-featured';
  }

  // Data/table-like content (multiple items with similar structure)
  if (allTexts.length >= 3 && allTexts.some(t => t.includes(' - ') || t.includes(':'))) {
    return 'data-table';
  }

  // Default → text component
  return 'text';
}

/**
 * Map an entire course plan's sections to component types
 */
export function mapCourseToComponents(coursePlan) {
  const mapping = [];

  for (const section of coursePlan.sections || []) {
    const sectionMapping = {
      sectionId: section.id,
      sectionTitle: section.title,
      sectionType: section.type,
      slides: [],
    };

    for (const slide of section.slides || []) {
      const componentType = chooseComponent(slide, section.type);
      sectionMapping.slides.push({
        slideId: slide.id,
        slideTitle: slide.originalTitle,
        assignedComponent: componentType,
        reasoning: getReasoningForChoice(componentType, slide),
      });
    }

    mapping.push(sectionMapping);
  }

  return mapping;
}

function getReasoningForChoice(type, slide) {
  const reasons = {
    'hero': 'Title/opening slide → full-viewport hero',
    'mcq': 'Quiz data detected → assessment component',
    'textinput': 'Form fields detected → text input component',
    'media': 'Video content detected → media player',
    'accordion': 'Multiple layers with text → expandable sections',
    'bento': 'Short content items → visual grid layout',
    'narrative': 'Sequential layers with rich text → carousel slider',
    'graphic-text': 'Image + text → split layout',
    'graphic': 'Image-focused → full graphic display',
    'branching': 'Interactive options → decision cards',
    'text-featured': 'Long text with headings → structured content',
    'data-table': 'Structured items → table layout',
    'text': 'Standard text content → clean text block',
    'assessmentResults': 'Results/scoring → assessment results display',
  };
  return reasons[type] || 'Default assignment';
}

function textVal(t) {
  if (!t) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'object') return t.content || t.text || String(t);
  return String(t);
}
