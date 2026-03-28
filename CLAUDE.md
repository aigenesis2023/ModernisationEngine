# CLAUDE.md — Modernisation Engine

## What This Is
An AI-powered tool that creates modern, branded, premium deep-scroll web learning experiences.

**Active pipeline: AI-First only.** User provides a topic brief → AI researches and generates a complete course → Google Stitch designs a branded component kit → we assemble the final course with full interactivity via a hydration script.

> **⚠️ SCORM Import is ARCHIVED.** The SCORM extraction path (extract.js, design-course.js, layout-engine.md, content-bucket.json) is dormant code preserved for potential future reactivation. It is NOT part of the active pipeline. Do not run it, do not include it in "end-to-end" runs, do not write QA checks for it. When the user says "run it" or "full pipeline", they mean the AI-first path ONLY.

**Preview URL:** https://aigenesis2023.github.io/ModernisationEngine/
(Currently serves the generated course directly — no upload UI during proof-of-concept phase)

**Branch:** Check `git branch` for current branch. `main` exists but is not actively used.

**Authoring Layer:** Live (Phases 1–3.5 complete). Users can swap variants, edit text inline, delete sections, and export modified JSON — all without re-running the pipeline. Phase 4 (Section Management) is next. See `v5/AUTHORING-LAYER.md`.

---

## Architecture (V5 — AI-First Pipeline)

```
═══ AI-FIRST PIPELINE ═════════════════════════════════════════════════
Topic Brief + URLs ──→ research-content.js  ──→ Knowledge Base (JSON)
                       (Claude Code subagent with web search)
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

═══ BUILD PIPELINE ════════════════════════════════════════════════════
Brand URL  ──→ scrape-brand.js   ──→ Brand Profile (JSON) + Brand Design (DESIGN.md)
                    │
                    ▼
         generate-course-html.js (Google Stitch — GEMINI_3_1_PRO)
         ├─ Sends brand-design.md (DESIGN.md format brief)
         ├─ Sends representative-course.md (all 28 component types)
         ├─ Stitch designs complete branded page experience
         ├─ Extracts: page shell, component patterns, design tokens
         └─→ component-patterns/ + design-tokens.json + stitch-course-raw.html
                    │
                    ▼
         generate-images.js (SiliconFlow AI → Pexels stock → SVG placeholder)
         └─→ images/*.jpg (AI-generated or stock photos)
                    │
                    ▼
         extract-contract.js (cheerio — design contract extraction)
         └─→ design-contract.json (stable interface for build)
                    │
                    ▼
         build-course.js (content assembly — design/layout separation)
         ├─ Generates own <head> from design-tokens.json (NOT Stitch raw CSS)
         ├─ Reads visual classes from design-contract.json (NEVER raw HTML)
         ├─ Selects layout variant per component (variant field from course-layout.json)
         ├─ Applies sectionWidth per section (narrow/standard/wide/full)
         ├─ Tags sections with data-section-track for progress tracking
         ├─ Inlines hydrate.js for interactivity + flow control
         └─→ course.html (single self-contained file)
```

### Core Principles

**1. Stitch designs the visual system. We control layout and content.**
Different brand URL → different Stitch kit → different visual character, identical layout. See `v5/STITCH-INTEGRATION.md` for full details.

**2. Content quality is non-negotiable.**
The AI generation agent creates rich, accurate educational content. Every assessment tests application, not recall. The generation engine uses emotional arc, structural archetypes, and density rhythm to produce courses worth scrolling.

**3. The design system is a reusable asset.**
Stitch's output (component patterns + design tokens) is extracted and stored. The future authoring layer can re-render with different content or swapped components without re-calling Stitch.

**4. Speak Stitch's language.**
We generate a DESIGN.md brand brief using Stitch's native vocabulary. See `v5/STITCH-INTEGRATION.md` for DESIGN.md format and supported fonts.

**5. Interactivity is hydration-driven.**
`hydrate.js` manages all runtime behavior: MCQ quizzes, tab panels, flashcard flips, carousels, checklists with progress, section progress tracking, scroll animations (GSAP), and stat counter animations. All wired via `data-*` attributes. See `v5/BUILD-SYSTEM.md`.

---

## Architecture Deep-Dive Documents

