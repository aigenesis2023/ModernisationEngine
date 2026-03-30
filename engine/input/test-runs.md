# Test Run Configuration

## Keywords

- **"Run"** → full pipeline (Steps 1-5), deliver the output. No QA, no bug fixing.
- **"Test"** → full pipeline (Steps 1-5), then all QA gates (6a, 6b, 6c). Fix any failures.
- **"Matrix test"** → run the default 3-combination matrix below. Fully autonomous — no user input needed.
- **"Reference test"** → use pre-built reference course (all 28 component types, 56 variants across 23 types). User provides 1 or 2 brand URLs. Runs Steps 3-5 per URL. No QA — user reviews manually.
- **"Authoring audit phase 1"** → start the authoring audit (setup, inventory, desktop sweep first half). **Each phase runs in a fresh chat and stops after saving.** See `engine/input/authoring-audit.md`.
- **"Authoring audit phase 2"** → desktop sweep second half.
- **"Authoring audit phase 3"** → mobile sweep, edge cases, authoring-OFF verification.
- **"Authoring audit phase 4"** → diagnose root causes, fix, verify, write report to `engine/output/audit-report.md`.

Examples:
- "Run it with sales and fin-ai" → just builds
- "Test it with Sprig on cybersecurity" → builds + QA + fixes
- "Matrix test" → runs the default 3 combinations, QA, classify bugs, fix, verify
- "Reference test with https://sprig.framer.website/" → builds reference course with Sprig brand
- "Reference test with https://sprig.framer.website/ and https://ailyx.framer.website/" → builds two courses (dark + light)

---

## Brand Pool

Auto-selected for matrix runs. No manual input needed.

| Brand | Theme | URL | Role |
|-------|-------|-----|------|
| Sprig | dark, cyan | `https://sprig.framer.website/` | Dark pool |
| Najaf | dark, green | `https://najaf.framer.ai/` | Dark pool |
| Crimzon | dark, crimson | `https://crimzon.framer.website/` | Dark pool |
| Landio | dark, neutral | `https://landio.framer.website/` | Dark pool |
| Ailyx | light, blue | `https://ailyx.framer.website/` | Light pool |
| Fluence | light, amethyst | `https://fluence.framer.website/` | Light pool |
| FitFlow | light, pink-blue | `https://fitflow.framer.website/` | Light pool |
| Aigents | light, purple | `https://aigents.framer.website/` | Light pool |
| CourSite | light, lavender-purple | `https://coursesite.framer.website/` | Light pool |

## Topic Pool

Pre-written topics grouped by content shape. Auto-selected for matrix runs.

**Data-heavy** (stats, tables, comparisons — stresses stat callouts, data tables, number typography):
1. Cloud Infrastructure Security
2. Data Privacy and GDPR Compliance
3. Financial Risk Management Fundamentals

**Narrative** (case studies, quotes, reflection — stresses pullquotes, graphic-text, whitespace, emotional arc):
1. Mastering High-Stakes Negotiation
2. Emotional Intelligence in Leadership
3. Building a Culture of Innovation

**Procedural** (steps, checklists, processes — stresses timelines, process-flows, checklists, accordions):
1. Emergency First Aid for Remote Teams
2. Incident Response and Crisis Management
3. Onboarding New Team Members Effectively

---

## Default Matrix (3 Combinations)

**Fully automatic.** When the user says "matrix test" with no other input, pick one combination from each content shape. Rotate brands and topics so consecutive matrix runs don't repeat the same combinations.

**Selection rules:**
1. **Run 1 (dark brand + data-heavy topic):** Pick one dark brand and one data-heavy topic
2. **Run 2 (light brand + narrative topic):** Pick one light brand and one narrative topic
3. **Run 3 (random brand + procedural topic):** Pick any brand NOT already used (dark or light) and one procedural topic

Avoid repeating the same brand or topic from the user's most recent matrix run if possible. If the user specifies brands or topics in chat, use those instead.

**Example matrix (auto-selected):**

| Run | Brand | Theme | Topic | Content shape |
|-----|-------|-------|-------|---------------|
| **1** | Crimzon | dark, crimson | Cloud Infrastructure Security | Data-heavy |
| **2** | FitFlow | light, pink-blue | Mastering High-Stakes Negotiation | Narrative |
| **3** | Najaf | dark, green | Emergency First Aid for Remote Teams | Procedural |

**Why 3, not 9:** Most bugs are universal (caught by any run), theme-specific (caught by dark vs light), or content-shape-specific (caught by varying topic type). 3 deliberate pairings give near-complete coverage.

---

## Instructions for Claude

### Before every run

