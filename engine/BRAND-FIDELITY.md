# BRAND-FIDELITY.md — Design Fidelity Between Brand URL and Course Output

> How well does our output reflect the look and feel of the provided brand URL?
> This document tracks the architectural concerns, the proposed rebuild, and implementation progress.

---

## The Core Problem

**The engine is a generative tool that creates a vibe. It needs to be an orchestration tool that respects a brand's established physics.**

We extract WHAT colors a brand has. We do not extract HOW it uses them. Then we feed one color into MD3 (a system designed for app theming, not brand replication), which generates a mathematically harmonious palette that bears limited resemblance to the original brand. Fixed archetype recipes apply these colors blindly — cycling vivid backgrounds onto sections without understanding what content should sit on them.

Every incremental fix for one URL risks making another worse. The architecture needs structural change, not more patches.

---

## Diagnosis: Three Missing Layers

### 1. Missing: Color Extraction (we GENERATE instead of EXTRACT)

**Current:** Brand URL → pick one seed color → MD3 math → 30 computed tokens
**Problem:** MD3 transforms the seed. `#ff4400` → peachy surfaces (`#ffe9e4`). Pure white backgrounds get warm tints. Secondary/tertiary colors are mathematically invented, not extracted from the brand. The output uses colors the brand never uses.

**Industry pattern:** monday.com's design-to-code pipeline uses a token fetcher that maps raw design values to semantic tokens — it doesn't generate new colors from a seed. Tools like Style Dictionary transform extracted primitives into platform-specific tokens without distorting them.

**What we need:** Extract the brand's actual color roles directly. White background stays `#ffffff`. Orange accent stays `#ff4400`. No mathematical transformation.

### 2. Missing: Color Application Rules (HOW colors are used)

**Current:** Archetype recipes define SHAPE (borders, radii, shadows) but are COLOR-BLIND. `surfaceRhythm` blindly cycles `bg-primary` onto sections. The `.bg-primary` CSS cascade flips all descendant text to white.

**Problem observed (Rep Republic):**
- Brand: orange section → white cards with dark text inside, heavy headings, orange icons on white
- Engine: orange section → all text flips white, thin body copy on vivid orange, icons invisible (orange on orange)

**What we need:** A structured spec that encodes color strategy — does text sit directly on accent backgrounds? Do cards float on colored sections? Is primary used for containers or only for small accents?

### 3. Missing: Semantic Token Layer (Primitive → Semantic → Component)

**Current token hierarchy:**
- Primitive: MD3 hex values (`#ff4400`, `#ffe9e4`)
- Semantic: MD3 role names (`primary`, `surface-container`)
- Component: Archetype recipes (`mcq.cardBg`, `tabs.activeTabBg`)

**Problem:** The semantic layer is MD3's semantic layer, designed for app theming from scratch. It doesn't have roles like "accent-section-background" or "card-on-accent-surface" — the functional color behaviors real brands use.

**Industry pattern:** Token aliasing with three levels — Primitive (`#0052CC`), Semantic (`color.primary`), Component (`button.primary.bg`). Semantic tokens describe functional roles: `background-inverted` for dark surfaces, `background-muted` for low-emphasis. This tells the engine exactly when a color acts as a container vs a content surface.

---

## Proposed Architecture: Extract → Spec → Map → Build

Replace "generation from seed" with "extraction and mapping":

