# Authoring Layer — Architecture & Progress Tracker

> **Living document.** Updated after every commit/push. Tracks what's done, what's next, what was skipped, and knock-on effects.

**Branch:** `authoring-layer-v1`
**Started:** 2026-03-28
**Last updated:** 2026-03-28

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
Phase 1: Authoring Layer v1          DEV variant toggle                    DONE
Phase 2: Component Taxonomy          Categories + new components +         IN PROGRESS
         + Expanded Palette          new variants + AI guidance
Phase 3: Inline Editing              Edit text + swap component type       PLANNED
Phase 4: Section Management          Reorder + add/remove + width control  PLANNED
Phase 5: AI-Assisted Editing         "Regenerate section" + category       PLANNED
                                     browser for manual add
Phase 6: Full Authoring              Blank course creation + complex       PLANNED
                                     assessment types (matching, etc.)
```

---

## Phase 2: Component Taxonomy + Expanded Palette

### 2a — Data Layer (no pipeline run needed)

- [ ] **Fix component categories in component-library.json**
  - [ ] Rename/reassign all 26 components to 6 new categories
  - [ ] Add `categoryLabel` and `categoryDescription` metadata
  - [ ] Validate every component's category assignment makes sense

- [ ] **Add new component: `divider`** (Structure category)
  - [ ] Add to component-library.json (type, category, props, variants, learningMoment, creativeUses)
  - [ ] Add to course-layout.schema.json type enum
  - Variants: `line` (default), `spacing` (whitespace only), `icon` (centered icon break)
  - Props: `style` (line/spacing/icon), optional `icon` name
  - Zero interactivity — pure visual

- [ ] **Add new component: `callout`** (Content category)
  - [ ] Add to component-library.json
  - [ ] Add to course-layout.schema.json type enum
  - Variants: `info` (default), `warning`, `tip`, `success`
  - Props: `displayTitle`, `body`, `calloutType` (info/warning/tip/success)
  - Zero interactivity — pure styled HTML

- [ ] **Add new variants to existing components** (17 new variants across 8 components)
  - [ ] `text`: `standard` (default), `two-column`, `highlight-box`
  - [ ] `narrative`: `image-focused`, `text-focused`
  - [ ] `flashcard`: `grid`, `single-large`
  - [ ] `checklist`: `standard` (default), `card-style`, `numbered`
  - [ ] `key-term`: `list` (default), `card-grid`
  - [ ] `labeled-image`: `numbered-dots` (default), `side-panel`
  - [ ] `data-table`: `standard` (default), `striped-card`
  - [ ] `branching`: `cards` (default), `list`

- [ ] **Update generation-engine.md** — rewrite component selection guidance using new categories
- [ ] **Update generation-agent.md** — reference categories in task prompt

### 2b — Stitch Layer (requires Design Run)

- [ ] **Update representative-course.md** — add HTML examples for:
  - [ ] `divider` (all 3 variants)
  - [ ] `callout` (all 4 variants)
  - [ ] All 17 new variants of existing components
- [ ] **Run Stitch** (Step 3) to design new components + variants
- [ ] **Run extract-contract.js** to extract new patterns

### 2c — Build Layer (after Stitch designs exist)

- [ ] **Update build-course.js**
  - [ ] Add `fillDivider()` function
  - [ ] Add `fillCallout()` function
  - [ ] Add variant rendering for text (2 new variants)
  - [ ] Add variant rendering for narrative (2 new variants)
  - [ ] Add variant rendering for flashcard (2 new variants)
  - [ ] Add variant rendering for checklist (2 new variants)
  - [ ] Add variant rendering for key-term (1 new variant)
  - [ ] Add variant rendering for labeled-image (1 new variant)
  - [ ] Add variant rendering for data-table (1 new variant)
  - [ ] Add variant rendering for branching (1 new variant)
- [ ] **Update hydrate.js** — minimal (callout/divider need no interactivity)
- [ ] **Update extract-contract.js** if needed for new component patterns
- [ ] **Update DEV toggle** — variant switcher for all newly variant-enabled components

### 2d — Authoring UI Layer

- [ ] **Update DEV toggle panel** — group variants by category
- [ ] **Add category headers/tabs** to variant browser
- [ ] **Visual indicators** for which category each section's component belongs to

### 2e — QA + Validation

- [ ] **Update qa-course.js** — validate new component types
- [ ] **Update qa-interactive.js** — add tests for new variants
- [ ] **Update validate-layout.js** — accept new types in validation
- [ ] **Run full QA gate** (6a → 6b → 6c)
- [ ] **Matrix test** with at least 2 brand/topic combinations

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

### Current: 13 components, ~22 variants
### Target: 21 components with variants, ~39 variants

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
| graphic | Content | standard, captioned-card |

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
- **DEV toggle UI:** Currently shows variants as a flat list. Will need category grouping to stay usable as variant count grows from ~22 to ~39.

---

## Changelog

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
