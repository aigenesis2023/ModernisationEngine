# CLAUDE.md — Modernisation Engine

## What This Is
An AI-powered tool that creates modern, branded, premium deep-scroll web learning experiences. Two input paths:

1. **AI-First (primary):** User provides a topic brief → AI researches and generates a complete course
2. **SCORM Import (legacy/future premium):** Upload a SCORM 1.2 file → content and logic are extracted and restructured

Both paths produce the same `course-layout.json` → **Google Stitch designs a branded component kit** → we assemble the final course with full interactivity via a hydration script.

**Preview URL:** https://aigenesis2023.github.io/ModernisationEngine/
(Currently serves the generated course directly — no upload UI during proof-of-concept phase)

**Branch:** `ai-first-authoring-3` (active development) | `ai-first-authoring-2` (V2, superseded) | `ai-first-authoring` (V1, superseded) | `Current-working-2` (V5 SCORM pipeline)

**Future:** An authoring layer will sit on top of the output, allowing end users to edit content, swap components, and customise the course without re-running the pipeline.

---

## Architecture (V5 — Dual Input, Stitch Component Kit)

```
═══ AI-FIRST PATH (primary) ═══════════════════════════════════════════
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
         ├─ AI designs course with structural variety — content shaped for component
         ├─ AI creates ALL assessments (KB has raw facts, not pre-built quizzes)
         └─→ course-layout.json

═══ SCORM IMPORT PATH (legacy/future premium) ═════════════════════════
SCORM File ──→ extract.js        ──→ Content Bucket (JSON) + Logic Metadata
                                          │
                    ┌─────────────────────┘
                    ▼
         design-course.js (AI layout engine)
         ├─ Reads layout-engine.md (system prompt)
         ├─ Reads content-bucket.json + brand-profile.json
         ├─ AI restructures content, picks best components
         └─→ course-layout.json

═══ SHARED PIPELINE (both paths) ══════════════════════════════════════
Brand URL  ──→ scrape-brand.js   ──→ Brand Profile (JSON) + Brand Design (DESIGN.md)
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
         ├─ Hardcodes LAYOUT classes (grids, containment, spacing)
         ├─ Wraps showIf components/sections with data-show-if attributes
         ├─ Emits path-selector with data-path-selector/data-path-variable
         ├─ Wraps post-selector content in course gate (data-course-gate)
         ├─ Tags sections with data-section-track for progress tracking
         ├─ Emits draw metadata (data-draw-count/pool) on question bank MCQs
         ├─ Injects window.__PATH_GROUPS__ + __SECTION_GATING__ state config
         ├─ Inlines hydrate.js for interactivity + flow control
         └─→ course.html (single self-contained file)
```

### Core Principles

**1. Stitch designs the visual system. We control layout and content.**
Different brand URL → different Stitch kit → different visual character, identical layout. See `v5/STITCH-INTEGRATION.md` for full details.

**2. Content and logic fidelity is non-negotiable.**
All educational content from the SCORM must be preserved. The learning design intent — branching, difficulty levels, conditional content — must be captured and mapped to modern patterns. See `v5/LOGIC-EXTRACTION.md` for the extraction architecture.

**3. The design system is a reusable asset.**
Stitch's output (component patterns + design tokens) is extracted and stored. The future authoring layer can re-render with different content or swapped components without re-calling Stitch.

**4. Speak Stitch's language.**
We generate a DESIGN.md brand brief using Stitch's native vocabulary. See `v5/STITCH-INTEGRATION.md` for DESIGN.md format and supported fonts.

**5. Logic flows end-to-end.**
Path selection, conditional content, and question bank associations extracted in Phase 1 flow through to the final HTML. The layout engine tags content with `showIf` conditions. The build step wraps tagged content with `data-show-if` attributes. `hydrate.js` manages a state store with flow control: course gate (must select path before continuing), section progress tracking (interactive completion per section with nav indicators), draw randomization (poolSize > drawCount), and required-items completion counters. See `v5/CONTENT-STRUCTURING.md` and `v5/BUILD-SYSTEM.md`.

