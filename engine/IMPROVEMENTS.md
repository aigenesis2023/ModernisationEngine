# IMPROVEMENTS.md — System Improvement Plan

## THE GOAL

A user inputs a **brand URL** and a **topic**. The engine produces a complete course where:

1. **Every component AND every variant is visually consistent** — switching variants changes layout, not visual language. No variant looks broken compared to another.
2. **The whole course faithfully reflects the brand URL's actual design language** — colors, text-on-color relationships, shapes, typography match the brand. Not what an algorithm invents.
3. **Nothing complicates the authoring layer** — variant swapping, text editing, section management, and JSON export work correctly across all 28 components × 56 variants.

### How we evaluate every change

**Not thorough = not done.** Before any change ships:

- Does it work for **all 28 components × all 56 variants**?
- Does it work for **all 8 archetypes** (4 full + 4 extending)?
- Does it work for **light AND dark brands**?
- Does it work for **monochromatic brands** AND **multi-color brands**?
- Does it affect any **image+text overlay** pattern?
- Does the **authoring layer** still swap variants correctly?
- ~~Is it applied to BOTH rendering paths?~~ ✅ Single rendering path now (Preact only)

---

## ~~CRITICAL ARCHITECTURAL PROBLEM: DUAL RENDERING PATHS~~ ✅ RESOLVED

**This was the #1 issue in the system.** It has been eliminated — see Phase 1 below.

### What's happening

The course has TWO independent rendering engines that must produce identical HTML:

```
Preact SSR components (src/components/*.tsx)
  └─ Renders the ACTIVE variant for each component
  └─ 28 components, TypeScript, reads AR tokens, follows all rules

build-course.js fill functions (28 fillXxx() functions)
  └─ Renders ALL OTHER variants into <template> tags
  └─ Used by authoring panel for variant swapping
  └─ INDEPENDENT CODE that must manually stay in sync with Preact
```

When the user clicks a variant button in the authoring panel, hydrate.js swaps the active HTML with the `<template>` HTML. **If the Preact component and the fill function produce different HTML, the variant swap shows a visually broken version.**

### What went wrong in this session

We fixed the Preact components (AR token wiring, dark scrims, neutral colors, onPrimary). These fixes improved the ACTIVE variant. But the 28 fill functions in build-course.js still have the OLD code. Result: the initially rendered variant looks correct, but every SWAPPED variant shows the unfixed version — hardcoded colors, white scrims, wrong onPrimary, bypassed AR tokens.

**This is not a minor sync issue — it affects every variant of every component that was changed.**

### The proper fix

**Eliminate the dual path.** Make template variants render through Preact too — one rendering engine, one source of truth. The fill functions in build-course.js become dead code and are removed.

**How it works today:**
```
build-course.js calls renderCourseBody() [Preact] → active variant HTML
build-course.js calls fillComponentVariant() [fill functions] → template HTML per variant
```

**How it should work:**
```
build-course.js calls renderCourseBody() [Preact] → active variant HTML
build-course.js calls renderComponentVariant() [Preact] → template HTML per variant
```

This means `renderComponentVariant(comp, variant, AR, ...)` must be exported from the Preact SSR bundle. It renders a single component with a forced variant override. build-course.js calls it once per variant to generate templates.

**When this is done:**
- All 28 fill functions in build-course.js can be deleted (~1600 lines)
- Every fix to a Preact component automatically applies to all variants
- No more sync debt, no more "did you update both paths?"
- The authoring layer works correctly by construction

---

## THE RULES (enforced by the system, not by memory)

### Rule 1: Brand colors are observed, never invented

Every color token comes from the brand's actual CSS, a neutral blend, or error red (the only MD3 token). No invented hues.

### Rule 2: onPrimary is observed from the brand

The engine checks what text color the brand actually puts on primary-colored backgrounds (from extracted CSS). Falls back to WCAG contrast ratio comparison. Mathematically correct for any color.

### Rule 3: Image + text = dark scrim + white text, always

