# Authoring Layer — Architecture & Progress Tracker

> **Living document.** Updated after every commit/push. Tracks what's done, what's next, what was skipped, and knock-on effects.

**Branch:** `authoring-layer-v5`
**Started:** 2026-03-28
**Last updated:** 2026-03-28 (Phase 3.5 COMPLETE — UX polish: friendly labels, delete, removed broken type swap)

---

## Vision

The authoring layer turns AI-generated courses into user-editable experiences. The AI creates a complete branded course from a topic brief; the authoring layer lets users refine, swap, edit, and rearrange without re-running the pipeline.

**Architecture:** Option C — AI generates, user refines with visual tools.

This is NOT a blank-canvas editor like Rise. The AI does the heavy lifting. The user adjusts.

---

## Research Summary

Researched **8 leading scroll-based authoring tools** (2026-03-28):
- **Articulate Rise 360** — ~40 block types, 8 categories, constrained simplicity
- **Adapt Learning / Evolve** — 46+ components, 3 categories (Presentation/Interaction/Question), deepest hierarchy (Course > Page > Article > Block > Component)
- **Elucidat** — 5 categories (Presentational/Interactions/Navigation/Questions/Results)
- **Gomo Learning** — Column-based layout system (1-4 cols), sub-screen architecture
- **DominKnow Flow** — 3 UI complexity levels (Essentials/Essential Plus/Designer), Design Assistant AI
- **Chameleon Creator** — Template-driven, parallax backgrounds, 1000+ recolorable illustrations
- **Mindsmith** — AI-native, 12x faster course creation claim
- **Easygenerator** — AI selects optimal block type, doc-to-course pipeline

### Key Industry Patterns
1. **Every tool uses 3-6 component categories** — the taxonomy is the UX
2. **Categories serve double duty** — help users FIND components AND help systems DECIDE which to use
3. **More variants > more component types** — Rise has ~40 types but most are variants of ~15 core patterns
4. **Constrained flexibility wins** — guardrails that prevent ugly designs, not freeform canvases
5. **AI-mediated authoring is the emerging trend** — tools are converging on "smart defaults + user overrides"
6. **No tool generates a visual design system from a brand URL** — our Stitch integration is unique
7. **No tool has named layout variants with live switching** — our variant system is ahead of market

### What We Can Learn From
- **Rise's category clarity** — each category answers a question: "What kind of block do I need?"
- **DominKnow's progressive disclosure** — show fewer options to new users, full palette to power users
- **Evolve's 3-category simplicity** — Presentation / Interaction / Question covers everything
- **Adapt's component + extension separation** — core components vs add-on behaviours

---

## Phase Build Path

```
Phase 1: Authoring Panel v1           Variant toggle (✎ Edit button)        DONE
Phase 2: Component Taxonomy          Categories + new components +         DONE
         + Expanded Palette          new variants + AI guidance
Phase 3: Inline Editing              Edit text + swap component type       DONE  ⚠️ KEY PHASE
         3a: JSON + text edit ✅   3b: Type swap ✅   3c: Export ✅
Phase 4: Section Management          Reorder + add/remove + width control  PLANNED
Phase 5: AI-Assisted Editing         "Regenerate section" + category       PLANNED
                                     browser for manual add
Phase 6: Full Authoring              Blank course creation + complex       PLANNED
                                     assessment types (matching, etc.)
```

### Phase 3 Architecture Note (critical — read before starting Phase 3)

> **⚠️ COMPLEXITY WARNING:** This is the hardest phase. `contenteditable` is notoriously buggy across browsers, and keeping a JSON data model in sync with live DOM edits produces edge cases. Plan for multiple debug iterations. Break into small testable pieces — don't try to build it all at once. Phase 3 should probably be split into sub-phases (3a: embed JSON + text editing only, 3b: component type swap, 3c: save/export).

Phase 3 is the most architecturally significant phase. It introduces a **live JSON data model** in the browser.

**Approach:** build-course.js embeds `course-layout.json` inside the built HTML as a `<script type="application/json" id="course-data">` tag. The authoring layer reads this JSON and keeps it in sync with DOM edits.

- **Text editing:** `contenteditable` on text elements → updates both DOM and embedded JSON
- **Component type swap:** Same `<template>` + DOM-swap mechanism the authoring panel variant toggle already uses
- **Variant swap:** Already works (Phase 1)
- **Save/Export:** Download modified JSON or send to server endpoint

This is NOT a full client-side rendering engine. The heavy rendering stays in Node.js (build-course.js). The browser only needs to: (a) keep JSON in sync with edits, (b) swap pre-rendered templates for structural changes, (c) re-hydrate after swaps (already implemented in Phase 1).

**Why this works:** The authoring panel (Phase 1) already proves the pattern — pre-rendered templates, DOM swap, re-hydration. Phase 3 extends it from "swap variant" to "swap component type" and "edit text in place."

### Phase 3 Post-Implementation Findings (critical — read before Phase 4)

> **Added 2026-03-28 after user testing of Phase 3. These findings reshape Phase 4+.**

#### Finding 1: Type swap dropdown is broken UX — REMOVE BEFORE PHASE 4

