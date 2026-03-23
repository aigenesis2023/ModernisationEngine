# CLAUDE.md — Modernisation Engine V2

## What This Is
An AI-powered tool that converts legacy SCORM 1.2 e-learning courses into modern, branded, premium deep-scroll web experiences. The SCORM file is a **knowledge base** — content is extracted, then an AI layout engine redesigns the course from scratch using a premium React component library and AI-generated branded images.

**Preview URL:** https://aigenesis2023.github.io/ModernisationEngine/
(Currently serves the generated course directly — no upload UI during proof-of-concept phase)

---

## Architecture

```
SCORM File ──→ Simplified Parser ──→ Content Bucket (JSON)
Brand URL  ──→ Brand Scraper     ──→ Brand Profile (JSON)
                                          │
                    ┌─────────────────────┘
                    ▼
         Content Bucket + Brand Profile
                    │
                    ▼
         AI Layout Engine (prompt in v2/prompts/layout-engine.md)
                    │
                    ▼
         Course Layout JSON (validated against schema)
                    │
              ┌─────┴─────┐
              ▼            ▼
    AI Image Generator   React Renderer
    (Pollinations)       (blade-runner-engine)
              │            │
              ▼            ▼
         images/      Static HTML course
```

### Core Principle
The SCORM file's internal structure (layers, triggers, states, coordinates) is **ignored**. We extract raw text, quiz data, and media inventory — then the AI designs the presentation from scratch. This eliminates all the V1 heuristic complexity and gives full creative control.

### Everything is codified — nothing ad-hoc
All prompts, schemas, and scripts live in `v2/`. The only difference between testing (Claude Code) and production (API call) is who executes the layout engine prompt. Everything else is automated code.

---

## File Structure

```
CLAUDE.md                              ← This file — project reference
WEBSITE BRANDING REF.rtf               ← Brand URL for testing

engine/
  scorm-parser.js                      ← SCORM extraction (being simplified for V2)
  brand-scraper.js                     ← Brand URL → colors/fonts/style (reused as-is)

blade-runner-engine/                   ← React + Vite renderer (the visual output)
  src/
    App.jsx                            ← Entry: loads courseData + brandData
    main.jsx                           ← React root mount
    index.css                          ← CSS design system (all via custom properties)
    components/
      ComponentRegistry.js             ← Maps type strings → React components
      CourseRenderer.jsx               ← Recursive JSON → React tree
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
    store/courseStore.js                ← Zustand state
    theme/ThemeEngine.js               ← Brand → CSS variables
  package.json                         ← React/Vite/Tailwind/Framer deps

blade-runner-template.html             ← Pre-built single-file renderer (~405KB)

v2/                                    ← ALL V2 WORK GOES HERE
  schemas/
    content-bucket.schema.json         ← Extraction output format
    course-layout.schema.json          ← Layout engine output format
    component-library.json             ← All components: type, props, usage, examples
  prompts/
    layout-engine.md                   ← System prompt for AI layout engine
    image-generator.md                 ← Prompt templates for image generation
  scripts/
    extract.js                         ← Simplified SCORM parser → content-bucket.json
    scrape-brand.js                    ← Brand URL → brand-profile.json
    generate-images.js                 ← Layout JSON → Pollinations → images/
    build-course.js                    ← Layout + images + brand → static HTML
  output/
    content-bucket.json                ← Extracted from test SCORM
    brand-profile.json                 ← Scraped from brand URL
    course-layout.json                 ← Layout engine output
    images/                            ← Generated images

v1-archive/                            ← Old V1 code (reference only, not used)
  content-planner.js                   ← 1317 lines of heuristics (replaced by LLM)
  adapt-translator.js                  ← 853 lines of rule mapping (replaced by LLM)
  app.js                               ← V1 pipeline orchestrator
  index-upload-ui.html                 ← V1 upload UI

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

### Phase 3 — AI Layout Engine (`v2/prompts/layout-engine.md`)
**Input:** `content-bucket.json` + `brand-profile.json` + system prompt
**Output:** `v2/output/course-layout.json`

The AI reads the extracted content and brand profile, then designs the course layout:
- Decides how many sections and what each contains
- Chooses the best component type for each content block
- Writes display titles, rewrites/tightens body text
- Specifies image prompts for each section (what to generate)
- Ensures visual variety (no consecutive identical component types)
- Follows brand aesthetic (dark/light, colors, typography mood)

**Testing:** Claude Code reads the prompt file and content, writes the layout JSON
**Production:** API call sends the same prompt + content, receives the same JSON

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

## Component Library

### Existing (12 — keep and polish)
| Type | Component | Purpose |
|---|---|---|
| `hero` | HeroSplash | Full-viewport opening, animated title, background image |
| `text` | TextBlock | Clean text with heading and body |
| `graphic` | GraphicBlock | Full-width image with hover zoom |
| `graphic-text` | GraphicText | Side-by-side text + image (alternates left/right) |
| `accordion` | SilkyAccordion | Expandable panels with completion tracking |
| `mcq` | MCQPro | Quiz: select, submit, feedback, retry |
| `narrative` | NarrativeSlider | Carousel with prev/next and dots |
| `bento` | BentoGrid | Multi-card grid with image backgrounds |
| `data-table` | DataTable | Auto-parsed table from structured data |
| `media` | MediaBlock | Video player with custom overlay |
| `textinput` | TextInputBlock | Multi-field form with submit |
| `branching` | BranchingCards | Selectable option cards |

### New (13 — to build)
| Type | Component | Purpose |
|---|---|---|
| `timeline` | TimelineStepper | Numbered steps with connecting line |
| `comparison` | ComparisonTable | Side-by-side columns with checks/crosses |
| `stat-callout` | StatCallout | Large numbers with context labels |
| `pullquote` | PullQuote | Emphasized text with accent bar |
| `key-term` | KeyTerm | Highlighted vocabulary with definition |
| `checklist` | Checklist | Checkable items with completion |
| `tabs` | TabPanel | Horizontal tabbed content |
| `flashcard` | Flashcard | Flip interaction for term/definition |
| `labeled-image` | LabeledImage | Image with numbered hotspot markers |
| `process-flow` | ProcessFlow | Connected workflow nodes |
| `image-gallery` | ImageGallery | Grid/masonry of images |
| `full-bleed` | FullBleedImage | Edge-to-edge image with overlay text |
| `video-transcript` | VideoTranscript | Video with expandable transcript |

All components documented in `v2/schemas/component-library.json` with: type string, required props, optional props, ideal use cases, example JSON.

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

## Future Roadmap
1. **Production UI:** Upload SCORM + brand URL + API key input
2. **Claude API integration:** Replace manual Claude Code step with API call
3. **AI Editor:** Click block → sidebar → change component, swap/regenerate image, edit text
4. **SCORM packaging:** JSZip export with imsmanifest.xml
5. **LMS tracking:** Lightweight SCORM shim for progress/completion reporting

---

## ⛔ ABSOLUTE RULE — UNIVERSAL ENGINE

Every change must work for ANY Storyline SCORM file. Test files are diagnostic tools, not the product.

**Branding:** Brand URL = only source for visual identity. SCORM styling is irrelevant.
**Content:** SCORM = only source for educational content. AI redesigns the presentation.