---

## Architecture Deep-Dive Documents

| Document | Covers |
|---|---|
| **`v5/LOGIC-EXTRACTION.md`** | How we extract triggers, variables, conditions, and interactive logic from Storyline SCORM exports. Storyline data schema, logic patterns, tagged content model. **Product differentiator.** |
| **`v5/CONTENT-STRUCTURING.md`** | How extracted data gets transformed by the AI layout engine into a structured course. Logic-to-component mapping, layout engine prompt, validation. |
| **`v5/STITCH-INTEGRATION.md`** | Google Stitch SDK, DESIGN.md format, supported fonts, API constraints, design contract architecture, pattern extraction, colorMode detection. |
| **`v5/BUILD-SYSTEM.md`** | Final HTML assembly. Design/layout separation, 10 layout rules, fill function conventions, generateHead(), hydrate.js interactivity, image embedding. |

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
    content-bucket.schema.json         ← SCORM extraction output format
    course-layout.schema.json          ← Layout engine output format (shared by both paths)
    component-library.json             ← 26 components: type, props, learningMoment, creativeUses, examples
  prompts/
    research-agent.md                  ← Expert SME persona: topic → raw knowledge + teachable moments
    generation-engine.md               ← Senior ID persona: emotional arc, archetypes, anti-patterns, voice calibration
    generation-agent.md                ← Subagent task: reads brand-design.md + KB → course-layout.json
    layout-engine.md                   ← System prompt for SCORM layout engine (legacy path)
    representative-course.md           ← All 26 component types for Stitch to design
  scripts/
    research-content.js                ← AI-first: topic → knowledge-base.json (subagent)
    generate-layout.js                 ← AI-first: knowledge-base → course-layout.json (subagent)
    extract.js                         ← SCORM: folder → content-bucket.json
    design-course.js                   ← SCORM: content-bucket → course-layout.json
    scrape-brand.js                    ← Brand URL → screenshot + natural language description
    generate-course-html.js            ← DESIGN.md + representative course → Stitch → component kit
    extract-contract.js                ← Cheerio: Stitch patterns → design-contract.json
    generate-images.js                 ← Image generation: SiliconFlow AI → Pexels stock → SVG
    build-course.js                    ← Contract fill: design-contract.json + real content → course.html
    review-course.js                   ← Playwright screenshot capture (Phase 6 visual review)
    hydrate.js                         ← Vanilla JS interactivity (injected into course.html)
    lib/
      validate-layout.js               ← Shared validation for course-layout.json
  input/                               ← AI-first inputs
    topic-brief.txt                    ← Plain text topic description
    urls.txt                           ← One URL per line (optional)
    docs/                              ← Drop PDFs/PPTXs here (future)
  output/
    knowledge-base.json                ← AI-first research output
    content-bucket.json                ← SCORM extraction output
    brand-profile.json                 ← Scraped from brand URL (raw data)
    brand-screenshot.png               ← Playwright screenshot of brand landing page
    brand-design.md                    ← Natural language brand description for Stitch
    course-layout.json                 ← Structured course (from either path)
    stitch-course-raw.html             ← Stitch's complete designed page
    stitch-course-meta.json            ← Stitch API response metadata
    stitch-course-screenshot.png       ← Stitch's design preview
    design-tokens.json                 ← Extracted design system tokens
    design-contract.json               ← Visual contract: cheerio-extracted from patterns
    component-patterns/                ← Extracted HTML pattern per component type (26)
    images/                            ← Generated images
    course.html                        ← Final single-file output