```
Brand URL
  │
  ├─ Playwright screenshot
  ├─ CSS extraction (getComputedStyle + CSS variables)
  │
  ▼
EXTRACTION TIER (scrape-brand.js — enhanced)
  ├─ Raw primitives: actual hex colors, actual fonts, actual radii, actual border widths
  ├─ Color roles observed: which colors appear as backgrounds, accents, text, icons
  ├─ Tooling (verified available):
  │   ├─ dembrandt — CLI extracting tokens from any URL into W3C DTCG JSON
  │   │   (groups colors by "confidence" — distinguishes logo colors vs border colors)
  │   ├─ BRANDr API — Puppeteer-based branding color extraction by usage patterns
  │   └─ Fallback: enhance our Playwright getComputedStyle extraction directly
  ├─ Output format: W3C DTCG JSON standard (machine-readable, AI-agent-consumable)
  │
  ▼
STRUCTURED DESIGN SPEC (brand-spec.json — NEW artifact, replaces prose brand-design.md for build)
  ├─ Produced by Vision AI answering 14 structured questions about the screenshot
  ├─ Machine-readable JSON, not prose
  ├─ Encodes:
  │   ├─ Color mapping: brand background → our background, brand accent → our primary
  │   ├─ Application rules: "primary used as section bg? cards on accent sections? text directly on accent?"
  │   ├─ Typography character: "heavy condensed display" vs "light geometric sans"
  │   ├─ Surface treatment: "flat solid" vs "glassmorphic" vs "soft shadow"
  │   ├─ Image treatment: "dramatic low-key" vs "bright airy" vs "monochrome"
  │   └─ Shape language: border-radius, border-width, shadow depth
  ├─ Deterministic once produced — just JSON flags, no generative AI downstream
  │
  ▼
TOKEN MAPPING (generate-design-tokens.js — refactored)
  ├─ NO MD3 seed-to-palette generation
  ├─ Semantic mapping via Style Dictionary pattern (token aliasing):
  │   ├─ Primitive: extracted hex values (brand's actual colors)
  │   ├─ Semantic: functional roles (background, background-inverted, background-muted,
  │   │   accent-surface, card-surface, on-accent, on-background)
  │   └─ Component: per-component tokens resolved from semantic layer
  ├─ Map extracted brand colors directly to our token roles:
  │   ├─ Brand's dominant background → --color-background
  │   ├─ Brand's accent color → --color-primary (preserved exact hex)
  │   ├─ Brand's secondary accent (if extracted) → --color-secondary (not MD3-computed)
  │   ├─ Brand's actual surface colors → --color-surface-container etc. (not tinted)
  │   └─ MD3 only for gaps: error, outline-variant, container hierarchy (if brand has one bg only)
  ├─ Font resolution (unchanged — Google Fonts check + subagent match)
  ├─ Output: design-tokens.json with real brand colors
  │
  ▼
ADAPTIVE RECIPES (visual-archetypes.json — refactored to logic-gated)
  ├─ Archetypes still control SHAPE: borders, radii, shadows, spacing, typography weight
  ├─ Color APPLICATION driven by applyColorStrategy(brandSpec):
  │   ├─ Recipes no longer hardcode color classes — they call a function
  │   │   that reads brand-spec.json flags and returns the correct classes
  │   ├─ If "accentSectionBg: true" + "cardsOnAccentBg: true":
  │   │     surfaceRhythm includes bg-primary sections, but components inside
  │   │     render in neutral cards (bg-background) with dark text
  │   ├─ If "accentSectionBg: true" + "cardsOnAccentBg: false":
  │   │     content sits directly on primary (only heavy text — headings, stats)
  │   ├─ If "accentSectionBg: false":
  │   │     primary used only for buttons, icons, accent borders, stat numbers
  │   │     sections use neutral surface rhythm only
  │   └─ Icon color adapts: on neutral bg → primary, on primary bg → on-primary
  ├─ Output: course.html with brand-faithful color application
  │
  ▼
BUILD (build-course.js + render.tsx — adjusted)
  ├─ Reads brand-spec.json for color application decisions
  ├─ surfaceRhythm becomes context-aware (respects cardsOnAccent flag)
  ├─ render.tsx wraps components in neutral card containers on accent sections
  │   (components themselves never change — composition, not inheritance)
  ├─ buildTailwindCSS() resolves brand-spec.json into CSS variables via @theme:
  │   ├─ Colors: extracted hex → --color-* variables (no MD3 distortion)
  │   ├─ Shape: brand-spec overrides archetype via cascade precedence
  │   │   (brand "physics" always wins over archetype "vibe")
  │   ├─ Constraints: shadowDepth: "none" → --shadow-*: none (global mute)
  │   ├─ Typography: uppercaseHeadings → --heading-transform: uppercase
  │   └─ Pairing: functional tokens (on-accent-foreground) resolved from extracted pairs
  └─ Components are "dumb" structural blocks — they consume resolved CSS variables
      and never need to know about brand-spec.json
```

