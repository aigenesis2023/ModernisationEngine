# IMPROVEMENTS.md — Full Engine Audit + Brand Fidelity Review

> Comprehensive audit conducted 2026-04-01. Covers all moving parts, interdependencies, and a special deep-dive on brand fidelity accuracy.

---

## PART 1: FULL ENGINE AUDIT

### Overview

The ModernisationEngine is a ~14,500-line pipeline across 11 scripts, 28 Preact SSR components, 8 archetype recipes, and a 2,556-line vanilla JS authoring/hydration layer. It transforms a topic + brand URL into a single-file, agency-quality eLearning course with an embedded authoring panel.

---

### A. Pipeline Health (End-to-End)

| Step | Script | LOC | Status | Fragility |
|------|--------|-----|--------|-----------|
| 1. Research | `engine/scripts/research-content.js` | ~364 | Stable | Medium — 6 hardcoded query templates, 3000-char cap can truncate |
| 2. Brand Scrape | `engine/scripts/scrape-brand.js` | ~1200 | Active refactor | High — 3-source cascade, Vision AI optional, dembrandt timeout 60s |
| 3. Course Gen | `engine/scripts/generate-layout.js` | ~254 | Stable | Low — pure prompt assembly + subagent |
| 4. Design Tokens | `engine/scripts/generate-design-tokens.js` | ~400+ | Active refactor | Medium — dual pipeline (brand-spec vs MD3 legacy) |
| 5. Images | `engine/scripts/generate-images.js` | ~568 | Stable | High — API rate limits, 3s delay between requests |
| 6. Vite Build | `vite.config.ts` | ~20 | Stable | Low |
| 7. HTML Build | `engine/scripts/build-course.js` | ~1600+ | Stable | High — largest script, base64 embedding can hit 50MB |
| 8. Structural QA | `engine/scripts/qa-course.js` | ~600+ | Stable | Medium — regex HTML parsing |
| 9. Interactive QA | `engine/scripts/qa-interactive.js` | ~700+ | Stable | Medium — hardcoded selectors |
| 10. Visual Review | `engine/scripts/review-course.js` | ~284 | Stable | Low — screenshot capture only |
| Runtime | `engine/scripts/hydrate.js` | ~2556 | Stable | Low-Medium |

### B. Critical Interdependencies

```
research-content.js --> knowledge-base.json --> generate-layout.js --> course-layout.json
                                                                              |
scrape-brand.js --> extracted-css.json --> generate-design-tokens.js           |
                |-> brand-spec.json ----> generate-design-tokens.js --> design-tokens.json
                |-> brand-design.md ----> generate-layout.js (voice)          |
                '-> brand-profile.json -> generate-layout.js                  |
                                                                              |
generate-images.js <-- course-layout.json -----------------------------> build-course.js
                  '-> images/*.jpg ------------------------------------> build-course.js
                                                                              |
visual-archetypes.json ------------------------------------------------> build-course.js
theme-template.css ----------------------------------------------------> build-course.js
hydrate.js -------------------------------------------------------------> build-course.js (embedded)
                                                                              |
                                                                              v
                                                                        course.html + index.html
```

**Single points of failure:**
- `brand-spec.json` missing: entire pipeline falls back to MD3 colors (legacy path)
- `design-tokens.json` missing: build-course.js cannot run
- Image generation API down: SVG placeholders (graceful but ugly)
- Playwright unavailable: scrape, interactive QA, and visual review all fail

### C. Component System Assessment

**28 components, 56 variants across 7 categories.** The Preact SSR system is production-grade.

| Metric | Score | Detail |
|--------|-------|--------|
| AR token adoption | ~70% | 7 components hardcode colors (ProcessFlow, Timeline, Narrative, Branching, Flashcard, Callout, FullBleed) |
| Container queries | ~40% | Hero, GraphicText, Bento, Accordion, MCQ, Tabs use @container; 22 components don't |
| Dark mode support | Incomplete | `isDark` context exists but NO component branches on it; Hero/FullBleed hardcode `text-white` |
| Accessibility | Basic | No ARIA roles/labels, no keyboard nav, form inputs lack labels |
| Normalization | Complete | `normalizeComponent()` handles all 28 types with _items mapping |

#### Component Token Adoption Tiers

**Tier 1 — Fully parameterized via AR (best):**
Hero, Bento, Accordion, MCQ

