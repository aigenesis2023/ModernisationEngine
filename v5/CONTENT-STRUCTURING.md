# Content Structuring

> **Status:** Implemented — dual-path content structuring (AI-first + SCORM). AI-first V2 rework with emotional arc, structural archetypes, and brand voice calibration.
> **Last updated:** 2026-03-28

This document covers how content gets transformed into a structured course layout (`course-layout.json`). Two paths exist:

1. **AI-First Path (primary):** Raw research → creative instructional design with emotional arc
2. **SCORM Import Path (legacy):** Extracted SCORM content → logic-aware restructuring

Both paths produce the same `course-layout.json` format for the shared build pipeline.

---

## AI-First Path — Creative Course Design

**Input:** `knowledge-base.json` (flat research) + `brand-design.md` (voice calibration) + `brand-profile.json`
**Output:** `course-layout.json` (structured sections, components, assessments)

The AI generation engine (`generation-engine.md`) acts as a senior instructional designer:

1. **Reads the brand brief** to calibrate writing voice (playful/corporate/technical/warm)
2. **Plans an emotional arc:** Hook (curiosity) → Foundation (context) → Challenge (struggle) → Insight (aha) → Application (ownership)
3. **Plans density rhythm:** Breather sections (1-2 components), standard (3-4), deep dives (5-7)
4. **Remixes structural archetypes** (The Deep Dive, The Challenge, The Overview, The Story, The Evidence, The Breather) so no two adjacent sections follow the same pattern
5. **Creates ALL assessments** from raw research — scenario-based MCQs testing application, branching scenarios, reflective textinput. No pre-built quizzes in the knowledge base.
6. **Treats components as creative palette** — reads `learningMoment` and `creativeUses` from `component-library.json`

### Key Design Principles (AI-First)
- Content and component are ONE thought — never prose first, format later
- Research structure ≠ course structure — merge, split, resequence content areas for narrative flow
- Anti-patterns enforced: no 1:1 content-area-to-section mapping, no key-term for every vocabulary word, no MCQ after every section, no uniform section density
- 12+ component types required for variety (validation enforced)
- Assessment clustered into 2-3 checkpoint moments, not scattered
- Course ends with reflection/action (textinput, checklist), not a quiz

### Knowledge Base Schema (Flat — Layout-Agnostic)
```
contentArea:
  keyPoints[] — ALL facts, stats, definitions, concepts as uniform points with citations
  teachableMoments[] — typed: surprising-insight, case-study, analogy, contrast, decision-framework
                       each with a "hook" one-liner (attention grabber)
```

No `statistics`, `terminology`, `quizIdeas`, or `commonMisconceptions` arrays. The generation agent decides how to present every piece of knowledge.

---

## SCORM Import Path — Logic-Aware Restructuring

**Input:** `content-bucket.json` (extracted content + logic metadata)
**Output:** `course-layout.json` (structured sections, components, conditions)

The SCORM layout engine (`layout-engine.md`) reads raw extracted content and produces a structured course. This involves:
1. Understanding the educational arc across all scenes/slides
2. Grouping related content into sections (5-12 typically)
3. Choosing the best component type for each piece of content (from 28 available)
4. Rewriting text for modern scannable format while preserving accuracy
5. Specifying image prompts for visual components
6. **Interpreting logic metadata and mapping it to modern interaction patterns**

---

## How Logic Maps to Course Structure

When `content-bucket.json` includes a `pathGroups` array (from logic extraction), the layout engine must handle it:

### Path Selection (difficulty/role branching)

The layout engine sees:
```json
{
  "pathGroups": [{
    "name": "{inferred from variable names}",
    "type": "user-choice",
    "options": [
      { "variable": "{authorVar1}", "label": "{derived label}" },
      { "variable": "{authorVar2}", "label": "{derived label}" },
      { "variable": "{authorVar3}", "label": "{derived label}" }
    ]
  }]
}
```

It produces:
1. A **path-selector component** early in the course (after the hero)
2. Sections tagged with `"showIf"` referencing the discovered path variable
3. Shared sections with no `showIf` (visible to all paths)
4. Path-specific quiz components drawing from the right question pool

**Multiple path groups:** A course can have multiple pathGroups (e.g., one for role selection, one for assessment depth). Each produces a separate path-selector component. The extraction handles this generically — any slide that sets 2+ boolean vars read downstream is a pathGroup. Draws already have conditions, so question banks naturally associate with the right selector.