### The Orchestrator-First Principle
Components are "dumb" reusable structural blocks. They consume resolved CSS variables (`--color-primary`, `--shadow-card`, `--heading-transform`) and never know about brand-spec.json. The build system is the orchestrator — it reads brand-spec.json and resolves all variables BEFORE components render. All brand intelligence lives in `buildTailwindCSS()` and `render.tsx`, not in the 28 component files.

### What This Preserves
- Deterministic build — once brand-spec.json is produced, everything downstream is pure JSON → HTML
- Archetype recipes — still control base shape/structure, still 8 types (brand-spec overrides via CSS cascade precedence)
- Component library — 28 types, all variants, zero changes (structural traits are stable)
- Preact SSR + Tailwind v4 — build pipeline unchanged (Tailwind v4 @theme is the multi-brand bridge)
- Authoring layer — unaffected (variant swap, edit, reorder, export all work on structural DOM)

### What This Changes
- **MD3 is demoted or removed** — no longer generates the palette; at most fills gaps where brand has no explicit value
- **brand-spec.json is the new contract** — structured, machine-readable, produced once during scraping
- **Recipes use composition over inheritance** — no more hardcoded Tailwind classes in JSON; recipes are functions that accept brand-spec.json and return adaptive CSS. Shape comes from the archetype, color comes from the spec.
- **Vision AI has a clear, bounded role** — answers 14 structured questions, not free-form prose
- **Tokens are a DAG, not a flat list** — primitives (extracted hex) → semantic roles (background, accent-surface) → component tokens (mcq.cardBg). A change to a primitive ripples through the graph consistently. `pairingLogic` in brand-spec.json enforces accessible foreground/background pairs at every level.

### The MD3 Decision

**Recommendation: Demote MD3 to gap-filler, not palette generator.**

- Use extracted brand colors directly for: background, primary, surfaces, secondary (if available)
- Use MD3 only to compute tokens the brand doesn't explicitly provide: error colors, outline variants, container hierarchy (if brand uses only one background color)
- This preserves MD3's value (accessible color math for gaps) without its cost (transforming colors the brand already defines)

---

## Structured Design Spec — Proposed Schema

The `brand-spec.json` artifact. Produced by Vision AI during scraping. Consumed by token mapping and build.

```json
{
  "colors": {
    "background": "#ffffff",
    "backgroundAlt": "#f5f5f5",
    "primary": "#ff4400",
    "secondary": null,
    "onPrimary": "#ffffff",
    "onBackground": "#090909",
    "cardSurface": "#ffffff",
    "cardBorder": "#e0e0e0"
  },
  "colorStrategy": {
    "accentSectionBg": true,
    "cardsOnAccentBg": true,
    "primaryForIcons": true,
    "primaryForStatNumbers": true,
    "primaryForButtons": true,
    "textDirectlyOnAccent": false,
    "accentSectionFrequency": 3
  },
  "typography": {
    "headlineCharacter": "heavy-condensed",
    "bodyCharacter": "clean-lightweight",
    "headlineWeight": 700,
    "bodyWeight": 400,
    "uppercaseHeadings": true
  },
  "shape": {
    "borderRadius": "sharp",
    "borderWidth": "thick",
    "shadowDepth": "none",
    "surfaceStyle": "flat-solid"
  },
  "imageStyle": {
    "treatment": "dramatic-low-key",
    "colorTemp": "warm",
    "contrast": "high"
  },
  "pairingLogic": {
    "background": "onBackground",
    "primary": "onPrimary",
    "cardSurface": "onBackground",
    "accentSectionBg": "onPrimary"
  },
  "applicationConstraints": [
    "Never place body text directly on accent backgrounds",
    "Never use shadows on buttons",
    "Never use gradients — flat solid surfaces only"
  ],
  "archetype": "neo-brutalist",
  "isDark": false
}
```

### How brand-spec.json is Produced

brand-spec.json merges THREE data sources — it is NOT purely Vision AI output:

