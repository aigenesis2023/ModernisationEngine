# CLAUDE.md — Modernisation Engine

## What This Project Is
A browser-based tool that converts legacy SCORM 1.2 e-learning courses (Articulate Storyline exports) into modern, branded, mobile-responsive deep-scroll web experiences. User uploads a SCORM folder, enters a brand URL, and gets a modernised SCORM package back.

**Live at:** https://aigenesis2023.github.io/ModernisationEngine/

---

## File Structure

```
index.html                           ← Upload UI served on GitHub Pages
engine/
  scorm-parser.js        (1093 loc)  ← Phase 1: SCORM → CourseIR
  content-planner.js     (1317 loc)  ← Phase 2: CourseIR → CoursePlan
  brand-scraper.js        (470 loc)  ← Phase 3: URL → BrandProfile
  adapt-translator.js     (853 loc)  ← Phase 4: CoursePlan → Adapt JSON
  app.js                  (579 loc)  ← Pipeline orchestrator + SCORM packager

blade-runner-engine/                 ← React + Vite project (pre-built into single HTML)
  src/
    App.jsx                          ← Entry: loads window.courseData + window.brandData
    main.jsx                         ← React root mount
    index.css                        ← Design system: CSS variables, focus states, scrollbar
    components/
      ComponentRegistry.js           ← Maps type strings → React components
      CourseRenderer.jsx   (268 loc) ← Recursive JSON → React tree, scroll progress, sections
      HeroSplash.jsx       (138 loc) ← Full-viewport hero with letter animation + bg image
      TextBlock.jsx         (48 loc) ← Simple text with heading
      GraphicBlock.jsx      (80 loc) ← Full-width image with hover zoom
      GraphicText.jsx      (121 loc) ← Side-by-side text + image split layout
      SilkyAccordion.jsx   (213 loc) ← Expandable panels with completion tracking
      MCQPro.jsx           (310 loc) ← Quiz with selection, submit, feedback, retry
      NarrativeSlider.jsx  (201 loc) ← Prev/next carousel with dots + counter
      BentoGrid.jsx        (167 loc) ← Multi-card grid with image backgrounds
      DataTable.jsx        (185 loc) ← Auto-parsed table from HTML body content
      MediaBlock.jsx       (181 loc) ← Video player with custom play overlay
      TextInputBlock.jsx   (157 loc) ← Multi-field form with labels + submit
      BranchingCards.jsx   (197 loc) ← Selectable option cards with letter badges
    store/courseStore.js              ← Zustand: course data, UI state, brand
    theme/ThemeEngine.js             ← Applies BrandProfile → CSS custom properties

blade-runner-template.html  (405KB)  ← Pre-built single-file HTML (React+CSS+JS inlined)
```

---

## Pipeline: How It Works End-to-End

All 6 phases run **in the browser** when the user clicks "Generate". No server.

### Phase 1 — SCORM Parsing (`scorm-parser.js`)
- Reads uploaded `fileMap` (Map<relativePath, File>) built from folder upload
- Parses `imsmanifest.xml` for course title, ID, mastery score, SCORM version
- Finds Storyline data JS files in `html5/data/js/` — each is one slide
- Parses each via `window.globalProvideData('slide', 'JSON')` pattern using Function constructor
- Extracts from each slide: objects (text, images, buttons, shapes), layers, triggers, states
- Classifies images by role: `background`, `hero`, `content`, `icon`, `decorative` (based on size/coverage/depth)
- Detects quiz data (pick-one, pick-many, true/false) from Storyline accType patterns
- Detects form fields, video/audio, sliders, scroll panels, 360-images
- **Output:** `CourseIR` — { meta, slides[], questionBanks[], navigation, variables, assets }

### Phase 2 — Content Planning (`content-planner.js`)
- **Noise filtering:** Removes 273+ categories of Storyline junk — auto-generated labels ("Rectangle 1"), icon alt-text ("arrow icon 1"), shape names, object hashes, ALL CAPS internal names, quiz type labels
- **Section grouping:** Groups slides into sections based on Storyline scene boundaries
- **Presentation classification:** Each slide gets a `presentation` type: `hero`, `narrative`, `interactive`, `media-feature`, `quiz`, `form`, `branching`
- **Image filtering:** Skips decorative/icon images, allows one background per section, deduplicates
- **Title derivation:** If manifest title is too short (< 5 chars, like "EV"), derives from first section title or heading
- **Output:** `CoursePlan` — { meta, sections[], quizBanks[], verification }