1. Read this file AND `CLAUDE.md` fully before acting
2. Detect mode from user's keyword: "run" / "test" / "matrix test"
3. **Topic selection:** If the user specifies a topic, use it. If they say "matrix test" with no topic, auto-select from the topic pool above. If a topic is short (1-3 words), expand it into a full brief before writing to `topic-brief.txt`. Include: subject scope, what it covers (5-7 subtopics), target audience, difficulty level, estimated duration (~45 minutes)
4. **Brand selection:** If the user specifies a brand, use it. If they say "matrix test" with no brand, auto-select from the brand pool above per the selection rules.
5. Update `brand/url.txt` and `engine/input/topic-brief.txt` with the chosen brand and topic

### Mode: Run

Execute full pipeline (Steps 1-5 per CLAUDE.md). Deliver the output. No QA. Done.

### Mode: Test

Execute full pipeline (Steps 1-5), then run all three QA gates in order:
1. `node engine/scripts/qa-course.js` — structural QA. Fix any failures before proceeding.
2. `node engine/scripts/qa-interactive.js` — interactive + design quality QA. Fix any failures before proceeding.
3. `node engine/scripts/review-course.js` — captures screenshots. Then **READ every screenshot file** with the Read tool and review using the prompt the script outputs. Fix any issues in the engine.

**Gate 6c is NOT optional.** The script captures screenshots but does NOT review them itself. You MUST:
- Read each `screenshots/section-*.jpeg` file
- Read each `screenshots/mobile-*.jpeg` file
- Apply the vision review criteria the script prints
- Log any issues found
- Fix issues in engine files (build-course.js, hydrate.js, etc.), never in output files

### Mode: Matrix Test

Fully autonomous. No user input needed. Follow this protocol exactly.

#### Phase 1: Generate upstream assets (one-time per unique topic/brand)

For each unique **topic** in the matrix:
1. Write expanded brief to `engine/input/topic-brief.txt`
2. Run `node engine/scripts/research-content.js` (spawn subagent)
3. Save `engine/output/knowledge-base.json` to `engine/output/matrix/{topic-slug}/knowledge-base.json`

For each unique **brand** in the matrix:
1. Write URL to `brand/url.txt`
2. Run `node engine/scripts/scrape-brand.js`
3. Run `node engine/scripts/generate-design-tokens.js` (MD3 palette + archetype)
4. Save brand outputs to `engine/output/matrix/{brand-slug}/` (brand-design.md, brand-profile.json, extracted-css.json, design-tokens.json)

This means: 3 topics researched + 3 brands scraped/designed = 6 upstream jobs, NOT 9.

#### Phase 2: Build and QA each combination

For each combination in the matrix (sequentially):

1. **Restore upstream files:** Copy the topic's KB and the brand's design files back to `engine/output/`
2. **Generate course layout:** Run `node engine/scripts/generate-layout.js` (subagent — content + brand voice = unique per combination)
3. **Generate images:** Run `node engine/scripts/generate-images.js`. Real images are required — hero, full-bleed, and graphic-text components layer text over images, so contrast, overlay opacity, and readability can only be tested with actual images. Priority chain: SiliconFlow AI → Pexels stock → SVG placeholder (last resort only).
4. **Build:** Run `node engine/scripts/build-course.js`
5. **QA Gate 6a:** Run `node engine/scripts/qa-course.js`. Log all failures.
6. **QA Gate 6b:** Run `node engine/scripts/qa-interactive.js`. Log all failures.
7. **QA Gate 6c:** Run `node engine/scripts/review-course.js`. READ every screenshot. Log all visual issues.
8. **Save results:** Copy `engine/output/course.html` to `engine/output/matrix/{brand-slug}-{topic-slug}/course.html`

**Do NOT fix bugs during Phase 2.** Log everything, fix nothing. The goal is to see the full picture before touching any code.

#### Phase 3: Classify bugs and auto-fix objective issues

After all 3 combinations are complete, compile the full bug report.

**Bug classification (mandatory for every bug):**

| Type | Definition | Where to fix |
|------|-----------|--------------|
| **Universal** | Appears in all 3 combinations | Fix once, applies everywhere |
| **Theme-specific** | Appears only in dark OR only in light brands | Fix in colour/contrast handling (build-course.js or generateHead) |
| **Content-specific** | Appears only with certain content shapes (data-heavy, narrative, procedural) | Fix in the relevant fill function or generation-engine.md |
| **Component-specific** | Appears only for one component type regardless of brand/topic | Fix in that component's fill function |

**Split bugs into two categories:**

**Objective bugs (from 6a + 6b) — fix these automatically, no approval needed:**
- Contrast ratios below WCAG AA thresholds
- Padding/border-radius/card-height inconsistencies
- Broken images, overflow, collapsed sections
- Font size/weight hierarchy violations
- Interactive components not functioning
- Any measurable, deterministic failure