1. **CSS extraction** (ground truth for hex values) — background, primary, secondary, onBackground, isDark, font weights, border radii, shadows. These come from extracted-css.json which already exists.
2. **Vision AI** (ground truth for design strategy) — a **Technical Design Audit**: 14 structured questions about HOW colors/type/images are used. Answers colorStrategy flags, archetype, surface style, image treatment, contrast, application constraints.
3. **Computed** (derived from the above) — onPrimary (from primary luminance), pairingLogic (from color pairs), backgroundAlt (step from background).

**Vision AI does NOT guess hex values.** CSS extraction provides colors. Vision AI provides strategy and classification only. See Phase 1 implementation section below for full data source mapping, the 13 Vision AI questions, and the subagent workflow.

This replaces the current combination of: `extracted-css.json` (too raw), `brand-design.md` (too loose), `design-tokens.json` (MD3-distorted colors), and the archetype classification (shape only).

**brand-design.md is kept** — but only for voice calibration in content generation (Step 2). It is NOT used by the build system. The build system reads brand-spec.json.

---

## Pre-Implementation Audit (2026-03-31)

Issues identified during comprehensive audit. Must be addressed during the relevant phase.

### AUDIT 1 — Components read AR class strings, not CSS variables
66 occurrences across 9 component files read `AR.surface.card`, `AR.mcq.choiceBg`, `AR.bento.cardBgs` etc. These are Tailwind CLASS NAMES in the archetype recipe JSON, not CSS variables. The doc says "components consume CSS variables" but that's the target state, not reality.
**Resolution:** `applyColorStrategy(brandSpec)` populates AR with the correct classes BEFORE render. AR stays the component interface — its VALUES change based on brand-spec.json, but components still read `AR.*` exactly as today. Zero component changes.

### AUDIT 2 — `.bg-primary` CSS cascade must be card-aware
theme-template.css `.bg-primary` overrides `--color-on-surface` and all surface tokens to white-on-primary for ALL descendants. When `cardsOnAccentBg: true`, neutral cards inside accent sections need these variables RESET to normal values.
**Resolution (Phase 3):** Add a `.card-on-accent` reset class or restructure `.bg-primary` cascade to not affect nested card containers.

### AUDIT 3 — Archetype classification moves from Step 3 to Step 1
Currently: separate subagent classifies archetype during generate-design-tokens.js. New plan: brand-spec.json (produced in scrape-brand.js) contains the archetype. This eliminates the archetype subagent workflow (write prompt → subagent → archetype-match.json → --archetype-ready flag).
**Resolution:** Vision AI prompt includes archetype classification as question 12 of 13.

### AUDIT 4 — extracted-css.json should be KEPT, not replaced
brand-spec.json is the structured interpretation. extracted-css.json is the raw data. generate-design-tokens.js should read BOTH — brand-spec.json for colors/strategy, extracted-css.json for font data and cross-validation.
**Resolution:** Don't delete extracted-css.json from the pipeline.

### AUDIT 5 — accentSectionFrequency needs a concrete algorithm
Schema says `"every-3rd"` but render.tsx needs an unambiguous rule. What's the starting section? How does it handle courses with 5 vs 20 sections?
**Resolution (Phase 1):** Define as a number (e.g., `3` = every 3rd non-hero section gets accent bg). render.tsx applies `(sectionIndex - 1) % frequency === 0`.

### AUDIT 6 — Dark mode surface hierarchy
The surface hierarchy generator (Phase 2) must work in both directions: lighter steps from dark base (dark brands), darker steps from light base (light brands). Plan doesn't address this explicitly.
**Resolution (Phase 2):** Build bidirectional stepper. `isDark` from brand-spec.json selects direction.

### AUDIT 7 — qa-course.js validates current token structure
QA checks design-tokens.json for color tokens and archetype. If token structure changes, QA fails.
**Resolution (Phase 2):** Update qa-course.js alongside token refactor.

### AUDIT 8 — generate-images.js reads brand-design.md not brand-spec.json
Image treatment needs to flow from brand-spec.json imageStyle, not prose.
**Resolution (Phase 4):** Already planned.

### AUDIT 9 — test-multi-brand.js references current artifacts
11 references to design-tokens.json, brand-profile.json etc. Needs updating if artifact structure changes.
**Resolution (Phase 4):** Update alongside multi-brand validation.

