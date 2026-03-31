# CLAUDE.md — Modernisation Engine

## What This Is
An AI-powered tool that creates modern, branded, premium deep-scroll web learning experiences.

**Active pipeline: AI-First only.** User provides a topic brief → AI researches and generates a complete course → brand-spec.json + archetype recipes generate a deterministic brand design system → we assemble the final course with full interactivity via a hydration script.

> **⚠️ BRAND FIDELITY REBUILD IN PROGRESS (Round 4).** MD3 is being demoted to gap-filler. The new pipeline extracts actual brand colors and maps them directly to tokens (no MD3 distortion). A new `brand-spec.json` artifact drives color application via structured flags. Archetypes now drive SHAPE only (borders, radii, shadows). Color strategy comes from brand-spec.json. **Read `engine/BRAND-FIDELITY.md` FIRST for the full plan, phases, and schema.** Branch: `brand-fidelity1`.

> **⚠️ SCORM Import is ARCHIVED.** The SCORM extraction path (extract.js, design-course.js, layout-engine.md, content-bucket.json) is dormant code preserved for potential future reactivation. It is NOT part of the active pipeline. Do not run it, do not include it in "end-to-end" runs, do not write QA checks for it. When the user says "run it" or "full pipeline", they mean the AI-first path ONLY.

**Preview URL:** https://aigenesis2023.github.io/ModernisationEngine/
(Currently serves the generated course directly — no upload UI during proof-of-concept phase)

**Branch:** Check `git branch` for current branch. `main` exists but is not actively used.

**Authoring Layer:** Live (Phases 1–4 in progress). Users can swap variants, edit text inline, delete sections, reorder blocks (↑↓), add new components (28 types via "+" picker with 7 categories), and export modified JSON — all without re-running the pipeline. Interactive components (MCQ, tabs, flashcard, checklist, etc.) use a per-section `✏️ Edit text` / `▶ Done` toggle that pauses interactivity for editing. Non-interactive components are auto-editable. Phase 4b (type swap) is next. See `engine/AUTHORING-LAYER.md`.

> **ENGINE REBUILD Rounds 1-3 COMPLETE. Round 4 (Brand Fidelity) IN PROGRESS.** Rounds 1-3: Stitch → MD3 + archetypes → Preact SSR + Tailwind v4 → Container queries. Round 4: MD3 demoted, brand-spec.json added, archetypes drive shape only. See `engine/BRAND-FIDELITY.md` for Round 4 plan. See `engine/STITCH-REPLACEMENT-BRIEF.md` for Rounds 1-3 history.

---

## Architecture (V5 — AI-First Pipeline, CURRENT)

