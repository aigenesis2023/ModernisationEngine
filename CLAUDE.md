# CLAUDE.md — Modernisation Engine

## What This Project Is
A browser-based tool that converts legacy SCORM 1.2 e-learning courses (Articulate Storyline exports) into modern, branded, mobile-responsive deep-scroll web experiences. The user uploads a SCORM zip/folder, enters a brand URL, and gets a modernised SCORM package back.

## Architecture

**Single-page app. No build step. No npm. Pure browser JavaScript using IIFE modules.**

```
index.html                  ← UI: upload zone, brand URL input, preview, download
engine/
  app.js                    ← Orchestrator: wires the 6-phase pipeline
  scorm-parser.js           ← Phase 1: Extracts CourseIR from Storyline data files
  content-planner.js        ← Phase 2: Intelligence layer — cleans, structures, plans presentation
  brand-scraper.js          ← Phase 3: Scrapes brand colors/fonts/logo from URL
  image-generator.js        ← Phase 4: Generates context-aware AI images via Pollinations API
  generator-data.js         ← Phase 5a: Converts CoursePlan → section/quiz JSON
  generator-css.js          ← Phase 5b: Generates brand-aware deep-scroll CSS
  generator-app.js          ← Phase 5c: Generates deep-scroll React app + SCORM adapter
  packager.js               ← Phase 6: Creates SCORM 1.2 zip with JSZip
```

### Module Loading Order (in index.html)
JSZip CDN → scorm-parser → content-planner → brand-scraper → image-generator → generator-css → generator-data → generator-app → packager → app.js

### Data Flow
```
SCORM Upload → SCORMParser.extractCourse()     → CourseIR
CourseIR     → ContentPlanner.planCourse()      → CoursePlan (sections, verification)
Brand URL    → BrandScraper.scrapeBrand()       → BrandProfile
CourseIR     → ImageGenerator.generateImages()  → ImageManifest
(CoursePlan, BrandProfile, ImageManifest) → GeneratorApp.generateHtml() → HTML string
  internally calls: GeneratorData.buildSectionsData() → section JSON
                    GeneratorData.buildQuizData()      → quiz JSON
                    GeneratorCSS.generateCss()         → CSS string
HTML string → Packager.packageCourse() → SCORM zip blob → download
```

## Key Data Structures

### CourseIR (output of scorm-parser.js)
```
{ meta: { title, courseId, scormVersion, masteryScore },
  slides: [{ id, title, type, slideNumber, elements, layers, timeline, triggers, transitions }],
  questionBanks: [{ id, title, group, drawCount, questions }],
  assets: { images, videos, audio, fonts },
  navigation, variables, extractionReport }
```

### CoursePlan (output of content-planner.js)
```
{ meta, sections: [{ id, type, title, slides: [PlannedSlide] }],
  quizBanks, navigation, variables, assets,
  verification: { extracted, planned, contentRetention } }
```

### PlannedSlide
```
{ id, originalTitle, type, presentation,
  content: { headings, bodyTexts, callouts, images, videos, audio },
  layers: [{ id, name, texts, images, videos, audio, interactions, triggers }],
  interactions, triggers, states, formFields, quizData }
```

### Presentation Types (set by content-planner.js)
- `hero` — full-viewport title with gradient/image background
- `narrative` — flowing text with optional images
- `media-feature` — large video/image focal point
- `interactive` — layers as accordion/modal/bento
- `form` — input fields
- `quiz` — inline quiz trigger
- `branching` — path selection
- `results` — score display

### Section Types
- `hero` — opening/title section
- `content` — main learning content
- `assessment` — quiz section
- `form` — data collection
- `branching` — path selection
- `results` — completion/results

### Slide Types
`title | objectives | form | branching | quiz | results | content`

### BrandProfile (output of brand-scraper.js)
```
{ sourceUrl, colors: { primary, secondary, accent, background, surface, text, textMuted, success, error, warning, gradient },
  typography: { headingFont, bodyFont, headingWeight, baseSize, lineHeight, headingSizes, fontImportUrl },
  style: { borderRadius, buttonStyle, cardStyle, spacing, mood },
  logo: { url, alt } }
```

