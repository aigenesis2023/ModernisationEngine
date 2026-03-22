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

## CRITICAL: Engine Development Process

### The Golden Rule
**The test SCORM file and brand URL are diagnostic tools, not the product.** They exist to REVEAL categories of problems that the engine must solve for ALL Storyline SCORM exports. Every engine change must be designed by studying how Storyline works universally, not by looking at what went wrong with one specific course.

### Mandatory Process — Follow This BEFORE Writing Any Code

When you see an issue in the test output, you MUST follow this sequence. Do NOT skip steps.

**Step 1: Name the category, not the symptom.**
- BAD: "The text 'Layer 1' is showing as a heading" → leads to fixing one string
- GOOD: "Auto-generated layer names are being rendered as content headings" → leads to a universal classifier

**Step 2: Research how Storyline produces this category universally.**
- How does Storyline name layers? (Always "Layer N" by default, authors can rename them)
- What other auto-generated patterns exist? (Shape names, variable names, slide titles)
- What does this look like in a DIFFERENT course? (Would a cooking course have the same issue?)

**Step 3: Design the rule based on structural patterns, not specific content.**
- The rule should reference Storyline's export FORMAT (object kinds, naming patterns, data structures)
- It should use content CHARACTERISTICS (length, position, semantic structure) not specific values
- Test the rule mentally: "If I ran a completely different Storyline course through this rule, would it still make correct decisions?"

**Step 4: Implement and verify.**
- The test SCORM output should improve as a BYPRODUCT
- If you find yourself checking "does this fix the specific issue I saw?" you've gone wrong — check "does this handle the CATEGORY correctly?"

### What "Specific Fix" Looks Like (DO NOT DO THIS)
- Changing a threshold because it looks better for this course's text (`60 → 80 chars`)
- Adding a regex that matches text from the test course
- Hardcoding any slide ID, variable name, or quiz bank ID from the test data
- Checking if output "looks right" for the test course without asking "would this work for a 50-slide compliance training course?"

### What "Universal Improvement" Looks Like (DO THIS)
- Studying Storyline's `textLib` structure to understand how text roles are encoded
- Building classification based on `fontSize`, `depth`, `fontWeight` — properties ALL Storyline exports have
- Using the navigation graph (`slideMap.slideRefs[].linksTo[]`) to understand branching — this structure is identical in every export
- Detecting auto-generated names by pattern (`generic_noun + optional_number`) since Storyline ALWAYS generates names this way

### Testing Requirements
- Run the COMPLETE pipeline (brand scraping + AI image generation) — don't skip phases
- Do NOT take Playwright screenshots unless the user explicitly asks for them — it's slow. The user previews via the GitHub Pages URL instead.
- Only take screenshots and save to `test/screenshots/` when the user says "take screenshots" or "update screenshots"
- When screenshots ARE taken, overwrite the existing files (don't accumulate old ones)
- For each issue found, write down the CATEGORY before touching code
- After implementing, re-run and verify the category is handled — not just the specific instance

### Universal Problem Categories
The engine must handle these categories for ANY Storyline SCORM export:
1. **Authoring artefacts** — auto-generated names, player instructions, variable placeholders, structural labels
2. **Content role classification** — inferring heading vs body vs callout vs feedback from text characteristics
3. **Course structure reconstruction** — grouping slides into logical sections based on scene boundaries and slide type
4. **Layer interaction mapping** — presenting Storyline layers as web-native components (accordion/modal/bento)
5. **Branching & navigation** — preserving the author's intended course flow and decision points
6. **Form field reconstruction** — building proper web forms from Storyline textinput objects
7. **Quiz & assessment preservation** — maintaining all question types, scoring, and feedback
8. **Asset path resolution** — correctly referencing images, video, and audio with fallbacks

## Common Pitfalls
- **Script order in index.html matters** — content-planner after scorm-parser, generators after content-planner
- **brand.colors is an OBJECT** with named keys, not an array of hex strings
- **Generated code is ES5** — the React app string must not use arrow functions, let/const, template literals
- **CoursePlan vs CourseIR** — generators now consume CoursePlan (from ContentPlanner), not raw CourseIR
- **Deep scroll layout** — no slide navigation; content flows as continuous scroll with sections
- **openPanels is now keyed by slideId** — format: `slideId_layerIndex` to support multiple accordion sections