```
═══ AI-FIRST PIPELINE ═════════════════════════════════════════════════
Topic Brief + URLs ──→ research-content.js  ──→ Knowledge Base (JSON)
                       (Tavily API gathers raw web content → Claude subagent synthesises)
                       (Expert SME persona — gathers raw knowledge + teachable moments)
                                          │
                    ┌─────────────────────┘
                    ▼
         generate-layout.js (AI course generation)
         ├─ Reads generation-engine.md (system prompt — emotional arc, archetypes, anti-patterns)
         ├─ Reads knowledge-base.json + brand-design.md (voice calibration) + brand-profile.json
         ├─ Reads component-library.json (learningMoment + creativeUses per component)
         ├─ AI classifies topic → selects course archetype (journey/case-file/builder/debate/explorer)
         ├─ AI designs course with structural variety — content shaped for component
         ├─ AI selects layout variants per component + section widths for visual rhythm
         ├─ AI creates ALL assessments (KB has raw facts, not pre-built quizzes)
         └─→ course-layout.json

═══ BRAND + BUILD PIPELINE ════════════════════════════════════════════
Brand URL  ──→ scrape-brand.js   ──→ Brand Profile + Brand Design + extracted-css.json
               (Playwright screenshot + getComputedStyle() extraction)
                    │
                    ▼
         generate-design-tokens.js (BEING REFACTORED — see engine/BRAND-FIDELITY.md)
         ├─ Reads extracted-css.json + brand-spec.json → maps extracted colors to token roles
         ├─ MD3 as gap-filler only (error, outline-variant — NOT primary palette)
         ├─ Checks fonts against Google Fonts (subagent match if unavailable)
         ├─ Vision AI produces brand-spec.json (15 structured questions — includes archetype + accent hex validation)
         └─→ design-tokens.json (colors, fonts, archetype, typography)
                    │
                    ▼
         generate-images.js (SiliconFlow AI → Pexels stock → SVG placeholder)
         └─→ images/*.jpg (AI-generated or stock photos)
                    │
                    ▼
         npx vite build (compiles Preact SSR components → dist/render.cjs)
                    │
                    ▼
         build-course.js (Preact SSR + Tailwind v4 build — deterministic)
         ├─ Loads dist/render.cjs → renderCourseBody() for SSR
         ├─ 28 Preact components in src/components/ (replaces string-template fill functions)
         ├─ Reads visual-archetypes.json for archetype recipe (AR)
         ├─ Container queries (@3xl: breakpoints) — components adapt to container width
         ├─ Resolves theme-template.css → Tailwind v4 CLI → compiled CSS (no CDN)
         ├─ Inlines hydrate.js for interactivity + flow control
         └─→ course.html (single self-contained file, ~380KB)
```

### Core Principles

**1. brand-spec.json + archetype recipes drive the visual system. We control layout and content.**
Different brand URL → different extracted colors + color strategy + archetype → different visual character, identical layout. Archetypes (8 types in `visual-archetypes.json`) control SHAPE (borders, radii, shadows, spacing). Color APPLICATION is driven by `brand-spec.json` flags (extracted from the brand URL). See `engine/BRAND-FIDELITY.md`.

**2. Content quality is non-negotiable.**
The AI generation agent creates rich, accurate educational content. Every assessment tests application, not recall. The generation engine uses emotional arc, structural archetypes, and density rhythm to produce courses worth scrolling.

**3. The design system is a reusable asset.**
Extracted brand tokens + archetype recipes are deterministic and reproducible. The authoring layer can re-render with different content or swapped components without re-running upstream steps.

**4. Design is deterministic, not generative.**
Brand colours come from CSS extraction → direct token mapping (brand-spec.json). Visual shape comes from archetype recipes (JSON). Vision AI produces the structured spec during scraping, then everything downstream is pure JSON → HTML. No black-box AI in the build layer. Testable, auditable, consistent.

**5. Interactivity is hydration-driven.**
`hydrate.js` manages all runtime behavior: MCQ quizzes, tab panels, flashcard flips, carousels, checklists with progress, section progress tracking, scroll animations (GSAP), and stat counter animations. All wired via `data-*` attributes. See `engine/BUILD-SYSTEM.md`.

**6. Typography scale lives in ONE place: `buildTailwindCSS()` in `build-course.js`.**
Font sizes, line-heights, letter-spacing, and default weights are defined in the `T = { ... }` object (~line 472). This is the single source of truth — all values flow through `theme-template.css` placeholders into compiled CSS. **To adjust typography (e.g., tighter line-height, smaller H2), change the defaults here.** Do NOT edit `theme-template.css` placeholders directly, add inline styles to components, or put typography in `visual-archetypes.json`. Brand input only controls font-weight preference (bold/light/medium) via `mergeTypo()` — sizes and spacing are engine-controlled for cross-brand consistency.

---

## Architecture Deep-Dive Documents