screenshots/                           ← Dev screenshots (gitignored, overwritten each run)
EV/                                    ← Test SCORM (64 slides, gitignored in Codespace)
```

---

## The Pipeline

### AI-First Path (primary)

#### Step 1 — Research (`v5/scripts/research-content.js`)
**Input:** Topic brief + optional URLs | **Output:** `knowledge-base.json`

Claude Code subagent with expert SME persona researches the topic using web search. Gathers raw knowledge as uniform `keyPoints[]` + `teachableMoments[]` (5 types: surprising-insight, case-study, analogy, contrast, decision-framework). The research agent has **zero knowledge of components** — it gathers raw material for the generation agent. Run: `node v5/scripts/research-content.js --topic "Your Topic"`

**⚠️ Subagent workflow:** The script writes a research prompt, then you spawn a subagent (Agent tool) to do the research. The subagent uses web search, reads the schema, and writes `v5/output/knowledge-base.json`. Validate after: `node v5/scripts/research-content.js --load v5/output/knowledge-base.json`.

#### Step 2 — Generate Course (`v5/scripts/generate-layout.js`)
**Input:** `knowledge-base.json` + `brand-design.md` + `brand-profile.json` + `generation-engine.md` | **Output:** `course-layout.json`

Claude Code subagent with senior instructional designer persona generates the complete course. Reads the brand brief for voice calibration (playful/corporate/technical/warm). Designs with emotional arc (hook→foundation→challenge→insight→application), structural archetypes (6 patterns to remix), and density rhythm (breather/standard/deep-dive). Creates ALL assessments from raw facts (no pre-built quizzes in KB). Uses `component-library.json` as creative palette (reads `learningMoment` + `creativeUses` per component).

**⚠️ Subagent workflow:** Same pattern. Spawn a subagent that reads `generation-agent.md` task prompt (which references all required files). Writes `v5/output/course-layout.json`. Validate after: `node v5/scripts/generate-layout.js --load v5/output/course-layout.json`.

### SCORM Import Path (legacy/future premium)

#### Phase 1 — Extraction (`v5/scripts/extract.js`)
**Input:** SCORM folder | **Output:** `content-bucket.json`

Extracts content + logic from Storyline HTML5 exports. See `v5/LOGIC-EXTRACTION.md`.

#### Phase 3 — AI Layout Engine (`v5/scripts/design-course.js`)
**Input:** `content-bucket.json` + `brand-profile.json` + `layout-engine.md` | **Output:** `course-layout.json`

AI restructures SCORM content. Uses shared `validateLayout()` from `v5/scripts/lib/validate-layout.js`.

### Shared Pipeline (both paths)

### Phase 4a — Stitch Component Kit (`v5/scripts/generate-course-html.js`)
**Input:** `brand-design.md` + `representative-course.md` | **Output:** `component-patterns/` + `design-tokens.json` + `design-contract.json`
**Model:** GEMINI_3_1_PRO

See `v5/STITCH-INTEGRATION.md`. Automatically runs `extract-contract.js` at the end.

### Phase 4b — Image Generation (`v5/scripts/generate-images.js`)
**Input:** `course-layout.json` + `brand-design.md` | **Output:** `images/*.jpg`
**Runs AFTER Phase 4a.** Priority chain: SiliconFlow AI (FLUX.1-schnell) → Pexels stock → SVG placeholders. Guarantees 100% asset coverage.

### Phase 5 — Build (`v5/scripts/build-course.js`)
**Input:** `design-contract.json` + `design-tokens.json` + `course-layout.json` + `images/` | **Output:** `course.html` + root `index.html`

See `v5/BUILD-SYSTEM.md`.

### Phase 6 — Visual Review (`v5/scripts/review-course.js`)
**Mandatory after every pipeline run.** Playwright captures screenshots of every section (desktop 1440x900) + mobile (390x844). Claude Code reviews visually, fixes go in the engine. Alternate brands between `najaf.framer.ai` (dark) and `ailyx.framer.website` (light).

---

## ⛔ Full Pipeline — MANDATORY CHECKLIST

**Every test run MUST execute ALL phases. No skipping. No reusing stale outputs.**

### Pre-run: Clear stale outputs
```bash
rm -rf v5/output/component-patterns/ v5/output/images/
rm -f v5/output/knowledge-base.json v5/output/brand-profile.json v5/output/brand-design.md
rm -f v5/output/course-layout.json v5/output/design-tokens.json v5/output/design-contract.json
rm -f v5/output/stitch-course-raw.html v5/output/stitch-course-meta.json
rm -f v5/output/stitch-course-screenshot.png v5/output/course.html
```

### AI-First path (run in order)
```bash
node v5/scripts/research-content.js --topic "Your Topic"  # Step 1 (subagent researches)
node v5/scripts/scrape-brand.js                            # Brand analysis
node v5/scripts/generate-layout.js                         # Step 2 (subagent generates course)
node v5/scripts/generate-course-html.js                    # Stitch component kit
node v5/scripts/generate-images.js                         # Image generation
node v5/scripts/build-course.js                            # Build final HTML
node v5/scripts/review-course.js                           # Visual review
```

### SCORM import path (run in order)
```bash
node v5/scripts/extract.js EV              # Phase 1 (skip ONLY if same SCORM)
node v5/scripts/scrape-brand.js            # Phase 2
node v5/scripts/design-course.js           # Phase 3
node v5/scripts/generate-course-html.js    # Phase 4a
node v5/scripts/generate-images.js         # Phase 4b
node v5/scripts/build-course.js            # Phase 5
node v5/scripts/review-course.js           # Phase 6
```

**If ANY step fails, STOP and tell the user. Do not silently continue with stale data.**

### API Keys (stored in `.env`, gitignored)
- `STITCH_API_KEY`: stitch.withgoogle.com → Settings → API Keys
- `SILICONFLOW_API_KEY`: SiliconFlow AI image generation via FLUX.1-schnell (default)
- `PEXELS_API_KEY`: pexels.com/api → free stock photo fallback, 200 req/hr
- `ANTHROPIC_API_KEY`: (Optional) Enables API mode for brand analysis + SCORM layout engine

---

## Component Library (26 types)

| Type | Purpose |
|---|---|
| `hero` | Full-viewport opening with background image, title, CTA |
| `path-selector` | Persistent course path/role selector with state management |
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

## Test Data
- **SCORM:** `EV/` — 64-slide EV Awareness & Safety course (gitignored, in Codespace)
- **Brand URL:** stored in `brand/url.txt` — currently `https://sprig.framer.website/`
- **Previously tested brands:** sprig (dark, cyan), fluence (light, amethyst), ailyx (light, blue), fitflow (light, pink-blue gradient), landio (dark, sleek SaaS), crimzon (dark, crimson), aigents (light, purple), najaf (dark, green)

---

## Deployment
GitHub Pages serves from root `index.html` on `Current-working-2`. `build-course.js` writes directly to root `index.html`. Commit and push to `Current-working-2` to deploy. **Never commit to or push to `main`.**

---

## ⛔ ABSOLUTE RULES

### UNIVERSAL ENGINE
The purpose of every conversation is to improve the **engine** — the scripts, prompts, schemas, and templates that power the pipeline. The test SCORM file and brand URL are diagnostic tools only. Every change must work for ANY Storyline SCORM file and ANY brand URL.

**ALL FIXES GO IN THE ENGINE — NEVER IN TEST DATA OR OUTPUT.**

### STITCH DESIGNS THE COMPONENT KIT
Stitch designs the visual system. We don't hardcode design decisions. Different brand URL → different Stitch kit → different visual output.

### CONTENT FIDELITY
All educational content from the SCORM must be preserved. Every quiz question, every text block, every learning objective. The AI layout engine rewords for clarity but never invents facts or drops content.

### LOGIC FIDELITY
The learning design intent — branching, difficulty levels, conditional content paths — must be extracted from the SCORM and mapped to modern interactive patterns. See `v5/LOGIC-EXTRACTION.md`.

### AUTHORING LAYER COMPATIBILITY
The design system and course structure are reusable assets. The future authoring layer must be able to: re-render with edited content, swap component types, move content between paths, and customise without re-running the pipeline.
