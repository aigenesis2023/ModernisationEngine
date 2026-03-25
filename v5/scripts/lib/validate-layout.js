/**
 * Shared layout validation — used by both design-course.js (SCORM path)
 * and generate-layout.js (AI-first path).
 *
 * SCORM-specific checks (pathGroups, question banks) only run when
 * a content-bucket.json exists with those fields.
 */

const fs = require('fs');
const path = require('path');

const VALID_TYPES = [
  'hero', 'text', 'graphic', 'graphic-text', 'accordion', 'mcq',
  'narrative', 'bento', 'data-table', 'media', 'textinput', 'branching',
  'timeline', 'comparison', 'stat-callout', 'pullquote', 'key-term',
  'checklist', 'tabs', 'flashcard', 'labeled-image', 'process-flow',
  'image-gallery', 'full-bleed', 'video-transcript', 'path-selector',
];

/**
 * Validate a course-layout.json object.
 *
 * @param {object} layout - The parsed course-layout.json
 * @param {object} [options] - Optional config
 * @param {string} [options.contentBucketPath] - Path to content-bucket.json for SCORM checks
 * @returns {{ valid: boolean, errors: string[], stats: object }}
 */
function validateLayout(layout, options = {}) {
  const errors = [];

  if (!layout.course?.title) errors.push('Missing course.title');
  if (!layout.sections || !Array.isArray(layout.sections)) errors.push('Missing sections array');
  if (layout.sections?.length < 2) errors.push('Need at least 2 sections');

  const componentIds = new Set();
  const sectionIds = new Set();
  let totalComponents = 0;
  let totalImages = 0;
  const typesUsed = new Set();

  for (const section of (layout.sections || [])) {
    if (!section.sectionId) errors.push('Section missing sectionId');
    if (sectionIds.has(section.sectionId)) errors.push(`Duplicate sectionId: ${section.sectionId}`);
    sectionIds.add(section.sectionId);

    let prevType = null;
    for (const comp of (section.components || [])) {
      totalComponents++;

      if (!comp.componentId) errors.push('Component missing componentId');
      if (componentIds.has(comp.componentId)) errors.push(`Duplicate componentId: ${comp.componentId}`);
      componentIds.add(comp.componentId);

      if (!comp.type) errors.push(`Component ${comp.componentId} missing type`);
      if (comp.type && !VALID_TYPES.includes(comp.type)) {
        errors.push(`Unknown component type: ${comp.type}`);
      }

      if (comp.type) typesUsed.add(comp.type);

      // Check consecutive same types
      if (comp.type === prevType) {
        errors.push(`Consecutive same type "${comp.type}" in section ${section.sectionId}`);
      }
      prevType = comp.type;

      if (comp.imagePrompt) totalImages++;
      if (comp.imagePrompts) totalImages += comp.imagePrompts.length;
    }
  }

  // Check hero exists as first component
  const firstComp = layout.sections?.[0]?.components?.[0];
  if (firstComp?.type !== 'hero') {
    errors.push('First component must be type "hero"');
  }

  // ── SCORM-specific validation (only when content-bucket exists) ────
  const cbPath = options.contentBucketPath || path.resolve('v5/output/content-bucket.json');
  let contentBucket = null;
  try {
    if (fs.existsSync(cbPath)) {
      contentBucket = JSON.parse(fs.readFileSync(cbPath, 'utf-8'));
    }
  } catch {}

  if (contentBucket?.pathGroups?.length > 0) {
    const allComps = (layout.sections || []).flatMap(s => s.components || []);
    const hasPathSelector = allComps.some(c => c.type === 'path-selector');
    if (!hasPathSelector) {
      errors.push('pathGroups detected in content-bucket but no path-selector component in layout');
    }

    // Collect valid path variable names
    const validVars = new Set();
    for (const pg of contentBucket.pathGroups) {
      for (const opt of pg.options || []) {
        if (opt.variable) validVars.add(opt.variable);
      }
    }

    // Validate showIf references
    for (const section of (layout.sections || [])) {
      if (section.showIf) {
        for (const varName of Object.keys(section.showIf)) {
          if (!validVars.has(varName)) {
            errors.push(`Section ${section.sectionId} showIf references unknown variable: ${varName}`);
          }
        }
      }
      for (const comp of (section.components || [])) {
        if (comp.showIf) {
          for (const varName of Object.keys(comp.showIf)) {
            if (!validVars.has(varName)) {
              errors.push(`Component ${comp.componentId} showIf references unknown variable: ${varName}`);
            }
          }
        }
      }
    }

    // Check each path has at least one section or component
    for (const varName of validVars) {
      const hasContent = (layout.sections || []).some(s =>
        (s.showIf && varName in s.showIf) ||
        (s.components || []).some(c => c.showIf && varName in c.showIf)
      );
      if (!hasContent) {
        errors.push(`Path variable "${varName}" has no showIf content in the layout`);
      }
    }
  }

  // MCQ count vs question bank questions
  if (contentBucket?.questionBanks?.questions?.length > 0) {
    const allComps = (layout.sections || []).flatMap(s => s.components || []);
    const mcqCount = allComps.filter(c => c.type === 'mcq').length;
    const qbCount = contentBucket.questionBanks.questions.length;
    if (mcqCount < Math.ceil(qbCount * 0.5)) {
      errors.push(`Content bucket has ${qbCount} unique question bank questions but layout only has ${mcqCount} MCQ components — significant content loss`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      totalComponents,
      totalImages,
      sections: layout.sections?.length || 0,
      typesUsed: typesUsed.size,
      typeList: [...typesUsed].sort(),
    },
  };
}

module.exports = { validateLayout, VALID_TYPES };