**Tier 2 — Partially parameterized (good):**
Tabs, Timeline, Comparison, StatCallout, Pullquote, Checklist, Flashcard, KeyTerm, Branching

**Tier 3 — Hardcoded colors (poor):**
ProcessFlow (`text-secondary`, `border-secondary`, `text-primary`, `border-primary`), Callout (icon/color map hardcoded), Branching (`bg-primary/10`), Flashcard (`bg-secondary-container`), Narrative (`text-secondary`, `bg-secondary`), FullBleed (`text-white`, `bg-black/60`)

**Tier 4 — No AR integration (limited):**
DataTable, TextInput, PathSelector, Graphic, Media, VideoTranscript, ImageGallery, LabeledImage, Divider

#### Component Audit Matrix

| Component | Variants | AR Tokens | @Container | Dark Mode |
|-----------|----------|-----------|------------|-----------|
| hero | 3 | Excellent | Partial | Not implemented |
| text | 3 | None | Yes | Yes |
| accordion | 2 | Good | Partial | Yes |
| mcq | 2 | Excellent | Yes | Yes |
| graphic-text | 3 | Basic | Excellent | Yes |
| tabs | 2 | Good | Partial | Yes |
| bento | 3 | Excellent | Good | Yes |
| data-table | 2 | None | No | Yes |
| textinput | — | Basic | Partial | Yes |
| path-selector | — | Basic | No | Yes |
| branching | 2 | Basic | No | Hardcoded |
| timeline | 2 | Basic | No | Hardcoded |
| comparison | 2 | Basic | No | Hardcoded |
| stat-callout | 2 | Basic | No | Yes |
| pullquote | 3 | Basic | No | Yes |
| checklist | 3 | Basic | No | Yes |
| flashcard | 2 | Basic | No | Hardcoded |
| narrative | 2 | Basic | No | Hardcoded |
| key-term | 2 | Basic | No | Yes |
| full-bleed | 3 | None | No | Not implemented |
| graphic | 2 | None | No | Yes |
| process-flow | 2 | None | No | Hardcoded |
| media | — | None | No | Yes |
| video-transcript | — | None | No | Yes |
| image-gallery | — | None | No | Yes |
| labeled-image | 2 | None | No | Yes |
| divider | 3 | None | No | Yes |
| callout | 4 | None | No | Hardcoded |

### D. Authoring Layer Assessment

Phase 4 complete. Architecture is sound and production-ready.

**Working features:**
- Variant swapping via pristine template cloning + re-hydration
- Inline text editing with immediate JSON sync (contenteditable + data-edit-path)
- Section management: reorder (flatten-swap-rebuild), add (template library, 28 types), delete (with confirm)
- JSON export of modified course-layout.json

**Interactivity (hydrate.js):**
- MCQ: select, submit, feedback (green/red), retry
- Tabs: trigger/panel switching, class-based activation
- Flashcards: 3D rotateY flip with touch support
- Carousel/Narrative: prev/next/dots, slide counter
- Accordion: native details/summary with custom CSS
- Checklist: checkbox + icon toggle, progress counter
- Branching: selection with opacity dimming
- Scroll progress bar, nav drawer, section progress tracking
- GSAP animations: fade-up, slide-in, scale, parallax, stat counters, text reveals
- Reduced motion support

**Gaps:**
- No undo/redo for authoring edits
- No paste sanitization for contenteditable (HTML injection risk)
- Type swap awaits Phase 4b client-side rendering
- Quiz feedback detection relies on hardcoded class names (`border-[#22c55e]`)

### E. Schema & Prompt Assessment

| Schema/Prompt | Status | Issues |
|---------------|--------|--------|
| `course-layout.schema.json` | Complete, well-aligned | Never validated programmatically (ajv); VALID_TYPES hardcoded in validate-layout.js |
| `knowledge-base.schema.json` | Clean | No programmatic validation |
| `component-library.json` | All 28 types | Informational only; not loaded at build time |
| `visual-archetypes.json` | 8 archetypes | Only ~20 of 28 components have per-archetype tokens; 8+ components have no visual archetype customization |
| `research-agent.md` | Correct | Aligned with KB schema |
| `generation-engine.md` | Comprehensive | Minor contradiction: "12+ types" vs "10 acceptable"; narrative vs visual archetype distinction not clarified |
| `generation-agent.md` | Correct | Minimal, delegates to generation-engine.md |
| `brand-spec-audit.md` | Complete | 15 structured questions; Q8 font classification could be more granular |

