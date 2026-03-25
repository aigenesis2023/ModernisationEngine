# CLAUDE.md — Modernisation Engine

## What This Is
An AI-powered tool that converts legacy SCORM 1.2 e-learning courses into modern, branded, premium deep-scroll web experiences. The SCORM file is a **knowledge base** — content is extracted, an AI layout engine structures it, **Google Stitch designs a complete branded component kit**, and we assemble the final course with 100% content fidelity + interactivity via a hydration script.

**Preview URL:** https://aigenesis2023.github.io/ModernisationEngine/
(Currently serves the generated course directly — no upload UI during proof-of-concept phase)

**Branch:** `Current-working-2` (this is the ONLY working branch — never work from or reference `main`)

**Future:** An AI-First authoring layer will sit on top of the output, allowing end users to edit content, swap components, and customise the course without re-running the pipeline.

---

## Architecture (V5 — Stitch Component Kit)

```
SCORM File ──→ extract.js        ──→ Content Bucket (JSON)
Brand URL  ──→ scrape-brand.js   ──→ Brand Profile (JSON) + Brand Design (DESIGN.md)
                                          │
                    ┌─────────────────────┘
                    ▼
         design-course.js (AI layout engine)
         ├─ Reads layout-engine.md (system prompt)
         ├─ Reads content-bucket.json + brand-profile.json
         ├─ AI structures content, picks best components
         └─→ course-layout.json (all content + component types)
                    │
                    ▼
         generate-course-html.js (Google Stitch — GEMINI_3_1_PRO)
         ├─ Sends brand-design.md (DESIGN.md format brief)
         ├─ Sends representative-course.md (all 25 component types)
         ├─ Stitch designs complete branded page experience
         ├─ Extracts: page shell, component patterns, design tokens
         └─→ component-patterns/ + design-tokens.json + stitch-course-raw.html
                    │
                    ▼
         generate-images.js (Pexels stock → Gemini AI → HF AI → SVG placeholder)
         ├─ Converts image prompts to search queries for stock photos
         ├─ Falls back to AI generation or SVG placeholders
         ├─ Always regenerates all images
         └─→ images/*.jpg (stock photos or AI-generated)
                    │
                    ▼
         build-course.js (content assembly — design/layout separation)
         ├─ Generates own <head> from design-tokens.json (NOT Stitch raw CSS)
         ├─ Extracts VISUAL classes from Stitch patterns (shadows, hovers, gradients)
         ├─ Hardcodes LAYOUT classes (grids, containment, spacing)
         ├─ For each component: our HTML structure + Stitch's visual styling
         ├─ 100% content fidelity — every word from the SCORM
         ├─ Embeds images as base64
         ├─ Inlines hydrate.js for interactivity
         └─→ course.html (single self-contained file)
```

### Core Principles

**1. Stitch designs the visual system. We control layout and content.**
Stitch receives a brand brief (DESIGN.md format) and a representative course (all 25 component types). It designs the complete visual system — colours, fonts, shadows, gradients, hover effects. We extract **visual-only** classes from patterns (shadows, hovers, transitions, brand-specific card backgrounds) and apply them to our hardcoded layout structure. We build our own `<head>` from `design-tokens.json` — never copy Stitch's raw CSS. Different brand URL → different Stitch kit → different visual character, identical layout.

**2. Content fidelity is non-negotiable.**
All educational content from the SCORM must be preserved. Every quiz question, every text block, every learning objective. Stitch never sees the real SCORM content — it designs the look, we guarantee the content. Enterprise clients require 100% accuracy.

**3. The design system is a reusable asset.**
Stitch's output (component patterns, design tokens) is extracted and stored. The future authoring layer can re-render the course with different content or swapped component types without calling Stitch again. Users can change "accordion" to "cards" and it renders instantly because Stitch already designed both.

**4. Speak Stitch's language.**
We generate a DESIGN.md brand brief using Stitch's native vocabulary — semantic colour names, Stitch-supported fonts, Material Design colour system, evocative atmospheric descriptions. Not raw CSS hex dumps. Stitch is trained to understand DESIGN.md format.