| Document | Covers | Status |
|---|---|---|
| **`v5/STITCH-INTEGRATION.md`** | Google Stitch SDK, DESIGN.md format, supported fonts, API constraints, design contract architecture, pattern extraction, colorMode detection. | **Active** |
| **`v5/BUILD-SYSTEM.md`** | Final HTML assembly. Design/layout separation, 10 layout rules, fill function conventions, generateHead(), hydrate.js interactivity, image embedding. | **Active** |
| **`v5/CONTENT-STRUCTURING.md`** | How data gets transformed by the AI layout engine into a structured course. Component mapping, layout engine prompt, validation. | **Active** (AI-first sections) |
| **`v5/AUTHORING-LAYER.md`** | Authoring layer architecture, component taxonomy, phase plan, progress tracker, skipped-for-later items. | **Active** — living document |
| **`v5/LOGIC-EXTRACTION.md`** | How we extract triggers, variables, conditions, and interactive logic from Storyline SCORM exports. | **ARCHIVED** — SCORM path only |

---

## File Structure

```
CLAUDE.md                              ← This file (index + rules)
index.html                             ← GitHub Pages entry (generated by build-course.js)
package.json / package-lock.json       ← Root dependencies (@google/stitch-sdk, dotenv)

v5/                                    ← ALL ACTIVE CODE
  LOGIC-EXTRACTION.md                  ← Logic extraction architecture
  CONTENT-STRUCTURING.md               ← Content structuring architecture
  STITCH-INTEGRATION.md                ← Stitch integration architecture
  BUILD-SYSTEM.md                      ← Build system architecture
  schemas/
    knowledge-base.schema.json         ← Flat research output: keyPoints[] + teachableMoments[] (no component awareness)
    course-layout.schema.json          ← Layout engine output format
    component-library.json             ← 28 components: type, props, learningMoment, creativeUses, examples
    content-bucket.schema.json         ← ⚠️ ARCHIVED — SCORM extraction output format
  prompts/
    research-agent.md                  ← Expert SME persona: topic → raw knowledge + teachable moments
    generation-engine.md               ← Senior ID persona: emotional arc, archetypes, anti-patterns, voice calibration
    generation-agent.md                ← Subagent task: reads brand-design.md + KB → course-layout.json
    representative-course.md           ← All 28 component types for Stitch to design
    layout-engine.md                   ← ⚠️ ARCHIVED — SCORM layout engine prompt
  scripts/
    research-content.js                ← AI-first: topic → knowledge-base.json (subagent)
    generate-layout.js                 ← AI-first: knowledge-base → course-layout.json (subagent)
    scrape-brand.js                    ← Brand URL → screenshot + natural language description
    generate-course-html.js            ← DESIGN.md + representative course → Stitch → component kit
    extract-contract.js                ← Cheerio: Stitch patterns → design-contract.json
    generate-images.js                 ← Image generation: SiliconFlow AI → Pexels stock → SVG
    build-course.js                    ← Contract fill: design-contract.json + real content → course.html
    qa-course.js                       ← Structural QA: HTML integrity, component coverage, content coverage
    qa-interactive.js                  ← Interactive QA: Playwright tests all clickable components + layout
    review-course.js                   ← Vision-based quality audit (subjective review)
    hydrate.js                         ← Vanilla JS interactivity (injected into course.html)
    lib/
      validate-layout.js               ← Shared validation for course-layout.json
    extract.js                         ← ⚠️ ARCHIVED — SCORM: folder → content-bucket.json
    design-course.js                   ← ⚠️ ARCHIVED — SCORM: content-bucket → course-layout.json
  input/                               ← AI-first inputs
    topic-brief.txt                    ← Plain text topic description
    urls.txt                           ← One URL per line (optional)
    test-runs.md                       ← Test run config: brands, topics, matrix settings, reference test
    reference-course-layout.json       ← Pre-built course (23 components) for reference test mode
    docs/                              ← Drop PDFs/PPTXs here (future)
  output/
    knowledge-base.json                ← AI-first research output
    brand-profile.json                 ← Scraped from brand URL (raw data)
    brand-screenshot.png               ← Playwright screenshot of brand landing page
    brand-design.md                    ← Natural language brand description for Stitch
    course-layout.json                 ← Structured course (AI-generated)
    stitch-course-raw.html             ← Stitch's complete designed page
    stitch-course-meta.json            ← Stitch API response metadata
    stitch-course-screenshot.png       ← Stitch's design preview
    design-tokens.json                 ← Extracted design system tokens
    design-contract.json               ← Visual contract: cheerio-extracted from patterns
    component-patterns/                ← Extracted HTML pattern per component type (28)
    images/                            ← Generated images
    course.html                        ← Final single-file output

screenshots/                           ← Dev screenshots (gitignored, overwritten each run)
EV/                                    ← Test SCORM (64 slides, gitignored in Codespace)
```

---

## The Pipeline

### Step 1 — Research (`v5/scripts/research-content.js`)
**Input:** Topic brief + optional URLs | **Output:** `knowledge-base.json`