**Key schema gaps:**
- No JSON Schema validation pipeline (schemas exist but never loaded by a validator)
- VALID_TYPES array manually maintained in 3 places (risk of drift)
- Narrative archetypes (5 types: journey, case-file, builder, debate, explorer) and visual archetypes (8 types: tech-modern, minimalist, etc.) are independent concepts — prompts don't clarify this relationship

### F. QA System Assessment

| Gate | What it catches | What it misses |
|------|----------------|----------------|
| qa-course.js (12 checks) | Structure, wiring, content coverage, heading hierarchy | No color validation, no font rendering check, no archetype enforcement |
| qa-interactive.js (32 tests) | Interactive functionality, WCAG AA contrast, overflow, mobile | No brand color check, no per-variant testing, no tablet breakpoint (768px) |
| review-course.js (manual) | Subjective design quality | Manual process; no brand-vs-output comparison criteria |

**Critical QA gap:** A course could pass all automated gates with completely wrong brand colors and fallback fonts. No automated check compares output colors against design-tokens.json.

**Other QA gaps:**
- No per-variant interactive testing (tests whatever variant the course uses, not all 56)
- No tablet breakpoint testing (only 1440px desktop + 390px mobile)
- No animation stability testing (GSAP content stuck invisible, stale after swap)
- No ARIA/keyboard accessibility validation
- 5 component types have zero specific tests: media, textinput, branching, path-selector, video-transcript

### G. Hardcoded Values & Magic Numbers

| Location | Value | Purpose |
|----------|-------|---------|
| research-content.js | 6 queries, max_results: 6, time_range: 'year' | Fixed research parameters |
| research-content.js | 3000/5000 chars | Content cap per source |
| scrape-brand.js | 1280x800 viewport | Screenshot size |
| scrape-brand.js | 0.18 luminance, 0.20 saturation | Dark/neutral color thresholds |
| scrape-brand.js | 60s dembrandt timeout | CLI timeout |
| generate-images.js | 1024 max dim, 3000ms delay, 8000ms retry | Image generation limits |
| build-course.js | py-16 (128px) section spacing | Fixed vertical padding |
| hydrate.js | 3px progress bar, #22c55e correct, #ef4444 incorrect | Visual constants |
| qa-interactive.js | 20-80% progress bar range | Acceptable scroll range |
| validate-layout.js | 10-12 min types for AI layouts | Type variety thresholds |

---

## PART 2: BRAND FIDELITY SPECIAL AUDIT

### Current Architecture (Post Phase 5)

```
Brand URL --> scrape-brand.js --> extracted-css.json + brand-spec.json
                                       |
              generate-design-tokens.js reads brand-spec.json
                |-- Primary, background, onPrimary: PRESERVED EXACT HEX
                |-- Surface hierarchy: stepSurface() from background (no MD3)
                |-- Secondary: MD3-generated if brand-spec doesn't provide it
                |-- Tertiary, error, outline: ALWAYS MD3-generated
                |-- Archetype: from brand-spec.json Q12
                '-- Fonts: Google Fonts match with improved prompt
                                       |
              build-course.js reads design-tokens + brand-spec.json
                |-- colorStrategy flags drive section backgrounds
                |-- sectionBg per-section (AI-set, not formula)
                |-- .card-on-accent wrapping when cardsOnAccentBg=true
                |-- data-context="accent" cascade for component tokens
                '-- Archetype recipes drive SHAPE only
```

### Fidelity Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Primary color accuracy | **95%** | Exact hex preserved; only loss is if CSS extraction fails (dembrandt fallback) |
| Background accuracy | **98%** | Direct extraction, no transformation |
| Surface/card colors | **70%** | stepSurface() is clean but computed, not extracted; MD3 tints eliminated |
| Secondary/accent colors | **30%** | MD3-generated; brand's actual secondary never extracted |
| Outline/border colors | **20%** | Always MD3-generated; warm tones from primary seed |
| Font character match | **65%** | Improved prompt; still misclassifies some categories |
| Color application strategy | **85%** | colorStrategy flags work well; accent over-classification fixed |
| Shape/archetype | **80%** | Correct archetype selected; recipes control shape well |
| **Overall brand fidelity** | **~60%** | Primary + background + strategy correct; secondary palette, outlines, fonts still weak |

### What's Working (Fidelity Preserved)

