# Engine V6 — Complete Rebuild Brief

> This is the single source of truth for the V6 engine rebuild. It captures all findings from the Stitch audit, two external architecture reviews, and the agreed replacement strategy. A new chat should read this document first and use it to drive the implementation.

---

## Table of Contents

1. [Why We're Rebuilding](#1-why-were-rebuilding)
2. [What Stitch Actually Provides (Audit Findings)](#2-what-stitch-actually-provides)
3. [What We Already Have](#3-what-we-already-have)
4. [The New Architecture](#4-the-new-architecture)
5. [Implementation Phases](#5-implementation-phases)
6. [Phase A: Foundation (React SSR + Tailwind v4)](#6-phase-a-foundation)
7. [Phase B: Brand Intelligence (Replaces Stitch)](#7-phase-b-brand-intelligence)
8. [Phase C: Design System (Recipes + Archetypes)](#8-phase-c-design-system)
9. [Phase D: QA & Calibration](#9-phase-d-qa--calibration)
10. [File Inventory](#10-file-inventory)
11. [Key Code References](#11-key-code-references)
12. [Risks and Hard Problems](#12-risks-and-hard-problems)
13. [Decision Log — Why We Chose This and Not That](#13-decision-log--why-we-chose-this-and-not-that)
14. [Appendix: Actual Stitch Output Data](#appendix-actual-stitch-output-data)

---

## 1. Why We're Rebuilding

Three converging problems:

### A. Stitch is architecturally wrong

The current pipeline is **generate → repair → validate**:
- Stitch generates a black-box HTML page
- `extract-contract.js` (745 lines) parses and repairs it
- `build-course.js` has 101 fallback operations to handle failures
- Dark-mode fixups strip Stitch's `bg-white`/`border-black` mistakes
- QA tests 17-31 exist to catch Stitch's inconsistency

The target architecture is **constrain → generate → trust**:
- Extract actual CSS from brand websites (deterministic)
- Use constrained AI only for narrow interpretation steps (testable)
- Render deterministically from tokens + recipes (trustworthy)

### B. QA instability traces directly to Stitch

From the current `design-contract.json`:

**Border-radius chaos (7 values in one contract):**
- `rounded-xl` (hero buttons) / `rounded-[2rem]` (MCQ card) / `rounded-2xl` (branching) / `rounded-3xl` (flashcard, checklist) / `rounded-full` (tabs) / `rounded-lg` (stat-callout) / `rounded-none` (checkbox)
- A coherent design system uses 2-3 values max

**Section backgrounds (4 values, no rhythm):**
- `bg-surface-dim` (text, graphic, MCQ, narrative, media)
- `bg-surface-container-lowest` (hero, data-table, tabs, process-flow, image-gallery)
- `bg-surface` (key-term, checklist, labeled-image)
- `bg-surface-container-low` (accordion)
- No intentional alternation. Random per-component.

**Padding fragmentation:**
- Most: `py-24 px-8 md:px-24`
- video-transcript: `px-6 py-12 lg:px-24 lg:py-20` (different breakpoint AND values)
- full-bleed: `px-8` only

**WCAG contrast chains:** Different every run.

### C. The engine must scale

Phase 4 (drag-and-drop section management), live preview, rich authoring — these require a component framework, not string template concatenation. Building this in vanilla JS will become unmaintainable. React SSR is the natural evolution. Best to migrate now before the authoring layer gets more complex.

### D. Integration cost is unjustifiable

- **1,499 lines** of Stitch-specific code (generate-course-html.js + extract-contract.js)
- **25 hardcoded fallback HTML patterns** because Stitch often doesn't generate all components
- **Retry mechanism** (second API call for missing components)
- **10-minute timeout** per API call
- Typography: `mergeTypo()` keeps ONLY font-weight, discards all sizes/spacing
- 12 of 28 components get ZERO visual properties from Stitch beyond section padding

---

## 2. What Stitch Actually Provides

### The important artifact: design-tokens.json

This is where brand identity actually lives. When Stitch tokens are removed, `generateHead()` falls back to:

```
primary:              '#ffffff'    ← NO brand identity
primary-container:    '#d4d4d4'    ← generic gray
secondary:            '#adc6ff'    ← generic blue
tertiary:             '#e9ddff'    ← generic purple
surface-dim:          '#131313'    ← generic dark
headline font:        'Inter'      ← generic
body font:            'Inter'      ← same
```

With Stitch (Cyntch brand):

```
primary:                    '#B8C3FF'    ← lavender-blue, brand-specific
primary-container:          '#2E5BFF'    ← electric cobalt, brand-specific
on-primary-container:       '#EFEFFF'
on-surface-variant:         '#C4C5D9'
outline-variant:            '#434656'
surface-dim:                '#131313'
surface-container-lowest:   '#0E0E0E'
surface-container-low:      '#1B1B1B'
surface-container:          '#1F1F1F'
surface-container-high:     '#2A2A2A'
surface-container-highest:  '#353535'
headline font:              'Space Grotesk'
body font:                  'Inter'
```

These 11+ colors flow through EVERYTHING: every `glass-card` border uses `outline-variant`, every `.text-gradient` uses `primary→secondary→tertiary`, every section background uses the surface hierarchy. **Remove these and the entire course becomes a generic dark theme identical for every brand.**

### The less-important artifact: design-contract.json

Per-component visual accents. Audit found:
- **12 of 28 components** get ZERO from Stitch beyond section padding
- **6 components** get marginal value (optional glows/shadows, fallbacks are fine)
- **6 components** get meaningful styling (hero, mcq, tabs, flashcard, timeline, branching)
- Every "brilliant" pattern maps to one of 8 parameterized CSS recipes (see Section 8)

### What Stitch's real value is

Stitch takes a prose brand brief and produces a **complete Material Design 3 semantic color palette** — 11+ colors with proper surface graduation, contrast pairs, and font selection. That's the actual design intelligence. Everything else (per-component accents, typography sizing, layout) we already control ourselves.

---

## 3. What We Already Have

### Brand scraping (scrape-brand.js)

Currently extracts:
- Full-page screenshot via Playwright
- isDark/isLight detection via luminance sampling at 6 scroll positions
- Rich prose brief via Claude Vision (600+ words covering: visual theme, colour palette, typography, component styles, layout feel, image treatment)
- Brand profile JSON (url, colorMode, visualSummary, typography, componentStyle, accentColors)

**What it does NOT extract (the gap):** Actual hex colors, font-family CSS values, border-radius values, box-shadow values, gradient definitions. All brand data is prose.

### Build system (build-course.js)

Already has:
- `generateHead()` that builds complete `<head>` from `design-tokens.json` (NOT from Stitch raw HTML)
- 28 fill functions with premium fallbacks for every DC property (`glass-card`, MD3 semantic colors, consistent transitions)
- Custom CSS classes built from tokens: `.glass-card`, `.text-gradient`, `.btn-primary`, `.glass-nav`
- Dark-mode fixup block (lines ~2426-2446) that strips Stitch's light-mode mistakes
- `mergeTypo()` that only keeps font-weight from Stitch, discards sizes/spacing (we own the scale)

### Content pipeline

Working well, not changing:
- `research-content.js` → knowledge-base.json (subagent with web search)
- `generate-layout.js` → course-layout.json (subagent with archetypes, emotional arc)
- `component-library.json` — 28 components with variants, learningMoment, creativeUses

---

## 4. The New Architecture

### Pipeline comparison

**Current (V5):**
```
1. research-content.js → knowledge-base.json
2. scrape-brand.js → brand-profile.json + brand-design.md (prose only)
3. generate-layout.js → course-layout.json
4. generate-course-html.js → Stitch API → raw HTML + component-patterns/      ← REMOVE
5. extract-contract.js → design-contract.json + design-tokens.json             ← REMOVE
6. generate-images.js → images/
7. build-course.js (string templates, Tailwind CDN) → course.html
8. QA gates (compensating for Stitch randomness)
```

**Target (V6):**
```
1. research-content.js → knowledge-base.json                                    (unchanged)
2. scrape-brand.js (enhanced) → brand-profile.json + brand-design.md
   + extracted-css.json (actual hex values, fonts, shadows, radii)               (enhanced)
3. generate-layout.js → course-layout.json                                      (unchanged)
4. generate-design-tokens.js → design-tokens.json (DTCG format)                 (NEW)
   ├─ Dembrandt-style CSS extraction → raw tokens
   ├─ @material/material-color-utilities → MD3 palette from seed
   ├─ Vision AI → Visual Archetype classification
   └─ Optional: Figma headless → refined token calculation
5. generate-images.js → images/                                                 (unchanged)
6. build-course.js (React SSR, Tailwind v4, pre-built CSS) → course.html       (rebuilt)
   ├─ React components (replace fill functions)
   ├─ Data-driven component registry (replace VARIANT_MAP)
   ├─ Consistent accent recipes (replace per-component DC lookups)
   └─ Container queries (replace width caps)
7. QA gates (simplified — deterministic upstream = fewer failures)
```

### API & Cost Model

**Zero new paid APIs.** Everything is either a local npm package or handled by Claude Code subagents:

| Tool | Type | Cost |
|---|---|---|
| `@material/material-color-utilities` | npm package, runs locally | Free |
| Dembrandt | npm package, Playwright-based, runs locally | Free (MIT) |
| Style Dictionary | npm package, runs locally | Free |
| Tailwind v4 CLI | npm package, runs locally | Free |
| Preact + preact-render-to-string | npm package, runs locally | Free |
| Iconify / Lucide | npm package or free API for open-source icons | Free |
| Vision AI archetype classification (B4) | **Claude Code subagent** — reads screenshot, outputs JSON | No separate API — runs as agent in repo |
| Seed color AI fallback (B5) | **Claude Code subagent** — heuristics first, AI only if ambiguous | No separate API |
| Brand description (scrape-brand.js) | **Claude Code subagent** — already works this way in V5 | No separate API |
| Figma API (B6, optional) | REST API, free tier (personal use, rate-limited) | Free for now — evaluate if needed after MD3 |
| SiliconFlow (image gen) | Already in pipeline | Already paying |
| Pexels (stock photos) | Already in pipeline, free tier 200 req/hr | Already paying |

**Key: all AI interpretation steps (archetype classification, seed color fallback, brand description) are Claude Code subagents, NOT separate Anthropic API calls.** The same pattern used by research-content.js and generate-layout.js in the current pipeline. The new chat should spawn these as Agent tool calls with specific prompts, just like the existing subagent workflow documented in CLAUDE.md.

### Core architectural principles

1. **Constrain → generate → trust** (not generate → repair → validate)
2. **AI interprets, doesn't create** — Vision AI classifies brand personality; it doesn't generate CSS
3. **Selection not generation for design** — pre-built archetype recipes, not freeform Stitch design
4. **Deterministic rendering** — pre-built CSS, consistent recipes, data-driven registry
5. **DTCG as interchange format** — one token standard flows through the entire pipeline
6. **Coupling eliminated** — no extract-contract.js repair layer, no dark-mode fixups, no 101 fallbacks

---

## 5. Implementation Phases

### EXECUTION ORDER — BUILD IN LAYERS YOU CAN SEE AND JUDGE

The full V6 plan is implemented in THREE rounds. Each round produces a working, testable system with visible course output. This lets you look at the result and say "that's right" or "that's wrong" before moving on. **Never change the design system AND the rendering layer at the same time.**

---

### ROUND 1: Replace Stitch (inside the EXISTING build system)
**Goal:** Deterministic tokens + archetype recipes feeding into the current build-course.js. No React. No Tailwind v4. Same fill functions. Just better design input.

**If the output looks better than Stitch → the design system works. Proceed to Round 2.**
**If the output looks wrong → the problem is in tokens/recipes, easy to isolate and fix.**

Sessions:

**Session 1 — Enhanced brand scraping**
- Add `getComputedStyle()` extraction to scrape-brand.js (actual hex colors, font families, border-radii, shadows from brand website)
- Investigate Dembrandt: run `npx dembrandt [brand-url] --dtcg` against 2-3 test brands, compare output
- Save extracted CSS alongside existing brand-profile.json and brand-design.md
- Test: extracted-css.json contains real values from the brand

**Session 2 — MD3 palette + token generation**
- Install `@material/material-color-utilities`
- Create `generate-design-tokens.js`:
  - Reads extracted CSS → identifies primary seed color (heuristics + AI fallback)
  - MD3 generates full palette from seed → writes design-tokens.json
  - Same JSON shape that build-course.js already consumes (colors, fonts, isDark, typography)
- Vision AI archetype classification: subagent reads brand screenshot → outputs archetype + style params
- Save archetype classification in tokens or alongside
- Test: run the CURRENT build-course.js with the NEW tokens. Does the course look branded?

**Session 3 — Archetype recipes in existing build-course.js**
- Add archetype-driven accent recipes directly into the current fill functions:
  - Replace `const c = DC.hero || {}` with archetype recipe lookups
  - e.g., `if (archetype === 'tech-modern') { btnGlow = 'shadow-[0_0_15px_${primaryRgb}66]'; }`
- Define 2-3 archetypes first (`tech-modern`, `minimalist`, `editorial`)
- Remove design-contract.json dependency entirely
- Remove dark-mode fixup block (MD3 generates dark-safe palettes)
- Enforce consistent border-radius, spacing, surface rhythm per archetype
- Test: run full pipeline with 2-3 different brand URLs. Compare output to Stitch. Is it better?

**Session 4 — Multi-brand calibration**
- Test across 4-5 brands (dark, light, gradient, minimal, multi-accent)
- Tune MD3 surface tone overrides for brands where palette looks too "Google-y"
- Tune seed color selection for edge cases
- Add remaining archetypes as needed
- Run QA gates. How many design tests pass now vs with Stitch?
- Archive Stitch code (move generate-course-html.js + extract-contract.js to v5/archived/)

**CHECKPOINT: The design system is proven. Output is consistently better than Stitch. Pipeline is faster. QA is more stable. You have a working V6 design layer on the V5 rendering layer. You can STOP HERE and have a significantly better engine. Or continue to Round 2.**

---

### ROUND 2: Migrate rendering (Preact SSR + Tailwind v4)
**Goal:** Modern rendering foundation for the authoring layer. The token system is already proven from Round 1. If something looks wrong, it's the rendering migration, not the design system.

Sessions:

**Session 5 — Preact SSR setup**
- Add Vite + Preact + preact-render-to-string
- Create `src/render.ts` — SSR entry point
- Convert 5-6 core components first (Hero, Text, Accordion, MCQ, Graphic-Text, Tabs)
- Verify: SSR output matches current fill function output (diff the HTML)
- hydrate.js continues working (it attaches to data-* attributes, framework-agnostic)

**Session 6 — Complete component migration**
- Convert remaining 22 components to Preact
- Build data-driven component registry (replace VARIANT_MAP)
- Verify: full course renders identically to Round 1 output
- Test authoring panel still works (amber edit button, variant swap, inline editing)

**Session 7 — Tailwind v4 migration**
- Replace CDN JIT with Tailwind v4 CLI
- Move token injection from `<script>tailwind.config</script>` to CSS `@theme` directives
- Move custom classes (glass-card, text-gradient) to theme.css
- Inline built CSS into single-file output
- Verify: course looks identical, no CDN dependency, CSS is deterministic

**CHECKPOINT: Full V6 rendering layer. Preact components, Tailwind v4, data-driven registry. Ready for Phase 4 authoring (drag-and-drop) whenever you want to build it.**

---

### ROUND 3: Polish
**Goal:** Container queries, icon strategy, QA simplification, optional Figma/Style Dictionary if needed.

**Session 8 — Container queries + width system**
- Replace COMPONENT_WIDTH_BOOST/CAP with container-responsive layouts
- Components adapt to container width, not viewport

**Session 9 — QA simplification + visual regression baseline**
- Remove or simplify design quality tests that can no longer fail (radius consistency, padding consistency)
- Capture reference screenshots per archetype × brand
- Optional: Framer Motion for authoring panel animations

**Session 10+ — Optional: DTCG, Style Dictionary, Figma, dynamic icons**
- Only if the simpler approach from Rounds 1-2 proves insufficient
- These are "enterprise scaling" tools — evaluate based on actual need

---

**IMPORTANT FOR EACH SESSION:** Start by reading this brief. Read `CLAUDE.md` for current system context. Read the specific source files being modified. At the end of each session, run the pipeline and visually inspect the output before committing. The user is a vibe coder — their judgment is visual, not technical. Keep the feedback loop tight: change → build → look → judge.

---

## 6. Phase A: Foundation (ROUND 2)

> **This phase runs in Round 2 AFTER the design system is proven in Round 1.** Do not change the rendering layer until tokens + archetypes are working in the existing build system. See execution order above.

### A1. Preact SSR Setup

**Why now:** Phase 4 authoring (drag-and-drop section management) requires a component framework. Fill functions are already component functions — they just return strings instead of JSX. Migrating now prevents a painful rewrite later.

**What to do:**
- Add Vite + React + ReactDOM/server
- Create a `renderCourse()` function that builds a React component tree from course-layout.json
- Use `renderToString()` to produce static HTML
- Inline the result into single-file output (same delivery format)
- hydrate.js remains vanilla JS (it attaches to data-* attributes, framework-agnostic)

**Component structure:**
```
src/components/
  Course.tsx          ← root component, maps sections → components
  Section.tsx         ← section wrapper (padding, background, width)
  Hero.tsx            ← was fillHero()
  Text.tsx            ← was fillText()
  Accordion.tsx       ← was fillAccordion()
  MCQ.tsx             ← was fillMCQ()
  ... (28 total)
```

**Each React component:**
- Receives props from course-layout.json (same data shape)
- Receives design tokens (colors, fonts, accent recipes)
- Returns JSX with consistent layout + token-driven styling
- No DC (design-contract) dependency — accents come from recipes

**Output remains single-file HTML.** React is the rendering engine, not the runtime.

**CRITICAL: Use Preact or Island Architecture, not full React hydration.**
The course content is static — only the amber authoring panel needs client-side interactivity. Full React hydration would ship ~40KB of runtime into every course HTML file, which is unacceptable for LMS iframe performance.

Two options (decide during implementation):
- **Preact** (3KB) — same JSX API as React, drop-in replacement for SSR via `preact-render-to-string`. Use `preact/compat` for any React ecosystem libraries. The component migration code is identical either way.
- **Island Architecture** — SSR everything as static HTML, only hydrate the authoring panel as an isolated "island." Course content stays as pure HTML/CSS. Best file size but more complex hydration wiring.

**Why not full React?** We evaluated this. The single-file HTML output gets loaded in LMS iframes where every KB matters. Shipping 40KB of React runtime for static content that doesn't need client-side interactivity is waste. The authoring panel is the only interactive part, and it can be hydrated independently.

**Framer Motion for authoring UX (optional, authoring panel only):** For drag-and-drop section management (Phase 4), Framer Motion (~25KB) provides layout animations (staggered fades, smooth height transitions when reordering). This loads ONLY in the authoring island, not in the static course. The course itself continues using GSAP scroll animations (CDN-loaded). Don't confuse the two animation layers.

### A2. Tailwind v4 Migration

**Why:** CDN JIT is non-deterministic (CSS compiled in browser). Pre-built CSS is deterministic, faster, and removes external CDN dependency.

**What to do:**
- Install `tailwindcss` v4 + CLI
- Replace `<script src="cdn.tailwindcss.com">` + `<script>tailwind.config</script>` with:
  - A `theme.css` file using `@theme` directive for tokens
  - Tailwind CLI build step: `npx tailwindcss -i theme.css -o course.css`
  - Inline built CSS into `<style>` in final HTML
- Token injection via CSS `@theme` instead of JS config:
  ```css
  @theme {
    --color-primary: var(--brand-primary);
    --color-surface-dim: var(--brand-surface-dim);
    --font-headline: var(--brand-font-headline);
    /* etc. */
  }
  ```
- Move custom classes (`.glass-card`, `.text-gradient`, etc.) into the CSS file

**Benefits:**
- ~35x faster builds (no JIT overhead)
- Deterministic CSS output (what you build = what renders)
- No external CDN dependency
- Cleaner token injection

**Use Style Dictionary (Amazon) for token transformation.** Style Dictionary is the industry standard for taking DTCG JSON and transforming it into Tailwind CSS variables, CSS custom properties, and TypeScript types for React/Preact props. It sits between `generate-design-tokens.js` (DTCG output) and the Tailwind `@theme` file (CSS input). This means we can swap out the token generation layer (Dembrandt, MD3, Figma) without touching components — as long as the DTCG JSON is valid, Style Dictionary produces the right CSS.

### A3. Data-Driven Component Registry

**Why:** The hardcoded `VARIANT_MAP` in build-course.js is brittle. Adding a variant requires a code change.

**What to do:**
- Create `v5/schemas/component-registry.json` (or `.ts` with types)
- Structure:
  ```json
  {
    "hero": {
      "variants": {
        "centered-overlay": { "layout": "centered", "imagePosition": "background" },
        "split-screen": { "layout": "split", "imagePosition": "right" },
        "minimal-text": { "layout": "centered", "imagePosition": "none" }
      },
      "defaultVariant": "centered-overlay",
      "widthBehavior": "full",
      "animationRecipe": "hero-reveal"
    }
  }
  ```
- React components read from registry, not hardcoded maps
- New variants added by data, not code changes
- Registry also stores: width behavior, animation recipe, accent recipe assignment

### A4. Container Queries

**Why:** Current width capping (`max-w-6xl` for inner content, `max-w-4xl` for vertical lists) is a workaround. Container queries let components respond to their container width.

**What to do:**
- Tailwind v4 has native `@container` support
- Replace viewport-based responsive classes with container-based where appropriate
- Components like bento, comparison, flashcard grid can adapt to their container
- Removes the need for `COMPONENT_WIDTH_BOOST` and `COMPONENT_WIDTH_CAP` maps

---

## 7. Phase B: Brand Intelligence (ROUND 1, Sessions 1-4)

> **This is the FIRST thing to build.** Works inside the existing build-course.js. No React, no Tailwind v4. Just better design input.

### B1. Dembrandt-Style CSS Extraction

**What it is:** [Dembrandt](https://github.com/thevangelist/dembrandt) is an open-source (MIT) Playwright-based CLI tool that crawls a live URL, extracts computed styles, and outputs DTCG-compliant JSON tokens. ~1.6k GitHub stars. Uses confidence scoring to distinguish brand colors from UI noise.

**What to do:**
- Investigate: run `npx dembrandt [brand-url] --dtcg` against test brands
- Compare output accuracy vs what we'd get from manual Playwright `getComputedStyle()`
- If output is good: integrate directly (it's MIT-licensed, can vendor or depend)
- If output needs customization: use as blueprint for our own extraction in scrape-brand.js

**What it extracts:**
- Colors: actual hex values from buttons, headings, backgrounds, links, cards
- Typography: font-family, font-weight, font-size from headings, body, labels
- Spacing: padding/margin patterns
- Borders: border-radius, border-color, border-width
- Shadows: box-shadow values from cards, buttons
- All output in DTCG format with confidence scores

### B2. Enhanced scrape-brand.js

**What to do (regardless of Dembrandt adoption):**
- Add Playwright `page.evaluate()` extraction:
  ```javascript
  const extracted = await page.evaluate(() => {
    const sample = (selector, limit = 10) => {
      return Array.from(document.querySelectorAll(selector)).slice(0, limit).map(el => {
        const s = getComputedStyle(el);
        return {
          color: s.color,
          backgroundColor: s.backgroundColor,
          fontFamily: s.fontFamily,
          fontWeight: s.fontWeight,
          fontSize: s.fontSize,
          borderRadius: s.borderRadius,
          boxShadow: s.boxShadow,
          borderColor: s.borderColor,
          padding: s.padding,
        };
      });
    };
    return {
      buttons: sample('button, [role="button"], a.btn, [class*="btn"]'),
      headings: sample('h1, h2, h3'),
      paragraphs: sample('p'),
      cards: sample('[class*="card"], [class*="panel"], [class*="box"]'),
      backgrounds: sample('section, main, [class*="hero"], [class*="section"]'),
      links: sample('a'),
      inputs: sample('input, textarea'),
    };
  });
  ```
- Save as `v5/output/extracted-css.json`
- Keep existing prose brief generation (brand-design.md) — it's valuable for voice calibration and image treatment
- Keep existing isDark detection via luminance sampling

### B3. MD3 Palette Generation

**What it is:** `@material/material-color-utilities` is Google's published library for Material Design 3 color science. Uses HCT (Hue, Chroma, Tone) color space. Given ONE seed color, generates the entire palette deterministically.

**What to do:**
- `npm install @material/material-color-utilities`
- New script: `generate-design-tokens.js`
- Flow:
  1. Read `extracted-css.json` (from enhanced scraper)
  2. Identify primary seed color (see B5 for how)
  3. Call `CorePalette.of(argbFromHex(seedColor))` → tonal palettes
  4. Map tonal palettes to MD3 semantic roles:
     - `primary` → tone 80 (light) or tone 80 (dark)
     - `primary-container` → tone 30 (dark) or tone 90 (light)
     - `surface-dim` → tone 6
     - `surface-container` → tone 12
     - `surface-container-high` → tone 17
     - etc. (full tone mapping table in MD3 spec)
  5. Generate font assignments from extracted typography
  6. Output `design-tokens.json` in DTCG format

**The output shape must match what generateHead() currently consumes:**
```json
{
  "colors": {
    "primary": "#...",
    "primary-container": "#...",
    "on-primary-container": "#...",
    "secondary": "#...",
    "tertiary": "#...",
    "surface-dim": "#...",
    "surface-container-lowest": "#...",
    "surface-container-low": "#...",
    "surface-container": "#...",
    "surface-container-high": "#...",
    "surface-container-highest": "#...",
    "on-surface-variant": "#...",
    "outline-variant": "#..."
  },
  "fonts": {
    "headline": "...",
    "body": "..."
  },
  "isDark": true/false,
  "typography": { ... },
  "accentRecipes": { ... }  // NEW: see Phase C
}
```

### B4. Vision AI Archetype Classification

**What it is:** Instead of Stitch "guessing" a design, we use Vision AI to classify the brand's visual personality and select a pre-built design archetype.

**What to do:**
- Analyze brand screenshot with Claude Vision
- Structured JSON output:
  ```json
  {
    "archetype": "tech-modern",        // from defined set (see Phase C)
    "borderRadiusStyle": "sharp",       // sharp / rounded / pill
    "shadowDepth": "glow",             // flat / subtle / medium / deep / glow
    "surfaceStyle": "glass",           // flat / glass / gradient / textured
    "iconWeight": "outlined",          // outlined / rounded / filled
    "decorativeElements": "glow-accents", // none / glow-accents / gradient-borders / subtle-shadows
    "typographyCharacter": "geometric", // geometric / humanist / monospace / serif
    "density": "spacious"              // compact / standard / spacious / editorial
  }
  ```
- This classification drives accent recipe selection (see Phase C)
- Single Claude API call — narrow, testable, inspectable
- No CSS generation — just interpretation and selection

**Why this is better than Stitch:** Stitch tries to generate an entire designed page from a prose brief (broad, uncontrollable). Vision AI just classifies intent from a screenshot (narrow, testable). The actual design work happens in our pre-built recipes (deterministic, consistent).

### B5. Seed Color Selection

**The hard problem:** Given extracted CSS from a brand website, which color is "primary"?

**Approach (layered heuristics + AI fallback):**
1. Extract all unique colors from buttons, links, headings, accents
2. Filter out near-black, near-white, and near-gray (not accent colors)
3. Dembrandt's confidence scoring (if available) ranks by frequency + context
4. Heuristic: the most-frequent saturated color on interactive elements (buttons, links) is likely primary
5. AI fallback: if ambiguous, include in the Vision AI archetype call — "which of these extracted colors is the primary brand accent?"

**Multi-accent brands:** MD3 supports primary, secondary, and tertiary. If the brand has multiple distinct accent colors:
- Most prominent → primary seed → MD3 generates structural palette (surfaces, containers, outlines)
- Second high-confidence color → secondary seed → used for action items (buttons, links, CTAs). Overrides MD3's auto-generated secondary.
- Third (if present) → tertiary seed

**Why separate structural vs action colors:** Many premium brands (Stripe, Airbnb) use a primary color for structural identity but a different color for interactive elements. MD3's single-seed model blends these. By splitting: primary seed drives surfaces/containers (the "feel"), secondary seed drives buttons/links (the "actions"). Add a `secondarySeed` slot to the DTCG schema for this.

**Font role classification heuristic:** Don't just check which font appears on `<h1>` tags — analyze computed font-size frequency across the entire page. If a font appears at 14-16px 80% of the time, it's the body font. If it appears at 32px+ in hero/section headings, it's the display/headline font. This is more robust than element-based guessing because some brands use the same font family at different weights for headings and body.

### B6. Figma as Headless Token Server (Optional / Future)

**The concept:** Figma's Variables API can function as a programmatic token calculation engine. No human opens Figma.

**Flow:**
1. Push extracted brand colors to a "Master Theme" Figma file via REST API
2. Figma Variables with modes (Dark/Light, Compact/Spacious) calculate peripheral scales
3. Pull refined tokens back via API
4. Figma handles accessibility ratio calculations and scale interpolation

**Why consider it:**
- Figma's color and spacing logic is industry-standard
- Variable Modes handle dark/light automatically
- Outsources complex accessibility math

**Why it's optional:**
- Adds external dependency
- `@material/material-color-utilities` handles the core math
- Main benefit is Variable Modes and accessibility — which MD3 library also covers
- Evaluate after Phase B3 is working — if MD3 palettes are good enough, skip Figma
- **Figma API can be slow** — any Figma calls MUST happen at build time with results cached in DTCG JSON. Never at runtime, never blocking the end-user's browser.

**Important: Figma does NOT replace the amber authoring panel.** Figma is a token server only. Content editing and layout authoring remain in-course. This was explicitly discussed and decided: Figma as a design tool would create a "source of truth" conflict (edit in Figma or in the amber panel?). The answer is: amber panel for content/layout, Figma only for token math if MD3 isn't sufficient.

**Potential future use for mode switching:** If the authoring panel adds a "Make this course more compact" toggle, that could pull Compact-mode tokens from the Figma file rather than writing CSS logic. But this is speculative — evaluate after core pipeline works.

---

## 8. Phase C: Design System (ROUND 1, Session 3 + ROUND 3 for polish)

> **Archetype recipes go into the existing build-course.js in Round 1.** Container queries, icon strategy, and polish happen in Round 3.

### C1. Visual Archetypes

**What they are:** 5-8 pre-designed structural recipe families that define the visual personality of a course. The Vision AI selects which archetype to apply based on brand analysis.

**IMPORTANT: Build archetypes early, mock tokens.** Don't wait for Dembrandt/MD3 integration. These archetypes are the most valuable IP in the system — they define the "premium" feel that separates us from generic AI-generated sites. Manually create token files for 3-4 test brands and build the archetypes against real visual output. Phase A and Phase B can run in parallel; Phase C archetypes should start as soon as the React component structure exists.

**MD3 surface tone override:** MD3 palette generation is mathematically perfect for accessibility but can produce "Google-y" pastel surfaces. For brands with very dark backgrounds (like Cyntch: `#131313`), MD3's default surface-dim might come out as `#1a1a2e` (slightly tinted) instead of the brand's actual near-black. The archetype layer MUST be able to override MD3 surface tones — keeping the primary accent palette math but substituting brand-extracted surface values. This is especially important for `neo-brutalist` (needs high-contrast blacks/whites) and `luxury` (needs deep, untinted darks).

**Proposed archetypes:**

| Archetype | Description | Border Radius | Shadows | Surfaces | Accents |
|---|---|---|---|---|---|
| `tech-modern` | Dark, glowing, electric | Sharp (4-8px) | Glow (colored box-shadow) | Glass (backdrop-blur) | Neon glow on interactive elements |
| `editorial` | Spacious, typographic, refined | Minimal (2-4px) | Flat (none or very subtle) | Flat solids from surface hierarchy | Thin accent borders, generous whitespace |
| `glassmorphist` | Frosted, layered, depth | Rounded (16-24px) | Medium (standard box-shadow) | Heavy glass (high blur, transparency) | Gradient borders, frosted overlays |
| `minimalist` | Clean, invisible UI, content-first | Rounded (8-12px) | Subtle (low-opacity shadow) | Flat with minimal contrast | Almost none — color only on CTAs |
| `neo-brutalist` | Bold, high contrast, graphic | Sharp (0-4px) | None | Solid blocks, high contrast | Thick borders, bold colors, offset shadows |
| `warm-organic` | Soft, approachable, friendly | Pill (20-32px) | Soft (large blur, low opacity) | Warm-tinted surfaces | Soft gradients, rounded everything |
| `corporate` | Professional, structured, trustworthy | Standard (8px) | Subtle (clean, crisp) | Neutral surfaces, clear hierarchy | Accent color on key actions only |
| `luxury` | Dark, subtle, premium | Minimal (4-8px) | None or very subtle | Deep, muted surfaces | Metallic gradients, thin gold/silver lines |

Each archetype is a complete recipe set that specifies:
- Border radius values (consistent across all components)
- Shadow definitions
- Surface treatment (glass vs flat vs gradient)
- Hover/transition patterns
- Decorative elements (glow, borders, icons)
- Spacing rhythm

### C2. Accent Recipe Engine

**The 8 core recipes** (from our audit — these cover every visual accent Stitch ever produced):

1. **Glow**: `box-shadow: 0 0 ${spread}px rgba(${primaryRgb}, ${opacity})`
   - Applied to: primary buttons, active timeline dots, focus rings
   - Parameterized by: primary color hex, spread (10-20px), opacity (0.3-0.5)

2. **Glass**: `backdrop-filter: blur(${blur}px); background: ${surfaceColor}${alphaHex}`
   - Applied to: cards, containers, nav bar
   - Parameterized by: surface color, blur (8-20px), alpha (80-cc hex)

3. **Gradient text**: `linear-gradient(${angle}deg, ${primary}, ${secondary}, ${tertiary})`
   - Applied to: stat numbers, hero accents
   - Parameterized by: three token colors, angle

4. **Surface rhythm**: Intentional alternation of surface levels
   - Pattern: `surface-dim → surface-container-low → surface-dim → surface-container-lowest`
   - Applied to: section backgrounds (no more random Stitch assignment)

5. **Accent borders**: `border-left: ${width}px solid ${primary}` or `border: 1px solid ${outline}/${opacity}`
   - Applied to: key-term cards, accordion separators, pullquote bars
   - Parameterized by: width (2-4px), color, opacity (10-30%)

6. **Hover transitions**: `transition-all duration-300` + bg shift to next surface level
   - Applied to: all interactive elements (buttons, choices, accordion headers)
   - Consistent across ALL components (no more per-component Stitch variation)

7. **Image hover zoom**: `group-hover:scale-${scale} transition-transform duration-${ms}`
   - Applied to: bento cards, image gallery thumbnails
   - Parameterized by: scale (105-115), duration (500-700ms)

8. **Decorative icons**: Material symbol at `opacity-${opacity}` in `${accentColor}`
   - Applied to: pullquote marks, divider icons
   - Parameterized by: icon name, opacity (20-40%), color

**Each Visual Archetype specifies which recipes to apply and with what parameters.** For example:
- `tech-modern` uses: Glow (strong), Glass (heavy), Gradient text, Surface rhythm, Accent borders (thin glow)
- `minimalist` uses: Surface rhythm only, Hover transitions (subtle), no glow, no glass, no decorative elements
- `warm-organic` uses: Glass (light, warm), Hover transitions (soft), Accent borders (rounded), Decorative icons

### C3. Dynamic Icon Strategy

**Why:** Material Symbols Outlined is the sole icon source currently. Different brand personalities call for different icon weights.

**What to do:**
- Integrate Iconify API or Lucide-Lab
- Vision AI archetype classification includes `iconWeight` (outlined / rounded / filled)
- Build system loads matching icon set
- Icon selection based on brand weight:
  - Minimalist brands → thin line icons (Lucide, Feather)
  - Bold brands → filled icons (Material Filled)
  - Modern brands → outlined (Material Outlined, current default)
  - Friendly brands → rounded (Material Rounded)

### C4. Consistent Spacing and Radius

**Replaces Stitch's random assignments:**

**Border radius (per archetype, consistent across ALL components):**
```
sharp:   { card: 'rounded-lg', button: 'rounded-md', input: 'rounded-md' }
rounded: { card: 'rounded-2xl', button: 'rounded-xl', input: 'rounded-xl' }
pill:    { card: 'rounded-3xl', button: 'rounded-full', input: 'rounded-full' }
```

**Section spacing (consistent, no variation):**
```
standard: py-20 (all standard sections)
compact:  py-12 (dividers, graphics)
generous: py-28 (hero, full-bleed)
```

**No per-component overrides.** The archetype defines the system. Every component follows it.

---

## 9. Phase D: QA & Calibration (ROUND 1 Session 4 + ROUND 3)

### D1. Simplified QA

With deterministic upstream:
- **Test 17 (WCAG contrast):** Still needed, but should rarely fail (MD3 generates accessible pairs)
- **Test 18 (padding consistency):** Should never fail (consistent spacing system)
- **Test 23 (border-radius consistency):** Should never fail (archetype-defined radii)
- **Test 26 (button style consistency):** Should never fail (recipe-defined buttons)
- **Tests 1-16 (functional):** Unchanged — still needed for interactivity
- **Dark-mode fixups:** Eliminated entirely (MD3 generates dark-safe palettes)

### D2. Multi-Brand Calibration

- Test each Visual Archetype across 3-5 brands
- Tune recipe parameters (glow spread, glass blur, gradient angle)
- Verify seed color selection works for: dark brands, light brands, gradient brands, multi-accent brands, minimal brands
- Document edge cases and fallbacks

### D3. Visual Regression Baseline

- Capture reference screenshots for each archetype + brand combination
- Optional: integrate Applitools/Percy for automated visual regression
- At minimum: review-course.js continues working as-is

### D4. Archive Stitch Code

- Move to `v5/archived/`:
  - `generate-course-html.js`
  - `extract-contract.js`
  - `STITCH-INTEGRATION.md`
- Keep for reference but remove from active pipeline
- Remove from CLAUDE.md pipeline documentation

---

## 10. File Inventory

### New files to create

| File | Purpose | Phase |
|---|---|---|
| `src/components/Course.tsx` | Root React component | A1 |
| `src/components/Section.tsx` | Section wrapper | A1 |
| `src/components/Hero.tsx` | Hero component (was fillHero) | A1 |
| `src/components/*.tsx` | 28 component files total | A1 |
| `src/render.ts` | SSR entry: renderToString → HTML | A1 |
| `theme.css` | Tailwind v4 @theme tokens | A2 |
| `v5/schemas/component-registry.json` | Data-driven variant/width/animation map | A3 |
| `v5/scripts/generate-design-tokens.js` | MD3 palette + archetype + token generation | B3 |
| `v5/schemas/visual-archetypes.json` | 5-8 archetype definitions with recipe params | C1 |
| `v5/schemas/accent-recipes.json` | Parameterized recipe definitions | C2 |

### Files to modify

| File | Changes | Phase |
|---|---|---|
| `package.json` | Add: preact, preact-render-to-string (OR react/react-dom), vite, tailwindcss v4, @material/material-color-utilities, style-dictionary. Remove: @google/stitch-sdk | A1, A2, B3 |
| `v5/scripts/scrape-brand.js` | Add CSS extraction via getComputedStyle() | B2 |
| `v5/scripts/build-course.js` | Rewrite: React SSR, read from registry + recipes, Tailwind v4 | A1-A4 |
| `v5/scripts/qa-interactive.js` | Simplify design quality tests (17-31) | D1 |
| `CLAUDE.md` | Update pipeline, architecture, file structure | All |
| `v5/BUILD-SYSTEM.md` | Rewrite for new architecture | All |

### Files to archive

| File | Reason |
|---|---|
| `v5/scripts/generate-course-html.js` | Stitch SDK integration (754 lines) |
| `v5/scripts/extract-contract.js` | Stitch extraction/repair (745 lines) |
| `v5/STITCH-INTEGRATION.md` | Stitch documentation |
| `v5/output/design-contract.json` | No longer generated |
| `v5/output/component-patterns/` | No longer generated |
| `v5/output/stitch-course-raw.html` | No longer generated |
| `v5/output/stitch-course-meta.json` | No longer generated |

---

## 11. Key Code References

### build-course.js (the file being rewritten)
- **Line 95-131:** Typography parsing + `mergeTypo()` (keeps only fontWeight from Stitch)
- **Line 147-395:** `generateHead()` — builds `<head>` from design-tokens.json. Core logic preserved in new system.
- **Lines 211-221:** Color fallback defaults (the generic values seen without Stitch)
- **Lines 265-394:** Custom CSS classes (glass-card, text-gradient, btn-primary) — move to theme.css
- **Lines 398-413:** Comment block explaining visual vs layout contract
- **Lines 415+:** 28 fill functions — each becomes a React component
- **Lines ~2426-2446:** Dark-mode fixup block stripping Stitch's bg-white/border-black — eliminated

### extract-contract.js (being archived)
- **Lines 28-67:** Visual class filter regexes — some logic reusable for CSS extraction
- **Lines 515-643:** Typography extraction via frequency voting — concept reusable
- **Lines 660-737:** Main extraction loop — replaced by Dembrandt/getComputedStyle

### generate-course-html.js (being archived)
- **Lines 84-114:** Stitch prompt construction
- **Lines 191-236:** Token extraction from Stitch's Tailwind config
- **Lines 334-517:** 25 hardcoded fallback patterns — useful as React component reference
- **Lines 658-707:** Retry mechanism (evidence of Stitch unreliability)

### scrape-brand.js (being enhanced)
- **Lines 53-171:** isDark detection via luminance sampling — keep as-is
- **Lines 215-272:** Claude Vision brand description — keep as-is
- **Lines 275-310:** Image treatment extraction — keep as-is
- **NEW:** CSS extraction function after screenshot capture

---

## 12. Risks and Hard Problems

### Genuinely hard (don't underestimate)

1. **Seed color selection** — "Which blue is primary?" Dembrandt's confidence scoring helps. Multi-accent brands need special handling. AI fallback for ambiguous cases.

2. **MD3 tuning for web** — The library was designed for Android. Surface tones may need adjustment for web (screens are larger, viewing distances differ, ambient light varies more). Expect calibration work.

3. **Visual Archetype design** — The 5-8 archetypes need to actually look S-tier. This is design work, not engineering. Each archetype needs testing across multiple brands. Plan for 2-3 calibration rounds.

4. **React SSR migration** — 28 fill functions → React components is mechanical but large. ~2000 lines of template logic to convert. Each component needs testing.

5. **Font role classification** — Which of the brand's extracted fonts is headline vs body? Heuristic: largest/boldest on headings = headline. May need AI fallback.

6. **Figma API integration** (if pursued) — Programmatic push/pull without human interaction requires careful API design. Variable Modes setup is a one-time design effort.

### Medium difficulty

7. **Tailwind v4 migration** — Config syntax changes. Plugin ecosystem may differ. CDN → CLI requires build step. Well-documented migration path exists.

8. **Container queries** — Replacing viewport-responsive with container-responsive is conceptual work — each component needs rethinking.

9. **DTCG format adoption** — Mapping our current token shape to DTCG standard.

### Lower risk

10. **Dembrandt integration** — Open-source, MIT, well-starred. Evaluate and adopt or use as blueprint.

11. **Archiving Stitch code** — Just file moves, no risk.

12. **QA simplification** — Tests become simpler, not more complex.

### Quality expectations (honest)

| | Stitch V5 (current) | V6 (projected) |
|---|---|---|
| **Best case** | S-tier (rare, ~1 in 4 runs) | A+ consistently, improving to S with archetype tuning |
| **Average case** | B+ (most accents fall to fallbacks) | A+ consistently |
| **Worst case** | C (contrast failures, radius chaos) | A+ consistently |
| **QA pass rate** | ~60-70% first build | ~95%+ first build |
| **Build speed** | 10+ min (Stitch API + retry) | Seconds (deterministic computation) |
| **Reliability** | Retry mechanism needed | Deterministic — same input, same output |

The honest gap: V6's first version will be "consistently excellent" not "occasionally breathtaking." Getting to S-tier requires iterating archetype recipes across brands. But every improvement is permanent, and the floor is dramatically higher.

---

## 13. Decision Log — Why We Chose This and Not That

This section captures decisions made during the audit conversation so a new chat doesn't re-evaluate paths we already ruled out.

### Why not keep Stitch and just improve extraction?

**Ruled out.** The core problem is architectural coupling: we are parsing and correcting a black-box system after the fact. `extract-contract.js` (745 lines) exists solely to repair Stitch's output. 101 fallbacks exist because upstream is unreliable. QA compensates for upstream randomness. No amount of better extraction fixes the fundamental issue: Stitch's output is non-deterministic and we can't constrain it. Two independent external reviews both identified this as the core problem.

### Why not just use our existing fallbacks without Stitch?

**Tested by the user — visually insufficient.** The user tested Stitch output vs fallback-only output and the difference was "quite obvious in terms of a consistent branded look." Investigation revealed why: the fallback colors in `generateHead()` are generic (`primary: '#ffffff'`, `secondary: '#adc6ff'`) with no brand identity. The branded look comes from the color TOKEN palette, not the per-component accents. We need a replacement that generates brand-specific tokens, not just better fallbacks.

### Why not full React (instead of Preact/Islands)?

**File size.** The output is a single HTML file loaded in LMS iframes. React runtime is ~40KB. Course content is static — only the authoring panel needs client-side interactivity. Shipping 40KB for static content is waste. Preact (3KB, same API) or island architecture (hydrate only the authoring panel) solves this. The SSR component code is identical either way.

### Why not Figma Code Connect?

**Solves the wrong problem.** Code Connect links existing React components to Figma designs so designers see code snippets. It solves Human→Code workflow. Our pipeline is URL→Code (fully automated, no human designer). Code Connect is irrelevant to automated course generation.

### Why not Builder.io Visual Copilot?

**Requires Figma + React component library, solves Human→Code.** Our pipeline is automated: URL + topic → course. Builder.io requires a human to design in Figma, then maps to React components. The PATTERN (structured mapper file) is valuable and we're adopting it as the data-driven component registry. But the TOOL doesn't fit our automated pipeline.

### Why not skip React and keep fill functions?

**Considered seriously.** Fill functions work today across 9+ brands. But Phase 4 authoring (drag-and-drop section management) will require: component state management, event delegation, live preview updates, undo/redo. Building this in vanilla JS string templates becomes unmaintainable. The fill functions ARE component functions — converting `fillHero(comp)` to `<Hero {...comp} />` is mechanical. Better to migrate now before authoring complexity grows.

### Why Dembrandt specifically?

**Open-source (MIT), Playwright-based, outputs DTCG, has confidence scoring.** ~1.6k GitHub stars. The confidence scoring (distinguishing brand colors from generic UI noise) directly solves our seed color selection problem. If its output isn't accurate enough for our needs, the source code serves as a blueprint for our own extraction. Evaluate empirically before committing.

### Why @material/material-color-utilities and not custom color math?

**Google's own library, battle-tested on Android, deterministic, accessibility-guaranteed.** MD3's HCT color space generates mathematically correct contrast pairs. Writing custom color math is reinventing a solved problem. The one caveat: MD3 was designed for Android and can produce "Google-y" pastel surfaces — the archetype layer must be able to override surface tones while keeping accent math.

### Why Visual Archetypes and not per-brand custom design?

**Determinism over creativity.** Stitch tried per-brand custom design and produced inconsistent results (7 border-radii, random backgrounds, contrast failures). Archetypes give us: consistent output within a style family, testable recipes, permanent improvements. The trade-off (less brand-specific than a perfect Stitch run) is acceptable because: (a) Stitch's "perfect" runs were rare (~1 in 4), (b) archetypes can still be tuned per-brand via color tokens, and (c) every archetype improvement benefits all brands in that family.

### Why not Tailwind v3 (stay on current)?

**CDN JIT is non-deterministic.** CSS is compiled in the browser at runtime. Same HTML can render differently if the CDN version changes or JIT encounters classes in a different order. Pre-built CSS via Tailwind v4 CLI means: what you build is what renders, every time. Also: v4's `@theme` directive is natively CSS (cleaner than our current `<script>tailwind.config = {...}</script>` JS hack), and Style Dictionary integrates naturally with CSS custom properties.

### Why is Figma headless optional?

**MD3 library handles the core math.** Figma's Variable Modes (Light/Dark, Compact/Spacious) are powerful but overlap with what `@material/material-color-utilities` already does. Figma adds an external API dependency with latency. Evaluate after MD3 palettes are working — if they're good enough, the complexity of Figma API integration isn't justified. If MD3 surfaces need more sophistication (e.g., mode switching in the authoring panel), Figma becomes worth it.

### Why Phase A before Phase B?

**Everything builds on React components + Tailwind v4.** The brand intelligence pipeline (Phase B) generates tokens. Those tokens need to flow into components (Phase A) via Tailwind `@theme`. If we build Phase B first, we'd be generating tokens that feed into the OLD string-template system, then migrating again. Phase A first means Phase B tokens flow directly into the target architecture.

**However: Phase A and Phase B can run in parallel** on different workstreams. React migration doesn't depend on Dembrandt/MD3. And archetype design (Phase C) should start as soon as React components exist — mock tokens manually while building archetypes. The archetypes ARE the IP.

### Why not visual regression tools (Applitools/Percy) now?

**Premature.** We're rebuilding the rendering layer. Visual regression compares against a baseline — we don't have a stable baseline yet. Set up visual regression AFTER Phase D calibration establishes reference screenshots for each archetype × brand combination. Our current `review-course.js` (Claude vision reading screenshots) works fine for iterative development.

---

## Appendix: Actual Stitch Output Data

### Current design-tokens.json (Cyntch brand)
```json
{
  "colors": {
    "surface-dim": "#131313",
    "surface-bright": "#393939",
    "surface-container-lowest": "#0E0E0E",
    "surface-container-low": "#1B1B1B",
    "surface-container": "#1F1F1F",
    "surface-container-high": "#2A2A2A",
    "surface-container-highest": "#353535",
    "primary": "#B8C3FF",
    "primary-container": "#2E5BFF",
    "on-primary-container": "#EFEFFF",
    "on-surface-variant": "#C4C5D9",
    "outline-variant": "#434656"
  },
  "fonts": { "headline": "Space Grotesk", "body": "Inter" },
  "isDark": true,
  "typography": {
    "h1": "text-[#B8C3FF] font-medium tracking-[0.05em] uppercase text-sm",
    "h2": "text-4xl",
    "h3": "text-2xl",
    "h4": "text-xl uppercase",
    "body": "text-sm",
    "bodyLarge": "text-sm font-light",
    "label": "text-xs font-bold uppercase tracking-widest",
    "blockquote": "text-3xl md:text-5xl font-bold leading-tight italic"
  }
}
```

### Current design-contract.json (Cyntch brand — full)
```json
{
  "hero": {
    "section": "relative h-[921px] flex items-center px-8 md:px-24 overflow-hidden bg-surface-container-lowest",
    "overlayGradient": "bg-gradient-to-r from-surface-dim via-surface-dim/80 to-transparent",
    "imgVisuals": "mix-blend-overlay opacity-40",
    "btn1": {
      "visual": "hover:bg-primary transition-all duration-300 shadow-[0_0_15px_rgba(46,91,255,0.4)]",
      "bg": "bg-primary-container",
      "gradient": "",
      "rounded": "rounded-xl",
      "textColor": "text-white"
    },
    "btn2": {
      "visual": "hover:bg-surface-variant transition-colors",
      "bg": "",
      "rounded": "rounded-xl"
    }
  },
  "text": { "section": "py-24 px-8 md:px-24 bg-surface-dim" },
  "graphic": { "section": "py-24 px-8 md:px-24 bg-surface-dim flex justify-center" },
  "graphic-text": {
    "section": "py-24 px-8 md:px-24 bg-surface-dim border-y border-outline-variant/10",
    "glowClass": "", "imgShadow": "", "imgClass": ""
  },
  "accordion": {
    "detailsClass": "group bg-surface-container-low transition-all",
    "bodyClass": "px-8 pb-8 text-on-surface-variant leading-relaxed border-t border-outline-variant/10 pt-4",
    "summaryClass": "flex items-center justify-between p-8 cursor-pointer hover:bg-surface-container transition-colors",
    "borderClass": ""
  },
  "mcq": {
    "section": "py-24 px-8 md:px-24 bg-surface-dim",
    "card": { "bg": "bg-surface-dim", "shadow": "", "rounded": "rounded-[2rem]", "border": "" },
    "labelClass": "text-xs font-bold text-primary uppercase tracking-widest mb-4 block",
    "choice": { "visual": "hover:bg-surface-container transition-all", "rounded": "rounded-xl" },
    "hasRadioIcon": false, "hasCheckIcon": false
  },
  "narrative": { "section": "py-24 px-8 md:px-24 bg-surface-dim" },
  "bento": {
    "cardBgs": ["bg-surface-container-low", "bg-surface-container-highest"],
    "cardShadows": ["", ""],
    "imgHover": "group-hover:scale-110 transition-transform duration-700"
  },
  "data-table": { "section": "py-24 px-8 md:px-24 bg-surface-container-lowest" },
  "media": { "section": "py-24 px-8 md:px-24 bg-surface-dim" },
  "textinput": {
    "cardClass": "glass-card p-12 rounded-[2rem]",
    "inputClass": "w-full bg-surface-container-lowest border-outline-variant/20 rounded-xl p-4 focus:ring-2 focus:ring-secondary/50 focus:border-secondary"
  },
  "branching": {
    "button": {
      "visual": "hover:bg-surface-variant transition-all border border-transparent hover:border-secondary/30",
      "bg": "bg-surface-variant/30", "rounded": "rounded-2xl"
    },
    "hasArrow": false,
    "arrowClass": "mt-6 inline-flex items-center gap-2 text-primary font-bold group-hover:translate-x-2 transition-transform"
  },
  "timeline": {
    "hasNumberedCircles": false,
    "connectorClass": "w-[2px] h-full bg-outline-variant/20 group-last:hidden",
    "activeDotClass": "absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-primary shadow-[0_0_10px_rgba(37,216,252,0.5)]",
    "inactiveDotClass": "absolute -left-[11px] top-0 w-5 h-5 rounded-full bg-outline-variant",
    "stepTitleClass": "text-xl font-headline text-white mb-2 uppercase"
  },
  "comparison": { "section": "py-24 px-8 md:px-24 bg-surface-container-lowest border-y border-outline-variant/10" },
  "stat-callout": {
    "stats": [
      { "cardBg": "bg-primary-container/5", "cardRounded": "rounded-lg", "numColor": "text-gradient", "numWeight": "font-extrabold" },
      { "cardBg": "", "cardRounded": "rounded-lg", "numColor": "text-primary", "numWeight": "font-bold" }
    ],
    "hasSublabel": false
  },
  "pullquote": {
    "hasDecorativeQuote": true,
    "decorativeSpanHtml": "<span class=\"material-symbols-outlined text-primary-container text-6xl mb-12 opacity-30\">format_quote</span>",
    "blockquoteStyle": "text-3xl md:text-5xl font-headline font-bold leading-tight italic",
    "citeClass": "text-primary font-headline uppercase tracking-widest not-italic"
  },
  "key-term": { "section": "py-24 px-8 md:px-24 bg-surface" },
  "checklist": {
    "card": { "bg": "bg-surface", "shadow": "", "rounded": "rounded-3xl" },
    "inputClass": "form-checkbox bg-surface-container border-outline-variant text-primary-container rounded-none",
    "labelClass": "flex items-center gap-4 cursor-pointer group",
    "labelHover": "hover:bg-surface-variant/50 transition-colors",
    "spanHover": "group-hover:text-white transition-colors"
  },
  "tabs": {
    "section": "py-24 px-8 md:px-24 bg-surface-container-lowest",
    "activeBtn": "px-8 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm uppercase tracking-wider",
    "inactiveBtn": "px-8 py-3 rounded-full glass-card hover:bg-surface-variant transition-all text-on-surface-variant font-bold text-sm uppercase tracking-wider"
  },
  "flashcard": {
    "front": { "bg": "", "shadow": "shadow-md", "rounded": "rounded-3xl", "useBoldPrimary": false },
    "back": { "bg": "bg-secondary-container", "rounded": "rounded-3xl" }
  },
  "labeled-image": { "section": "py-24 px-8 md:px-24 bg-surface" },
  "process-flow": { "section": "py-24 px-8 md:px-24 bg-surface-container-lowest" },
  "image-gallery": { "section": "py-24 px-8 md:px-24 bg-surface-container-lowest" },
  "full-bleed": { "section": "relative h-[716px] flex items-center justify-center text-center px-8 overflow-hidden" },
  "video-transcript": { "section": "max-w-7xl mx-auto px-6 py-12 lg:px-24 lg:py-20 relative z-10" }
}
```

### Current brand-design.md (Cyntch — the prose brief we keep)
```
Visual Theme: Deep, cosmic darkness punctuated by electric energy. Cinematic and dramatic.
Colour Palette: Near-absolute black background. Electric cobalt blue primary. Deep violet secondary.
Typography: Modern geometric sans-serif. Bold headings, lightweight body copy.
Component Styles: Outlined with electric blue glow borders. Dark floating cards with blue borders.
Layout Feel: Spacious and editorial. Large sections of pure darkness as intentional negative space.
Image Treatment: Deep space photography. Cool blue-to-violet colour grading. Dramatic single-source lighting.
```

### Current brand-profile.json
```json
{
  "url": "https://cyntch.framer.website/",
  "scrapedAt": "2026-03-29T00:00:00Z",
  "colorMode": "dark",
  "visualSummary": "Deep cosmic darkness with electric cobalt blue and violet glow accents.",
  "typography": "Modern geometric sans-serif, bold headings, lightweight body copy",
  "componentStyle": "Glowing outlined buttons, dark floating cards with blue borders, ultra-thin dividers",
  "layoutFeel": "Spacious, editorial, vast negative space with concentrated pools of light",
  "imageTreatment": "Deep space photography, cool blue-violet grading, dramatic single-source lighting",
  "accentColors": ["electric cobalt blue", "deep violet", "indigo", "cyan"],
  "method": "screenshot-manual"
}
```