Any component putting text over an image uses `from-black/X` gradients and `text-white`. Applies to Hero (3 variants), FullBleed (3 variants), GraphicText full-overlay, Graphic captioned-card.

### Rule 4: Archetype recipes control SHAPE, tokens control COLOR

Switching brand URL changes colors. Switching archetype changes shape. Independent axes.

### Rule 5: colorStrategy overrides AI suggestions

If brand-spec.json says `accentSectionBg: false`, no section gets `bg-primary`.

### Rule 6: Every component reads from AR

No hardcoded visual classes. Every visual property comes from the archetype recipe with a sensible fallback.

### Rule 7: ONE rendering path

Every component variant is rendered by Preact. No parallel fill functions. A fix to a component applies to all variants automatically.

---

## WHAT'S BEEN DONE (this session — Preact components only)

These fixes are correct in the Preact rendering path. They do NOT yet apply to variant templates (the fill function path). This is the dual-path problem above.

### Token System
- [x] All non-primary tokens are neutral blends (no MD3 hue leak)
- [x] onPrimary observed from CSS, WCAG contrast fallback
- [x] Dark brand blend ratios adaptive (mathematically verified)
- [x] Focus ring uses brand primary (CSS global rule)

### Preact Components
- [x] All 28 components read from AR tokens (zero hardcoded bypasses)
- [x] Image overlays use dark scrim + white text (Hero, FullBleed, GraphicText, Graphic)
- [x] Callout reads per-type AR styling
- [x] MCQ badge uses bg-primary text-on-primary
- [x] Section backgrounds respect colorStrategy

### Phase 1 DONE
- [x] **Dual rendering path eliminated.** All 28 fill functions + `buildSectionsLegacy` + `--legacy` flag deleted from build-course.js (~1912 lines removed). `renderComponentVariant()` in src/render.tsx was already generating all variant `<template>` tags via Preact. Dead helpers (`stripTags`, `sectionOnly`, `mc`) also removed. Build output is byte-for-byte identical (body HTML verified via md5sum). build-course.js: 2927 → 852 lines.

---

## THE PLAN — IN ORDER

### Phase 1: Eliminate dual rendering path ✅ COMPLETE

**Goal:** One rendering engine. All variants rendered by Preact. Fill functions deleted.

**What was done:**
1. `renderComponentVariant()` was already exported from src/render.tsx and generating `<template>` tags
2. build-course.js already used Preact SSR as default — fill functions were only reachable via `--legacy` flag
3. Deleted all 28 `fillXxx()` functions, `fillComponentVariant()`, `fillComponent()`, `buildSectionsLegacy()`, legacy `buildNav()` (~1912 lines)
4. Removed `--legacy` flag, dead helpers (`stripTags`, `sectionOnly`, `mc`)
5. Preserved `CATEGORY_MAP` (needed for authoring panel metadata in build output)
6. Verified: body HTML byte-for-byte identical before/after (only Tailwind CSS compilation order differs)
7. QA: 0 errors in qa-course.js, 38/38 functional tests pass in qa-interactive.js
8. Pre-existing contrast warnings (21) are color token issues, not rendering path issues

**Impact:** Every fix to a Preact component now automatically applies to all variants. No sync debt.

### Phase 2: Brand fidelity QA gate

**Goal:** Automated verification that output matches input. No silent mismatches.

**Steps:**
1. Add to qa-course.js: read design-tokens.json, verify CSS custom properties match
2. Add to qa-interactive.js: verify rendered font-family matches declared fonts (Playwright getComputedStyle)
3. Verify primary/background/onPrimary hex values in output CSS
4. Flag mismatches as errors (not warnings)

### Phase 3: Dark brand end-to-end validation ✅ COMPLETE

**Goal:** Confirm the system works for dark brands by construction, not assumption.