### The `design-course.js` Workflow

This script is the bridge between "content extraction" and "course rendering". It operates in three modes:

**Mode 1 — Manual (default, no API key):**
```bash
node v5/scripts/design-course.js
```
Claude Code (or any LLM) acts as the layout engine — reads the content bucket and designs the course structure. No `--manual` flag needed — the script detects there's no API key and goes straight to manual mode.

**Mode 2 — API (when ANTHROPIC_API_KEY is set):**
```bash
node v5/scripts/design-course.js
```
Calls Claude API directly. Same prompt, same output. Switches automatically when the key exists.

**Mode 3 — Load (replay):**
```bash
node v5/scripts/design-course.js --load response.json
```
Loads a previously saved response.

---

## File Structure

```
CLAUDE.md                              ← This file
index.html                             ← GitHub Pages entry (generated by build-course.js)
package.json / package-lock.json       ← Root dependencies (@google/stitch-sdk, dotenv)

v5/                                    ← ALL ACTIVE CODE
  schemas/
    content-bucket.schema.json         ← Extraction output format
    course-layout.schema.json          ← Layout engine output format
    component-library.json             ← 25 components: type, props, usage, examples
  prompts/
    layout-engine.md                   ← System prompt for AI layout engine
    representative-course.md           ← All 25 component types for Stitch to design
  scripts/
    extract.js                         ← SCORM folder → content-bucket.json
    scrape-brand.js                    ← Brand URL → screenshot + natural language description
    design-course.js                   ← AI layout engine (manual + API + load modes)
    generate-course-html.js            ← DESIGN.md + representative course → Stitch → component kit
    generate-images.js                 ← Design-informed image generation (runs after Stitch)
    build-course.js                    ← Pattern fill: Stitch patterns + real content → course.html
    review-course.js                   ← Playwright screenshot capture (Phase 6 visual review)
    hydrate.js                         ← Vanilla JS interactivity (injected into course.html)
  output/
    content-bucket.json                ← Extracted from test SCORM
    brand-profile.json                 ← Scraped from brand URL (raw data)
    brand-screenshot.png               ← Playwright screenshot of brand landing page
    brand-design.md                    ← Natural language brand description for Stitch
    course-layout.json                 ← AI-structured course
    stitch-course-raw.html             ← Stitch's complete designed page
    stitch-course-meta.json            ← Stitch API response metadata
    stitch-course-screenshot.png       ← Stitch's design preview
    design-tokens.json                 ← Extracted design system tokens
    component-patterns/                ← Extracted HTML pattern per component type (25)
    images/                            ← HF-generated images
    course.html                        ← Final single-file output

screenshots/                           ← Dev screenshots (gitignored, overwritten each run)

EV/                                    ← Test SCORM (64 slides, gitignored in Codespace)
```

---

## The 5 Phases

### Phase 1 — Extraction (`v5/scripts/extract.js`)
**Input:** SCORM folder (e.g., `EV/`)
**Output:** `v5/output/content-bucket.json`