1. **Primary color** — exact hex preserved end-to-end (brand-spec -> design-tokens -> CSS variable -> component)
2. **Background color** — exact hex preserved, no MD3 transformation
3. **Surface hierarchy** — Phase 4a replaced MD3 neutralVariantTone() with stepSurface() from background; no more peach/salmon tinting
4. **Color application strategy** — colorStrategy flags (accentSectionBg, cardsOnAccentBg, textDirectlyOnAccent, frequency) drive section backgrounds correctly
5. **Section backgrounds** — Phase 4b: AI sets sectionBg per section ("accent"/"default"), no formula lock-in
6. **Contextual component tokens** — Phase 4c: data-context="accent" + --ctx-card-bg cascade gives components correct colors in any section context
7. **Card-on-accent wrapping** — Phase 3: components wrapped in neutral cards on accent sections; CSS cascade resets work
8. **Image treatment** — Phase 5: generate-images.js reads brand-spec.json imageStyle (treatment/colorTemp/contrast)
9. **Archetype classification** — Phase 1: Vision AI Q12 during brand scraping, no separate subagent needed
10. **Dark/light detection** — CSS luminance sampling at 6 scroll positions

### What's Still Lost (Fidelity Gaps)

#### GAP 1: Secondary/Tertiary Colors — MD3 Invented (HIGH IMPACT)

**Current state:** brand-spec.json has `"secondary": null`. design-tokens.json has `"secondary": "#77574e"` (MD3-generated warm brown from orange seed). The brand (Rep Republic) doesn't use brown accents anywhere. MD3 invents this from the primary's hue.

**Affected components:** Timeline (dot classes), Branching (button borders), Flashcard (back bg uses `bg-secondary-container`), Narrative (nav text), ProcessFlow (connector/text colors), StatCallout (card-row uses secondary).

**Evidence:** brand primary `#ff4400` (orange) -> MD3 secondary `#77574e` (warm brown) -> brand never uses brown

**Fix:** Add Q16 to Vision AI audit: "What secondary accent colors does the brand use? Return hex or null." Map to `brand-spec.json colors.secondary`. Only use MD3 if truly null.

#### GAP 2: Outline and Surface-Variant — Always MD3 (MEDIUM IMPACT)

**Current state:**
- `"outline": "#85736e"` — MD3 warm brown
- `"outline-variant": "#d8c2bc"` — MD3 warm pink-brown
- `"surface-variant": "#f5ded8"` — MD3 peach

These colors are used for borders, dividers, subtle backgrounds. The warm peachy tones from orange-seeded MD3 create visual warmth the brand doesn't intend. Rep Republic uses pure neutral greys (#e0e0e0 borders, #f5f5f5 surfaces).

**Fix:** Extract outline/border colors from CSS. Map to tokens. Use MD3 only as last resort. For brands with no visible borders, compute neutral grey from background.

#### GAP 3: brand-spec.json Colors Incomplete (HIGH IMPACT)

**Current state:** `"cardSurface": null`, `"cardBorder": null`, `"secondary": null`. Null values force computed fallbacks or MD3 generation.

**Root cause:** Vision AI prompt asks design strategy questions but doesn't ask for card surface hex or border hex. CSS extraction samples card elements but inconsistently.

**Fix:**
1. Improve CSS extraction to reliably sample card backgrounds and borders
2. Add Vision AI questions: "What color are content cards/containers?" and "What color are borders/dividers?"

#### GAP 4: Font Character Misclassification (MEDIUM IMPACT)

**Current state:** Brand uses "Clash Grotesk" (heavy condensed display). Vision AI classified it as "bold-geometric" instead of "heavy-condensed". Font substitution produced "Big Shoulders Display" — which IS condensed (partially correct), but the classification signal was wrong.

**Fix:** Refine Q8 options to distinguish between "condensed" and "geometric": add "heavy-condensed-display" as a separate category from "bold-geometric".

#### GAP 5: 7 Components Hardcode Colors (MEDIUM IMPACT)

These components use `text-primary`, `text-secondary`, `bg-primary/10` etc. directly instead of AR tokens:

| Component | Hardcoded Colors |
|-----------|-----------------|
| ProcessFlow | `text-secondary`, `border-secondary`, `text-primary`, `border-primary` |
| Timeline | `bg-primary`, `text-secondary` |
| Branching | `bg-primary/10`, `text-primary` |
| Flashcard | `text-secondary`, `bg-secondary-container` |
| Narrative | `text-secondary`, `bg-secondary` |
| Callout | hardcoded icon/color map per callout type |
| FullBleed | `text-white`, `bg-black/60` |

