/**
 * Blade Runner Engine — Main App
 *
 * Loads course data from window.courseData (injected at build time)
 * and renders through the CourseRenderer.
 *
 * The ComponentStyleProvider bridges Stitch's per-component design
 * patterns to React components. Every component reads its visual
 * config from the provider — icons, backgrounds, badges, layouts
 * are all Stitch-designed and course-specific.
 */
import { useEffect, useState } from 'react';
import useCourseStore from './store/courseStore';
import { applyBrand, applyDesignDNA } from './theme/ThemeEngine';
import { ComponentStyleProvider } from './theme/ComponentStyleProvider';
import CourseRenderer from './components/CourseRenderer';

function App() {
  const loadCourse = useCourseStore((s) => s.loadCourse);
  const loadBrand = useCourseStore((s) => s.loadBrand);
  const [designDNA, setDesignDNA] = useState(null);

  useEffect(() => {
    // Load course data from global (injected by the engine pipeline)
    if (window.courseData) {
      loadCourse(window.courseData);

      // Apply brand if available
      if (window.brandData) {
        loadBrand(window.brandData);
        applyBrand(window.brandData);
      }

      // Apply Stitch Design DNA if available (enhanced tokens overlay)
      if (window.designDNA) {
        applyDesignDNA(window.designDNA);
        setDesignDNA(window.designDNA);
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

  return (
    <ComponentStyleProvider designDNA={designDNA}>
      <CourseRenderer />
    </ComponentStyleProvider>
  );
}

export default App;