Extracts all educational content from the SCORM file:
- Course title from imsmanifest.xml
- Scene boundaries (Storyline's topic groupings)
- All text per slide: headings, body paragraphs, callouts
- Quiz data: question, choices with correct answers, feedback
- Form fields: labels, types
- Media inventory: image/video filenames

### Phase 2 — Brand Analysis (`v5/scripts/scrape-brand.js`)
**Input:** Brand URL
**Output:** `v5/output/brand-profile.json` + `v5/output/brand-design.md` + `v5/output/brand-screenshot.png`

Uses **Playwright** to visit the **landing page only** (the exact URL provided — no sub-pages) and take a screenshot. The screenshot is then described in **natural language** using design vocabulary — this is what Stitch wants. No hex codes, no CSS parsing. Stitch is trained on natural language design briefs, not colour dumps.

**How the brand description works (two modes, same pattern as Phase 3):**

**Manual mode (no `ANTHROPIC_API_KEY`):**
1. Playwright visits the URL, takes screenshot → `brand-screenshot.png`
2. Script outputs the screenshot path and pauses
3. **Claude Code (in conversation) views the screenshot and writes a natural language design description**
4. Description is saved as `brand-design.md` in DESIGN.md format
5. This is real work — Claude Code must describe the visual design like a professional designer

**API mode (when `ANTHROPIC_API_KEY` is set):**
1. Playwright visits the URL, takes screenshot → `brand-screenshot.png`
2. Script sends the screenshot to Claude Vision API automatically
3. Claude Vision returns a natural language design description
4. Description is saved as `brand-design.md` — no manual step needed

**The brand brief (brand-design.md) must be pure natural language in Stitch's DESIGN.md format:**
- Visual Theme & Atmosphere (evocative adjectives — "dark, moody, glass-forward")
- Colour descriptions in words ("vibrant lime green buttons on near-black background")
- Typography descriptions ("bold modern sans-serif headings, clean body text")
- Component styles ("pill-shaped buttons, frosted glass cards with backdrop blur")
- Layout feel ("generous whitespace, premium spacing")
- NO hex codes, NO CSS values — Stitch interprets natural language with its own design intelligence

### Phase 3 — AI Layout Engine (`v5/scripts/design-course.js`)
**Input:** `content-bucket.json` + `brand-profile.json` + `layout-engine.md`
**Output:** `v5/output/course-layout.json`

The AI redesigns the course from scratch:
- Groups content into sections (8-12 typically)
- Chooses the best component type for each content block (from 25 available)
- Writes display titles, rewrites body text for modern format
- Specifies image prompts for components that need images
- Preserves ALL quiz questions from the SCORM with correct answers
- Ensures visual variety (no consecutive identical component types)

### Phase 4a — Stitch Component Kit (`v5/scripts/generate-course-html.js`)
**Input:** `brand-design.md` + `representative-course.md`
**Output:** `stitch-course-raw.html` + `component-patterns/` + `design-tokens.json`
**Model:** GEMINI_3_1_PRO

Sends Stitch two things:
1. The brand brief in DESIGN.md format (how it should look)
2. A representative course exercising ALL 25 component types (what to design)

Stitch designs a complete, branded page experience — not just colours, but the full visual system including navigation, section flow, every component type, and footer.

We extract:
- **Page shell** — navigation, section wrappers, footer
- **Component patterns** — one HTML fragment per component type (all 25)
- **Design tokens** — Tailwind config, colour system, fonts, spacing

This is a **reusable design asset**. The authoring layer can re-render courses with different content or swapped components without re-calling Stitch.

### Phase 4b — Image Generation (`v5/scripts/generate-images.js`)
**Input:** `course-layout.json` (content subjects) + `brand-design.md` (photographic mood)
**Output:** Images in `v5/output/images/`
**Runs AFTER Phase 4a** — images are informed by the brand description.

**Image source priority chain:**
1. **Pexels stock photos** (default, free) — `PEXELS_API_KEY` — 200 req/hr, instant key from pexels.com/api
2. **Gemini AI generation** — `GEMINI_API_KEY` — requires paid Google plan for image models
3. **HuggingFace FLUX** — `HF_TOKEN` — may have credit limits
4. **SVG placeholders** — always works, no API key needed

For stock photos: `promptToSearchQuery()` strips photographic treatment terms from AI image prompts, keeping only the content subject (e.g., "Modern electric vehicle in a professional workshop"). Picks randomly from top 3 Pexels results for variety.

For AI generation: reads the "Image Treatment" section from `brand-design.md` to determine photographic mood. Combined with content subject from each component's `imagePrompt`.

**Critical rule:** Image treatment is ONLY photographic terms. Never includes UI design elements.

Always regenerates all images. Guarantees 100% asset coverage (real images or SVG placeholders).

### Phase 5 — Build (`v5/scripts/build-course.js`)
**Input:** `component-patterns/` + `design-tokens.json` + `course-layout.json` + `images/`
**Output:** `v5/output/course.html` + root `index.html`

**⛔ CRITICAL: Design/Layout Separation (IMPLEMENTED)**

Stitch controls **DESIGN**: colours, fonts, shadows, gradients, hover effects, brand-specific card backgrounds.
We control **LAYOUT**: grids, containment, overflow, spacing, positioning, HTML structure.

**How it works:**

1. **`generateHead()`** builds the entire `<head>` from `design-tokens.json` — Tailwind config (colours + fonts), Google Fonts, Material Symbols, and our own CSS definitions for `glass-card`, `text-gradient`, `btn-primary`, `glass-nav`. **Never copies Stitch's raw `<head>`.**

2. **Visual extraction utilities** (`extractVisuals`, `getClasses`, `visualOnly`, `bgOnly`, `mc`) parse Stitch patterns and extract **visual-only** classes: shadows, hovers, transitions, gradients, ring effects, border colours, brand-specific card backgrounds.

3. **Fill functions** own the HTML structure and layout classes. For each component:
   - Layout classes are hardcoded (grids, containment, spacing, typography scale)
   - Visual classes come from Stitch patterns (shadows, hovers, gradients, brand colours)
   - Content comes from course-layout.json (100% SCORM fidelity)

4. **10 enhanced fill functions** extract visual richness: hero (gradient buttons, coloured shadows), pullquote (giant decorative quote watermark), timeline (numbered circles with glow rings), branching (hover borders, arrow animation), graphic-text (image glow wrapper), mcq (card shadow, choice hover, radio icons), flashcard (bold primary front vs glass-card), bento (per-card brand colour variety), checklist (label hover effects), stat-callout (per-stat alternating colours).

**Result:** Different brand URL → different Stitch kit → different visual character, identical layout. Verified across 9+ brands.

**Layout rules enforced by every fill function (non-negotiable):**
1. **Containment:** Every component gets `max-w-6xl mx-auto px-8` — no content touches screen edges. The `<section>` tag handles spacing/background only (via `sectionOnly()` helper that strips containment classes from Stitch patterns). An inner `<div>` provides containment.
2. **Grids/flex:** Every grid and flex layout gets explicit `gap-*` classes and minimum column widths (`min-w-[...]`) — no text wrapping per-word in narrow columns. Smart column counts avoid orphan items (e.g., 4 items use 2×2, not 3+1).
3. **Typography:** Headings use a consistent scale — `h2 = text-3xl`, `h3 = text-2xl`, `h4 = text-xl` — no random size spikes. Hero `h1` is exempt (uses `text-6xl md:text-8xl`).
4. **Theme-safe colours:** All semi-transparent overlays use `on-surface/5` (not `white/5`) — adapts to both light and dark themes. `on-surface` resolves to black on light, white on dark.
5. **Nav enforcement:** `buildNav()` injects required layout classes (`fixed`, `flex`, `justify-between`, `items-center`, `h-20`) if Stitch's nav pattern omits them. Max 5 nav links with `whitespace-nowrap`.
6. **Graphic max-height:** Standalone images get `max-h-[60vh]` to prevent viewport domination.
7. **Flashcard visibility:** Front faces get `shadow-md border border-outline-variant/10` so cards are visible on light themes where `glass-card` may be transparent.
8. **Responsive padding:** All glass-card containers use `p-6 md:p-12` — prevents content cramping on mobile (375px viewport). Applies to MCQ cards, text input cards, tab panels, narrative cards, branching cards, checklist cards.
9. **Flashcard 3D via inline styles:** `perspective`, `transform-style`, `backface-visibility`, and `transform: rotateY(180deg)` use inline `style` attributes, NOT Tailwind utility classes — Tailwind CDN doesn't generate `perspective-*` or `rotate-y-*` utilities.
10. **Tabs structure:** Tab panels (`[data-tab-panel]`) must be INSIDE the `[data-tabs]` wrapper, not siblings — hydrate.js scopes its `querySelectorAll` to the container.

### Hydration (`v5/scripts/hydrate.js`)
Vanilla JS script injected into the final HTML. Handles:
- **Quizzes**: Select answer → submit → correct/incorrect feedback → retry. Correct answer resolved by reading `data-correct` index from the quiz container and looking up `choices[idx]`. Submit button and feedback are injected inside the glass-card (choice container's parent), not the outer section.
- **Accordions**: Native `<details>` with smooth animation
- **Tabs**: Click tab → show panel. Active/inactive styling captured from Stitch's initial class strings at init time, then swapped as full `className` — works with any Stitch button style (pills, underlines, etc.).
- **Flashcards**: Click to flip via inline `style.transform = 'rotateY(180deg)'` (not Tailwind class toggle)
- **Carousels**: Prev/next navigation with dot indicators
- **Checklists**: Check/uncheck with progress tracking. Build-course.js writes a static counter with `data-checklist-progress` attr — hydrate.js finds and reuses it instead of creating a duplicate.
- **Scroll progress bar**: Fixed bar at top showing read percentage
- **Smooth scroll**: Anchor link navigation

---

## Component Library (25 types)

| Type | Purpose |
|---|---|
| `hero` | Full-viewport opening with background image, title, CTA |
| `text` | Prose paragraphs, introductions, explanations |
| `graphic` | Full-width image |
| `graphic-text` | Side-by-side text + image (alternates left/right) |
| `accordion` | Expandable panels with smooth animation |
| `mcq` | Quiz: select answer, submit, feedback, retry |
| `narrative` | Carousel with prev/next navigation |
| `bento` | Multi-card grid with optional images |
| `data-table` | Structured data table |
| `media` | Video player |
| `textinput` | Form fields with submit |
| `branching` | Selectable option cards |
| `timeline` | Numbered sequential steps |
| `comparison` | Side-by-side columns with check/cross indicators |
| `stat-callout` | Large numbers with labels |
| `pullquote` | Emphasized text with accent bar |
| `key-term` | Vocabulary terms with definitions |
| `checklist` | Checkable items with progress |
| `tabs` | Tabbed content panels |
| `flashcard` | 3D flip cards |
| `labeled-image` | Image with hotspot markers |
| `process-flow` | Connected workflow nodes |
| `image-gallery` | Grid of images with lightbox |
| `full-bleed` | Edge-to-edge image with text overlay |
| `video-transcript` | Video with expandable transcript |

---

## Stitch Integration Notes

### SDK Version
`@google/stitch-sdk` v0.0.3 — MCP-based API.

### Available Models
- `GEMINI_3_FLASH` — faster, lower quality
- `GEMINI_3_1_PRO` — Deep Think mode, significantly better for design reasoning (USE THIS)
- `GEMINI_3_PRO` — deprecated

### DESIGN.md Format (what Stitch understands)
Stitch is trained to interpret DESIGN.md files. Structure:
1. **Visual Theme & Atmosphere** — evocative adjectives (e.g., "Airy, glass-forward, ethereal")
2. **Colour Palette & Roles** — semantic names in natural language (e.g., "Soft amethyst purple — primary actions")
3. **Typography Rules** — must use Stitch's 28 supported fonts
4. **Component Stylings** — natural language (e.g., "Pill-shaped buttons, frosted glass cards")
5. **Layout Principles** — whitespace strategy, grid patterns

### Stitch's 28 Supported Fonts
BE_VIETNAM_PRO, EPILOGUE, INTER, LEXEND, MANROPE, NEWSREADER, NOTO_SERIF, PLUS_JAKARTA_SANS, PUBLIC_SANS, SPACE_GROTESK, SPLINE_SANS, WORK_SANS, DOMINE, LIBRE_CASLON_TEXT, EB_GARAMOND, LITERATA, SOURCE_SERIF_FOUR, MONTSERRAT, METROPOLIS, SOURCE_SANS_THREE, NUNITO_SANS, ARIMO, HANKEN_GROTESK, RUBIK, GEIST, DM_SANS, IBM_PLEX_SANS, SORA

### DesignTheme Vocabulary
When describing brands, use Stitch's native terms:
- `colorMode`: LIGHT or DARK
- `colorVariant`: MONOCHROME, NEUTRAL, TONAL_SPOT, VIBRANT, EXPRESSIVE, FIDELITY, CONTENT, RAINBOW, FRUIT_SALAD
- `roundness`: ROUND_FOUR, ROUND_EIGHT, ROUND_TWELVE, ROUND_FULL
- `spacingScale`: 0 (minimal), 1 (compact), 2 (normal), 3 (spacious)

### ColorMode Detection (generate-course-html.js)
`detectColorMode()` analyses the brand brief text for light/dark keywords and injects an explicit `colorMode` directive into the Stitch prompt. This prevents Stitch from guessing wrong — e.g., choosing dark for a clearly light gradient brand like FitFlow. Detection defaults to LIGHT if ambiguous. The directive is prompt-only — it doesn't affect downstream processing. `design-tokens.json` `isDark` is always extracted from Stitch's actual CSS output.

### Future: IMAGE_TO_UI
The SDK's internal schema references `IMAGE_TO_UI` project types. When this tool is exposed, we can pass brand URL screenshots directly to Stitch instead of generating DESIGN.md from screenshot description. Monitor SDK updates.

### API Constraints (IMPORTANT)
- `generate_screen_from_text` only accepts: `projectId`, `prompt`, `deviceType`, `modelId`
- There is NO theme parameter on the API input. DesignTheme fields appear in the OUTPUT schema only.
- Therefore: the DESIGN.md content must go INSIDE the text `prompt` parameter. Stitch understands it there because it's trained on DESIGN.md format.
- Do NOT try to pass DesignTheme as a separate API parameter — it won't work.

### Prompt Enhancement (from stitch-skills repo)
The stitch-design skill (https://github.com/google-labs-code/stitch-skills) specifies that enhanced prompts should include:
1. Platform specification (Web Desktop)
2. Design system brief (the DESIGN.md content)
3. Palette with semantic role naming + hex codes
4. Style descriptors for roundness and shadow/elevation
5. Detailed PAGE STRUCTURE with Header, Hero, Content Area, Footer
- Convert informal language to professional UI/UX terminology (e.g., "nice header" → "sticky navigation bar with glassmorphism")
- Use evocative atmospheric direction (Minimalist, Vibrant, Brutalist, etc.)

### Component Pattern Extraction (working)
After Stitch returns the full HTML page, `generate-course-html.js` extracts individual component patterns:
- The representative course prompt instructs Stitch to wrap each component with `data-component-type="hero"`, `data-component-type="accordion"`, etc.
- Extraction parses the returned HTML by `data-component-type` attributes (regex, no DOM library needed)
- Each fragment is stored in `component-patterns/{type}.html`
- The page shell (nav, footer, head content) is extracted separately to `_page-shell.json`
- `build-course.js` loads each pattern and fills it with real content via per-type fill functions
- Confirmed working: 25/25 patterns extracted, 39 components filled with 0 fallbacks (EV test course)

### What hydrate.js Expects (data attributes)
hydrate.js looks for these specific data attributes to add interactivity:
- **Quizzes:** `data-quiz` on container, `data-correct="N"` (zero-indexed), `data-choice` on each option
- **Accordions:** Native `<details><summary>` elements
- **Tabs:** `data-tabs` on container, `data-tab-trigger` on buttons, `data-tab-panel` on panels
- **Flashcards:** `data-flashcard` on card container
- **Checklists:** `data-checklist` on container, native `<input type="checkbox">`
- **Carousels:** `data-carousel` on container, `data-slide` on slides, `data-prev`/`data-next` on nav
- **Text inputs:** Native `<form>` with `<input>` elements

These MUST be included in the Stitch prompt so Stitch generates HTML with these exact attributes. hydrate.js then "lights them up" with interactivity.

### representative-course.md Design Requirements
This file must:
- Include ALL 25 component types (no gaps — the authoring layer needs every type designed)
- Arrange them in a realistic e-learning flow (hero → intro text → content → quiz → etc.)
- Use generic but realistic example content (not tied to any specific SCORM)
- Request `data-component-type` attributes on each component wrapper for extraction
- Request all interactive data attributes listed above for hydrate.js compatibility
- Be a SINGLE deep-scroll page (not multiple pages)

---

## ⛔ Full Pipeline — MANDATORY CHECKLIST

**Every test run MUST execute ALL phases. No skipping. No reusing stale outputs.**

When asked to "run it" or "test with a brand URL", follow this checklist exactly:

### Pre-run: Clear stale outputs
```bash
# Clear everything EXCEPT content-bucket.json (only if same SCORM file)
rm -rf v5/output/component-patterns/ v5/output/images/
rm -f v5/output/brand-profile.json v5/output/brand-design.md
rm -f v5/output/course-layout.json v5/output/design-tokens.json
rm -f v5/output/stitch-course-raw.html v5/output/stitch-course-meta.json
rm -f v5/output/stitch-course-screenshot.png v5/output/course.html
```

### Phase 1 — Extract (skip ONLY if same SCORM file)
```bash
node v5/scripts/extract.js EV
```

### Phase 2 — Brand scrape
```bash
node v5/scripts/scrape-brand.js
```
Script reads URL from `brand/url.txt`, visits with Playwright, takes screenshot.
**Claude Code then views `brand-screenshot.png` and writes a natural language design description** saved as `brand-design.md`. Describe colours in words, not hex. This is real work — do not skip it. When `ANTHROPIC_API_KEY` is added, this step runs automatically via Claude Vision API.

### Phase 3 — Layout engine
```bash
node v5/scripts/design-course.js
```
**Claude Code acts as the layout engine.** Read content-bucket.json + layout-engine.md, produce course-layout.json. This is real work — do not skip it. When `ANTHROPIC_API_KEY` is added to `.env`, this step runs automatically via the API.

### Phase 4a — Stitch component kit
```bash
node v5/scripts/generate-course-html.js
```
Must produce 25/25 patterns (retry + fallback logic handles Stitch truncation).

### Phase 4b — Image generation (AFTER 4a)
```bash
node v5/scripts/generate-images.js
```
Uses Pexels stock photos by default (free, fast). Falls back to Gemini AI → HuggingFace AI → SVG placeholders. Image mood/treatment is read from `brand-design.md`. Always run this step — the fallback chain guarantees 100% asset coverage.

### Phase 5 — Build
```bash
node v5/scripts/build-course.js
```

**If ANY step fails, STOP and tell the user. Do not silently continue with stale data.**

**API Keys:**
All keys are stored in `.env` (gitignored, never committed). Scripts load them automatically via dotenv.
Open `.env` directly in VS Code to set your keys — **never paste keys in the chat**.

- `STITCH_API_KEY`: Get from stitch.withgoogle.com → Settings → API Keys
- `PEXELS_API_KEY`: Get from pexels.com/api → free, instant, 200 req/hr (recommended for images)
- `GEMINI_API_KEY`: (Optional) For AI image generation (requires paid Google plan for image models)
- `HF_TOKEN`: (Optional) Get from huggingface.co → Settings → Access Tokens
- `ANTHROPIC_API_KEY`: (Optional) When set, Phase 2 brand description + Phase 3 layout engine both switch to API mode automatically

---

## Test Data
- **SCORM:** `EV/` — 64-slide EV Awareness & Safety course (gitignored, in Codespace)
- **Brand URL:** stored in `brand/url.txt` — currently `https://sprig.framer.website/`. `scrape-brand.js` reads this automatically when no CLI argument is given.
- **Previously tested brands:** `https://sprig.framer.website/` (dark, cyan/teal), `https://fluence.framer.website/` (light, amethyst), `https://ailyx.framer.website/` (light, blue corporate), `https://fitflow-template.framer.website/` (light, pink-blue gradient), `https://landio.framer.website/` (dark, sleek SaaS), `https://crimzon.framer.website/` (dark, crimson red), `https://aigents.framer.ai/` (light, purple-violet), `https://najaf.framer.ai/` (dark, green)

## Phase 6 — Visual Review (`v5/scripts/review-course.js`)

Automated Playwright screenshot capture for every section + mobile. **This is mandatory after every pipeline run.**

```bash
node v5/scripts/review-course.js
```

Outputs to `screenshots/` (gitignored):
- `section-00.jpeg` through `section-NN.jpeg` — one per section from course-layout.json
- `footer.jpeg` — course complete + footer
- `mobile-hero.jpeg` — mobile viewport hero
- `mobile-mid.jpeg` — mobile viewport mid-page
- `brand.jpeg` — brand reference screenshot

**The review loop workflow:**
1. Run full pipeline (Phases 1-5)
2. Run `review-course.js`
3. Claude Code views every section screenshot (vision), diagnoses layout/design issues
4. Fix the **engine** (build-course.js, hydrate.js, prompts, etc.)
5. Rebuild + re-review
6. Repeat until clean

**When doing review runs, alternate brand URLs** between `najaf.framer.ai` (dark/green) and `ailyx.framer.website` (light/blue) to ensure fixes are universal. A fix that works for one brand but breaks the other is the wrong fix.

**Image asset coverage must be 100%.** `generate-images.js` has a fallback chain: Pexels stock → Gemini AI → HuggingFace AI → SVG placeholders. The script guarantees 100% asset delivery. Pexels is the default and typically delivers 100% real stock photos with no fallbacks needed.

---

## Deployment
GitHub Pages serves from root `index.html` on `Current-working-2`. `build-course.js` writes directly to root `index.html`. Commit and push to `Current-working-2` to deploy. **Never commit to or push to `main`.**

---

## ⛔ ABSOLUTE RULES

### UNIVERSAL ENGINE
The purpose of every conversation is to improve the **engine** — the scripts, prompts, schemas, and templates that power the pipeline. The test SCORM file (`EV/`, gitignored) and test brand URL are **diagnostic tools only**. We run them through the pipeline to verify the engine works, the same way you'd run a test suite. If the output looks wrong, the question is always "what's wrong with the engine?" — never "how do I patch this specific output?"

Every change must work for ANY Storyline SCORM file and ANY brand URL. A fix that makes the EV course look better but wouldn't help a different SCORM file is the wrong fix.

**ALL FIXES GO IN THE ENGINE — NEVER IN TEST DATA OR OUTPUT.**
When a visual issue is found, the fix goes in:
- Component patterns: `v5/scripts/build-course.js` (pattern-based rendering)
- Hydration: `v5/scripts/hydrate.js` (interactivity logic)
- Extraction: `v5/scripts/extract.js` (SCORM parsing)
- Layout: `v5/scripts/design-course.js` (content structuring)
- Layout prompt: `v5/prompts/layout-engine.md` (AI layout instructions)
- Stitch prompt: `v5/scripts/generate-course-html.js` (design instructions)
- Representative course: `v5/prompts/representative-course.md` (component coverage)
- Brand analysis: `v5/scripts/scrape-brand.js` (DESIGN.md generation)
- Schemas: `v5/schemas/` (component definitions, output formats)

NEVER edit output files (`v5/output/*.json`, `v5/output/*.html`) to fix problems. NEVER tailor engine logic to one specific SCORM file or brand — every decision must be generic.

### STITCH DESIGNS THE COMPONENT KIT
Stitch designs the visual system — every component type, page shell, design tokens. We don't hardcode design decisions. The build script uses Stitch's actual component patterns as templates, filled with real SCORM content. Different brand URL → different Stitch kit → different visual output.

### CONTENT FIDELITY
All educational content from the SCORM must be preserved. Every quiz question, every text block, every learning objective. Stitch never sees the real SCORM content — it designs with representative examples. The build script guarantees 100% content fidelity from course-layout.json. The AI layout engine rewords for clarity but never invents facts or drops content.

### AUTHORING LAYER COMPATIBILITY
The design system (component patterns + design tokens) is a reusable asset. The future authoring layer must be able to: re-render with edited content, swap component types (e.g., accordion → cards), and customise without re-calling Stitch. All 25 component types must be designed by Stitch upfront.