### AUDIT 10 — BUILD-SYSTEM.md describes old architecture
Still says "MD3 palette" and "archetype recipes control DESIGN: colours". Will confuse new chats implementing Phases 2-3.
**Resolution:** Add a rebuild notice at top pointing to BRAND-FIDELITY.md. Full rewrite after Phase 3.

### AUDIT 11 — RenderContext type needs brandSpec
`types.ts` RenderContext has `AR`, `isDark`, `embedImage`. If render.tsx needs brand-spec.json for card-wrapping decisions, either add `brandSpec` to context OR resolve everything into AR before render.
**Resolution:** Resolve into AR (per AUDIT 1). If surfaceRhythm logic needs colorStrategy flags directly, add them to RenderContext in Phase 3.

### AUDIT 12 — Legacy fill functions (build-course.js ~lines 700-2400)
Legacy string-template path behind `--legacy` flag. Do not update — it's not the active path. Don't waste time on 1700 lines of dead code.

---

## Observed Problems (Rep Republic, 2026-03-31)

Side-by-side comparison of brand URL vs our output:

| # | Problem | Brand URL | Our Output |
|---|---------|-----------|------------|
| OBS 1 | Thin text on vivid orange | Heavy headings only on orange; body text on white cards | All text flips white; thin body copy directly on orange |
| OBS 2 | Cards inherit orange | White cards float on orange section backgrounds | Cards inherit orange bg; text forced white |
| OBS 3 | Peachy surface tints | Crisp pure white `#ffffff` | MD3 warm peach `#ffe9e4` |
| OBS 4 | Font substitution | Clash Grotesk (heavy condensed display) | Barlow (standard geometric sans) |
| OBS 5 | Icons invisible on orange | Orange icons on white backgrounds | Orange icons on orange bg = invisible |

Root cause of OBS 1, 2, 5: surfaceRhythm applies `bg-primary` without color application rules. Solved by `brand-spec.json` flags (`cardsOnAccentBg: true`, `textDirectlyOnAccent: false`).

Root cause of OBS 3: MD3 palette generation. Solved by extracting brand's actual background colors.

Root cause of OBS 4: Font matching quality. Separate concern — improve subagent prompt for condensed/display typeface matching.

---

## Known Technical Gaps

| # | Gap | Impact | Where |
|---|-----|--------|-------|
| 1 | Font substitution quality | High | `generate-design-tokens.js` + `font-match-prompt.txt` |
| 2 | MD3 surface tint | High | `generate-design-tokens.js` — addressed by proposed architecture |
| 3 | Single seed color | High | `pickSeedColor()` — addressed by direct extraction |
| 4 | No gradient extraction | Medium | `scrape-brand.js` sample() |
| 5 | No border width/style extraction | Medium | `scrape-brand.js` sample() |
| 6 | Limited accent color sampling | Medium | `scrape-brand.js` summary generation |
| 7 | Pseudo-element blindness | Low | `scrape-brand.js` selector strategy |
| 8 | Google Fonts weight range (300-700 only) | Low-Med | `generateHeadV4()` in `build-course.js` |
| 9 | Image treatment not flowing through | Medium | `brand-profile.json` → not consumed |
| 10 | Button shape not flowing through | Low | `extracted-css.json` → not consumed by recipe |

---

## Implementation Phases

### Phase 1: Structured Design Spec (SCHEMA IS THE PRIORITY)
The schema is the hard part. If the schema is wrong, everything downstream is wrong. If the schema is right, Phases 2-4 are just plumbing. Focus almost entirely on nailing the application rules (the "how") — hex extraction is just data our Playwright setup already handles.

**No build changes in Phase 1. No changes to generate-design-tokens.js, build-course.js, render.tsx, or any component. Only scrape-brand.js is modified to produce brand-spec.json alongside existing outputs. All existing outputs (extracted-css.json, brand-design.md, brand-profile.json) continue to be produced.**

#### Phase 1 — Data Sources for brand-spec.json

brand-spec.json is NOT produced purely by Vision AI. It merges THREE sources:

