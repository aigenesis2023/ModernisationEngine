# Test Run Configuration

## Keywords

- **"Run"** → full pipeline (Steps 1-5), deliver the output. No QA, no bug fixing.
- **"Test"** → full pipeline (Steps 1-5), then all QA gates (6a, 6b, 6c). Fix any failures.
- **"Matrix test"** → run the default 3-combination matrix below. Fully autonomous — no user input needed.

Examples:
- "Run it with sales and fin-ai" → just builds
- "Test it with Sprig on cybersecurity" → builds + QA + fixes
- "Matrix test" → runs the default 3 combinations, QA, classify bugs, fix, verify

---

## Brands

```
BRAND 1: https://crimzon.framer.website/
BRAND 2: https://fitflow.framer.website/
BRAND 3: https://sprig.framer.website/
```

## Topics

Short is fine — even just "Cybersecurity" works. Claude will expand it into a full brief with audience, level, duration, and scope before running the research agent.

```
TOPIC 1: Cloud Infrastructure Security

TOPIC 2: Soft Skill: Mastering High-Stakes Negotiation

TOPIC 3: Compliance: Emergency First Aid for Remote Teams
```

## Brand Reference

Tested brands you can copy into the slots above.

| Brand | Theme | URL |
|-------|-------|-----|
| Sprig | dark, cyan | `https://sprig.framer.website/` |
| Ailyx | light, blue | `https://ailyx.framer.website/` |
| Najaf | dark, green | `https://najaf.framer.ai/` |
| Fluence | light, amethyst | `https://fluence.framer.website/` |
| FitFlow | light, pink-blue | `https://fitflow.framer.website/` |
| Landio | dark, neutral | `https://landio.framer.website/` |
| Crimzon | dark, crimson | `https://crimzon.framer.website/` |
| Aigents | light, purple | `https://aigents.framer.website/` |
| CourSite | light, lavender-purple | `https://coursesite.framer.website/` |

---

## Default Matrix (3 Combinations)

The matrix is designed for maximum bug coverage with minimum runs. Each combination stresses different parts of the engine.

| Run | Brand | Theme | Topic | Content shape | What it stresses |
|-----|-------|-------|-------|---------------|------------------|
| **1** | Crimzon | dark, crimson | Cloud Infrastructure Security | Data-heavy (stats, tables, comparisons) | Contrast on dark bg, stat callouts, data tables, number typography |
| **2** | FitFlow | light, pink-blue | Mastering High-Stakes Negotiation | Narrative (case studies, quotes, reflection) | Long prose, pullquotes, graphic-text, whitespace rhythm, emotional arc |
| **3** | Sprig | dark, cyan | Emergency First Aid for Remote Teams | Procedural (steps, checklists, processes) | Timelines, process-flows, checklists, accordions, dense sections |

**Why 3, not 9:** Most bugs are universal (caught by any run), theme-specific (caught by dark vs light), or content-shape-specific (caught by varying topic type). 3 deliberate pairings give near-complete coverage. A 3x3 grid would find the same bugs 3x each.

---

## Instructions for Claude

### Before every run

1. Read this file AND `CLAUDE.md` fully before acting
2. Detect mode from user's keyword: "run" / "test" / "matrix test"
3. If a topic is short (1-3 words), expand it into a full brief before writing to `topic-brief.txt`. Include: subject scope, what it covers (5-7 subtopics), target audience, difficulty level, estimated duration (~45 minutes)
4. Update `brand/url.txt` and `v5/input/topic-brief.txt` with the chosen brand and topic

### Mode: Run

Execute full pipeline (Steps 1-5 per CLAUDE.md). Deliver the output. No QA. Done.

### Mode: Test

Execute full pipeline (Steps 1-5), then run all three QA gates in order:
1. `node v5/scripts/qa-course.js` — structural QA. Fix any failures before proceeding.
2. `node v5/scripts/qa-interactive.js` — interactive + design quality QA. Fix any failures before proceeding.
3. `node v5/scripts/review-course.js` — captures screenshots. Then **READ every screenshot file** with the Read tool and review using the prompt the script outputs. Fix any issues in the engine.

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
1. Write expanded brief to `v5/input/topic-brief.txt`
2. Run `node v5/scripts/research-content.js` (spawn subagent)
3. Save `v5/output/knowledge-base.json` to `v5/output/matrix/{topic-slug}/knowledge-base.json`

For each unique **brand** in the matrix:
1. Write URL to `brand/url.txt`
2. Run `node v5/scripts/scrape-brand.js`
3. Run `node v5/scripts/generate-course-html.js` (Stitch component kit)
4. Save brand outputs to `v5/output/matrix/{brand-slug}/` (brand-design.md, brand-profile.json, design-contract.json, design-tokens.json, component-patterns/)

