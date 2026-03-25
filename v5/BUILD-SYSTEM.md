# Build System

> **Status:** Implemented and working. Verified across 9+ brands.
> **Last updated:** 2026-03-25

This document covers how the Modernisation Engine assembles the final course HTML from the design contract, design tokens, course layout, and images. It includes the layout rules, fill function conventions, head generation, and hydration system.

---

## Design/Layout Separation (Core Principle)

Stitch controls **DESIGN**: colours, fonts, shadows, gradients, hover effects, brand-specific card backgrounds.
We control **LAYOUT**: grids, containment, overflow, spacing, positioning, HTML structure.

**How it works:**

1. **`generateHead()`** builds the entire `<head>` from `design-tokens.json` — Tailwind config (colours + fonts), Google Fonts, Material Symbols, and our own CSS definitions for `glass-card`, `text-gradient`, `btn-primary`, `glass-nav`. **Never copies Stitch's raw `<head>`.**

2. **`design-contract.json`** is the single interface between Stitch's design and our build. It's produced by `extract-contract.js` (cheerio-based, runs automatically after Stitch). Contains per-component visual properties (shadows, backgrounds, borders, hover effects, button styles). `build-course.js` reads ONLY this JSON — never Stitch's raw HTML patterns.

3. **Fill functions** own the HTML structure and layout classes. For each component:
   - Layout classes are hardcoded (grids, containment, spacing, typography scale)
   - Visual classes come from `design-contract.json` (shadows, hovers, gradients, brand colours)
   - Content comes from course-layout.json (100% SCORM fidelity)

4. **If Stitch changes its HTML output**, fix `extract-contract.js` (one file). The 25 fill functions in `build-course.js` don't change.

**Result:** Different brand URL → different Stitch kit → different visual character, identical layout. Verified across 9+ brands.

---

## Layout Rules (Non-Negotiable)

Every fill function enforces these rules. They are hardcoded in `build-course.js`, not derived from Stitch:

1. **Containment:** Every component gets `max-w-6xl mx-auto px-8` — no content touches screen edges. The `<section>` tag handles spacing/background only (via `sectionOnly()` helper that strips containment classes from Stitch patterns). An inner `<div>` provides containment.

2. **Grids/flex:** Every grid and flex layout gets explicit `gap-*` classes and minimum column widths (`min-w-[...]`) — no text wrapping per-word in narrow columns. Smart column counts avoid orphan items (e.g., 4 items use 2x2, not 3+1).

3. **Typography:** Headings use a consistent scale — `h2 = text-3xl`, `h3 = text-2xl`, `h4 = text-xl` — no random size spikes. Hero `h1` is exempt (uses `text-6xl md:text-8xl`).

4. **Theme-safe colours:** All semi-transparent overlays use `on-surface/5` (not `white/5`) — adapts to both light and dark themes. `on-surface` resolves to black on light, white on dark.

5. **Nav enforcement:** `buildNav()` injects required layout classes (`fixed`, `flex`, `justify-between`, `items-center`, `h-20`) if Stitch's nav pattern omits them. Max 5 nav links with `whitespace-nowrap`.

6. **Graphic max-height:** Standalone images get `max-h-[60vh]` to prevent viewport domination.

7. **Flashcard visibility:** Front faces get `shadow-md border border-outline-variant/10` so cards are visible on light themes where `glass-card` may be transparent.

8. **Responsive padding:** All glass-card containers use `p-6 md:p-12` — prevents content cramping on mobile (375px viewport). Applies to MCQ cards, text input cards, tab panels, narrative cards, branching cards, checklist cards.

9. **Flashcard 3D via inline styles:** `perspective`, `transform-style`, `backface-visibility`, and `transform: rotateY(180deg)` use inline `style` attributes, NOT Tailwind utility classes — Tailwind CDN doesn't generate `perspective-*` or `rotate-y-*` utilities.

10. **Tabs structure:** Tab panels (`[data-tab-panel]`) must be INSIDE the `[data-tabs]` wrapper, not siblings — hydrate.js scopes its `querySelectorAll` to the container.

---

## Fill Function Conventions

Each of the 25 component types has a `fill{Type}(comp, index)` function in `build-course.js`. Every fill function follows the same pattern:

```
1. Read visual properties from DC (design-contract.json) with safe fallbacks
2. Extract content from the component object (comp.displayTitle, comp.body, comp._items, etc.)
3. Build HTML with:
   - Section tag: sectionOnly(contractSection) for spacing/background only
   - Inner div: max-w-6xl mx-auto px-8 for containment
   - Layout classes: hardcoded grids, gaps, typography scale
   - Visual classes: from design contract (shadows, hovers, gradients)
   - Content: escaped text from course-layout.json
4. Embed images as base64 via embedImage()
5. Return the complete HTML string
```

**Helper functions:**
- `esc(s)` — HTML-escapes text
- `stripTags(html)` — removes HTML tags for plain text contexts
- `embedImage(path)` — reads image file, returns base64 data URI
- `sectionOnly(cls)` — strips containment/grid classes from Stitch section patterns
- `mc(...parts)` — merges class strings, filtering empty/null, deduplicating

---

## generateHead()

Builds the entire `<head>` from `design-tokens.json`. This is the ONLY place that translates Stitch's design tokens into CSS/config.

**What it generates:**
- Tailwind CDN script with custom colour config (all colours from Stitch)
- Google Fonts link for headline + body + label fonts
- Material Symbols Outlined font
- Custom CSS definitions: `body` base styles, `.glass-card`, `.glass`, `.glass-nav`, `.text-gradient`, `.btn-primary`, `#scroll-progress`, scrollbar styles
- All custom CSS uses colour values from `design-tokens.json` — adapts to any brand

**What it never does:**
- Copy Stitch's raw `<head>` content
- Include Stitch's CSS directly

---

## Page Assembly

`build()` in `build-course.js` assembles the final HTML:

1. Load `course-layout.json`, `design-contract.json`, `design-tokens.json`
2. Generate `<head>` from tokens via `generateHead()`
3. Build nav from contract via `buildNav()`
4. For each section in course-layout.json:
   - Render section title bar with accent lines
   - For each component: call the appropriate fill function
5. Add "Course Complete" section
6. Build footer from contract via `buildFooter()`
7. Inline `hydrate.js` as a `<script>` block
8. Write to `v5/output/course.html` AND root `index.html` (identical copies)

The output is a **single self-contained HTML file** — all images are base64-embedded, all JS is inlined, all CSS is via Tailwind CDN + inline `<style>` blocks.

---

## Hydration (hydrate.js)

Vanilla JS IIFE injected into the final HTML. Uses ES5 `var` declarations for maximum compatibility. Handles runtime interactivity:

- **Quizzes**: Select answer → submit → correct/incorrect feedback → retry. Correct answer resolved by reading `data-correct` index from the quiz container and looking up `choices[idx]`. Submit button and feedback are injected inside the glass-card (choice container's parent), not the outer section.
- **Accordions**: Native `<details>` with smooth CSS animation (injected keyframes)
- **Tabs**: Click tab → show panel. Active/inactive styling captured from Stitch's initial class strings at init time, then swapped as full `className` — works with any Stitch button style (pills, underlines, etc.)
- **Flashcards**: Click to flip via inline `style.transform = 'rotateY(180deg)'` (not Tailwind class toggle)
- **Carousels/Narratives**: Prev/next navigation with dot indicators, disabled state on boundaries
- **Checklists**: Check/uncheck with progress tracking. Build-course.js writes a static counter with `data-checklist-progress` attr — hydrate.js finds and reuses it instead of creating a duplicate
- **Scroll progress bar**: Fixed bar at top showing read percentage
- **Smooth scroll**: Anchor link navigation for nav links

### State Store for Conditional Content (IMPLEMENTED)

hydrate.js includes a minimal state store for conditional rendering:
- A `var state = {}` map initialized from `window.__PATH_GROUPS__` (injected by build-course.js from content-bucket.json)
- `data-show-if` attribute handling: parses `"VarA=true|VarB=true"` conditions with OR logic
- `[data-path-selector]` click handler: sets the selected variable to true, others in the group to false, calls `applyState()`
- `applyState()` shows/hides all `[data-show-if]` elements based on current state
- `sessionStorage` persistence so path selection survives page reload

This is NOT a Storyline trigger engine — it's a conditional renderer.

### Course Gate (IMPLEMENTED)

When a path-selector exists, the course enforces a "choose before continuing" pattern:
- **build-course.js** wraps all content after the path-selector section in `<div data-course-gate class="gated">`
- **hydrate.js** checks on load: if no path variable is true, keeps the `.gated` class which applies `filter: blur(6px); opacity: 0.3; pointer-events: none; max-height: 60vh; overflow: hidden` with a gradient fade-out
- On path selection: removes `.gated`, smooth-scrolls to the unlocked content
- On reload with `sessionStorage` state: gate is removed immediately (no re-selection needed)

The blurred preview communicates "there's content here, choose your path first" — better UX than hiding everything or showing a blank page.

### Section Progress Tracking (IMPLEMENTED)

Tracks interactive component completion per section and shows progress in the nav:
- **build-course.js** emits `data-section-track="{sectionId}" data-interactive-count="{N}"` on sections containing interactive components (MCQ, accordion, tabs, flashcard, narrative, checklist, textinput)
- **build-course.js** injects `window.__SECTION_GATING__` from content-bucket's `sectionGating` array
- **hydrate.js** `updateNavProgress()` counts completed interactives per section:
  - Quizzes: answered (feedback visible)
  - Accordions: all `<details>` opened at least once
  - Tabs: all triggers clicked
  - Checklists: all checkboxes checked
- Nav links get progress indicators: `(2/5)` in progress, checkmark icon when complete
- Uses MutationObserver on quizzes + event delegation on accordions/tabs for live updates

### Required-Items Completion (IMPLEMENTED)

Components tagged with `data-required-items="N"` by the layout engine get a completion counter:
- Progress indicator shows `"X / N explored"` and updates as sub-items are interacted with
- Completed state: checkmark icon + "All items explored" message
- Feeds into section progress tracking via `data-items-complete="true"`

### Draw Randomization (IMPLEMENTED)

When question bank draws have `poolSize > drawCount`:
- **build-course.js** emits `data-draw-count`, `data-draw-pool`, and `data-draw-shuffle` on MCQ sections
- **hydrate.js** groups MCQs by nearest section/showIf wrapper, shuffles if flagged, hides extras via `display: none`
- Runs at init time before quiz handlers, so hidden quizzes don't interfere with interaction

### Scroll Animations (IMPLEMENTED)

GSAP ScrollTrigger + SplitType for premium scroll-triggered animations. ~50KB from CDN. NO Lenis or smooth scroll overrides (user rejected as unresponsive — native scroll only).

**CDNs added to `generateHead()`:**
- `gsap@3.12.7/dist/gsap.min.js` + `ScrollTrigger.min.js`
- `split-type@0.3.4/umd/index.min.js`

**Data attributes added by `build-course.js` fill functions:**
- `data-animate="fade-up|slide-in-left|slide-in-right|scale-in|clip-up"` — per-element animation type
- `data-animate-stagger="fade-up|scale-in"` — on containers; children animate with stagger delay
- `data-parallax` — scroll-linked parallax (hero bg, full-bleed images)
- `data-text-reveal` — SplitType line-by-line text reveal (hero title, pullquotes)
- `data-counter` — stat number count-up animation
- `data-accent-bar` — pullquote border-left grow animation

**Per-component animation map:**
| Component | Animation |
|---|---|
| hero | Title: text-reveal. BG: parallax. Subtitle/CTA: fade-up with staggered delay |
| text | fade-up |
| graphic-text | Image: slide-in from image side. Text: fade-up |
| graphic, media, labeled-image | clip-up (clip-path reveal) |
| bento, key-term, checklist, branching | Stagger fade-up on children |
| flashcard, path-selector, image-gallery | Stagger scale-in on children |
| accordion, timeline, process-flow | Stagger fade-up on children |
| stat-callout | Stagger fade-up + counter animation on numbers |
| pullquote | text-reveal + accent-bar grow |
| comparison, data-table, textinput, mcq, tabs, narrative, video-transcript | fade-up |
| full-bleed | BG: parallax. Text overlay: fade-up |

**CSS initial states** hide animated elements (`opacity: 0` + transform). GSAP reveals on scroll trigger (`top 85%`, `once: true`). Hero elements animate immediately on page load (above fold).

**Accessibility:** `@media (prefers-reduced-motion: reduce)` overrides all initial states to visible. If GSAP fails to load from CDN, fallback shows all elements immediately.

**Deterministic:** Component type → animation recipe. No AI/LLM in the loop.

---

## Image Embedding

All images are base64-encoded into the HTML at build time via `embedImage()`. This makes the output self-contained but potentially large.

Supported formats: JPEG, PNG, GIF, WebP, SVG. MIME types are mapped from file extensions.

If an image path doesn't resolve to a file on disk, the raw path string is used as-is (fallback for external URLs).