### Layer Interaction Types
- `accordion` — text-heavy layers → expandable panels
- `modal` — layers with images → clickable tiles that open overlay
- `bento` — 3+ short layers → CSS Grid tile layout

## The 6-Phase Pipeline

| Phase | What It Does |
|-------|-------------|
| 1. Deep SCORM Extraction | Parse Storyline data into comprehensive CourseIR |
| 2. Content Intelligence | Clean noise, group into sections, classify presentation |
| 3. Brand Intelligence | Scrape brand website for design tokens |
| 4. AI Image Generation | Generate context-aware branded images via Pollinations |
| 5. HTML Generation | Build deep-scroll React app with brand CSS |
| 6. SCORM Packaging | Create valid SCORM 1.2 zip with manifest and assets |

## Output Experience
- **Deep scroll layout** — continuous scrolling experience, no slide-by-slide navigation
- **Section-based structure** — course grouped into logical sections (hero, content, quiz, results)
- **Scroll-triggered animations** — IntersectionObserver reveals content as user scrolls
- **Fixed progress bar** — shows scroll progress through the course
- **Inline quiz** — quiz appears as a full-screen overlay when triggered
- **Alternating section backgrounds** — visual rhythm between sections
- **Mobile-first responsive** — works on all devices

## What Works Well
- All 8 modules wire together correctly
- Deep scroll layout with section-based structure
- Content Intelligence layer filters noise and groups slides logically
- Quiz logic is complete: pick-one, pick-many, true/false, text-entry
- SCORM pass/fail reporting works (SCORM.complete → LMS API)
- Brand scraper falls back to purple/elegant theme if scraping fails
- Image generation includes brand colors and content context in prompts
- Layer audio now preserved through to output
- Content verification report tracks what was kept vs dropped

## Development Notes

### How to test locally
Open `index.html` in a browser. Upload a SCORM zip or folder. Enter a brand URL. Click "Generate". Preview result and download SCORM package.

### CORS proxy
Brand scraping requires a CORS proxy. Set in the UI input field.

### No npm/node required
Everything runs in the browser. External deps loaded via CDN:
- React 18 + ReactDOM 18 (in generated output)
- JSZip (in index.html for packaging)

### Generated output structure
```
imsmanifest.xml       ← SCORM 1.2 manifest
index.html            ← Self-contained deep-scroll React app with embedded CSS + JS
assets/images/*       ← Original + AI-generated images
assets/media/*        ← Video/audio files
```

## Code Conventions
- IIFE module pattern: `window.ModuleName = (function() { ... })();`
- No ES6 modules, no import/export — script tag loading order matters
- ES5-compatible generated code (runs in LMS webviews)
- All generated React uses `React.createElement` (no JSX, no build step)
- `escJs()` and `escHtml()` for safe string embedding

## CRITICAL: Engine Development Rule

**Every change to the engine MUST be a universal improvement, NEVER a specific fix for a specific SCORM file or brand URL.**

The test SCORM folder and URL in the repo are just test data. When an issue is found in test output:
1. Ask "what CATEGORY of problem is this?" — not "how do I fix this specific text?"
2. Build detection based on content characteristics (length, structure, semantic role) — not specific phrases or regex for known strings
3. The improved output from the test SCORM should be a BYPRODUCT of a better engine, not the goal
4. Every rule should make sense if you imagine a completely different SCORM course being processed

**Bad:** Adding a regex like `/click\s+on\s+the\s+most\s+relevant/i` to filter one course's instruction text
**Good:** Building a classifier that detects ANY text whose purpose is to instruct users how to interact with the Storyline player

## Common Pitfalls
- **Script order in index.html matters** — content-planner after scorm-parser, generators after content-planner
- **brand.colors is an OBJECT** with named keys, not an array of hex strings
- **Generated code is ES5** — the React app string must not use arrow functions, let/const, template literals
- **CoursePlan vs CourseIR** — generators now consume CoursePlan (from ContentPlanner), not raw CourseIR
- **Deep scroll layout** — no slide navigation; content flows as continuous scroll with sections
- **openPanels is now keyed by slideId** — format: `slideId_layerIndex` to support multiple accordion sections