| Document | Covers | Status |
|---|---|---|
| **`engine/BRAND-FIDELITY.md`** | Brand fidelity rebuild: Extract → Spec → Map → Build architecture. MD3 demoted, brand-spec.json schema, adaptive recipes, implementation phases. | **Active** — Round 4 |
| **`engine/STITCH-REPLACEMENT-BRIEF.md`** | Engine rebuild: audit findings, new architecture (Rounds 1-3). Preact SSR, Tailwind v4, container queries. | **Complete** — Rounds 1-3 reference |
| **`engine/STITCH-INTEGRATION.md`** | Google Stitch SDK, DESIGN.md format, supported fonts, API constraints. | **ARCHIVED** — Stitch replaced by MD3+archetype pipeline |
| **`engine/BUILD-SYSTEM.md`** | Final HTML assembly. Design/layout separation, 10 layout rules, Preact component conventions, generateHeadV4(), Tailwind v4, hydrate.js interactivity. | **Active** |
| **`engine/CONTENT-STRUCTURING.md`** | How data gets transformed by the AI layout engine into a structured course. Component mapping, layout engine prompt, validation. | **Active** (AI-first sections) |
| **`engine/AUTHORING-LAYER.md`** | Authoring layer architecture, component taxonomy, phase plan, progress tracker, skipped-for-later items. | **Active** — living document |
| **`engine/LOGIC-EXTRACTION.md`** | How we extract triggers, variables, conditions, and interactive logic from Storyline SCORM exports. | **ARCHIVED** — SCORM path only |

---

## File Structure