Claude Code subagent with expert SME persona researches the topic using web search. Gathers raw knowledge as uniform `keyPoints[]` + `teachableMoments[]` (5 types: surprising-insight, case-study, analogy, contrast, decision-framework). The research agent has **zero knowledge of components** — it gathers raw material for the generation agent. Run: `node v5/scripts/research-content.js --topic "Your Topic"`

**⚠️ Subagent workflow:** The script writes a research prompt, then you spawn a subagent (Agent tool) to do the research. The subagent uses web search, reads the schema, and writes `v5/output/knowledge-base.json`. Validate after: `node v5/scripts/research-content.js --load v5/output/knowledge-base.json`.

### Step 2 — Generate Course (`v5/scripts/generate-layout.js`)
**Input:** `knowledge-base.json` + `brand-design.md` + `brand-profile.json` + `generation-engine.md` | **Output:** `course-layout.json`

Claude Code subagent with senior instructional designer persona generates the complete course. Reads the brand brief for voice calibration (playful/corporate/technical/warm). Designs with emotional arc (hook→foundation→challenge→insight→application), structural archetypes (6 patterns to remix), and density rhythm (breather/standard/deep-dive). Creates ALL assessments from raw facts (no pre-built quizzes in KB). Uses `component-library.json` as creative palette (reads `learningMoment` + `creativeUses` per component).

**⚠️ Subagent workflow:** Same pattern. Spawn a subagent that reads `generation-agent.md` task prompt (which references all required files). Writes `v5/output/course-layout.json`. Validate after: `node v5/scripts/generate-layout.js --load v5/output/course-layout.json`.

### Step 3 — Stitch Component Kit (`v5/scripts/generate-course-html.js`)
**Input:** `brand-design.md` + `representative-course.md` | **Output:** `component-patterns/` + `design-tokens.json` + `design-contract.json`
**Model:** GEMINI_3_1_PRO

See `v5/STITCH-INTEGRATION.md`. Automatically runs `extract-contract.js` at the end.

### Step 4 — Image Generation (`v5/scripts/generate-images.js`)
**Input:** `course-layout.json` + `brand-design.md` | **Output:** `images/*.jpg`
**Runs AFTER Step 3.** Priority chain: SiliconFlow AI (Tongyi Z-Image-Turbo) → Pexels stock → SVG placeholders. Guarantees 100% asset coverage.

### Step 5 — Build (`v5/scripts/build-course.js`)
**Input:** `design-contract.json` + `design-tokens.json` + `course-layout.json` + `images/` | **Output:** `course.html` + root `index.html`

See `v5/BUILD-SYSTEM.md`. On dark themes (`isDark: true`), the builder sanitizes Stitch's contract values — replacing hardcoded `bg-white` in card/section/panel backgrounds with theme-adaptive classes (`glass-card` for cards, `bg-surface-container` for flat panels). Hero CTA button accents are preserved.

### Step 6 — QA + Review (three gates, in order)
**6a — Structural QA (`v5/scripts/qa-course.js`):** Validates built HTML without a browser — section coverage, component integrity, quiz wiring, image integrity, heading hierarchy, duplicate IDs, content coverage vs knowledge base, design token/contract integrity, accessibility basics. **If it fails, fix before proceeding.**

**6b — Interactive + Design Quality QA (`v5/scripts/qa-interactive.js`):** Opens course in Playwright browser. Tests 31 checks in two tiers:
- **Functional (Tests 1-16):** Clicks quiz choices (submit → feedback → retry), switches tabs, flips flashcards, navigates carousels, expands accordions, checks checklists. Validates overflow (desktop + mobile), font sizes, tap targets, heading hierarchy, invisible content, section spacing, collapsed sections, nav z-index.
- **Design quality (Tests 17-31):** WCAG AA contrast on ALL text, padding consistency within card groups, card height balance, image aspect ratios, line measure (chars/line), font weight hierarchy, border-radius consistency, broken/collapsed images, mobile padding collapse, button style consistency, icon size consistency, hover/transition feedback, focus indicators, assessment distribution, section density variation.
- **Variant coverage (Test 32):** Checks which layout variants were used, verifies HTML renders the correct variant structure, reports untested variants.
**If it fails, fix before proceeding.**

**6c — Visual Review (`v5/scripts/review-course.js`):** Playwright captures screenshots of every section (desktop 1440x900) + mobile (390x844). Claude Code **MUST read each screenshot file** with the Read tool and review using the structured criteria the script outputs (graphic design, UX, UI, instructional design). The script captures screenshots but does NOT review them — you must do the visual review yourself. Fixes go in the engine. **Only run after 6a and 6b pass.**

---

## ⛔ Pipeline Runs — MANDATORY RULES

### When to use which run level

Claude Code automatically selects the correct run level based on what changed. The user does NOT need to specify.

