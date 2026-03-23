# CLAUDE.md — Modernisation Engine V2

## What This Is
An AI-powered tool that converts legacy SCORM 1.2 e-learning courses into modern, branded, premium deep-scroll web experiences. The SCORM file is a **knowledge base** — content is extracted, then an AI layout engine redesigns the course from scratch using a premium React component library and AI-generated branded images.

**Preview URL:** https://aigenesis2023.github.io/ModernisationEngine/
(Currently serves the generated course directly — no upload UI during proof-of-concept phase)

---

## Architecture

```
SCORM File ──→ extract.js        ──→ Content Bucket (JSON)
Brand URL  ──→ scrape-brand.js   ──→ Brand Profile (JSON)
                                          │
                    ┌─────────────────────┘
                    ▼
         design-course.js
         ├─ Reads layout-engine.md (system prompt)
         ├─ Reads content-bucket.json + brand-profile.json
         ├─ Assembles the full LLM message
         ├─ Gets LLM response (API call OR manual paste)
         ├─ Validates against course-layout.schema.json
         └─→ course-layout.json
                    │
              ┌─────┴─────┐
              ▼            ▼
    generate-images.js   build-course.js
    (Pollinations API)   (React renderer)
              │            │
              ▼            ▼
         images/      Static HTML course
```

### Core Principle
The SCORM file's internal structure (layers, triggers, states, coordinates) is **ignored**. We extract raw text, quiz data, and media inventory — then the AI designs the presentation from scratch. This eliminates all the V1 heuristic complexity and gives full creative control.

### Everything is codified — nothing ad-hoc
All prompts, schemas, and scripts live in `v2/`. Every step of the pipeline is a script that reads files and writes files. The LLM is one step in that pipeline — not something done ad-hoc in a chat window.

### The `design-course.js` Workflow (CRITICAL)

This script is the bridge between "content extraction" and "course rendering". It operates in two modes:

**Mode 1 — Manual (Claude Code / development):**
```bash
node v2/scripts/design-course.js --manual
```
1. Script assembles the full prompt (system prompt + content bucket + brand profile)
2. Writes it to `v2/output/design-prompt.txt`
3. Developer pastes this into Claude Code (or any LLM chat)
4. Developer pastes the LLM's JSON response back
5. Script validates and saves to `v2/output/course-layout.json`

In this mode, Claude Code is literally just a stand-in for an API call. The script does all the assembly, validation, and file I/O. The chat just provides the LLM response.

**Mode 2 — API (production):**
```bash
ANTHROPIC_API_KEY=sk-... node v2/scripts/design-course.js
```
1. Script assembles the exact same prompt
2. Sends it to the Claude API
3. Receives the JSON response
4. Validates and saves to `v2/output/course-layout.json`

**The output is identical in both modes.** Same prompt, same validation, same output file. This means:
- Every improvement to the prompt, schema, or validation logic is permanent in the repo
- Switching from manual to API mode is just adding an API key — zero code changes
- The production UI will call the same script with the same code path

---

## File Structure