```
CLAUDE.md                              ← This file (index + rules)
index.html                             ← GitHub Pages entry (generated by build-course.js)
package.json / package-lock.json       ← Root dependencies (preact, tailwindcss, vite, etc.)
tsconfig.json                          ← TypeScript config for Preact SSR
vite.config.ts                         ← Vite build config (Preact SSR → dist/render.cjs)
brand/
  url.txt                              ← Brand URL for pipeline (one URL)

src/                                       ← PREACT SSR COMPONENTS (Round 2)
  types.ts                             ← TypeScript types for course data + render context
  context.ts                           ← Module-level render context (replaces globals AR, IS_DARK)
  utils.ts                             ← Shared utilities (esc, stripTags, width maps, category/variant maps)
  render.tsx                           ← SSR entry point: renderCourseBody()
  theme-template.css                   ← Tailwind v4 theme template with @theme directives
  components/
    index.ts                           ← Component registry (28 entries, data-driven)
    Hero.tsx                           ← 3 variants (centered-overlay, split-screen, minimal-text)
    Text.tsx                           ← 3 variants (standard, two-column, highlight-box)
    Accordion.tsx                      ← 2 variants (standard, accent-border)
    MCQ.tsx                            ← 2 variants (stacked, grid)
    GraphicText.tsx                    ← 3 variants (split, overlap, full-overlay)
    Tabs.tsx                           ← 2 variants (horizontal, vertical)
    Bento.tsx                          ← 3 variants (grid-4, wide-2, featured)
    remaining.tsx                      ← 21 more components (all variants)

dist/                                      ← BUILD OUTPUT (gitignored)
  render.cjs                           ← Compiled Preact SSR bundle

engine/                                    ← ALL ACTIVE CODE
  CHANGE-AUDIT.md                      ← Post-change audit checklist (stale counts, doc drift, memory)
  LOGIC-EXTRACTION.md                  ← Logic extraction architecture
  CONTENT-STRUCTURING.md               ← Content structuring architecture
  STITCH-INTEGRATION.md                ← ⚠️ ARCHIVED — Stitch integration (replaced by MD3+archetypes)
  BUILD-SYSTEM.md                      ← Build system architecture
  schemas/
    knowledge-base.schema.json         ← Flat research output: keyPoints[] + teachableMoments[] (no component awareness)
    course-layout.schema.json          ← Layout engine output format
    component-library.json             ← 28 components: type, props, learningMoment, creativeUses, examples
    visual-archetypes.json             ← 8 visual archetype recipes (tech-modern, minimalist, editorial, etc.)
    content-bucket.schema.json         ← ⚠️ ARCHIVED — SCORM extraction output format
  prompts/
    research-agent.md                  ← Expert SME persona: topic → raw knowledge + teachable moments
    generation-engine.md               ← Senior ID persona: emotional arc, archetypes, anti-patterns, voice calibration
    generation-agent.md                ← Subagent task: reads brand-design.md + KB → course-layout.json
    representative-course.md           ← All 28 component types (used for reference test builds)
    layout-engine.md                   ← ⚠️ ARCHIVED — SCORM layout engine prompt
  scripts/
    research-content.js                ← AI-first: topic → knowledge-base.json (subagent)
    generate-layout.js                 ← AI-first: knowledge-base → course-layout.json (subagent)
    scrape-brand.js                    ← Brand URL → screenshot + CSS extraction + natural language description
    generate-design-tokens.js          ← extracted-css + brand-spec.json → mapped tokens (MD3 gap-filler only)
    generate-images.js                 ← Image generation: SiliconFlow AI → Pexels stock → SVG
    build-course.js                    ← Archetype recipe build: design-tokens + visual-archetypes + content → course.html
    test-multi-brand.js                ← Multi-brand calibration harness (Session 4)
    qa-course.js                       ← Structural QA: HTML integrity, component coverage, content coverage
    qa-interactive.js                  ← Interactive QA: Playwright tests all clickable components + layout
    review-course.js                   ← Vision-based quality audit (subjective review)
    hydrate.js                         ← Vanilla JS interactivity (injected into course.html)
    lib/
      validate-layout.js               ← Shared validation for course-layout.json
    extract.js                         ← ⚠️ ARCHIVED — SCORM: folder → content-bucket.json
    design-course.js                   ← ⚠️ ARCHIVED — SCORM: content-bucket → course-layout.json
  archived/                            ← Archived scripts (Stitch-era, dormant)
    generate-course-html.js            ← ⚠️ ARCHIVED — Stitch component kit generation
    extract-contract.js                ← ⚠️ ARCHIVED — Cheerio design contract extraction
  input/                               ← AI-first inputs
    topic-brief.txt                    ← Plain text topic description
    urls.txt                           ← One URL per line (optional)
    test-runs.md                       ← Test run config: brands, topics, matrix settings, reference test
    authoring-audit.md                 ← Authoring audit protocol: 4 phases, per-phase-per-chat, checklists
    reference-course-layout.json       ← Pre-built course (23 components) for reference test mode
    docs/                              ← Drop PDFs/PPTXs here (future)
  output/
    knowledge-base.json                ← AI-first research output
    brand-profile.json                 ← Scraped from brand URL (raw data)
    brand-screenshot.png               ← Playwright screenshot of brand landing page
    brand-design.md                    ← Natural language brand description
    extracted-css.json                 ← getComputedStyle() tokens from brand website
    course-layout.json                 ← Structured course (AI-generated)
    brand-spec.json                    ← Structured design spec (Vision AI extraction — colors, strategy, shape)
    design-tokens.json                 ← Mapped brand tokens + fonts + archetype (from generate-design-tokens.js)
    calibration-results.json           ← Multi-brand test results (from test-multi-brand.js)
    images/                            ← Generated images
    course.html                        ← Final single-file output
    audit-findings.json                ← Authoring audit checkpoint (persists between phases)
    audit-report.md                    ← Authoring audit final report (written by Phase 4)

screenshots/                           ← Dev screenshots (gitignored, overwritten each run)
EV/                                    ← Test SCORM (64 slides, gitignored in Codespace)
```

---

## The Pipeline

### Step 1 — Research (`engine/scripts/research-content.js`)
**Input:** Topic brief + optional URLs | **Output:** `knowledge-base.json`

**Tavily-first pipeline:** The script runs 6 targeted Tavily searches in parallel (fundamentals, stats, case studies, misconceptions, trends, applications) plus Tavily extract on any user-provided URLs. All raw content is bundled into the prompt. A Claude subagent then **synthesises only** — no web searching — which dramatically reduces token usage. Run: `node engine/scripts/research-content.js --topic "Your Topic"`

Gathers raw knowledge as uniform `keyPoints[]` + `teachableMoments[]` (5 types: surprising-insight, case-study, analogy, contrast, decision-framework). The research agent has **zero knowledge of components** — it gathers raw material for the generation agent.