The Phase 3b component type `<select>` dropdown has three compounding problems:
1. Only allows swapping within the same category (can't change text → accordion)
2. Nothing visual happens — just a "⟳ Rebuild needed" badge
3. The category names and component names are developer labels, not user-friendly

**Action:** Remove the type swap dropdown from hydrate.js. Type swapping needs client-side rendering (see Finding 4) before it can deliver value.

#### Finding 2: Categories and component names are developer language

Current categories (Content, Explore, Assess, Layout, Media, Structure) were designed for the AI generation engine, not end users. "Explore" means nothing to a user. Component names like "narrative", "bento", "graphic-text", "stat-callout" are internal developer labels.

**User-friendly category labels (display only — internal names stay unchanged):**

| Internal (keep everywhere) | User-facing (toolbar display only) |
|---|---|
| Content | Text & Images |
| Explore | Interactive |
| Assess | Quiz & Activities |
| Layout | Data & Layout |
| Media | Media |
| Structure | Page Structure |

**User-friendly component labels (display only — add `typeLabels` map in hydrate.js):**

| Internal | User-facing |
|---|---|
| hero | Hero Banner |
| text | Text Block |
| graphic | Image |
| graphic-text | Image & Text |
| full-bleed | Full-Width Image |
| pullquote | Featured Quote |
| stat-callout | Key Statistics |
| key-term | Glossary |
| callout | Callout |
| accordion | Expandable List |
| tabs | Tabs |
| narrative | Slideshow |
| flashcard | Flashcards |
| labeled-image | Labelled Image |
| mcq | Quiz |
| branching | Scenario |
| textinput | Free Text |
| checklist | Checklist |
| bento | Card Grid |
| comparison | Comparison |
| data-table | Table |
| timeline | Timeline |
| process-flow | Process Flow |
| image-gallery | Gallery |
| media | Video |
| video-transcript | Video + Transcript |
| divider | Divider |
| path-selector | Path Selector |

Same pattern as `variantLabels` — internal names stay in JSON, schemas, fill functions, prompts. Friendly names are display-only in hydrate.js.

#### Finding 3: Variant swapping is safe, type swapping is not

Variant swapping works perfectly because all variants of the same component type share the same data structure (same props). Renaming categories or component labels doesn't affect variant swapping at all — it's purely display.

Type swapping is fundamentally different — different types have different data structures (`text` has `{displayTitle, body}`, `process-flow` has `{displayTitle, steps[]}`). Type swap requires re-rendering, which currently only exists server-side (build-course.js fill functions).

#### Finding 4: Client-side type template library (proposed approach for Phase 4)

To enable type swap + add section WITHOUT a server:

1. **build-course.js pre-renders a "type template library"** — one `<template data-type-template="TYPE">` per component type with placeholder content, embedded in every course
2. When user swaps type or adds a section, hydrate.js clones the template, fills JSON data into the DOM (heading → displayTitle, paragraphs → body, list items → items), inserts into DOM, re-hydrates
3. Lightweight client-side fill functions — much simpler than full build-course.js since styled HTML already exists in template. Just set text content.
4. Won't be pixel-perfect vs server rebuild, but good enough for authoring preview. Server rebuild replaces it with production quality later.

#### Finding 5: "Add section" has open UX/content questions

Adding a new section raises questions that need design decisions:
- **Content generation:** A new "Image & Text" component needs an image (SiliconFlow/Pexels) and body text (AI-generated). Where does this content come from without a server?
- **User input model:** Does the user specify content manually? Or use a prompt like "new block about X topic"? Or get empty placeholder content to fill in?
- **Simplest viable approach:** Pre-filled placeholder content ("Your heading here", placeholder image) that the user edits with contenteditable. AI-assisted content generation waits for Phase 5.
- **This is a big UX decision** that should be resolved before building add-section functionality.

#### Finding 6: Delete section works client-side — ship it now

Delete is the one section management feature that works without a server. Remove from DOM + remove from JSON + confirm dialog. Ship with the UX fixes (Findings 1-2), before tackling type swap and add.

#### ⚠️ CRITICAL: Do not implement type swap, add section, or delete without reading this

These three features (swap component type, add new section, delete section) affect the course structure and content in ways that are hard to undo and have cascading implications:

- **Type swap** changes data structure — a `text` component has `{displayTitle, body}` but an `accordion` has `{displayTitle, items[]}`. Swapping types means content may not map. Needs client-side template library (Finding 4) AND a strategy for what happens to content that doesn't fit the new type.
- **Add section** requires content — where does the text, images, quiz data come from? AI generation needs a server. Manual entry needs a content editing UI beyond basic contenteditable. Placeholder content is the simplest option but may confuse users. **This must be designed before building.**
- **Delete section** is the simplest (just remove DOM + JSON) but is destructive and irreversible in the current architecture (no undo). Confirm dialog is minimum. Consider: should deleted sections be recoverable?

**Do not build any of these as quick features. Each needs a UX design decision first.** The revised phase plan below reflects this.

#### Revised Phase 4 Plan

Based on these findings, Phase 4 should be restructured:

```
Phase 3.5: Authoring UX Polish           Friendly labels, remove broken     DONE
                                          type dropdown, add delete button
Phase 4a: Client-side type templates      Pre-render type template library   PLANNED
Phase 4b: Type swap (client-side)         Clone template + fill from JSON    PLANNED
Phase 4c: Add section                     Component picker + placeholder     PLANNED  ⚠️ UX DECISIONS NEEDED
Phase 4d: Reorder sections                Move up/down + JSON reorder        PLANNED
Phase 4e: Section width control           narrow/standard/wide/full toggle   PLANNED
```

### SCORM & Accessibility Notes

**SCORM:** No architectural debt. hydrate.js already tracks quiz answers, completion, and progress via `data-*` attributes. SCORM is a future output format wrapper (`--output scorm` flag on build-course.js + imsmanifest.xml template + scorm-wrapper.js). Zero changes to current architecture needed.

**Accessibility of course output:** Native HTML elements (`<details>`, `<input>`, `<form>`) provide a strong foundation. ARIA attributes (`role`, `aria-selected`, `aria-expanded`, `aria-live`) and keyboard navigation for custom widgets (tabs, carousel, flashcards) should be added in a dedicated session. Not blocking for Phase 2, but should be done before production use.

**Accessibility of authoring tool:** Phase 6+ concern. Standard for v1 of any authoring tool.

---

## Phase 2: Component Taxonomy + Expanded Palette

### 2a — Data Layer (no pipeline run needed) ✅ DONE

- [x] **Fix component categories in component-library.json**
  - [x] Rename/reassign all 26 components to 6 new categories
  - [x] Add `categoryLabel` and `categoryDescription` metadata (in `component_categories` object)
  - [x] Validate every component's category assignment makes sense

- [x] **Add new component: `divider`** (Structure category)
  - [x] Add to component-library.json (type, category, props, variants, learningMoment, creativeUses)
  - [x] Add to course-layout.schema.json type enum + `style`/`icon` props
  - Variants: `line` (default), `spacing` (whitespace only), `icon` (centered icon break)
  - Props: `style` (line/spacing/icon), optional `icon` name
  - Zero interactivity — pure visual

- [x] **Add new component: `callout`** (Content category)
  - [x] Add to component-library.json
  - [x] Add to course-layout.schema.json type enum + `calloutType` prop
  - Variants: `info` (default), `warning`, `tip`, `success`
  - Props: `displayTitle`, `body`, `calloutType` (info/warning/tip/success)
  - Zero interactivity — pure styled HTML

- [x] **Add new variants to existing components** (17 new variants across 8 components)
  - [x] `text`: `standard` (default), `two-column`, `highlight-box`
  - [x] `narrative`: `image-focused`, `text-focused`
  - [x] `flashcard`: `grid`, `single-large`
  - [x] `checklist`: `standard` (default), `card-style`, `numbered`
  - [x] `key-term`: `list` (default), `card-grid`
  - [x] `labeled-image`: `numbered-dots` (default), `side-panel`
  - [x] `data-table`: `standard` (default), `striped-card`
  - [x] `branching`: `cards` (default), `list`

- [x] **Update generation-engine.md** — added category table, component selection guidance, new variant table, callout/divider usage rules, quality checklist updates
- [x] **Update generation-agent.md** — reference categories, callout/divider, 28 components

### 2b — Stitch Layer (requires Design Run) ✅ DONE

- [x] **Update representative-course.md** — added HTML examples for:
  - [x] `divider` (all 3 variants: line, spacing, icon)
  - [x] `callout` (all 4 variants: info, warning, tip, success)
  - [x] All 17 new variants of existing components (text ×3, narrative ×2, flashcard ×2, checklist ×3, key-term ×2, labeled-image ×2, data-table ×2, branching ×2)
  - [x] Added `data-variant` attribute requirement to design requirements
- [x] **Run Stitch** (Step 3) to design new components + variants
- [x] **Run extract-contract.js** to extract new patterns

### 2c — Build Layer (after Stitch designs exist) ✅ DONE

- [x] **Update build-course.js**
  - [x] Add `fillDivider()` function
  - [x] Add `fillCallout()` function
  - [x] Add variant rendering for text (2 new variants: two-column, highlight-box)
  - [x] Add variant rendering for narrative (2 new variants: image-focused, text-focused)
  - [x] Add variant rendering for flashcard (2 new variants: grid, single-large)
  - [x] Add variant rendering for checklist (2 new variants: card-style, numbered)
  - [x] Add variant rendering for key-term (1 new variant: list)
  - [x] Add variant rendering for labeled-image (1 new variant: side-panel)
  - [x] Add variant rendering for data-table (1 new variant: striped-card)
  - [x] Add variant rendering for branching (1 new variant: list)
- [x] **Update hydrate.js** — no changes needed (callout/divider are non-interactive; single-large flashcard uses existing carousel hydration)
- [x] **Update extract-contract.js** — no changes needed (divider/callout don't use design contracts)
- [x] **Update authoring panel** — variant switcher works via existing VARIANT_MAP + template system

### 2d — Authoring UI Layer ✅ DONE

- [x] **Renamed DEV toggle → Authoring Layer** — button "✎ Edit", variables, comments, CSS classes, data attributes all renamed
- [x] **Update authoring panel** — group variants by category with colour-coded toolbars
- [x] **Add category badges** to variant browser (category name badge on each toolbar)
- [x] **Visual indicators** for which category each section's component belongs to (colour-coded outlines + badges)
- [x] **Embedded category metadata** — `data-category` on sections + JSON `<script>` tag for hydrate.js
- [x] **6 category colours** — Content (blue), Explore (purple), Assess (red), Layout (green), Media (cyan), Structure (amber)

### 2e — QA + Validation ✅ DONE

- [x] **Update qa-course.js** — variant registry synced (all new variants validated)
- [x] **Update validate-layout.js** — accepts new types (divider, callout)
- [x] **Run full QA gate** (6a → 6b → 6c) — passed: 109/0 structural, 47/0 interactive, visual review clean
- [x] **Matrix test** with 2 brand/topic combinations:
  - Landio (dark) + Data Privacy & GDPR: 113/0 structural, 43/1→0 interactive (fixed accordion contrast)
  - Fluence (light) + Emotional Intelligence: 109/0 structural, 43/0 interactive
  - 1 bug found and fixed: accordion body text contrast on dark themes (`text-on-surface-variant` → `text-on-surface/80`)

---

## Phase 3: Inline Editing

### 3a — Embed JSON + Text Editing ✅ DONE

- [x] **build-course.js: Embed course-layout.json** as `<script type="application/json" id="course-data">` in built HTML
- [x] **build-course.js: Add data-section-index + data-component-index** to all component sections (including template variants) for JSON↔DOM mapping
- [x] **hydrate.js: loadCourseData() / saveCourseData()** — parse embedded JSON on demand, write back on every edit
- [x] **hydrate.js: enableInlineEditingForSection()** — makes `displayTitle` (first heading) and `body` (paragraphs) contenteditable
  - Skips paragraphs inside interactive elements (quiz choices, tab labels, carousel nav, checklist labels)
  - Enter key on headings blurs (prevents line breaks in titles)
  - Enter key on paragraphs prevented (Shift+Enter allowed for line breaks)
  - Input events sync text back to JSON model + save immediately
- [x] **hydrate.js: enableInlineEditing() / disableInlineEditing()** — toggle all contenteditable on/off with authoring mode
- [x] **hydrate.js: Visual indicators** — CSS for editable elements: blue dashed outline on hover, solid blue on focus, subtle blue tint background on focus
- [x] **hydrate.js: Variant swap integration** — re-enables inline editing on new section after variant swap
- [x] **hydrate.js: Editing stylesheet** — disabled when authoring mode is off, enabled when on
- [x] **QA passed:** 109/0 structural, 43/0 interactive (0 new errors, all warnings pre-existing)

### 3b — Component Type Swap ✅ DONE

- [x] **Component type `<select>` dropdown** in each toolbar — shows types from same category
- [x] **JSON model update** — changing type updates `comp.type` in embedded JSON and clears `comp.variant`
- [x] **"⟳ Rebuild needed" badge** — red badge on section when type changed (visual changes require rebuild)
- [x] **Revert detection** — badge removed if user selects original type back
- [x] **Architecture note:** Visual re-render requires Node.js rebuild (fill functions live server-side). The dropdown updates the JSON model; user exports and rebuilds to see the new component type rendered.

### 3c — Save/Export ✅ DONE

- [x] **"↓ Export JSON" button** — blue, fixed top-right (left of Edit button), visible only in authoring mode
- [x] **Downloads `course-layout.json`** with all user edits (text changes, type swaps, variant changes)
- [x] **Blob download** — creates in-memory blob, triggers download, cleans up URL
- [x] **QA passed:** 109/0 structural, 43/0 interactive

---

## Category System (6 categories)

| Category | Intent | User Question It Answers | Components |
|---|---|---|---|
| **Content** | Deliver information | "I want to present text, images, or key messages" | text, graphic, graphic-text, full-bleed, pullquote, stat-callout, key-term, **callout** |
| **Explore** | Learner discovers by clicking | "I want the learner to reveal content at their own pace" | accordion, tabs, narrative, flashcard, labeled-image |
| **Assess** | Test, reflect, or commit | "I want to check understanding or prompt action" | mcq, branching, textinput, checklist |
| **Layout** | Arrange multiple items visually | "I have several related items to display together" | bento, comparison, data-table, timeline, process-flow, image-gallery |
| **Media** | Video and audio | "I have video/audio content" | media, video-transcript |
| **Structure** | Course-level elements | "I need course framing or visual breaks" | hero, path-selector, **divider** |

### Design Decisions Behind Categories

**Why "Explore" not "Interactive"?** — "Interactive" is vague; MCQ is interactive too, but it's assessment. "Explore" clearly signals: content the learner reveals at their own pace. Every component in this category hides content behind a click (accordion panels, tab switches, carousel slides, flashcard flips, hotspot markers). The shared pattern is *discovery*.

**Why checklist is "Assess" not "Explore"?** — Checklists don't reveal hidden content. They prompt the learner to *commit* to actions and self-assess completion. The interaction pattern is closer to textinput (reflection) than accordion (discovery).

**Why branching is "Assess" not "Explore"?** — Branching asks "what would you do?" — it tests decision-making. The learner makes a judgement call, not a discovery. It's ungraded assessment.

**Why bento/timeline/process-flow are "Layout" not "Content" or "Explore"?** — These components arrange multiple items in a visual structure (grid, sequence, flow). The *arrangement* is the value, not the text content or an interaction pattern. A user asking "I have 5 related things to show" reaches for Layout.

**Why "Content" includes both text-only and image components?** — All deliver information directly. Graphic, full-bleed, pullquote, stat-callout — they present content to be consumed, not explored or assessed. The user question is always "I want to show/tell something."

### Category Migration Map (current → new)

| Component | Current Category | New Category | Reason for Change |
|---|---|---|---|
| hero | structural | Structure | Rename only |
| text | content | Content | No change |
| graphic | visual | Content | It delivers visual content, not "layout" |
| graphic-text | content | Content | No change |
| full-bleed | visual | Content | It's a content delivery format |
| pullquote | visual | Content | It emphasizes key text content |
| stat-callout | content | Content | No change |
| key-term | content | Content | No change |
| accordion | interactive | Explore | Learner reveals content by clicking |
| tabs | interactive | Explore | Learner reveals content by clicking |
| narrative | interactive | Explore | Learner navigates through slides |
| flashcard | interactive | Explore | Learner flips to discover |
| labeled-image | visual | Explore | Learner clicks markers to reveal |
| mcq | assessment | Assess | No change (renamed) |
| branching | interactive | Assess | It tests decision-making |
| textinput | interactive | Assess | It prompts reflection |
| checklist | interactive | Assess | It prompts self-assessment/commitment |
| bento | content | Layout | It arranges multiple cards in a grid |
| comparison | content | Layout | It arranges items in columns |
| data-table | content | Layout | It arranges data in rows/columns |
| timeline | content | Layout | It arranges items in sequence |
| process-flow | visual | Layout | It arranges nodes in a flow |
| image-gallery | visual | Layout | It arranges images in a grid |
| media | visual | Media | No change |
| video-transcript | visual | Media | No change |
| path-selector | structural | Structure | No change |

---

## Variant Inventory (after Phase 2)

### Current (after Phase 2a+audit): 23 components with variants, 56 variants total
### (was: 13 components, ~22 variants before Phase 2)

| Component | Category | Variants (new in **bold**) |
|---|---|---|
| hero | Structure | centered-overlay, split-screen, minimal-text |
| text | Content | **standard**, **two-column**, **highlight-box** |
| graphic | Content | standard, captioned-card |
| graphic-text | Content | split, overlap, full-overlay |
| full-bleed | Content | center, left, right |
| pullquote | Content | accent-bar, centered, minimal |
| stat-callout | Content | centered, card-row |
| callout | Content | **info**, **warning**, **tip**, **success** |
| accordion | Explore | standard, accent-border |
| tabs | Explore | horizontal, vertical |
| narrative | Explore | **image-focused**, **text-focused** |
| flashcard | Explore | **grid**, **single-large** |
| labeled-image | Explore | **numbered-dots**, **side-panel** |
| mcq | Assess | stacked, grid |
| branching | Assess | **cards**, **list** |
| checklist | Assess | **standard**, **card-style**, **numbered** |
| bento | Layout | grid-4, wide-2, featured |
| comparison | Layout | columns, stacked-rows |
| data-table | Layout | **standard**, **striped-card** |
| timeline | Layout | vertical, centered-alternating |
| process-flow | Layout | vertical, horizontal |
| key-term | Content | **list**, **card-grid** |
| divider | Structure | **line**, **spacing**, **icon** |

Components WITHOUT variants (5): image-gallery, media, video-transcript, path-selector, textinput

---

## Skipped for Future Sessions

These were identified in research as valuable but too complex for the current phase. They should be implemented in Phase 6 or dedicated sessions.

### Matching Exercise (Assess category)
- **What:** Drag items from one list to match with items in another list
- **Why skip:** Requires drag-and-drop interaction in hydrate.js — entirely new interaction pattern. Needs touch support, accessibility (keyboard drag), visual feedback during drag. Every tool has this but it's the most complex interactive pattern to implement.
- **Industry prevalence:** Every major tool (Rise, Evolve, DominKnow, Gomo, Adapt)
- **When to implement:** Phase 6, alongside sorting. Share drag-drop infrastructure.
- **Props sketch:** `_pairs: [{ prompt: string, match: string }]`, with optional distractors
- **Variants:** `line-draw` (draw lines between), `drag-drop` (drag items to slots)

### Sorting / Ranking (Assess category)
- **What:** Drag items to reorder (ranking) or categorize into buckets (sorting)
- **Why skip:** Same drag-and-drop infrastructure as matching. Should be built together.
- **Industry prevalence:** Rise, DominKnow, Evolve, Chameleon
- **When to implement:** Phase 6, with matching
- **Props sketch:** `_items: [{ text: string }]`, `_categories?: [{ title: string }]` (for sorting into buckets)
- **Variants:** `reorder` (drag to rank), `categorize` (drag to buckets)

### Scenario / Scored Branching (Assess category)
- **What:** Multi-step branching scenario where each choice has a score. Final score determines outcome path.
- **Why skip:** Needs state management (running score across steps), step navigation, outcome routing. Significantly more complex than current branching (which is single-step, ungraded).
- **Industry prevalence:** DominKnow, Evolve, Elucidat (branching scenarios)
- **When to implement:** Phase 6 or dedicated session
- **Props sketch:** `_steps: [{ body: string, choices: [{ text: string, score: number, feedback: string, nextStep: string }] }]`
- **Variants:** `conversation` (chat-style), `decision-tree` (visual tree)

### Embed / iFrame (Media category)
- **What:** Embed external content via iFrame — code playgrounds, external tools, third-party widgets
- **Why skip:** Security complexity (CSP headers, sandboxing, cross-origin), responsive sizing, fallback handling. Also requires decisions about what to allow embedding.
- **Industry prevalence:** Most tools support some form of embed
- **When to implement:** Phase 5 or 6
- **Props sketch:** `src: string (URL)`, `height: string`, `title: string`, `sandbox: string`
- **Variants:** `responsive` (auto-height), `fixed` (set height)

### Audio Player (Media category)
- **What:** Standalone audio player with waveform/progress visualization
- **Why skip:** Need audio generation pipeline (no current audio in AI-first path). Without audio assets, the component would be unused.
- **Industry prevalence:** Most tools (Rise, Evolve, DominKnow, Gomo)
- **When to implement:** When audio generation or sourcing is added to pipeline
- **Props sketch:** `_audio: { src: string, transcript?: string }`

### Resource / Download (Structure category)
- **What:** Downloadable file (PDF, template, worksheet) with description
- **Why skip:** Needs file hosting/serving solution. Single-file course output doesn't naturally support bundled downloads.
- **Industry prevalence:** Rise, Evolve, DominKnow
- **When to implement:** Phase 5 or 6, when file hosting is addressed

### Discussion Prompt (Assess category)
- **What:** Collaborative discussion prompt — learners see and respond to each other
- **Why skip:** Requires backend/server for storing and displaying responses. Our courses are static single-file HTML.
- **Industry prevalence:** LMS-integrated tools only
- **When to implement:** Only if/when backend is added

---

## Pipeline Impact Notes

### Files that change in Phase 2

| File | What Changes | Run Level Triggered |
|---|---|---|
| `v5/schemas/component-library.json` | Categories, new components, new variants | Full Run |
| `v5/schemas/course-layout.schema.json` | Type enum + new component props | Full Run |
| `v5/prompts/generation-engine.md` | Category-based component guidance | Full Run |
| `v5/prompts/generation-agent.md` | Reference to categories | Full Run |
| `v5/prompts/representative-course.md` | HTML for new components + variants | Design Run |
| `v5/scripts/build-course.js` | Fill functions + variant rendering | Build Run |
| `v5/scripts/hydrate.js` | Minimal — new components are non-interactive | Build Run |
| `v5/scripts/extract-contract.js` | May need new component pattern extraction | Design Run |
| `v5/scripts/qa-course.js` | Validate new types | Build Run |
| `v5/scripts/qa-interactive.js` | Test new variants | Build Run |
| `v5/scripts/lib/validate-layout.js` | Accept new types | Build Run |

### Knock-on Effects to Watch
- **Stitch token budget:** Adding 2 new components + 17 new variants to representative-course.md increases the prompt size sent to Stitch. Monitor for token limits.
- **Design contract size:** More component patterns = larger design-contract.json. Should be fine but watch.
- **AI generation quality:** Better categories should IMPROVE component selection. Verify with matrix test.
- **Existing courses:** course-layout.json files generated before this change won't have divider/callout components. That's fine — build-course.js handles missing types gracefully.
- **Authoring panel UI:** Currently shows variants as a flat list. Will need category grouping to stay usable with 56 variants across 23 components (Phase 2d).

---

## Changelog

### 2026-03-28 — Deep Inline Editing (structured content)
- build-course.js: Added `data-edit-path` attributes to text elements inside structured items across 12 components:
  - accordion (title, body), tabs (title, body), timeline (title, body), process-flow (title, body)
  - stat-callout (value, label), narrative (title, body), flashcard (front, back), bento (title, body)
  - checklist (text), key-term (term, definition), pullquote (body, attribution)
- build-course.js: Added `data-edit-html` attribute on rich-content fields (accordion body, tabs body) to preserve HTML formatting
- hydrate.js: Added `setNestedValue()` helper for dot-path JSON updates (e.g., `_items.2.title`)
- hydrate.js: `enableInlineEditingForSection()` now finds all `[data-edit-path]` elements and makes them contenteditable with JSON sync
- hydrate.js: Variant swap now carries over structured edits via `data-edit-path` element matching
- All item text (accordion panels, timeline steps, stat values, flashcard faces, etc.) is now editable in authoring mode
- Not yet editable: MCQ choices (quiz logic sensitivity), comparison table cells, data-table, labeled-image markers, branching options
- QA: 110/0 structural (0 new issues)

### 2026-03-28 — Phase 3.5: Authoring Panel UX Polish
- hydrate.js: Removed broken component type swap `<select>` dropdown, change handler, and "⟳ Rebuild needed" badge code
- hydrate.js: Added `typeLabels` map (28 user-friendly component names) — display only in toolbar
- hydrate.js: Added `USER_CATEGORY_LABELS` map (6 user-friendly category names) — display only in toolbar badge
- hydrate.js: Toolbar now shows: [category badge] [type label] [delete] then [variant buttons] on second row
- hydrate.js: Added "✕ Delete" button per section — right-aligned, red on hover, browser confirm dialog
- hydrate.js: Delete removes section from DOM + embedded JSON model, re-indexes remaining sections
- QA: 110/0 structural (0 new issues, all warnings pre-existing)

### 2026-03-28 — Post-Implementation UX Review (Phase 3)
- User testing revealed Phase 3b type swap dropdown is broken UX — removal recommended
- Categories and component names are developer language, need user-friendly display labels
- Documented user-friendly category labels (6) and component type labels (28)
- Identified client-side type template library as approach for type swap without server
- Identified open UX questions for "add section" (content generation, user input model)
- Restructured Phase 4 into 5 sub-phases (3.5 → 4a → 4b → 4c → 4d → 4e)
- No code changes — documentation and planning only

### 2026-03-28 — Interactive component editing (Edit/Preview toggle)
- build-course.js: Added `data-interactive` marker to all interactive component sections (MCQ, tabs, flashcard, checklist, branching, path-selector, narrative)
- build-course.js: Added `data-edit-path` to all components missing them (MCQ, tabs triggers, branching, path-selector, labeled-image, textinput, full-bleed, image-gallery, video-transcript, comparison)
- hydrate.js: Per-section `✏️ Edit text` / `▶ Done` toggle on interactive component toolbars — suppresses interactivity while editing
- hydrate.js: `isSectionEditing()` guard on all interactive handlers (quiz choice, tab switch, flashcard flip, checklist toggle, path-selector click)
- hydrate.js: `data-editing` attribute on section controls editing state; `data-edit-bound` prevents zombie event listeners
- hydrate.js: GSAP counter animations killed when entering edit mode (stat-callout)
- hydrate.js: CSS disables pointer-events on checkboxes and sets cursor:text on interactive elements in edit mode
- Non-interactive components (text, callout, accordion, etc.) unaffected — still auto-editable in authoring mode
- Architecture: generic `data-interactive` marker = future-proof (new interactive components auto-detected)
- QA: 110/0 structural, 43/0 interactive

### 2026-03-28 — Bug Fix: Authoring hydration fixes (3 bugs)
- hydrate.js: `hydrateComponent()` now uses `qsaIncludingSelf()` — fixes variant swap breaking interactivity on MCQ, flashcard (single-large), and narrative (all variants) where `data-quiz`/`data-carousel` live on the `<section>` itself
- hydrate.js: CSS override for `[data-editable].text-gradient` — `-webkit-text-fill-color: transparent` made stat values invisible when contenteditable was active
- build-course.js: Removed `data-interactive` from stat-callout (both variants) — no click interactions, toggle was unnecessary; stat-callout now auto-editable like other Content components
- hydrate.js: Fixed GSAP counter tween kill — `killTweensOf(el)` was a no-op (tween target is `obj`); now stores tween ref as `el._counterTween` and restores final value if editing starts before scroll-triggered animation

### 2026-03-28 — Bug Fix: Variant swap text carry-over
- hydrate.js: swapVariant() now applies JSON model (displayTitle + body) to new variant DOM after cloning template
- hydrate.js: Variant selection also persisted to JSON model (cd.variant = targetVariant)
- Previously, edited text was lost on variant swap — template clone showed original pre-rendered text
- QA: 110/0 structural

### 2026-03-28 — Phase 3b+3c Complete (Type Swap + Export) — Phase 3 DONE
- hydrate.js: Component type `<select>` dropdown in each authoring toolbar — shows types from same category
- hydrate.js: Changing type updates JSON model (`comp.type`), clears variant, adds red "⟳ Rebuild needed" badge
- hydrate.js: "↓ Export JSON" button (blue, fixed top-right) — downloads modified course-layout.json
- Export button visible only in authoring mode, uses Blob download
- Architecture: type swap updates data model only — visual re-render requires Node.js rebuild
- QA: 109/0 structural, 43/0 interactive (0 new issues)

### 2026-03-28 — Phase 3a Complete (Inline Text Editing)
- build-course.js: Embedded full course-layout.json as `<script id="course-data">` in built HTML (~44KB)
- build-course.js: Added `data-section-index` + `data-component-index` attributes to all component sections (active + template variants)
- hydrate.js: Added `loadCourseData()` / `saveCourseData()` for JSON model management
- hydrate.js: Added `enableInlineEditingForSection()` — contenteditable on displayTitle (headings) + body (paragraphs) with real-time JSON sync
- hydrate.js: Visual indicators — blue dashed outline on hover, solid blue + tint on focus
- hydrate.js: Integrated with variant swap — re-enables editing after template swap
- hydrate.js: Editing CSS stylesheet toggled with authoring mode
- QA: 109/0 structural, 43/0 interactive (0 new issues)

### 2026-03-28 — Phase 2e Complete (Matrix Test) — Phase 2 DONE
- Matrix test with 2 brand/topic combinations:
  - **Combo 1:** Landio (dark, neutral SaaS) + Data Privacy & GDPR (data-heavy, case-file archetype)
  - **Combo 2:** Fluence (light, lavender-purple gradient) + Emotional Intelligence in Leadership (narrative, debate archetype)
- Results: Both combos passed 3-gate QA (structural + interactive + visual)
- 1 bug found: accordion body text contrast on dark themes (3.82:1, needs 4.5:1)
  - **Fix:** Changed accordion bodyClass from `text-on-surface-variant` to `text-on-surface/80` — works on both dark and light themes
  - **Classification:** Theme-specific (dark only), objective (WCAG AA), auto-fixed
- Verified fix resolves the issue without regression on light theme

### 2026-03-28 — Phase 2d Complete (Authoring UI Layer)
- Renamed DEV toggle → Authoring Layer across entire codebase:
  - hydrate.js: `initDevMode` → `initAuthoringMode`, `devBtn` → `authoringBtn`, `devActive` → `authoringActive`
  - Button label: `DEV` → `✎ Edit`, `DEV ✓` → `✎ Edit ✓`
  - Data attributes: `data-dev-wrapper` → `data-authoring-wrapper`, `data-dev-variant` → `data-authoring-variant`
  - Console logs, comments, docs all updated
- Added category-coloured authoring panel:
  - build-course.js: `CATEGORY_MAP` (type→category), `data-category` on sections, embedded JSON metadata
  - hydrate.js: Reads category metadata, colours each toolbar by category, adds category badge
  - 6 colours: Content (#3b82f6), Explore (#8b5cf6), Assess (#ef4444), Layout (#22c55e), Media (#06b6d4), Structure (#f59e0b)
  - Variant buttons: white text on category-coloured toolbar (was black on amber)
  - Section outlines: dashed in category colour (was all amber)
- Updated all docs: CLAUDE.md, AUTHORING-LAYER.md, BUILD-SYSTEM.md, CHANGE-AUDIT.md, test-runs.md
- Updated memory files: project_dev_toggle.md, project_reference_test.md, MEMORY.md
- QA: 109/0 structural, 47/0 interactive, visual review clean

### 2026-03-28 — Phase 2c Complete (Build Layer)
- Implemented variant rendering for all 7 remaining Phase 2 components in build-course.js:
  - `narrative`: image-focused (large image + compact text), text-focused (larger text, more padding)
  - `flashcard`: single-large (one card at a time, carousel-style navigation)
  - `checklist`: card-style (separate cards in grid), numbered (numbered indicators)
  - `key-term`: list (vertical definition list in glass card)
  - `labeled-image`: side-panel (image left, marker list panel right)
  - `data-table`: striped-card (prominent card with stronger header/row styling)
  - `branching`: list (vertical stacked list with chevron arrows)
- Added `variant` parameter to all 7 fill function signatures + dispatcher calls
- Full QA gate passed: 109/0 structural, 47/0 interactive, visual review clean
- Design Run completed with Sprig brand: 11 sections, 31 components, 22 types, 100% image coverage

### 2026-03-28 — Phase 2a/2b Audit Fixes
- Added missing variant arrays to 4 pre-existing components: graphic (standard, captioned-card), pullquote (accent-bar, centered, minimal), full-bleed (center, left, right), process-flow (vertical, horizontal) — were in build-course.js but not component-library.json
- Added callout vs text/highlight-box distinction guidance to generation-engine.md
- Added 2 new section patterns (Guided Path, Transition) using callout and divider
- Added 7 new variant selection examples for newly-varianted components
- Replaced 3 empty "no new design needed" stubs in representative-course.md with full content (labeled-image/numbered-dots, data-table/standard, branching/cards)
- Added `required: {}` to divider props + expanded example with componentId
- Updated variant counts: 23 components with variants, 56 total variants
- Component library remains v4.0.0 (28 components)

### 2026-03-28 — Phase 2a Complete (Data Layer)
- Reassigned all 26 components from 5 old categories to 6 new categories (Content, Explore, Assess, Layout, Media, Structure)
- Added `categoryLabel`, `description`, `question` metadata per category in `component_categories`
- Added `divider` component (Structure): 3 variants (line, spacing, icon)
- Added `callout` component (Content): 4 variants (info, warning, tip, success)
- Added `calloutType`, `style`, `icon` props to course-layout.schema.json
- Added 17 new variants across 8 existing components (text, narrative, flashcard, checklist, key-term, labeled-image, data-table, branching)
- Updated generation-engine.md: category table, component selection guidance, expanded variant table, quality checklist
- Updated generation-agent.md: category references, new component guidance
- Component library bumped to v4.0.0 (28 components, 46 variants)

### 2026-03-28 — Document Created
- Created authoring layer architecture document
- Completed industry research (8 tools)
- Defined 6-category system
- Planned Phase 2 (Component Taxonomy + Expanded Palette)
- Identified 7 components to skip for future sessions
- Mapped pipeline integration order

---

## References

| Document | Relevance |
|---|---|
| `CLAUDE.md` | Master index — component list, pipeline steps, variant table |
| `v5/BUILD-SYSTEM.md` | How build-course.js assembles HTML — fill functions, variant rendering |
| `v5/STITCH-INTEGRATION.md` | How Stitch designs components — representative-course.md format |
| `v5/CONTENT-STRUCTURING.md` | How AI selects components — generation engine guidance |
| `v5/schemas/component-library.json` | Source of truth for all component types |
| `v5/prompts/generation-engine.md` | AI prompt for component selection |
| `v5/prompts/representative-course.md` | HTML examples sent to Stitch |