This means: 3 topics researched + 3 brands scraped/designed = 6 upstream jobs, NOT 9.

#### Phase 2: Build and QA each combination

For each combination in the matrix (sequentially):

1. **Restore upstream files:** Copy the topic's KB and the brand's design files back to `v5/output/`
2. **Generate course layout:** Run `node v5/scripts/generate-layout.js` (subagent — content + brand voice = unique per combination)
3. **Generate images:** Run `node v5/scripts/generate-images.js`. Real images are required — hero, full-bleed, and graphic-text components layer text over images, so contrast, overlay opacity, and readability can only be tested with actual images. Priority chain: SiliconFlow AI → Pexels stock → SVG placeholder (last resort only).
4. **Build:** Run `node v5/scripts/build-course.js`
5. **QA Gate 6a:** Run `node v5/scripts/qa-course.js`. Log all failures.
6. **QA Gate 6b:** Run `node v5/scripts/qa-interactive.js`. Log all failures.
7. **QA Gate 6c:** Run `node v5/scripts/review-course.js`. READ every screenshot. Log all visual issues.
8. **Save results:** Copy `v5/output/course.html` to `v5/output/matrix/{brand-slug}-{topic-slug}/course.html`

**Do NOT fix bugs during Phase 2.** Log everything, fix nothing. The goal is to see the full picture before touching any code.

#### Phase 3: Classify and fix bugs

After all 3 combinations are complete, compile the bug report:

**Bug classification (mandatory for every bug):**

| Type | Definition | Where to fix |
|------|-----------|--------------|
| **Universal** | Appears in all 3 combinations | Fix once, applies everywhere |
| **Theme-specific** | Appears only in dark OR only in light brands | Fix in colour/contrast handling (build-course.js or generateHead) |
| **Content-specific** | Appears only with certain content shapes (data-heavy, narrative, procedural) | Fix in the relevant fill function or generation-engine.md |
| **Component-specific** | Appears only for one component type regardless of brand/topic | Fix in that component's fill function |

**Fix priority order:**
1. Universal bugs first (highest ROI — one fix, all combinations benefit)
2. Theme-specific bugs (affects 2 of 3 runs)
3. Component-specific bugs
4. Content-specific bugs (lowest priority — may be edge cases)

**Skip-and-log policy:** If a bug resists fixing after 3 attempts, log it with:
- What was tried
- Why it failed
- Suggested next step
Then move on. Do not burn time on stubborn bugs.

#### Phase 4: Verify fixes

After all fixes are applied:
1. Re-run Phase 2 for ALL 3 combinations (not just the one that had the bug)
2. A fix for dark brands could break light brands — always verify the full matrix
3. If new bugs appear, classify and fix them (repeat Phase 3-4)
4. Stop when all 3 combinations pass all 3 QA gates with no errors

#### Phase 5: Summary report

Output a structured summary:

```
## Matrix Test Results

### Combinations tested
1. Crimzon (dark) x Cloud Infrastructure Security — PASS/FAIL
2. FitFlow (light) x High-Stakes Negotiation — PASS/FAIL
3. Sprig (dark) x Emergency First Aid — PASS/FAIL

### Bugs found: N total
- Universal: N (fixed: N, skipped: N)
- Theme-specific: N (fixed: N, skipped: N)
- Component-specific: N (fixed: N, skipped: N)
- Content-specific: N (fixed: N, skipped: N)

### Bugs fixed (with classification)
1. [Universal] Description — fixed in {file}:{line}
2. [Theme-dark] Description — fixed in {file}:{line}
...

### Bugs skipped (with reason)
1. [Component-specific] Description — skipped because: {reason}
...

### Files modified
- v5/scripts/build-course.js: {what changed}
- v5/scripts/hydrate.js: {what changed}
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

9 components have layout variants (21 total implementations). The matrix should cover as many as possible across the 3 runs. After Phase 2, check which variants were used:

| Component | Variants | Goal: covered by at least 1 run |
|-----------|----------|-------------------------------|
| hero | centered-overlay, split-screen, minimal-text | All 3 |
| graphic-text | split, overlap, full-overlay | All 3 |
| bento | grid-4, wide-2, featured | All 3 |
| accordion | standard, accent-border | Both |
| mcq | stacked, grid | Both |
| stat-callout | centered, card-row | Both |
| timeline | vertical, centered-alternating | Both |
| comparison | columns, stacked-rows | Both |
| tabs | horizontal, vertical | Both |

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
