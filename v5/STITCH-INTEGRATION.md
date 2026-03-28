# Stitch Integration

> **Status:** Implemented and working. Verified across 9+ brands.
> **Last updated:** 2026-03-25

This document covers how the Modernisation Engine uses Google Stitch to generate branded visual systems. Stitch designs the look — we control layout, content, and interactivity.

---

## How Stitch Fits in the Pipeline

Stitch receives two things:
1. **brand-design.md** — a DESIGN.md format brief describing how the course should look
2. **representative-course.md** — all 28 component types arranged in a realistic e-learning flow

Stitch designs a complete branded page experience. We then extract:
- **Component patterns** — one HTML fragment per component type (25 files)
- **Design tokens** — Tailwind config, colour system, fonts, spacing
- **Page shell** — navigation, section wrappers, footer
- **Design contract** — `extract-contract.js` (cheerio) parses patterns into `design-contract.json`

This is a **reusable design asset**. The authoring layer can re-render courses with different content or swapped components without re-calling Stitch.

---

## SDK

`@google/stitch-sdk` v0.0.3 — MCP-based API.

**Available models:**
- `GEMINI_3_FLASH` — faster, lower quality
- `GEMINI_3_1_PRO` — Deep Think mode, significantly better for design reasoning (**USE THIS**)
- `GEMINI_3_PRO` — deprecated

**API constraints:**
- `generate_screen_from_text` only accepts: `projectId`, `prompt`, `deviceType`, `modelId`
- There is NO theme parameter on the API input. DesignTheme fields appear in the OUTPUT schema only.
- The DESIGN.md content must go INSIDE the text `prompt` parameter. Stitch understands it there because it's trained on DESIGN.md format.
- Do NOT try to pass DesignTheme as a separate API parameter — it won't work.

---

## DESIGN.md Format (What Stitch Understands)

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

---

## ColorMode Detection

**Primary method:** `scrape-brand.js` scrolls the actual brand page and samples background colours at 6 evenly-spaced positions (skipping the hero). It counts light vs dark samples and writes `detectedTheme: "light"` or `"dark"` to `brand-profile.json`. This is reliable because it measures the dominant page theme, not just the hero — many brands (e.g. FitFlow) have a dark hero but light content sections.

`detectColorMode()` in `generate-course-html.js` reads `brand-profile.json.detectedTheme` first. If unavailable (e.g. manual brand setup), it falls back to keyword-matching the brand-design.md text. The detected mode is injected as an explicit `colorMode` directive into the Stitch prompt. `design-tokens.json` `isDark` is always extracted from Stitch's actual CSS output.

---

## Prompt Enhancement (from stitch-skills repo)

The stitch-design skill (https://github.com/google-labs-code/stitch-skills) specifies that enhanced prompts should include:
1. Platform specification (Web Desktop)
2. Design system brief (the DESIGN.md content)
3. Palette with semantic role naming + hex codes
4. Style descriptors for roundness and shadow/elevation
5. Detailed PAGE STRUCTURE with Header, Hero, Content Area, Footer
- Convert informal language to professional UI/UX terminology (e.g., "nice header" → "sticky navigation bar with glassmorphism")
- Use evocative atmospheric direction (Minimalist, Vibrant, Brutalist, etc.)

---

## Component Pattern Extraction

After Stitch returns the full HTML page, `generate-course-html.js` extracts individual component patterns:
- The representative course prompt instructs Stitch to wrap each component with `data-component-type="hero"`, `data-component-type="accordion"`, etc.
- Extraction parses the returned HTML by `data-component-type` attributes (regex tag matching)
- Each fragment is stored in `component-patterns/{type}.html`
- The page shell (nav, footer, head content) is extracted separately to `_page-shell.json`
- If <25 patterns found: retry Stitch with a focused prompt for missing types, then fallback to semantic-token-based defaults
- Confirmed working: 25/25 patterns extracted, 39 components filled with 0 fallbacks (EV test course)

---

## Design Contract (extract-contract.js)

The design contract is the **stable interface** between Stitch's design output and the build step. It's produced by `extract-contract.js` (cheerio-based, runs automatically at the end of `generate-course-html.js`).

**How it works:**
1. Reads each `component-patterns/{type}.html` file
2. Uses cheerio (proper HTML parser) to extract visual-only properties: shadows, backgrounds, borders, hover effects, button styles, rounded corners
3. Writes `design-contract.json` — one entry per component type with extracted visual classes
4. `build-course.js` reads ONLY this JSON — never touches raw HTML patterns

**Why this matters:**
- If Stitch changes its HTML output → fix `extract-contract.js` (one file)
- The 25 fill functions in `build-course.js` don't change
- Different brand URL → different contract values → different visual character, identical layout

---

## representative-course.md Requirements

This file must:
- Include ALL 28 component types (no gaps — the authoring layer needs every type designed)
- Arrange them in a realistic e-learning flow (hero → intro text → content → quiz → etc.)
- Use generic but realistic example content (not tied to any specific SCORM)
- Request `data-component-type` attributes on each component wrapper for extraction
- Request all interactive data attributes for hydrate.js compatibility
- Be a SINGLE deep-scroll page (not multiple pages)

---

## What hydrate.js Expects (data attributes)

These MUST be included in the Stitch prompt so Stitch generates HTML with these exact attributes:
- **Quizzes:** `data-quiz` on container, `data-correct="N"` (zero-indexed), `data-choice` on each option
- **Accordions:** Native `<details><summary>` elements
- **Tabs:** `data-tabs` on container, `data-tab-trigger` on buttons, `data-tab-panel` on panels
- **Flashcards:** `data-flashcard` on card container
- **Checklists:** `data-checklist` on container, native `<input type="checkbox">`
- **Carousels:** `data-carousel` on container, `data-slide` on slides, `data-prev`/`data-next` on nav
- **Text inputs:** Native `<form>` with `<input>` elements

hydrate.js then "lights them up" with interactivity.

---

## Future: IMAGE_TO_UI

The SDK's internal schema references `IMAGE_TO_UI` project types. When this tool is exposed, we can pass brand URL screenshots directly to Stitch instead of generating DESIGN.md from screenshot description. Monitor SDK updates.