**Course gate:** The path-selector enforces selection. Content below the selector is blurred and locked until a path is chosen. This translates the SCORM's "you must choose before advancing" intent into a scroll-native pattern. See BUILD-SYSTEM.md for implementation.

### Section Gating

Content blocks tagged with section-completion conditions map to tracked progress sections. In a deep-scroll format, sections are not locked (scroll-locking is hostile), but completion is tracked:
- `extract.js` emits a `sectionGating` array mapping completion variables to their scenes
- `build-course.js` tags sections with `data-section-track` and counts interactive components
- `hydrate.js` tracks engagement (quizzes answered, accordions opened, tabs visited) and updates nav with progress indicators
- The nav shows `(2/5)` in-progress or a checkmark when all interactives in a section are complete

This preserves the SCORM's "ensure engagement in order" intent without fighting the scroll format.

### Layer Content (Click-to-Reveal)

Content extracted from Storyline layers (with `show_slidelayer` triggers) maps to interactive components:
- Multiple layers on one slide → accordion or tabs
- Single layer popup → expandable panel or inline reveal
- Layer with quiz content → MCQ component

### Question Banks per Path

Questions tagged with path conditions get grouped into path-specific quiz sections. The layout engine creates separate MCQ components for each path rather than a single randomised bank.

---

## The Layout Engine Prompt (layout-engine.md)

The system prompt at `v5/prompts/layout-engine.md` defines the AI's role, design rules, and output format. Key sections:

- **Design Process:** Understand content → plan structure → choose components → write content
- **Component Reference:** When to use each of the 28 types
- **Design Rules:** Hero first, no consecutive same types, 2-6 components per section, alternate image alignment, space MCQs apart
- **Content Rules:** Rewrite for modern tone, preserve accuracy, real headings, structure content appropriately
- **Image Rules:** Write prompts for every image-bearing component
- **Brand-Aware Design:** Use brand colours in image prompts, adjust tone to brand personality

### Logic-Aware Instructions (IMPLEMENTED)

`layout-engine.md` includes a "Logic-Aware Design" section that instructs the AI to:
- Interpret `pathGroups` and create `path-selector` components (26th component type)
- Tag path-specific sections/components with `showIf` conditions
- Handle shared vs path-specific content (no `showIf` = visible to all)
- Map layer content to interactive components (accordion, tabs, flashcard)
- Structure path-specific quizzes with `drawMetadata`
- Enforce content fidelity rules (all questions, all glossary terms, all layers)

---

## The design-course.js Script

Operates in three modes:
- **Manual (default):** Claude Code acts as the layout engine in conversation
- **API (when ANTHROPIC_API_KEY set):** Calls Claude API directly
- **Load (--load flag):** Replays a saved response

All modes produce the same output: validated `course-layout.json`.

### Validation

`validateLayout()` checks:
- Course title exists
- At least 2 sections
- Hero is the first component
- No consecutive same component types
- All componentId and sectionId values are unique
- All component types are from the valid 28-type set

### Logic Validation (IMPLEMENTED)

`validateLayout()` in `design-course.js` now also checks:
- Path-selector component exists when `pathGroups` are present in content-bucket.json
- All `showIf` conditions reference valid path variable names
- Every path has at least one section or component with matching `showIf`
- MCQ count >= question bank question count (content fidelity check)

---

## Output Format (course-layout.schema.json)

The schema defines sections containing components. Each component has:
- `componentId` — unique identifier
- `type` — one of 28 component types
- `displayTitle`, `body`, `instruction` — content fields
- `_items[]` — for list-based components (accordion, tabs, quiz choices, etc.)
- `_graphic` — image reference (populated by image generation step)
- `imagePrompt` / `imagePrompts` — instructions for image generation
- Component-specific fields: `columns`, `rows`, `_markers`, `_nodes`, `transcript`, etc.

### Condition Fields (IMPLEMENTED)

Components and sections can include:
- `showIf` — condition object (`{ "VariableName": true }`) for conditional rendering. Multiple keys = OR logic.
- `pathGroup` — which path group this section/component belongs to (for authoring tool UI)
- `drawMetadata` — on MCQ components: `{ drawId, shuffle, drawCount, poolSize }` for authoring layer compatibility