**Subjective bugs (from 6c vision review) — list these for user approval:**
- "Whitespace feels cramped in section 4"
- "Visual weight is front-loaded"
- "Colour harmony feels off"
- "Component transitions are abrupt"
- Any design judgement call where the fix could affect other things

**Fix priority order (for objective bugs):**
1. Universal bugs first (highest ROI — one fix, all combinations benefit)
2. Theme-specific bugs (affects 2 of 3 runs)
3. Component-specific bugs
4. Content-specific bugs (lowest priority — may be edge cases)

**Skip-and-log policy:** If a bug resists fixing after 3 attempts, log it with:
- What was tried
- Why it failed
- Suggested next step
Then move on. Do not burn time on stubborn bugs.

#### Phase 4: Present report and wait for approval

After auto-fixing objective bugs, present the full report to the user:

```
## Matrix Test Report

### Combinations tested
1. {Brand} (theme) x {Topic} — 6a: PASS/FAIL, 6b: PASS/FAIL, 6c: N issues
2. ...
3. ...

### Objective bugs (already fixed)
1. [Universal] Description — fixed in {file}:{line}
2. [Theme-dark] Description — fixed in {file}:{line}
...

### Objective bugs (skipped — couldn't fix)
1. [Component-specific] Description — skipped because: {reason}
...

### Subjective bugs (from vision review — AWAITING YOUR APPROVAL)
1. [Section 3] "Whitespace between stat callout and next section feels cramped"
   → Suggested fix: increase py-24 to py-32 in fillStatCallout (build-course.js)
2. [Section 7] "Cards have uneven visual weight — first card dominates"
   → Suggested fix: adjust bento featured variant grid proportions
...
Reply with which subjective bugs to fix, skip, or adjust.

### Variant coverage
- Covered: {N}/56 variants across 3 runs
- Missing: {list}

### Files modified so far
- engine/scripts/build-course.js: {what changed}
- engine/scripts/hydrate.js: {what changed}
...
```

**── STOP AND WAIT for user response. ──**

The user will reply with which subjective bugs to fix. Apply those fixes.

#### Phase 5: Verify all fixes

After all fixes (objective + approved subjective) are applied:
1. Re-run Phase 2 for ALL 3 combinations (not just the one that had the bug)
2. A fix for dark brands could break light brands — always verify the full matrix
3. If new bugs appear, classify and fix them (repeat Phase 3-5)
4. Stop when all 3 combinations pass all 3 QA gates with no errors

#### Phase 6: Final summary

Output a final structured summary:

```
## Matrix Test Results — FINAL

### Combinations tested
1. {Brand} x {Topic} — PASS/FAIL
2. {Brand} x {Topic} — PASS/FAIL
3. {Brand} x {Topic} — PASS/FAIL

### Bugs found: N total
- Objective: N (auto-fixed: N, skipped: N)
- Subjective: N (user-approved fixes: N, user-skipped: N)

### All fixes applied
1. [Type] Description — fixed in {file}:{line}
...

### Files modified
- engine/scripts/build-course.js: {what changed}
- engine/scripts/hydrate.js: {what changed}
...

### Verification
All 3 combinations re-tested after fixes: PASS/FAIL
```

---

## Overrides

Users can override any default in chat. Common overrides:

- **Different brands/topics:** "Matrix test with Najaf, Ailyx, Fluence on [topics]"
- **Skip images (SVG only):** "Matrix test, skip images" (faster, but can't test text-on-image contrast)
- **Skip visual review:** "Matrix test, skip 6c" (not recommended)
- **Single combination only:** "Test Crimzon on cybersecurity" (use "test" mode instead)

Overrides from chat take precedence over this file. Apply them and note the deviation in the summary.

---

## Variant coverage

23 components have layout variants (56 total). The matrix should cover as many as possible across the 3 runs. After Phase 2, check which variants were used:

| Component | Variants | Goal: covered by at least 1 run |
|-----------|----------|-------------------------------|
| hero | centered-overlay, split-screen, minimal-text | All 3 |
| text | standard, two-column, highlight-box | All 3 |
| graphic | standard, captioned-card | Both |
| graphic-text | split, overlap, full-overlay | All 3 |
| pullquote | accent-bar, centered, minimal | All 3 |
| stat-callout | centered, card-row | Both |
| callout | info, warning, tip, success | All 4 |
| key-term | list, card-grid | Both |
| accordion | standard, accent-border | Both |
| tabs | horizontal, vertical | Both |
| narrative | image-focused, text-focused | Both |
| flashcard | grid, single-large | Both |
| labeled-image | numbered-dots, side-panel | Both |
| checklist | standard, card-style, numbered | All 3 |
| mcq | stacked, grid | Both |
| branching | cards, list | Both |
| bento | grid-4, wide-2, featured | All 3 |
| comparison | columns, stacked-rows | Both |
| data-table | standard, striped-card | Both |
| timeline | vertical, centered-alternating | Both |
| process-flow | vertical, horizontal | Both |
| divider | line, spacing, icon | All 3 |
| full-bleed | center, left, right | All 3 |

`qa-interactive.js` TEST 32 reports which variants were used and which are missing. If critical variants (hero, graphic-text) aren't covered after 3 runs, note it in the summary.

The generation engine (`generation-engine.md`) instructs the AI to use diverse variants. If the same default variant appears in all 3 runs, that's a prompt quality issue — fix in the generation prompt, not the fill functions.

---

## Component-level QA requirements

During QA (gates 6a, 6b, 6c), testing must cover **every component type present** in the built course:

**Playwright (6b) must verify each component instance:**
- Interactive components (MCQ, tabs, flashcards, carousels, accordions, checklists): click/interact with every instance, not just the first
- Visual components (bento, comparison, stat-callout, timeline): check padding, card balance, border-radius consistency per instance
- Image components (hero, full-bleed, graphic-text, graphic): check contrast, image loading, aspect ratios per instance

**Vision review (6c) must examine each section screenshot:**
- Every section screenshot must be read and reviewed — do not skip sections
- Flag variant-specific rendering issues (e.g., split-screen hero misaligned, overlap graphic-text image clipping)
- Compare components of the same type across the course (e.g., two graphic-text sections should have consistent treatment)

---

## Edge cases to watch for

During matrix testing, pay extra attention to:
- Components with minimal content (1 accordion item, 2-choice MCQ)
- Components with maximum content (8+ accordion panels, long prose in tabs)
- Sections with many consecutive visual components (images, stats, pullquotes)
- Very short courses (3-4 sections) and longer ones (10+ sections)
- Topics that produce lots of statistics vs topics that are mostly narrative
- Dark themes: text readability on all background variants (surface, surface-variant, primary-container)
- Light themes: sufficient contrast on pale backgrounds, subtle borders visible

---

## Reference Test

### Purpose

Fast engine QA using a pre-built course that exercises all 28 component types and 56 layout variants across 23 types. Skips the most time-consuming steps (research + layout generation) and runs everything else fresh. The user reviews the output manually instead of automated QA.

**Use when:** You've changed build-course.js, hydrate.js, generate-design-tokens.js, visual-archetypes.json, generate-images.js, or any engine script and want to verify the output visually.

**Do NOT use when:** You've changed prompts (generation-engine.md, research-agent.md) or schemas — use a full "run" or "test" for those since the reference course bypasses content generation.

### Reference course file

`engine/input/reference-course-layout.json`

- 10 sections, 28 component instances (one per component type)
- All 28 component types (including divider and callout)
- All 56 layout variants across 23 types, accessible via the **authoring panel** (see below)
- Topic: "The Future of Work: Navigating Digital Transformation"
- Realistic content, normal lengths

### Authoring panel — variant switching

Every built course includes a **"✎ Edit"** button (top-right corner, sticky). Click it to enter authoring mode:

- Each component that has layout variants shows a toolbar above it with the component type label and buttons for each variant (using friendly per-component labels, not internal names)
- Click a variant button to swap the layout live — content stays the same, layout changes
- Interactive components (tabs, quizzes, etc.) re-initialize automatically after swap
- Text elements become inline-editable (blue outline on hover/focus)
- "↓ Export JSON" button appears to download the modified course data

This means one component per type in the reference course covers ALL 56 variants. No duplicate components needed.

The authoring panel is always present in every built course — not just reference tests. It's subtle until clicked (no impact on end users). This IS the authoring layer — it evolves phase by phase.

### How it works

User says: **"reference test"** + 1 or 2 brand URLs.

**With 1 URL:**
```
1. Write URL to brand/url.txt
2. Copy engine/input/reference-course-layout.json → engine/output/course-layout.json
3. Run: node engine/scripts/scrape-brand.js
4. Run: node engine/scripts/generate-design-tokens.js
5. Run: node engine/scripts/generate-images.js
6. Run: node engine/scripts/build-course.js
7. Output preview link to engine/output/course.html
```

**With 2 URLs (dark + light):**
Run the above sequence for each URL. Save first output before starting second:
```
1. Run steps 1-6 for URL 1
2. Copy engine/output/course.html → engine/output/reference-test-1.html
3. Run steps 1-6 for URL 2
4. Copy engine/output/course.html → engine/output/reference-test-2.html
5. Output both preview links
```

**What does NOT run:**
- research-content.js (skipped — using reference content)
- generate-layout.js (skipped — using reference layout)
- qa-course.js, qa-interactive.js, review-course.js (skipped — user reviews manually)

### After the reference test

The user scrolls through the output and tells Claude what to fix. Claude fixes the engine (never the output), rebuilds, and gives a new preview link. Repeat until the user is satisfied.