### Phase 3 — Brand Scraping (`brand-scraper.js`)
- Fetches brand URL via CORS proxy: `https://cors-proxy.leoduncan-elearning.workers.dev?url=...`
- 10-second timeout on main fetch, 5-second timeout per external stylesheet
- Parses HTML with DOMParser, collects all CSS (inline `<style>`, external `<link>`, `[style]` attrs)
- **Color extraction:** Finds hex/rgb colors, maps to roles (primary, secondary, accent) by saturation + context (background, border, theme-color meta)
- **Dark/light detection:** Counts dark vs light background occurrences, checks body/html background
- **Typography:** Extracts font-family declarations, finds Google Fonts imports, detects heading weight
- **Style:** Detects border-radius, glassmorphism (backdrop-filter + transparent bg), button style (pill/rounded/solid), card style (glass/elevated/outlined/flat), mood (creative/corporate/elegant)
- **Logo:** Tries header selectors, `.logo img`, og:image fallback
- **Fallback:** If fetch fails, returns generic purple/dark profile
- **Output:** `BrandProfile` — { colors, typography, style, logo }

### Phase 4 — Adapt Translation (`adapt-translator.js`)
- **ID Manager:** Central authority for all IDs — guarantees every component→block→article→page chain is valid. One broken reference = broken course.
- Creates single-page deep-scroll structure: 1 page, N articles (sections), N blocks (slides), N components
- **Article displayTitle** is set from section title (except hero sections) — this is what renders as section headers
- **Component type mapping** (this is critical — determines which React component renders):

| Slide Content | Component Type | React Component |
|---|---|---|
| `presentation: 'hero'` or `section.type: 'hero'` | `hero` | HeroSplash (full-viewport, animated title, bg image) |
| Has video | `media` | MediaBlock (video player with play overlay) |
| `interactive` layers + mostly images | `narrative` | NarrativeSlider (prev/next carousel) |
| `interactive` layers, text-heavy | `accordion` | SilkyAccordion (expandable panels) |
| `form` with formFields | `textinput` | TextInputBlock (all fields grouped, one submit) |
| `quiz` with quizData | `mcq` | MCQPro (selection + submit + feedback + retry) |
| `branching` with interactions | `branching` | BranchingCards (selectable option cards) |
| Has image + text | `graphic-text` | GraphicText (side-by-side split) |
| 4+ short texts (< 120 chars each), no images | `bento` | BentoGrid (multi-card grid) |
| 3+ texts with separators (` - `, `:`, `\|`) | `data-table` | DataTable (auto-parsed table) |
| Has image only | `graphic` | GraphicBlock (full-width with hover zoom) |
| Default (text only) | `text` | TextBlock |

- **Image paths:** `adaptImagePath()` strips directory, prepends `course/en/images/filename`
- **Output:** Adapt JSON — { course, contentObjects[], articles[], blocks[], components[] }

### Phase 5 — Template Injection + Image Embedding (`app.js`)
- Fetches `blade-runner-template.html` (tries 3 paths)
- Verifies it's actually the React app (checks for 'courseData' or 'react' in HTML)
- **Image embedding:**
  - Stringifies ALL adapt JSON, scans for image filenames
  - Iterates fileMap for `.jpg|.jpeg|.png|.gif|.svg|.webp` files
  - Matches by filename (not directory) — catches `mobile/` files referenced as `story_content/`
  - Reads matching files as ArrayBuffer → base64 data URLs
  - Caps: **6MB total**, **800KB per image** — skips larger ones
  - Replaces `course/en/images/filename` paths with `data:image/...;base64,...` in ALL JSON
  - Debug logging when 0 images match (shows JSON refs vs SCORM files)
- Injects `<script>window.courseData = {...}; window.brandData = {...};</script>` before `</head>`

### Phase 6 — SCORM Packaging (`app.js` + JSZip)
- Creates ZIP with: `index.html` (the injected template), `imsmanifest.xml`
- Copies original images from `story_content/` and `mobile/` into `course/en/images/`
- Copies video files from `story_content/` into `course/en/video/`
- Compresses with DEFLATE level 6
- User downloads as `modernised-course.zip`

---

## Blade Runner Engine (React Renderer)

### Tech Stack
- React 19.2 + Vite 8.0
- Tailwind CSS 4.2 (via @tailwindcss/vite)
- Framer Motion 12.38 (scroll-reveal animations)
- Zustand 5.0 (state management)
- vite-plugin-singlefile 2.3 (inlines all JS/CSS into one HTML)

### Building the Template
```bash
cd blade-runner-engine
npm install
npx vite build
cp dist/index.html ../blade-runner-template.html
```
**IMPORTANT:** After any component/CSS change, you MUST rebuild and commit `blade-runner-template.html`. The pipeline fetches this file at runtime — it doesn't build React on the fly.

### How the Renderer Works
1. `App.jsx` reads `window.courseData` and `window.brandData` (injected by pipeline)
2. `courseStore.js` (Zustand) stores all course data + UI state (scroll progress, accordion state, quiz answers)
3. `ThemeEngine.js` applies brand colors/fonts/radius as CSS custom properties on `:root`
   - Handles dark mode (white glass overlays) and light mode (white fills, dark borders)
   - Sets `--ui-button-radius` from brand `buttonStyle` (pill/rounded/default)