When MD3 generates wrong secondary colors, these components display those wrong colors directly, bypassing the AR token system.

**Fix:** Wire all component colors through AR tokens so archetype recipes can control them.

#### GAP 6: No QA Gate for Brand Color Accuracy (HIGH IMPACT)

**Current state:** No automated check compares output colors against design-tokens.json or brand-spec.json. A course could render with completely different colors and pass all QA gates.

**Fix:** Add a "brand fidelity check" to qa-course.js or qa-interactive.js:
1. Read design-tokens.json primary, background, font names
2. Scan course.html CSS for --color-primary, --color-background values
3. Verify rendered font-family matches declared fonts (via Playwright getComputedStyle)
4. Flag mismatches as errors

#### GAP 7: applicationConstraints Not Enforced (LOW-MEDIUM IMPACT)

**Current state:** brand-spec.json contains rich constraints like "Never use shadows on cards" and "Never use gradients". Stored but never validated against the actual output.

**Fix:** Post-build validation that checks applicationConstraints against rendered CSS properties.

#### GAP 8: dembrandt Output Not Fully Utilized (LOW IMPACT)

**Current state:** dembrandt extracts 15+ colors with confidence scores, plus typography, borders, and shadows. Only the highest-confidence chromatic color is used (for primary fallback). The rest is saved to extracted-dembrandt.json but never consumed.

**Fix:** Use dembrandt border/shadow data to cross-validate or improve brand-spec.json shape fields. Use multiple palette colors for secondary extraction.

#### GAP 9: brand-spec.json Only 20% Integrated Into Build (MEDIUM IMPACT)

**Current state:** build-course.js reads colorStrategy from brand-spec.json. But these fields are produced and never consumed:
- `applicationConstraints` — could validate compliance
- `typography.headlineCharacter/bodyCharacter` — not used in build
- `shape.*` — not used (archetype already defines shape)
- `imageStyle.*` — now used by generate-images.js (Phase 5 fix)
- `pairingLogic` — not enforced

**Fix:** Either wire remaining fields into the build/QA pipeline or remove them from the schema to avoid false expectations.

#### GAP 10: Legacy MD3 Path Still Active (MEDIUM IMPACT)

**Current state:** When brand-spec.json doesn't exist, generate-design-tokens.js falls back to full MD3 palette generation from a single seed color. This produces a complete course with mathematically-derived colors bearing limited resemblance to the brand.

**Fix:** Make brand-spec.json required. Remove the MD3 fallback path. If brand-spec.json is missing, error out rather than silently generating wrong colors.

---

## PART 3: PRIORITIZED RECOMMENDATIONS

### Tier 1: Immediate Wins (Highest Impact, Lowest Effort)

| # | Recommendation | Impact | Effort | Area |
|---|---------------|--------|--------|------|
| 1 | **Extract secondary color from CSS/dembrandt** — add to brand-spec.json `colors.secondary` so MD3 doesn't invent it | High | ~2 hrs | Brand Fidelity |
| 2 | **Extract card surface and border colors** — improve CSS sampling for card elements, map to brand-spec.json | High | ~2 hrs | Brand Fidelity |
| 3 | **Compute outline-variant from background** — neutral grey derived from brand background instead of MD3 warm tones | High | ~1 hr | Brand Fidelity |
| 4 | **Add brand fidelity QA check** — verify output colors match design-tokens.json; verify rendered fonts match declared fonts | High | ~3 hrs | QA |

### Tier 2: Short-Term (Medium Effort, Significant Impact)

| # | Recommendation | Impact | Effort | Area |
|---|---------------|--------|--------|------|
| 5 | **Wire 7 components through AR tokens** — eliminate hardcoded colors in ProcessFlow, Timeline, Branching, Flashcard, Narrative, Callout, FullBleed | Medium | ~4 hrs | Components |
| 6 | **Refine font classification categories** — split "bold-geometric" vs "heavy-condensed-display" in Q8 | Medium | ~1 hr | Brand Fidelity |
| 7 | **Enforce applicationConstraints** — post-build check that constraints (no shadows, no gradients, etc.) are respected | Medium | ~3 hrs | QA |
| 8 | **Use dembrandt palette for secondary extraction** — when CSS has no secondary, pick highest-confidence secondary from dembrandt | Medium | ~2 hrs | Brand Fidelity |
| 9 | **Implement programmatic JSON Schema validation** — load schemas via ajv, auto-generate VALID_TYPES from schema enum | Medium | ~3 hrs | Schemas |

