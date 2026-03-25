# Content Structuring

> **Status:** Skeleton — will be expanded as logic extraction is implemented.
> **Last updated:** 2026-03-25

This document covers how extracted content (including logic, conditions, and variables) gets transformed by the AI layout engine into a structured course layout. This is the bridge between "what was in the SCORM" and "what the output course looks like."

---

## The Transformation Step

**Input:** `content-bucket.json` (extracted content + logic metadata)
**Output:** `course-layout.json` (structured sections, components, conditions)

The AI layout engine reads raw extracted content and produces a structured course. This involves:
1. Understanding the educational arc across all scenes/slides
2. Grouping related content into sections (5-12 typically)
3. Choosing the best component type for each piece of content (from 25 available)
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
    "name": "difficulty",
    "type": "user-choice",
    "options": [
      { "variable": "Group1NonTechnical", "label": "Non-Technical" },
      { "variable": "Group2SemiTechnical", "label": "Semi-Technical" },
      { "variable": "Group3Technical", "label": "Technical" }
    ]
  }]
}
```

It produces:
1. A **path-selector component** early in the course (after the hero)
2. Sections tagged with `"showIf": { "difficulty": "technical" }`
3. Shared sections with no `showIf` (visible to all paths)
4. Path-specific quiz components drawing from the right question pool

### Section Gating

Content blocks tagged with `Section1complete` conditions become naturally ordered sections. In a deep-scroll format, linear gating is handled by scroll order — no runtime logic needed. The layout engine can add progress markers between sections.

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
- **Component Reference:** When to use each of the 25 types
- **Design Rules:** Hero first, no consecutive same types, 2-6 components per section, alternate image alignment, space MCQs apart
- **Content Rules:** Rewrite for modern tone, preserve accuracy, real headings, structure content appropriately
- **Image Rules:** Write prompts for every image-bearing component
- **Brand-Aware Design:** Use brand colours in image prompts, adjust tone to brand personality

### Future Enhancement: Logic-Aware Instructions

When logic extraction is implemented, `layout-engine.md` will need additional instructions:
- How to interpret `pathGroups` and create path-selector components
- How to tag sections with `showIf` conditions
- How to handle shared vs path-specific content
- How to map layer content to interactive components
- How to structure path-specific quizzes

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
- All component types are from the valid 25-type set

### Future Enhancement: Logic Validation

When logic extraction is implemented, validation will also check:
- Path-selector component exists when `pathGroups` are present
- All path-specific sections have valid `showIf` references
- Every path has at least one section of content
- Quiz components are assigned to the correct paths

---

## Output Format (course-layout.schema.json)

The schema defines sections containing components. Each component has:
- `componentId` — unique identifier
- `type` — one of 25 component types
- `displayTitle`, `body`, `instruction` — content fields
- `_items[]` — for list-based components (accordion, tabs, quiz choices, etc.)
- `_graphic` — image reference (populated by image generation step)
- `imagePrompt` / `imagePrompts` — instructions for image generation
- Component-specific fields: `columns`, `rows`, `_markers`, `_nodes`, `transcript`, etc.

### Future: Condition Fields

When logic extraction is implemented, components will gain:
- `showIf` — condition object (`{ "variable": "value" }`) for conditional rendering
- `pathGroup` — which path group this component belongs to (for authoring tool UI)