**⚠️ Subagent workflow:** The script runs Tavily, assembles the prompt with pre-gathered content, then you spawn a subagent (Agent tool) to synthesise and structure it. The subagent reads the bundled research and writes `engine/output/knowledge-base.json` — no web search needed. Validate after: `node engine/scripts/research-content.js --load engine/output/knowledge-base.json`.

### Step 2 — Generate Course (`engine/scripts/generate-layout.js`)
**Input:** `knowledge-base.json` + `brand-design.md` + `brand-profile.json` + `generation-engine.md` | **Output:** `course-layout.json`

Claude Code subagent with senior instructional designer persona generates the complete course. Reads the brand brief for voice calibration (playful/corporate/technical/warm). Designs with emotional arc (hook→foundation→challenge→insight→application), structural archetypes (6 patterns to remix), and density rhythm (breather/standard/deep-dive). Creates ALL assessments from raw facts (no pre-built quizzes in KB). Uses `component-library.json` as creative palette (reads `learningMoment` + `creativeUses` per component).

**⚠️ Subagent workflow:** Same pattern. Spawn a subagent that reads `generation-agent.md` task prompt (which references all required files). Writes `engine/output/course-layout.json`. Validate after: `node engine/scripts/generate-layout.js --load engine/output/course-layout.json`.

### Step 3 — Design Tokens (`engine/scripts/generate-design-tokens.js`)
**Input:** `extracted-css.json` + `brand-spec.json` + `brand-screenshot.png` | **Output:** `design-tokens.json`

**⚠️ BEING REFACTORED — see `engine/BRAND-FIDELITY.md` for the new architecture.**

**Current (pre-refactor):** Reads extracted CSS → picks seed color → MD3 generates palette → subagent classifies archetype. Run: `node engine/scripts/generate-design-tokens.js`, then re-run with `--archetype-ready` (and/or `--fonts-ready`) after subagents complete.

**Target (post-refactor):** Reads extracted CSS + brand-spec.json → maps brand's actual colors directly to token roles → MD3 only for gap-filling (error, outline-variant) → archetype from brand-spec.json (shape classification, not color generation).

**⚠️ Font subagent workflow:** If brand fonts aren't on Google Fonts, the script writes `font-match-prompt.txt` and exits. Spawn a subagent to read the prompt + screenshot, write `font-match.json`, then re-run with `--fonts-ready`.

### Step 4 — Image Generation (`engine/scripts/generate-images.js`)
**Input:** `course-layout.json` + `brand-design.md` | **Output:** `images/*.jpg`
**Runs AFTER Step 3.** Priority chain: SiliconFlow AI (Tongyi Z-Image-Turbo) → Pexels stock → SVG placeholders. Guarantees 100% asset coverage.

### Step 5 — Build (`engine/scripts/build-course.js`)
**Input:** `design-tokens.json` + `visual-archetypes.json` + `course-layout.json` + `images/` | **Output:** `course.html` + root `index.html`

See `engine/BUILD-SYSTEM.md`.

### Step 6 — QA + Review (three gates, in order)
**6a — Structural QA (`engine/scripts/qa-course.js`):** Validates built HTML without a browser — section coverage, component integrity, quiz wiring, image integrity, heading hierarchy, duplicate IDs, content coverage vs knowledge base, design token/contract integrity, accessibility basics. **If it fails, fix before proceeding.**

**6b — Interactive + Design Quality QA (`engine/scripts/qa-interactive.js`):** Opens course in Playwright browser. Tests 27 checks in two tiers:
- **Functional (Tests 1-16):** Clicks quiz choices (submit → feedback → retry), switches tabs, flips flashcards, navigates carousels, expands accordions, checks checklists. Validates overflow (desktop + mobile), font sizes, tap targets, heading hierarchy, invisible content, section spacing, collapsed sections, nav z-index.
- **Design quality (Tests 17-31, 4 removed):** WCAG AA contrast on ALL text, card height balance, image aspect ratios, line measure (chars/line), font weight hierarchy, broken/collapsed images, icon size consistency, hover/transition feedback, focus indicators, assessment distribution, section density variation. *(Removed in Round 3: padding consistency, border-radius consistency, mobile padding collapse, button style consistency — all now locked by archetype recipes.)*
- **Variant coverage (Test 32):** Checks which layout variants were used, verifies HTML renders the correct variant structure, reports untested variants.
**If it fails, fix before proceeding.**