4. `CourseRenderer.jsx` renders the tree:
   - Progress bar (fixed top, gradient)
   - Course header (hidden when HeroSplash exists)
   - For each article → `ArticleSection` with alternating backgrounds, section title + accent bar
   - Hero sections render full-width (no max-width container)
   - For each block → `BlockRow` with glass card wrapper (backdrop-blur)
   - For each component → resolved via `ComponentRegistry.js` → rendered
5. All components use Framer Motion `useInView` for scroll-triggered entrance animations

### CSS Design System (`index.css`)
All colors/fonts/radii are CSS custom properties overridden by ThemeEngine at runtime:
```
--brand-primary, --brand-secondary, --brand-accent, --brand-heading
--brand-bg, --brand-surface, --brand-text, --brand-text-muted
--brand-success, --brand-error, --brand-gradient, --brand-glow
--ui-glass, --ui-glass-border, --ui-glass-hover
--ui-radius, --ui-radius-sm, --ui-radius-lg, --ui-button-radius
--font-heading, --font-body
```
Also includes: focus-visible states, link styling in body content, image loading backgrounds, custom scrollbar, `prefers-reduced-motion` support.

### Zustand Store (`courseStore.js`)
```
course, contentObjects, articles, blocks, components  ← Course data
brand                                                  ← Brand profile
scrollProgress                                         ← 0-100
activeAccordions                                       ← { componentId_itemIndex: true }
quizAnswers                                            ← { componentId: answerIndex }
completedSections                                      ← { articleId: true }
```
Actions: `loadCourse`, `loadBrand`, `toggleAccordion`, `submitAnswer`, `completeSection`, `updateComponent`.
Exposed as `window.courseData` for potential future AI editing bridge.

---

## CORS Proxy
Brand scraping requires a CORS proxy (Cloudflare Worker):
`https://cors-proxy.leoduncan-elearning.workers.dev`
Used as: `proxy?url=<encoded-brand-url>`. Timeout: 10s main, 5s per stylesheet.

## Test Files
- `TEST SCORM/` — Small test SCORM (committed to repo)
- `EV/` — Full 108-slide EV course (gitignored, too large for git, uploaded to Codespace)

---

## Pipeline Diagnostics
Each pipeline phase logs timing and content breakdowns in the progress log:
- **Phase 1:** `(Xms): N slides, M objects`
- **Phase 2:** `(Xms): N sections, title="..."`
- **Phase 3:** `(Xms): primary=#..., font=..., theme=..., bg=#...`
- **Phase 4:** `(Xms): N sections, M blocks, P components [hero:1, graphic-text:5, accordion:3, ...]`
- **Phase 5:** `Found N referenced images (out of M total)` + DEBUG lines when 0 match

---

## ⛔ ABSOLUTE RULE — UNIVERSAL ENGINE, NOT SPECIFIC FIXES

**Every engine change must work for ANY Storyline SCORM file.**

The test SCORM files are diagnostic tools that REVEAL categories of problems.
They are NOT the product. Fixing specific output for specific test files is
COUNTERPRODUCTIVE — it gives a false sense of progress.

**Before writing ANY code, ask:** "If someone uploaded a Storyline course about
cooking safety, marine biology, or HR compliance, would this change help THAT course?"

**The process:**
1. Name the CATEGORY, not the symptom
2. Research how Storyline produces this category UNIVERSALLY
3. Design the rule based on STRUCTURAL PATTERNS
4. Implement — test output should improve as a BYPRODUCT

**Branding source of truth:**
- Brand URL website → ONLY source for visual identity (colors, fonts, logo, style)
- SCORM file → ONLY source for content and structure
- Original SCORM styling is IRRELEVANT

---

## Component Development Guidelines

Reference these tools for interaction design patterns:
- **Articulate Rise 360** — gold standard for scrolling e-learning interactions
- **Adapt Framework** — component library documentation and JSON schemas
- **H5P** — interactive content types and patterns

Every component must:
1. Accept Adapt-standard JSON props (`data` object with `_id`, `_component`, etc.)
2. Use CSS custom properties for ALL brand-specific colors (never hardcode colors)
3. Include Framer Motion scroll-reveal animations via `useInView`
4. Be responsive (mobile-first)
5. Have `data-component-id` attribute on wrapper div (for future AI editing)
6. Handle missing/empty data gracefully (return null, don't render empty cards)
7. Handle image load errors with `onError` fallback (hide broken images)

---

## Known Issues & Next Steps

### Critical
- **Image display unverified:** Storyline data references `story_content/` paths but files often live in `mobile/`. Embedding code matches by filename so it SHOULD work — needs end-to-end testing. Debug logging added.
- **SCORM tracking:** No LMS tracking shim in React output. Course won't record progress/completion.

### Content Gaps
- Drag-and-drop content presented as plain text (needs matching exercise interaction)
- 360-image content extracted but no interactive viewer
- Results routing untested with actual quiz completion flow

### Polish
- Mobile responsive pass needed across all components
- Brand scraper fails on some sites (CORS/timeout) — uses generic fallback