| Schema Field | Source | Method |
|---|---|---|
| `colors.background` | CSS extraction | Most frequent backgroundColor from extracted-css.json backgrounds |
| `colors.backgroundAlt` | CSS extraction | 2nd most frequent backgroundColor, or computed (slight step from bg) |
| `colors.primary` | CSS extraction | Top accent color from extracted-css.json accentColors |
| `colors.secondary` | CSS extraction | 2nd accent color, or null |
| `colors.onPrimary` | Computed | Luminance of primary: dark primary → `#ffffff`, light primary → `#1a1a1a` |
| `colors.onBackground` | CSS extraction | Most frequent heading/paragraph text color |
| `colors.cardSurface` | Vision AI + CSS | Vision AI observes card backgrounds; CSS cross-validates |
| `colors.cardBorder` | CSS extraction | Border color from card elements, or null |
| `colorStrategy.*` | **Vision AI** | Structured questions about HOW colors are used |
| `typography.headlineCharacter` | Vision AI | Observed from screenshot |
| `typography.headlineWeight` | CSS extraction | Average heading fontWeight from extracted-css.json |
| `typography.bodyWeight` | CSS extraction | Average paragraph fontWeight |
| `typography.bodyCharacter` | Vision AI | Observed from screenshot |
| `typography.uppercaseHeadings` | Vision AI + CSS | Vision AI observes; CSS can verify text-transform |
| `shape.borderRadius` | CSS extraction | Mapped from dominantBorderRadius (0-4px=sharp, 5-12px=rounded, 13px+=pill) |
| `shape.borderWidth` | CSS extraction | Inferred from card/button border presence and width |
| `shape.shadowDepth` | CSS extraction | Mapped from dominantShadow (null=none, small=flat, medium=soft, large=deep) |
| `shape.surfaceStyle` | Vision AI | flat-solid / glassmorphic / gradient |
| `imageStyle.*` | Vision AI | Observed from screenshot photography |
| `pairingLogic` | Computed | Derived from extracted color pairs (bg→text, primary→onPrimary) |
| `applicationConstraints` | Vision AI | "Never" rules observed from screenshot |
| `archetype` | Vision AI | Classification into 8 types (replaces current archetype subagent) |
| `isDark` | CSS extraction | Already computed by scrape-brand.js theme detection |

#### Phase 1 — Files to Create/Modify

1. **CREATE `engine/schemas/brand-spec.schema.json`** — formal JSON Schema for validation
2. **CREATE `engine/prompts/brand-spec-audit.md`** — Vision AI structured prompt (standalone .md per project convention — prompts never hardcoded in scripts)
3. **MODIFY `engine/scripts/scrape-brand.js`** — add brand-spec.json production:
   - After CSS extraction: compute all CSS-derived fields (colors, shape, isDark, typography weights)
   - Write `engine/output/brand-spec-prompt.txt` with: screenshot path + CSS-derived data + structured questions for Vision AI
   - Exit (subagent pattern — same as current archetype workflow)
   - On re-run with `--spec-ready` flag: read `engine/output/brand-spec-vision.json` (subagent output), merge with CSS-derived data, cross-validate, write final `engine/output/brand-spec.json`
4. **OUTPUT `engine/output/brand-spec.json`** — the new artifact

#### Phase 1 — Vision AI Prompt (what the subagent answers)