**6c — Visual Review (`engine/scripts/review-course.js`):** Playwright captures screenshots of every section (desktop 1440x900) + mobile (390x844). Claude Code **MUST read each screenshot file** with the Read tool and review using the structured criteria the script outputs (graphic design, UX, UI, instructional design). The script captures screenshots but does NOT review them — you must do the visual review yourself. Fixes go in the engine. **Only run after 6a and 6b pass.**

---

## ⛔ Pipeline Runs — MANDATORY RULES

### When to use which run level

Claude Code automatically selects the correct run level based on what changed. The user does NOT need to specify.

**FULL RUN** — clear all outputs, execute all steps. Required when:
- User says "run it", "full pipeline", or "full run"
- Topic brief or URLs changed
- Brand URL changed
- Any prompt file changed (engine/prompts/*.md)
- Any schema file changed (engine/schemas/*)
- research-content.js, generate-layout.js, scrape-brand.js changed
- generate-design-tokens.js or visual-archetypes.json changed
- Testing a new topic/brand combination
- Uncertain whether upstream outputs are still valid

**DESIGN RUN** (Steps 3–6) — reuse KB + course layout, regenerate design + images + build. Required when:
- generate-design-tokens.js or visual-archetypes.json changed (but not content scripts)
- Brand URL changed but topic hasn't
- Archetype recipes changed

**BUILD RUN** (Steps 5–6 only) — reuse everything upstream, just rebuild HTML + QA. Allowed ONLY when:
- ONLY build-course.js or hydrate.js changed
- The fix is clearly limited to HTML output / styling / interactivity
- All upstream outputs (KB, layout, contract, tokens, images) are unchanged

**MATRIX TEST** — autonomous multi-combination testing. Required when:
- User says "matrix test" (with or without specifying brands/topics)
- **Read `engine/input/test-runs.md` FIRST** — it contains the complete protocol: brand/topic pools, auto-selection rules, 6-phase workflow (generate → QA → classify → approve → fix → verify), bug classification, variant coverage tracking, and summary template
- If the user provides no brands or topics, auto-select from the pools in test-runs.md
- If the user specifies brands or topics, use those as overrides
- **Approval workflow:** Objective bugs (6a/6b failures) are auto-fixed. Subjective bugs (6c vision findings) are listed for user approval before fixing. See test-runs.md Phase 4.

**AUTHORING AUDIT** — systematic quality audit of course output + authoring layer. Required when:
- User says "authoring audit phase 1" (or 2, 3, 4)
- **Read `engine/input/authoring-audit.md` FIRST** — it contains the full protocol, checklists, and component criteria
- **Each phase runs in a separate fresh chat.** Phase 1 → save → stop. Phase 2 → save → stop. Etc.
- Findings persist in `engine/output/audit-findings.json` between phases. Report written to `engine/output/audit-report.md`.
- Phase 4 includes root cause diagnosis before any fixes — see the Diagnose step in the protocol.

**When in doubt, do a FULL RUN.** Announce which run level you're using and why.

### Post-Change Audit (MANDATORY)
After completing any significant code change (new components, new variants, fill function changes, schema changes), **run the change audit checklist** in `engine/CHANGE-AUDIT.md`. This catches stale counts, missing variant labels, doc drift, and memory staleness that QA gates do not test. Do not skip this. Do not self-assess — execute every check in the file.

### Full Run: Clear stale outputs
```bash
rm -rf engine/output/images/
rm -f engine/output/knowledge-base.json engine/output/brand-profile.json engine/output/brand-design.md
rm -f engine/output/extracted-css.json engine/output/course-layout.json engine/output/design-tokens.json
rm -f engine/output/font-match-prompt.txt engine/output/font-match.json engine/output/course.html
rm -f engine/output/archetype-prompt.txt engine/output/archetype-match.json
```

### Full Run: Execute in order
```bash
node engine/scripts/research-content.js --topic "Your Topic"  # Step 1 (Tavily gathers → subagent synthesises)
node engine/scripts/scrape-brand.js                            # Brand analysis + CSS extraction
# ⚠️ If no ANTHROPIC_API_KEY: script writes brand-describe-prompt.txt and exits.
#    Spawn a subagent: read engine/output/brand-screenshot.png + follow the prompt → write brand-describe.json
#    Then re-run: node engine/scripts/scrape-brand.js --description-ready
node engine/scripts/generate-layout.js                         # Step 2 (subagent generates course)
node engine/scripts/generate-design-tokens.js                  # Step 3 (token mapping — see BRAND-FIDELITY.md)
node engine/scripts/generate-images.js                         # Step 4 (image generation)
npx vite build                                                 # Step 5a (compile Preact SSR → dist/render.cjs)
node engine/scripts/build-course.js                            # Step 5b (build final HTML via Preact SSR)
node engine/scripts/qa-course.js                               # Step 6a (structural QA — fix if fails)
node engine/scripts/qa-interactive.js                          # Step 6b (interactive QA — fix if fails)
node engine/scripts/review-course.js                           # Step 6c (visual review — only after 6a+6b pass)
```

**If ANY step fails, STOP and tell the user. Do not silently continue with stale data.**

### API Keys (stored in `.env`, gitignored)
- `TAVILY_API_KEY`: Tavily web search + extract — used by research-content.js (Step 1) to gather raw content before Claude synthesises
- `SILICONFLOW_API_KEY`: SiliconFlow AI image generation via Tongyi Z-Image-Turbo (default)
- `PEXELS_API_KEY`: pexels.com/api → free stock photo fallback, 200 req/hr
- `ANTHROPIC_API_KEY`: (Optional) Enables API mode for brand analysis + Vision AI archetype classification

---

## Component Library (28 types)

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
| `divider` | Visual break between topics (line, spacing, or icon) |
| `callout` | Styled info/warning/tip/success box |
| `path-selector` | Course path selection (branching entry point) |

### Course Archetypes

The generation engine classifies each topic and selects a **course archetype** that shapes the entire narrative arc, density pattern, and assessment placement. Set in `metadata.archetype` in course-layout.json.

| Archetype | Structure | Best For |
|---|---|---|
| `the-journey` | Hook → Foundation → Challenge → Insight → Application | General awareness, introductory topics |
| `the-case-file` | Incident → Investigation → Evidence → Framework → Prevention | Security, compliance, risk management |
| `the-builder` | Goal → Foundations → Build → Test → Refine → Deploy | Technical skills, procedural how-to |
| `the-debate` | Assumption → Counter-evidence → Perspectives → Synthesis → Position | Leadership, strategy, ethics |
| `the-explorer` | Landscape → Deep Dives → Connections → Patterns → Implications | Market analysis, emerging tech, surveys |

### Layout Variants

23 components have **layout variants** — different visual arrangements that use the same archetype recipe. The generation engine picks the variant based on content. Set `"variant": "name"` in course-layout.json. When absent, the first variant is the default.

**All variants are pre-rendered into every built course** as `<template>` tags. The **authoring panel** (amber "✎ Edit" button, top-right of every course) lets you switch variants live without rebuilding. This IS the authoring layer — it evolves phase by phase (variant swapping → category browsing → text editing → section management → AI assist).

| Component | Variants |
|---|---|
| `hero` | `centered-overlay` (default), `split-screen`, `minimal-text` |
| `text` | `standard` (default), `two-column`, `highlight-box` |
| `graphic` | `standard` (default), `captioned-card` |
| `graphic-text` | `split` (default), `overlap`, `full-overlay` |
| `pullquote` | `accent-bar` (default), `centered`, `minimal` |
| `stat-callout` | `centered` (default), `card-row` |
| `callout` | `info` (default), `warning`, `tip`, `success` |
| `accordion` | `standard` (default), `accent-border` |
| `tabs` | `horizontal` (default), `vertical` |
| `narrative` | `image-focused` (default), `text-focused` |
| `flashcard` | `grid` (default), `single-large` |
| `labeled-image` | `numbered-dots` (default), `side-panel` |
| `mcq` | `stacked` (default), `grid` |
| `branching` | `cards` (default), `list` |
| `checklist` | `standard` (default), `card-style`, `numbered` |
| `bento` | `grid-4` (default), `wide-2`, `featured` |
| `comparison` | `columns` (default), `stacked-rows` |
| `data-table` | `standard` (default), `striped-card` |
| `timeline` | `vertical` (default), `centered-alternating` |
| `process-flow` | `vertical` (default), `horizontal` |
| `key-term` | `list` (default), `card-grid` |
| `divider` | `line` (default), `spacing`, `icon` |
| `full-bleed` | `center` (default), `left`, `right` |

### Section Width

Sections can set `"sectionWidth"` to vary page-level content width:
- `standard` — `max-w-6xl` (default)
- `narrow` — `max-w-3xl` (focused reading: text, pullquote)
- `wide` — `max-w-[90rem]` (visual/multi-column components boost to `max-w-7xl` via `COMPONENT_WIDTH_BOOST`)
- `full` — edge-to-edge background with `max-w-6xl` contained inner content

---

## Test Data
- **Brand URL:** stored in `brand/url.txt` — currently `https://coursesite.framer.website/`
- **Previously tested brands:** sprig (dark, cyan), fluence (light, amethyst), ailyx (light, blue), fitflow (light, pink-blue gradient), landio (dark, sleek SaaS), crimzon (dark, crimson), aigents (light, purple), najaf (dark, green), coursesite (light, lavender-purple gradient)
- **SCORM (archived):** `EV/` — 64-slide EV Awareness & Safety course (gitignored, for future SCORM path reactivation only)

---

## Deployment
`build-course.js` writes directly to root `index.html`. Preview via local port (Codespace). GitHub Pages is configured on `main` but not actively used during development. Branch snapshots (e.g., `authoring-layer-v3` → `v4`) serve as backups before big changes.

---

## ⛔ ABSOLUTE RULES

### AI-FIRST ONLY
The active pipeline is AI-first. SCORM import code (extract.js, design-course.js, layout-engine.md, content-bucket) is **archived** — do not run it, do not include it in pipeline runs, do not write checks for it. When the user says "run it" or "full pipeline", they mean the AI-first steps above.

### UNIVERSAL ENGINE
The purpose of every conversation is to improve the **engine** — the scripts, prompts, schemas, and templates that power the pipeline. The brand URL is a diagnostic tool only. Every change must work for ANY topic and ANY brand URL.

**ALL FIXES GO IN THE ENGINE — NEVER IN TEST DATA OR OUTPUT.**

### BRAND-SPEC.JSON + ARCHETYPE RECIPES DRIVE THE DESIGN
The visual system comes from extracted brand colors (brand-spec.json) + archetype recipes (visual-archetypes.json). Archetypes control SHAPE (borders, radii, shadows). brand-spec.json controls COLOR APPLICATION (which colors, where they're used, pairing logic, constraints). MD3 is a gap-filler only — it does NOT generate the primary palette. See `engine/BRAND-FIDELITY.md` for the full architecture.

### CONTENT QUALITY
The AI generation agent creates rich, accurate educational content. Assessments test application, not recall. The generation engine uses emotional arc, structural archetypes, and density rhythm. No invented facts.

### AUTHORING LAYER COMPATIBILITY
The design system and course structure are reusable assets. The future authoring layer must be able to: re-render with edited content, swap component types, and customise without re-running the pipeline.
