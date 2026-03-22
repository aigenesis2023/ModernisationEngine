# CLAUDE.md — Modernisation Engine

## What This Project Is
A browser-based tool that converts legacy SCORM 1.2 e-learning courses (Articulate Storyline exports) into modern, branded, mobile-responsive web experiences. The user uploads a SCORM zip/folder, enters a brand URL, and gets a modernised SCORM package back.

## Architecture

**Single-page app. No build step. No npm. Pure browser JavaScript using IIFE modules.**

```
index.html                  ← UI: upload zone, brand URL input, preview, download
engine/
  app.js                    ← Orchestrator: wires the 5-phase pipeline
  scorm-parser.js           ← Phase 1: Extracts CourseIR from Storyline data files
  brand-scraper.js          ← Phase 2: Scrapes brand colors/fonts/logo from URL
  image-generator.js        ← Phase 3: Generates AI images via Pollinations API
  generator-data.js         ← Phase 4a: Converts CourseIR → slide/quiz JSON
  generator-css.js          ← Phase 4b: Generates brand-aware mobile-first CSS
  generator-app.js          ← Phase 4c: Generates React app + SCORM adapter as JS string
  packager.js               ← Phase 5: Creates SCORM 1.2 zip with JSZip
```

### Module Loading Order (in index.html)
JSZip CDN → scorm-parser → brand-scraper → image-generator → generator-css → generator-data → generator-app → packager → app.js

### Data Flow
```
SCORM Upload → SCORMParser.extractCourse() → CourseIR
Brand URL    → BrandScraper.scrapeBrand()  → BrandProfile
CourseIR     → ImageGenerator.generateImages(course, brand) → ImageManifest
(CourseIR, BrandProfile, ImageManifest) → GeneratorApp.generateHtml() → HTML string
  internally calls: GeneratorData.buildSlidesData() → slide JSON
                    GeneratorData.buildQuizData()   → quiz JSON
                    GeneratorCSS.generateCss()      → CSS string
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

### Slide Types
`title | objectives | form | branching | quiz | results | content`

### BrandProfile (output of brand-scraper.js)
```
{ sourceUrl, colors: { primary, secondary, accent, background, surface, text, textMuted, success, error, warning, gradient },
  typography: { headingFont, bodyFont, headingWeight, baseSize, lineHeight, headingSizes, fontImportUrl },
  style: { borderRadius, buttonStyle, cardStyle, spacing },
  logo: { url, alt } }
```

### Layer Interaction Types (set by generator-data.js)
- `accordion` — text-heavy layers → expandable panels
- `modal` — layers with images → clickable tiles that open overlay
- `bento` — 3+ short layers → CSS Grid tile layout

## The 5-Step Modernisation Plan

| Step | Status | What It Does |
|------|--------|--------------|
| 1. Deep SCORM Extraction | ✅ DONE | Parse Storyline data into comprehensive CourseIR |
| 2. Brand Intelligence | ✅ DONE | Scrape brand website for design tokens |
| 3. Content Restructuring | ✅ DONE | Convert layers to Accordion/Modal/Bento; mobile-first CSS Grid |
| 4. AI Image Generation | ✅ DONE | Generate context-aware images via Pollinations API |
| 5. Polish & Packaging | 🔲 TODO | Final QA, edge cases, output quality |

## Known Bugs

### BUG: Brand colors not applied to image generation prompts
**File:** `engine/image-generator.js`, lines 21-23
**Problem:** Code checks `brand.colors.length > 0` but `brand.colors` is an object (not array), so the condition is always false. Image prompts never include brand palette.
**Fix:** Convert `brand.colors` to values array: `Object.values(brand.colors).filter(c => typeof c === 'string' && c.startsWith('#'))`

### BUG: brand.industry never set
**File:** `engine/image-generator.js`, line 17
**Problem:** Checks `brand.industry` but BrandScraper never sets this property.
**Impact:** Low — just means industry context is missing from image prompts.

## What Works Well
- All 7 modules wire together correctly (exports/imports verified)
- All 60+ CSS class names match between generator-app.js and generator-css.js
- Quiz logic is complete: pick-one, pick-many, true/false, text-entry
- SCORM pass/fail reporting works (SCORM.complete → LMS API)
- Error handling is robust with graceful fallbacks throughout
- Brand scraper falls back to purple/elegant theme if scraping fails
- Image generation skips failures and continues

## Development Notes

### How to test locally
Open `index.html` in a browser. Upload a SCORM zip or folder. Enter a brand URL. Click "Modernise". Preview result and download SCORM package.

### CORS proxy
Brand scraping requires a CORS proxy (default: `https://corsproxy.io/?`). Set in the UI input field.

### No npm/node required
Everything runs in the browser. External deps loaded via CDN:
- React 18 + ReactDOM 18 (in generated output)
- JSZip (in index.html for packaging)

### Generated output structure
```
imsmanifest.xml       ← SCORM 1.2 manifest
index.html            ← Self-contained React app with embedded CSS + JS
assets/images/*       ← Original + AI-generated images
assets/media/*        ← Video/audio files
```

## Code Conventions
- IIFE module pattern: `window.ModuleName = (function() { ... })();`
- No ES6 modules, no import/export — script tag loading order matters
- ES5-compatible generated code (runs in LMS webviews)
- All generated React uses `React.createElement` (no JSX, no build step)
- `escJs()` and `escHtml()` for safe string embedding

## Common Pitfalls
- **Script order in index.html matters** — generator-app.js depends on generator-data.js and generator-css.js
- **brand.colors is an OBJECT** with named keys, not an array of hex strings
- **Generated code is ES5** — the React app string must not use arrow functions, let/const, template literals
- **Layer tabs were replaced** — old `activeLayer` state removed, replaced with `openPanels` (accordion) and `modalLayer` (modal)