```
CLAUDE.md                              ← This file — project reference
WEBSITE BRANDING REF.rtf               ← Brand URL for testing

engine/
  scorm-parser.js                      ← V1 browser-based SCORM parser (reference)
  brand-scraper.js                     ← V1 browser-based brand scraper (reference)

blade-runner-engine/                   ← React + Vite renderer (the visual output)
  src/
    App.jsx                            ← Entry: loads courseData + brandData
    main.jsx                           ← React root mount
    index.css                          ← CSS design system (all via custom properties)
    components/
      ComponentRegistry.js             ← Maps 25 type strings → React components
      CourseRenderer.jsx               ← Recursive JSON → React tree
      — 12 original components —
      HeroSplash.jsx                   ← Full-viewport hero with animation
      TextBlock.jsx                    ← Text with heading
      GraphicBlock.jsx                 ← Full-width image
      GraphicText.jsx                  ← Side-by-side text + image split
      SilkyAccordion.jsx               ← Expandable panels
      MCQPro.jsx                       ← Quiz with feedback + retry
      NarrativeSlider.jsx              ← Carousel with prev/next
      BentoGrid.jsx                    ← Multi-card grid
      DataTable.jsx                    ← Parsed table
      MediaBlock.jsx                   ← Video player
      TextInputBlock.jsx               ← Form fields
      BranchingCards.jsx               ← Selectable option cards
      — 13 new V2 components —
      TimelineStepper.jsx              ← Numbered steps with connecting line
      ComparisonTable.jsx              ← Side-by-side columns with checks/crosses
      StatCallout.jsx                  ← Animated large numbers with labels
      PullQuote.jsx                    ← Emphasized text with accent bar
      KeyTerm.jsx                      ← Vocabulary terms with definitions
      Checklist.jsx                    ← Checkable items with progress bar
      TabPanel.jsx                     ← Horizontal tabbed content
      Flashcard.jsx                    ← 3D flip cards for review
      LabeledImage.jsx                 ← Image with numbered hotspot markers
      ProcessFlow.jsx                  ← Connected workflow nodes with arrows
      ImageGallery.jsx                 ← Grid of images with lightbox
      FullBleedImage.jsx               ← Edge-to-edge parallax image with overlay
      VideoTranscript.jsx              ← Video with expandable transcript
    store/courseStore.js                ← Zustand state
    theme/ThemeEngine.js               ← Brand → CSS variables
  package.json                         ← React/Vite/Tailwind/Framer deps

blade-runner-template.html             ← Pre-built single-file renderer (~458KB)

v2/                                    ← ALL V2 WORK GOES HERE
  schemas/
    content-bucket.schema.json         ← Extraction output format
    course-layout.schema.json          ← Layout engine output format
    component-library.json             ← All 25 components: type, props, usage, examples
  prompts/
    layout-engine.md                   ← System prompt for AI layout engine
    image-generator.md                 ← Prompt templates for image generation
  scripts/
    extract.js                         ← SCORM folder → content-bucket.json
    scrape-brand.js                    ← Brand URL → brand-profile.json
    design-course.js                   ← THE LAYOUT ENGINE SCRIPT (manual + API modes)
    generate-images.js                 ← Layout JSON → Pollinations → images/
    build-course.js                    ← Layout + images + brand → static HTML
  output/
    content-bucket.json                ← Extracted from test SCORM
    brand-profile.json                 ← Scraped from brand URL
    design-prompt.txt                  ← Assembled prompt (written by design-course.js)
    course-layout.json                 ← Layout engine output (validated)
    images/                            ← Generated images
    course.html                        ← Final single-file output

v1-archive/                            ← Old V1 code (reference only, not used)

EV/                                    ← Test SCORM (gitignored, in Codespace)
TEST SCORM/                            ← Small test SCORM (committed)
```

---

## The 5 Phases

### Phase 1 — Extraction (`v2/scripts/extract.js`)
**Input:** SCORM folder (e.g., `EV/`)
**Output:** `v2/output/content-bucket.json`

Simplified "structured dumb" extraction. No layout inference, no interaction analysis.