**FULL RUN** — clear all outputs, execute all steps. Required when:
- User says "run it", "full pipeline", or "full run"
- Topic brief or URLs changed
- Brand URL changed
- Any prompt file changed (v5/prompts/*.md)
- Any schema file changed (v5/schemas/*)
- research-content.js, generate-layout.js, scrape-brand.js changed
- generate-course-html.js or extract-contract.js changed
- Testing a new topic/brand combination
- Uncertain whether upstream outputs are still valid

**DESIGN RUN** (Steps 3–6) — reuse KB + course layout, regenerate design + images + build. Required when:
- generate-course-html.js or extract-contract.js changed (but not content scripts)
- Brand URL changed but topic hasn't
- representative-course.md changed

**BUILD RUN** (Steps 5–6 only) — reuse everything upstream, just rebuild HTML + QA. Allowed ONLY when:
- ONLY build-course.js or hydrate.js changed
- The fix is clearly limited to HTML output / styling / interactivity
- All upstream outputs (KB, layout, contract, tokens, images) are unchanged

**MATRIX TEST** — autonomous multi-combination testing. Required when:
- User says "matrix test" (with or without specifying brands/topics)
- **Read `v5/input/test-runs.md` FIRST** — it contains the complete protocol: brand/topic pools, auto-selection rules, 6-phase workflow (generate → QA → classify → approve → fix → verify), bug classification, variant coverage tracking, and summary template
- If the user provides no brands or topics, auto-select from the pools in test-runs.md
- If the user specifies brands or topics, use those as overrides
- **Approval workflow:** Objective bugs (6a/6b failures) are auto-fixed. Subjective bugs (6c vision findings) are listed for user approval before fixing. See test-runs.md Phase 4.

**When in doubt, do a FULL RUN.** Announce which run level you're using and why.

### Post-Change Audit (MANDATORY)
After completing any significant code change (new components, new variants, fill function changes, schema changes), **run the change audit checklist** in `v5/CHANGE-AUDIT.md`. This catches stale counts, missing variant labels, doc drift, and memory staleness that QA gates do not test. Do not skip this. Do not self-assess — execute every check in the file.

### Full Run: Clear stale outputs
```bash
rm -rf v5/output/component-patterns/ v5/output/images/
rm -f v5/output/knowledge-base.json v5/output/brand-profile.json v5/output/brand-design.md
rm -f v5/output/course-layout.json v5/output/design-tokens.json v5/output/design-contract.json
rm -f v5/output/stitch-course-raw.html v5/output/stitch-course-meta.json
rm -f v5/output/stitch-course-screenshot.png v5/output/course.html
```

### Full Run: Execute in order
```bash
node v5/scripts/research-content.js --topic "Your Topic"  # Step 1 (subagent researches)
node v5/scripts/scrape-brand.js                            # Brand analysis
node v5/scripts/generate-layout.js                         # Step 2 (subagent generates course)
node v5/scripts/generate-course-html.js                    # Step 3 (Stitch component kit)
node v5/scripts/generate-images.js                         # Step 4 (image generation)
node v5/scripts/build-course.js                            # Step 5 (build final HTML)
node v5/scripts/qa-course.js                               # Step 6a (structural QA — fix if fails)
node v5/scripts/qa-interactive.js                          # Step 6b (interactive QA — fix if fails)
node v5/scripts/review-course.js                           # Step 6c (visual review — only after 6a+6b pass)
```

**If ANY step fails, STOP and tell the user. Do not silently continue with stale data.**

### API Keys (stored in `.env`, gitignored)
- `STITCH_API_KEY`: stitch.withgoogle.com → Settings → API Keys
- `SILICONFLOW_API_KEY`: SiliconFlow AI image generation via Tongyi Z-Image-Turbo (default)
- `PEXELS_API_KEY`: pexels.com/api → free stock photo fallback, 200 req/hr
- `ANTHROPIC_API_KEY`: (Optional) Enables API mode for brand analysis

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

23 components have **layout variants** — different visual arrangements that use the same design contract. The generation engine picks the variant based on content. Set `"variant": "name"` in course-layout.json. When absent, the first variant is the default.

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
- `wide` — `max-w-7xl` (visual components: bento, comparison, gallery)
- `full` — edge-to-edge background with contained inner content

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

### STITCH DESIGNS THE COMPONENT KIT
Stitch designs the visual system. We don't hardcode design decisions. Different brand URL → different Stitch kit → different visual output.

### CONTENT QUALITY
The AI generation agent creates rich, accurate educational content. Assessments test application, not recall. The generation engine uses emotional arc, structural archetypes, and density rhythm. No invented facts.

### AUTHORING LAYER COMPATIBILITY
The design system and course structure are reusable assets. The future authoring layer must be able to: re-render with edited content, swap component types, and customise without re-running the pipeline.
