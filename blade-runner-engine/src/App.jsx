/**
 * Blade Runner Engine — Main App
 *
 * Loads course data from window.courseData (injected at build time)
 * and renders through the CourseRenderer.
 */
import { useEffect } from 'react';
import useCourseStore from './store/courseStore';
import { applyBrand } from './theme/ThemeEngine';
import CourseRenderer from './components/CourseRenderer';

function App() {
  const loadCourse = useCourseStore((s) => s.loadCourse);
  const loadBrand = useCourseStore((s) => s.loadBrand);

  useEffect(() => {
    // Load course data from global (injected by the engine pipeline)
    if (window.courseData) {
      loadCourse(window.courseData);

      // Apply brand if available
      if (window.brandData) {
        loadBrand(window.brandData);
        applyBrand(window.brandData);
      }
    }

    // Listen for live updates (AI editing bridge)
    window.addEventListener('courseDataUpdate', (e) => {
      if (e.detail) {
        loadCourse(e.detail);
      }
    });

    window.addEventListener('brandDataUpdate', (e) => {
      if (e.detail) {
        loadBrand(e.detail);
        applyBrand(e.detail);
      }
    });
  }, [loadCourse, loadBrand]);

  return <CourseRenderer />;
}

export default App;