**Extracts:**
- Course title from imsmanifest.xml
- Scene boundaries (Storyline's intentional topic groupings)
- All text per slide: headings, body paragraphs, callouts (cleaned of junk)
- Quiz data: question, choices with correct answers, feedback (structured)
- Form fields: labels, types
- Media inventory: list of all real image/video filenames (shapes and text-as-image excluded)

**Noise filtering (kept from V1):**
- Shape filenames: `Shape*.png`, `txt__default_*.png`
- Auto-generated labels: "Rectangle 1", "Oval 3", "Slide 2.1"
- Icon alt-text: "arrow icon 1", "check icon 1"
- Storyline UI text: player instructions, variable placeholders
- Very short strings (< 3 chars)

### Phase 2 — Brand Scraping (`v2/scripts/scrape-brand.js`)
**Input:** Brand URL (e.g., `https://www.backgrounds.supply`)
**Output:** `v2/output/brand-profile.json`

Reuses `engine/brand-scraper.js` logic. Fetches URL via CORS proxy, extracts:
- Colors: primary, secondary, accent, background, surface, text, gradient
- Typography: heading font, body font, sizes, weights, line-height, Google Fonts URL
- Style: border-radius, button style (pill/rounded/solid), card style, mood
- Logo: URL, dimensions, alt text

CORS proxy: `https://cors-proxy.leoduncan-elearning.workers.dev`

### Phase 3 — AI Layout Engine (`v2/scripts/design-course.js`)
**Script:** `v2/scripts/design-course.js`
**Input:** `content-bucket.json` + `brand-profile.json` + `layout-engine.md`
**Output:** `v2/output/course-layout.json`

The `design-course.js` script orchestrates the AI layout step:

1. Reads the system prompt from `v2/prompts/layout-engine.md`
2. Reads `content-bucket.json` and `brand-profile.json`
3. Assembles a complete LLM message and writes it to `v2/output/design-prompt.txt`
4. Gets the LLM response (manual paste OR API call — see modes below)
5. Extracts and validates JSON against `v2/schemas/course-layout.schema.json`
6. Writes validated output to `v2/output/course-layout.json`

The AI redesigns the course from scratch:
- Decides how many sections and what each contains
- Chooses the best component type for each content block
- Writes display titles, rewrites/tightens body text
- Specifies image prompts for each section (what to generate)
- Ensures visual variety (no consecutive identical component types)
- Follows brand aesthetic (dark/light, colors, typography mood)

**Manual mode** (`--manual`): Script writes the assembled prompt to a file. Developer pastes it into Claude Code (or any LLM), then pastes the response back. The script validates and saves.
**API mode** (`ANTHROPIC_API_KEY=...`): Script calls the Claude API directly. Same prompt, same validation, same output.

The prompt, validation, and all logic live in the repo. The LLM is a function call — not a manual process.

### Phase 4 — Image Generation (`v2/scripts/generate-images.js`)
**Input:** `course-layout.json` (contains image prompts per component)
**Output:** Images in `v2/output/images/`

Uses Pollinations free API: `https://image.pollinations.ai/prompt/...`
- Each component that needs an image has an `imagePrompt` field in the layout JSON
- Prompts include: topic context, brand colors, style directive, dimensions
- Dimensions per component type: 16:9 (hero, full-bleed), 4:3 (graphic-text), 1:1 (cards)
- Style: modern, clean, tech-professional, matching brand aesthetic

Future upgrade: DALL-E 3, Flux, or Stable Diffusion for higher quality.
User can replace any image via the AI editor.

### Phase 5 — Build (`v2/scripts/build-course.js`)
**Input:** `course-layout.json` + `images/` + `brand-profile.json`
**Output:** Static HTML at GitHub Pages URL

- Converts course-layout.json into the `window.courseData` format the React renderer expects
- Embeds images as base64 data URLs
- Injects brand data as `window.brandData`
- Injects into `blade-runner-template.html`
- Outputs final single-file HTML

---

## Component Library (25 components — all built)

All 25 components are built, registered in `ComponentRegistry.js`, and documented in `v2/schemas/component-library.json` with: type string, required/optional props, when to use, when NOT to use, and example JSON.

| Type | Component | Category | Purpose |
|---|---|---|---|
| `hero` | HeroSplash | structural | Full-viewport opening, animated title, background image |
| `text` | TextBlock | content | Clean text with heading and body |
| `graphic` | GraphicBlock | visual | Full-width image with hover zoom |
| `graphic-text` | GraphicText | content | Side-by-side text + image (alternates left/right) |
| `accordion` | SilkyAccordion | interactive | Expandable panels with completion tracking |
| `mcq` | MCQPro | assessment | Quiz: select, submit, feedback, retry |
| `narrative` | NarrativeSlider | interactive | Carousel with prev/next and dots |
| `bento` | BentoGrid | content | Multi-card grid with image backgrounds |
| `data-table` | DataTable | content | Auto-parsed table from structured data |
| `media` | MediaBlock | visual | Video player with custom overlay |
| `textinput` | TextInputBlock | interactive | Multi-field form with submit |
| `branching` | BranchingCards | interactive | Selectable option cards |
| `timeline` | TimelineStepper | content | Numbered steps with connecting line |
| `comparison` | ComparisonTable | content | Side-by-side columns with checks/crosses |
| `stat-callout` | StatCallout | visual | Animated large numbers with context labels |
| `pullquote` | PullQuote | visual | Emphasized text with accent bar |
| `key-term` | KeyTerm | content | Vocabulary terms with definitions |
| `checklist` | Checklist | interactive | Checkable items with progress bar |
| `tabs` | TabPanel | interactive | Horizontal tabbed content |
| `flashcard` | Flashcard | interactive | 3D flip cards for term/definition review |
| `labeled-image` | LabeledImage | visual | Image with numbered hotspot markers |
| `process-flow` | ProcessFlow | content | Connected workflow nodes with arrows |
| `image-gallery` | ImageGallery | visual | Grid of images with lightbox zoom |
| `full-bleed` | FullBleedImage | visual | Edge-to-edge parallax image with overlay text |
| `video-transcript` | VideoTranscript | visual | Video with expandable transcript panel |

---

## Design System

### CSS Custom Properties (set by ThemeEngine from brand profile)
```
Colors:     --brand-primary, --brand-secondary, --brand-accent, --brand-heading
            --brand-bg, --brand-surface, --brand-text, --brand-text-muted
            --brand-success, --brand-error, --brand-gradient, --brand-glow
Glass:      --ui-glass, --ui-glass-border, --ui-glass-hover
Radius:     --ui-radius, --ui-radius-sm, --ui-radius-lg, --ui-button-radius
Fonts:      --font-heading, --font-body
Typography: --font-base-size, --font-h1, --font-h2, --font-h3
            --font-heading-weight, --font-body-weight, --font-line-height
```

### Theme detection
ThemeEngine computes actual background luminance from hex color (ignores theme strings). Dark bg (luminance < 0.55) gets dark-mode glass. Light bg gets light-mode glass. All components use CSS variables — never hardcoded colors.

### Building the renderer
```bash
cd blade-runner-engine && npm install && npx vite build && cp dist/index.html ../blade-runner-template.html
```
**Must rebuild after any component/CSS change.**

---

## Test Data
- **SCORM:** `EV/` — 108-slide EV Awareness & Safety course (gitignored, in Codespace)
- **Brand URL:** `https://www.backgrounds.supply/?ref=onepagelove` (in `WEBSITE BRANDING REF.rtf`)
- Brand profile: dark theme (#383838 bg), blue (#0099ff) + pink (#ff3c71), Satoshi/Inter fonts

---

## Full Pipeline Command Sequence

```bash
# Phase 1 — Extract content from SCORM
node v2/scripts/extract.js EV

# Phase 2 — Scrape brand from URL
node v2/scripts/scrape-brand.js "https://www.backgrounds.supply/?ref=onepagelove"

# Phase 3 — Design course layout (manual mode: paste prompt into Claude Code)
node v2/scripts/design-course.js --manual
# ... or with API key:
# ANTHROPIC_API_KEY=sk-... node v2/scripts/design-course.js

# Phase 4 — Generate images
node v2/scripts/generate-images.js

# Phase 5 — Build final HTML
node v2/scripts/build-course.js
```

Each script reads from `v2/output/` and writes to `v2/output/`. They are independent and can be re-run individually (e.g., regenerate images without re-designing the layout).

---

## Future Roadmap
1. **Production UI:** Upload SCORM + brand URL + API key input → calls the same scripts
2. **API mode is already built into `design-course.js`** — just needs an API key
3. **AI Editor:** Click block → sidebar → change component, swap/regenerate image, edit text
4. **SCORM packaging:** JSZip export with imsmanifest.xml
5. **LMS tracking:** Lightweight SCORM shim for progress/completion reporting

The production UI is a thin wrapper around the existing scripts. It does NOT require rewriting the pipeline — it calls `extract.js`, `scrape-brand.js`, `design-course.js` (API mode), `generate-images.js`, and `build-course.js` in sequence.

---

## ⛔ ABSOLUTE RULE — UNIVERSAL ENGINE

Every change must work for ANY Storyline SCORM file. Test files are diagnostic tools, not the product.

**Branding:** Brand URL = only source for visual identity. SCORM styling is irrelevant.
**Content:** SCORM = only source for educational content. AI redesigns the presentation.