### Tier 3: Medium-Term (Structural Improvements)

| # | Recommendation | Impact | Effort | Area |
|---|---------------|--------|--------|------|
| 10 | **Deprecate MD3 fallback entirely** — require brand-spec.json; error if missing | Medium | ~8 hrs | Architecture |
| 11 | **Add container queries to remaining 60% of components** — consistent responsive behavior across all 28 types | Medium | ~6 hrs | Components |
| 12 | **Implement isDark branching in components** — Hero, FullBleed, Callout should check isDark context instead of hardcoding text-white | Medium | ~3 hrs | Components |
| 13 | **Add per-variant interactive testing** — qa-interactive.js cycles through all variants of interactive components, not just the rendered one | Medium | ~4 hrs | QA |
| 14 | **Add tablet breakpoint testing** — test 768px in addition to 1440px and 390px | Low | ~2 hrs | QA |
| 15 | **Add ARIA attributes** — role="tab", aria-selected, aria-expanded, keyboard navigation for all interactive components | Medium | ~4 hrs | Accessibility |

### Tier 4: Long-Term (Architecture)

| # | Recommendation | Impact | Effort | Area |
|---|---------------|--------|--------|------|
| 16 | **Support multi-primary brands** — allow 3-5 accent colors with usage rules for brands like Figma (multi-color identity) | Medium | ~6 hrs | Architecture |
| 17 | **Extract surface rhythm from brand URL** — Vision AI observes the brand's actual section background pattern instead of archetype assumption | Medium | ~5 hrs | Brand Fidelity |
| 18 | **Define archetype tokens for all 28 components** — extend visual-archetypes.json to cover graphic, text, narrative, divider, callout, media, etc. | Medium | ~6 hrs | Architecture |
| 19 | **Add undo/redo for authoring** — JSON snapshot stack before each edit | Medium | ~4 hrs | Authoring |
| 20 | **Implement type swap (Phase 4b)** — client-side fill functions for component type changes without rebuild | Medium | ~8 hrs | Authoring |

---

## PART 4: KNOWN FRAGILE AREAS

These are not bugs but architectural weak points that could break under specific conditions:

| Area | Risk | Trigger |
|------|------|---------|
| Regex HTML parsing in qa-course.js | Medium | Unusual whitespace or formatting in component HTML |
| Quiz feedback detection in hydrate.js | Low | Tailwind color class name changes (`border-[#22c55e]`) |
| Tab class-based activation | Low | All tab triggers having identical classes |
| Flashcard 3D structure assumption | Low | Component HTML structure changes (assumes firstElementChild) |
| Carousel dot duplication | Low | Multiple re-hydration calls (mitigated by idempotent check) |
| Base64 image embedding | Medium | 50+ images producing >50MB HTML file |
| GSAP CDN dependency | Medium | Course opened offline (animations won't load) |
| Google Fonts API availability | Low | Font validation fails, triggers unnecessary subagent prompt |
| dembrandt CLI timeout | Medium | Large/slow brand websites exceeding 60s |
| Content cap truncation | Low | Important research content cut mid-sentence at 3000 chars |

---

## PART 5: WHAT'S WORKING WELL

These are the engine's strongest subsystems that should be preserved and built upon:

1. **Pipeline architecture** — clear data contracts between steps, deterministic build from JSON inputs
2. **Preact SSR component system** — 28 types, 56 variants, TypeScript types, normalization layer
3. **Authoring layer** — variant swapping, inline editing, section management, JSON export all production-ready
4. **Three-gate QA** — structural + interactive + visual review catches most functional bugs
5. **brand-spec.json schema** — well-designed structured spec that encodes both WHAT colors and HOW they're used
6. **Phase 4 color architecture** — stepSurface() from background, AI-set sectionBg, data-context cascade, .card-on-accent wrapping
7. **Three-source color cascade** — CSS extraction -> dembrandt -> Vision AI validation
8. **Archetype recipe system** — 8 archetypes with inheritance, shape/spacing control
9. **Scroll animations** — GSAP + ScrollTrigger with reduced-motion support, stat counter formatting
10. **Single-file output** — self-contained course.html with embedded CSS, JS, and base64 images

---

*Last updated: 2026-04-01*
