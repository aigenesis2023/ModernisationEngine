/**
 * Course Store — Zustand state management
 *
 * Single source of truth for the entire course.
 * Any mutation to this store triggers instant re-render.
 * Also exposed as window.courseData for AI editing.
 */
import { create } from 'zustand';

const useCourseStore = create((set, get) => ({
  // Course data (Adapt JSON schema)
  course: null,
  contentObjects: [],
  articles: [],
  blocks: [],
  components: [],

  // Brand/theme
  brand: null,

  // UI state
  scrollProgress: 0,
  activeAccordions: {},
  quizAnswers: {},
  completedSections: {},

  // Load course data
  loadCourse: (data) => {
    set({
      course: data.course,
      contentObjects: data.contentObjects || [],
      articles: data.articles || [],
      blocks: data.blocks || [],
      components: data.components || [],
    });
    // Expose to window for AI editing
    window.courseData = data;
  },

  // Load brand
  loadBrand: (brand) => set({ brand }),

  // Update scroll progress
  setScrollProgress: (progress) => set({ scrollProgress: progress }),

  // Toggle accordion
  toggleAccordion: (componentId, itemIndex) => set((state) => {
    const key = `${componentId}_${itemIndex}`;
    const active = { ...state.activeAccordions };
    active[key] = !active[key];
    return { activeAccordions: active };
  }),

  // Submit quiz answer
  submitAnswer: (componentId, answerIndex) => set((state) => ({
    quizAnswers: { ...state.quizAnswers, [componentId]: answerIndex }
  })),

  // Mark section complete
  completeSection: (articleId) => set((state) => ({
    completedSections: { ...state.completedSections, [articleId]: true }
  })),

  // Update a single component (for AI editing)
  updateComponent: (componentId, updates) => set((state) => ({
    components: state.components.map((c) =>
      c._id === componentId ? { ...c, ...updates } : c
    )
  })),

  // Get blocks for an article
  getBlocksForArticle: (articleId) => {
    return get().blocks.filter((b) => b._parentId === articleId);
  },

  // Get components for a block
  getComponentsForBlock: (blockId) => {
    return get().components.filter((c) => c._parentId === blockId);
  },
}));

export default useCourseStore;
