# CLAUDE.md — Modernisation Engine (Blade Runner Architecture)

## What This Project Is
A browser-based tool that converts legacy SCORM 1.2 e-learning courses (Articulate Storyline exports) into modern, branded, mobile-responsive deep-scroll web experiences. User uploads a SCORM zip/folder, enters a brand URL, and gets a modernised SCORM package back.

## Architecture (Current: Blade Runner Engine)

**Two-layer system:**
1. **Extraction Pipeline** — Browser-based IIFE modules that parse SCORM, plan content, scrape brand
2. **Blade Runner Engine** — Pre-built React + Vite + Tailwind + Framer Motion renderer (single HTML file)

```
index.html                           ← Upload UI (GitHub Pages)
engine/
  scorm-parser.js                    ← Phase 1: SCORM → CourseIR
  content-planner.js                 ← Phase 2: CourseIR → CoursePlan
  brand-scraper.js                   ← Phase 3: URL → BrandProfile
  adapt-translator.js                ← Phase 4: CoursePlan → Adapt JSON
  app.js                             ← Pipeline orchestrator

blade-runner-engine/                 ← React + Vite project (pre-built)
  src/
    components/                      ← 11 premium React components
      ComponentRegistry.js           ← Dynamic component resolution
      CourseRenderer.jsx             ← Recursive JSON → React tree
      HeroSplash.jsx                 ← Full-viewport hero
      TextBlock.jsx                  ← Clean text with glass card
      GraphicBlock.jsx               ← Full-width image
      GraphicText.jsx                ← Split layout (text + image)
      SilkyAccordion.jsx             ← Framer Motion accordion
      MCQPro.jsx                     ← Quiz with feedback
      NarrativeSlider.jsx            ← Carousel for sequential content
      BentoGrid.jsx                  ← Multi-item grid layout
      DataTable.jsx                  ← Technical data display
      MediaBlock.jsx                 ← Video/audio player
      TextInputBlock.jsx             ← Form inputs
      BranchingCards.jsx             ← Decision cards
    store/courseStore.js              ← Zustand state management
    theme/ThemeEngine.js             ← Brand → CSS variables
    services/RepresentationAgent.js  ← AI content → component mapping

blade-runner-template.html           ← Pre-built single-file output (399KB)
```

### Data Flow
```
SCORM Upload → SCORMParser.extractCourse()     → CourseIR
CourseIR      → ContentPlanner.planCourse()     → CoursePlan
Brand URL     → BrandScraper.scrapeBrand()      → BrandProfile
CoursePlan    → AdaptTranslator.translate()     → Adapt JSON (course/articles/blocks/components)
BrandProfile  → ThemeEngine.applyBrand()        → CSS Variables

Adapt JSON + BrandProfile → injected into blade-runner-template.html
                          → single self-contained HTML file
                          → opens in browser, works from file://
```

## Key Data Structures

### Adapt JSON Schema (output of adapt-translator.js)
The engine uses Adapt's JSON hierarchy as its data standard:
```
course.json           → { _id: "course", title, _spoor, _trickle, ... }
contentObjects.json   → [{ _id: "co-100", _parentId: "course", _type: "page" }]
articles.json         → [{ _id: "a-100", _parentId: "co-100", _type: "article" }]
blocks.json           → [{ _id: "b-100", _parentId: "a-100", _type: "block" }]
components.json       → [{ _id: "c-100", _parentId: "b-100", _component: "accordion", ... }]
```

### ID Manager
Central authority for all IDs. Guarantees unique IDs and valid parent refs.
Every component points to a block, every block to an article, every article to a page.
One broken reference = broken course. The ID Manager prevents this.

### Component Types (from ComponentRegistry.js)
| Type | React Component | When Used |
|------|----------------|-----------|
| `hero` | HeroSplash | Opening/title slides |
| `text` | TextBlock | Standard text content |
| `graphic` | GraphicBlock | Full-width images |
| `graphic-text` | GraphicText | Text + image split layout |
| `accordion` | SilkyAccordion | Multi-layer expandable content |
| `mcq` | MCQPro | Quiz questions |
| `narrative` | NarrativeSlider | Sequential carousel content |
| `bento` | BentoGrid | Multi-item grid layout |
| `data-table` | DataTable | Technical/structured data |
| `media` | MediaBlock | Video/audio |
| `textinput` | TextInputBlock | Form fields |
| `branching` | BranchingCards | Decision/path selection |