The prompt provides the screenshot + CSS-extracted data (so Vision AI doesn't guess hex values that CSS already knows). Vision AI answers ONLY what requires visual observation:

1. Does the brand use its accent color as full-width section backgrounds? (yes/no)
2. When accent sections appear, does content sit in cards/containers or directly on the color? (cards/direct/none)
3. Does text appear directly on accent backgrounds? (none/headings-only/all)
4. What is the primary accent color's role? (buttons-only / buttons-and-icons / section-backgrounds-and-buttons)
5. Is there content that uses the accent as stat/number highlights? (yes/no)
6. How frequently do accent sections appear? (number — e.g., every 2nd, 3rd, 4th section, or 0 for never)
7. What is the surface style? (flat-solid / glassmorphic / soft-shadow / gradient)
8. What is the headline typography character? (heavy-condensed / bold-geometric / light-elegant / standard-sans / serif)
9. Are headings uppercase? (yes/no)
10. What is the image/photography treatment? (dramatic-dark / bright-airy / monochrome / illustrated / none)
11. What is the image color temperature? (warm / cool / neutral)
12. Which visual archetype best matches? (tech-modern / minimalist / editorial / glassmorphist / corporate / warm-organic / neo-brutalist / luxury)
13. What is the overall visual contrast level? Consider text-to-background contrast, color intensity, and whether the design uses high-contrast pairings or muted/low-contrast treatments. (high / medium / low)
14. List any "never" rules observed (e.g., "no shadows", "no gradients", "no body text on accent"). Return as JSON array.

The subagent reads the screenshot with the Read tool, answers in strict JSON, writes to `engine/output/brand-spec-vision.json`.

#### Phase 1 — API Model

When `ANTHROPIC_API_KEY` is set, scrape-brand.js calls the Claude API directly for the Vision AI structured audit. Use `claude-sonnet-4-20250514` — this is a classification/observation task (not complex reasoning), so Sonnet is appropriate and cost-effective.

#### Phase 1 — Cross-Validation

After merging CSS data + Vision AI answers, scrape-brand.js cross-validates:
- If Vision AI says `accentSectionBg: false` but CSS found primary color as a backgroundColor on sections → flag warning
- If Vision AI says `isDark: true` but CSS theme detection says light → use CSS (ground truth for luminance)
- If Vision AI picks colors that don't appear in CSS extraction → flag warning, prefer CSS values

#### Phase 1 — Test Protocol

Run against 3+ brands. For each brand:
1. Run `node engine/scripts/scrape-brand.js` (produces extracted-css.json + writes prompt)
2. Spawn subagent to answer Vision AI questions → brand-spec-vision.json
3. Re-run `node engine/scripts/scrape-brand.js --spec-ready`
4. Read brand-spec.json and manually verify against the brand URL:
   - Are the colors correct?
   - Are the colorStrategy flags accurate?
   - Is the archetype reasonable?
   - Do applicationConstraints match what you see?

Test brands: rep-republic (vivid orange, neo-brutalist), sprig (dark, cyan, tech-modern), coursesite (light, lavender, editorial/minimalist)

**Exit criteria:** brand-spec.json is accurate for 3 diverse brands. All fields populated. No build changes made.

### Phase 2: Direct Color Extraction (Replace MD3)
- Refactor `generate-design-tokens.js` to map extracted colors → token roles
- Demote MD3 to gap-filler for missing tokens only
- Brand's actual backgrounds, accents, surfaces → design-tokens.json
- Test: do surfaces match the brand's actual backgrounds?

### Phase 3: Adaptive Color Application
- Refactor surfaceRhythm in `render.tsx` to read `colorStrategy` flags
- When `cardsOnAccentBg: true`, components on primary sections render in neutral cards
- When `textDirectlyOnAccent: false`, only headings/stats appear on accent bg
- Test: does the Rep Republic output match the brand's card-on-orange pattern?

### Phase 4: Shape/Typography Refinement
- Ensure archetype recipes drive shape only (not color strategy)
- Improve font substitution for condensed/display faces
- Expand font weight range to 100-900
- Flow image treatment into generate-images.js prompts

### Multi-Brand Validation (after each phase)
Test brands: sprig (dark, cyan), fluence (light, amethyst), fitflow (light, pink-blue gradient), crimzon (dark, crimson), coursesite (light, lavender-purple), rep-republic (light, vivid orange neo-brutalist)

Score: side-by-side brand URL vs course output. Focus on: color accuracy, typography character, surface treatment, color application patterns.

---

## Work Log

| Date | Change | Phase | Status |
|------|--------|-------|--------|
| 2026-03-31 | Architecture analysis + BRAND-FIDELITY.md created | Planning | Complete |
| 2026-03-31 | Proposed architecture: Extract → Spec → Map → Build | Planning | **APPROVED** |
| 2026-03-31 | Pre-implementation audit: 12 issues found, all documented above | Planning | Complete |
| 2026-03-31 | Decisions: 14 questions (Q13=contrast added), Sonnet for API mode | Planning | Complete |