**What was done:**
1. Full pipeline run with Sprig (dark, cyan, #111111 background, #1fd6fa primary, tech-modern archetype)
2. All 30 components (23 types) rendered with readable text and visible borders — verified via 3-gate QA + visual review
3. QA results: 0 errors in structural QA, 0 errors in interactive QA (42 passed), WCAG AA contrast passed for all text
4. No dark-brand-specific bugs found. Adaptive blend ratios, dark scrims, and surface containers all working correctly
5. Minor issues found were content/generation quality (hero empty space, AI-generated image text), not dark-mode rendering

**Additional fixes discovered during Phase 3 validation (branch: improvements2):**

6. **Surface rhythm bug fix (render.tsx):** The substring filter `!cls.includes('bg-surface-container')` was matching `bg-surface-container-lowest` and `bg-surface-container-low`, collapsing ALL sections to the same `bg-surface-dim` shade when `accentSectionBg: false`. Changed to exact match `cls !== 'bg-primary'`. The rhythm was never actually cycling for any non-accent brand.

7. **Section background recalculation for authoring layer:** Added `data-course-section` attribute to non-hero section wrappers in render.tsx. Embedded surfaceRhythm array + accentSectionBg flag as `<script id="surface-rhythm">` JSON block in build-course.js. Added `recalcSectionBackgrounds()` in hydrate.js that reapplies section backgrounds after authoring mutations (add/delete/reorder/add-section).

8. **Section heading visual break:** Section headings now wrapped in `<div class="bg-background">` inside the surface rhythm wrapper, so they visually punch through with the base background color. Creates clear visual separation. Heading width locked to `max-w-6xl` regardless of section width for consistency.

9. **Image generation: no illustrations:** `illustrated` treatment in generate-images.js now maps to `"dramatic low-key lighting, stylised atmosphere"` instead of vector illustration style. Every prompt includes `photorealistic` and negative terms (`no cartoon, no illustration, no anime, no drawing, no sketch, no vector art`).

10. **graphic-text width cap:** Added `graphic-text` to `NEEDS_STANDARD` set in src/utils.ts so it caps at `max-w-6xl` in wide sections.

11. **Review prompt update:** Updated review-course.js to note that minimal-text hero variant intentionally has generous whitespace.

### Phase 4: Font classification refinement

**Goal:** Improve font substitution accuracy for condensed display fonts.

**Steps:**
1. Add "heavy-condensed-display" to Q8 options in brand-spec-audit.md
2. Update font-match prompt to use the new classification

### Phase 5: applicationConstraints enforcement

**Goal:** Validate that output respects brand constraints ("never use shadows on cards" etc.).

**Steps:**
1. Post-build validation reads constraints from brand-spec.json
2. Checks rendered CSS properties against constraint rules
3. Flags violations

---

## FRAGILE AREAS

| Area | Risk | Status |
|------|------|--------|
| **Dual rendering paths** | **CRITICAL** | Phase 1 eliminates this |
| Regex HTML parsing in qa-course.js | Medium | Watch point |
| Quiz feedback class names in hydrate.js | Low | Watch point |
| Base64 image embedding (>50MB) | Medium | Watch point |
| GSAP CDN dependency (offline) | Medium | Watch point |
| dembrandt CLI timeout (60s) | Medium | Watch point |

---

## WHAT'S WORKING WELL (preserve these)

1. **Pipeline architecture** — clear data contracts, deterministic build
2. **Preact SSR component system** — 28 types, 56 variants, TypeScript, AR-wired
3. **Authoring layer** — variant swap, inline edit, section management, JSON export
4. **Three-gate QA** — structural + interactive + visual review
5. **Neutral blend color system** — no MD3 hue leak, adaptive for light/dark
6. **onPrimary observation** — reads actual brand CSS, WCAG contrast fallback
7. **brand-spec.json** — structured spec encoding WHAT colors and HOW they're used
8. **Archetype recipe system** — 8 archetypes, shape/spacing, inheritance
9. **Image overlay rule** — dark scrim + white text, all components, all variants
10. **Section background enforcement** — colorStrategy overrides AI suggestions

---

*Last updated: 2026-04-01 — Phases 1 + 3 complete (+ additional fixes in improvements2 branch)*