### RepresentationAgent (services/RepresentationAgent.js)
Analyzes content characteristics and assigns the best component type:
- 4+ short text items → BentoGrid
- Layers with substantial text → Accordion
- Sequential layers with images → NarrativeSlider
- Quiz data → MCQPro
- Image + text → GraphicText split layout
- Structured items with separators → DataTable

## The Pipeline

| Phase | Module | What It Does |
|-------|--------|-------------|
| 1 | scorm-parser.js | Parse Storyline SCORM data into CourseIR |
| 2 | content-planner.js | Clean noise, group into sections, classify presentation |
| 3 | brand-scraper.js | Scrape brand website for design tokens via CORS proxy |
| 4 | adapt-translator.js | Convert CoursePlan → Adapt JSON with ID Manager |
| 5 | app.js | Inject JSON + brand into pre-built Blade Runner template |
| 6 | app.js (JSZip) | Package as SCORM zip (HTML + images) |

## Blade Runner Engine (React Renderer)

### Tech Stack
- React 19 + Vite 8
- Tailwind CSS v4 (via @tailwindcss/vite)
- Framer Motion (animations)
- Zustand (state management)
- vite-plugin-singlefile (single HTML output)

### Building the Template
```bash
cd blade-runner-engine
npm install
npx vite build
cp dist/index.html ../blade-runner-template.html
```

### How It Works
1. The template is pre-built ONCE during development (399KB single HTML)
2. At runtime, app.js fetches the template and injects `window.courseData` + `window.brandData`
3. React reads from Zustand store, which loads from `window.courseData`
4. ThemeEngine applies brand CSS variables from `window.brandData`
5. CourseRenderer recursively maps JSON → React components
6. Preview opens as blob URL in new tab (works from file://)

### Design System
- **Aesthetic:** "Linear.app meets Blade Runner 2049"
- **Theme:** Dark mode default, light mode via brand detection
- **Typography:** Satoshi/Inter, CSS variable-driven
- **Cards:** Glassmorphism (backdrop-blur, semi-transparent borders)
- **Animations:** Framer Motion scroll-reveal, staggered entrances
- **Colors:** All via CSS custom properties (--brand-primary, etc.)

### State Management (Zustand)
```
useCourseStore:
  course, contentObjects, articles, blocks, components  ← Course data
  brand                                                  ← Brand profile
  scrollProgress                                         ← 0-100
  activeAccordions                                       ← { componentId_itemIndex: true }
  quizAnswers                                            ← { componentId: answerIndex }
  completedSections                                      ← { articleId: true }
```

Exposed as `window.courseData` for future AI editing bridge.

## CORS Proxy
Brand scraping requires a CORS proxy (Cloudflare Worker):
`https://cors-proxy.leoduncan-elearning.workers.dev`

## Test Files
- `TEST SCORM/` — Small test SCORM (committed to repo)
- `EV/` — Full 108-slide EV course (gitignored, uploaded to Codespace)
- `test/screenshots/` — Visual audit screenshots (overwritten each run)

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
The brand URL website is the ONLY source of truth for visual branding.
The original SCORM course's colors and styling are IRRELEVANT.
The SCORM file provides CONTENT and STRUCTURE.
The brand URL provides VISUAL IDENTITY.

## Component Development Guidelines

When building or improving components, reference these e-learning authoring tools
for interaction design patterns:
- **Articulate Rise 360** — gold standard for scrolling e-learning interactions
- **Adapt Framework** — component library documentation and JSON schemas
- **H5P** — interactive content types and patterns

Every component must:
1. Accept Adapt-standard JSON props (`data` object with `_id`, `_component`, etc.)
2. Use CSS custom properties for ALL brand-specific colors
3. Include Framer Motion scroll-reveal animations
4. Be responsive (mobile-first)
5. Have a `data-component-id` attribute for future AI editing
6. Handle missing/empty data gracefully (don't render empty cards)

## Known Issues & Next Steps
- Images don't load from blob URLs (need base64 embedding)
- Brand scraper fails on some sites (CORS/timeout)
- Tailwind classes need verification in build output
- Components need more glassmorphism/spacing polish
- No SCORM tracking in the React output yet (need lightweight shim)
