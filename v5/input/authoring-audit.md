# Authoring Audit

A comprehensive, systematic audit of both the **course output quality** and the **authoring layer** on a built course. Uses the authoring panel to cycle through every variant of every component in the course — testing each for rendering quality, text overflow, image containment, interactive functionality, contrast, spacing, mobile behaviour, and design polish. Also validates the authoring tools themselves (toolbars, labels, variant swap, inline editing, delete, export).

The audit tests every possible visual state of every component present in the course, not just the one the AI happened to generate. A typical course contains 15-20 of the 23 variant-capable component types, covering 35-50 of the 56 total variants. The summary reports exact coverage.

**Trigger:** "authoring audit" starts Phase 1. "continue audit" resumes from last saved checkpoint.

**Pre-condition:** `index.html` must exist with a built course. If missing or empty, STOP and tell the user: "No built course found. Run the pipeline first (e.g. 'run it with [brand] and [topic]'), then type 'authoring audit' to begin."

Read `CLAUDE.md` and `v5/AUTHORING-LAYER.md` before starting.

---

## Execution Model: 4 Phases with Checkpoints

The audit runs in **4 phases within a single chat**. Each phase saves its findings to `v5/output/audit-findings.json` so that if context gets compressed or the session dies, nothing is lost.

| Phase | What happens | Saves |
|---|---|---|
| **Phase 1** | Setup, inventory, nav check, desktop sweep of first half of components | Findings so far → `audit-findings.json` |
| **Phase 2** | Desktop sweep of remaining components | Append findings → `audit-findings.json` |
| **Phase 3** | Mobile sweep, edge case tests, authoring-OFF verification | Append findings → `audit-findings.json` |
| **Phase 4** | Read all findings, classify, fix in priority order, rebuild, verify, report | Final report to user |

**Auto-chaining:** After each phase, proceed directly to the next. No user input needed between phases. The checkpoint save is a safety net, not a pause point.

**If the session dies or context is lost:** User types "continue audit". Read `v5/output/audit-findings.json` to see which phases are complete, then resume from the next incomplete phase.

### Findings file format

```json
{
  "course": "course title",
  "brand": "brand URL",
  "theme": "dark|light",
  "inventory": [ { "index": 0, "type": "hero", "variant": "split-screen", "templateCount": 2, "expectedCount": 2, "hasVariants": true, "jsonMatch": true } ],
  "totalComponents": 18,
  "completedPhases": [1, 2],
  "lastComponentAudited": "checklist",
  "issues": [
    { "id": 1, "component": "stat-callout", "variant": "card-row", "category": "TEXT-CONTRAST", "severity": "P2", "description": "Label text fails WCAG AA on dark card background", "phase": 1 }
  ],
  "uxNotes": [ "Variant label 'Grid' on stat-callout is ambiguous — user can't predict what it does" ],
  "variantsTested": 42,
  "variantsTotal": 56
}
```

### How to check: programmatic vs visual

Use **browser JS evaluation** for anything measurable: font sizes, element dimensions, contrast ratios (getComputedStyle → extract colours → calculate), overflow detection, heading tag levels, touch target sizes, element visibility, DOM attribute values.

Use **screenshots + vision** for things that require judgement: visual hierarchy, professional feel, variant differentiation, brand consistency, whether a label is confusing, spacing rhythm.

This avoids spending vision tokens on things a DOM query can answer instantly.

---

## Phase 1: Setup + Desktop Sweep (First Half)

### Setup

1. Start a local HTTP server serving the repo root
2. Open in Playwright at **1440x900** (desktop)
3. Screenshot the course landing state with authoring **OFF**
4. Click the **"✎ Edit"** button (top-right amber button) to activate authoring mode
5. Confirm: "✎ Edit ✓" label appears, toolbars appear on all sections, "↓ Export JSON" button appears
6. Screenshot the landing state with authoring **ON**
7. Determine theme: check for `class="dark"` on the html element. Note dark or light.

### Build the component inventory

This is a **programmatic pre-scan** — query the DOM to plan the audit.

Query all `[data-component-type]` sections (exclude `[data-component-type="navigation"]`). For each, record: section index, component index, component type, active variant, count of `<template data-variant-alt>` tags.

**Cross-reference against source of truth:**
- `VARIANT_MAP` in `build-course.js` — flag any component with fewer templates than expected
- `variantLabels` in `hydrate.js` — flag any variant button showing a raw internal name
- `typeLabels` in `hydrate.js` — flag any toolbar showing a raw type like "mcq" or "graphic-text"
- Embedded `course-layout.json` (the `#course-data` script element) — flag any section/component in the JSON that doesn't have a matching DOM section (silently dropped during build = build bug)

Log any mismatches as issues immediately.

Note which components have **no variants** (media, textinput, image-gallery, video-transcript, path-selector). These still get the full output quality audit — they just skip variant cycling.

### Check nav bar and course chrome

| Check | Pass criteria |
|---|---|
| Nav bar visible | Fixed nav at top with course title, section links |
| Nav not overlapped by toolbars | Authoring toolbars don't cover or push behind the nav |
| Scroll progress bar | Progress indicator updates as you scroll. Works in authoring mode |
| Section drawer/sidebar | If present: opens, links scroll to correct sections. Works in authoring mode |
| Hero CTA button | "Begin Course" (or similar) scrolls to first content section |

### Desktop sweep: first half of components

Split the component list in half. Audit the **first half** now (Phase 1), the second half in Phase 2. Scroll top-to-bottom, stopping at each component.

For each component, run the **Component Audit Checklist** (defined below).

**Save checkpoint:** Write findings so far to `v5/output/audit-findings.json` with `completedPhases: [1]`.

---

## Phase 2: Desktop Sweep (Second Half)

Continue the desktop sweep with the **remaining components**. Same checklist, same process.

**Save checkpoint:** Update `audit-findings.json` with `completedPhases: [1, 2]`.

---

## Phase 3: Mobile + Edge Cases + Final Verification

### Mobile sweep (390x844)

Resize Playwright to **390x844**. Keep authoring mode ON. Scroll top-to-bottom once.

**Layout and overflow:**

| Check | Pass criteria |
|---|---|
| Toolbars fit | Text and buttons don't overflow. Variant buttons wrap cleanly |
| Type label + Delete visible | Both fit on first row without overlapping |
| Content stacking | Multi-column layouts stack to single column |
| No horizontal scrollbar | No section causes overflow. Watch: data-table, process-flow horizontal, timeline centered-alternating, bento grid-4 |
| Text readable | Nothing below 14px. Headings still larger than body |
| Images scale | No overflow or distortion |
| Stat-callout | Stack to 1-2 columns, not tiny 4-column grid |
| Tabs | Scrollable horizontally or stacked |
| Hero | Text readable, still prominent |
| Internal padding | 12px minimum from screen edges |

**Mobile interactivity** — pick 3-4 interactive components and test at mobile width:

| Check | Pass criteria |
|---|---|
| Touch targets | All interactive elements at least 44x44px |
| MCQ/Quiz | Choice selection and submit work |
| Tabs | Switching works, panels don't overflow |
| Flashcard | Flip works with tap. Back content readable |
| Carousel/Narrative | Slides fit width. Nav buttons tappable |
| Accordion | Expand/collapse works. Content doesn't overflow |
| Checklist | Checkboxes tappable, counter updates |

**Mobile variant swap spot-check:** Swap variants on 3-4 complex components (hero, graphic-text, bento, tabs). Verify no overflow at mobile width.

### Edge case stress tests (resize back to 1440x900)

| Test | Procedure | Pass criteria |
|---|---|---|
| **Swap-Edit-Swap-Back** | On an interactive component: swap to variant B, edit heading, Done, swap back to A, swap to B again | Edited text persists in B; A shows its original text |
| **Rapid variant swap** | Click 4-5 buttons quickly (under 2 seconds) | No crash, no stale content, final state correct |
| **Delete section** | Delete one section | Re-indexes correctly, no errors, no visual gaps |
| **Delete + variant swap** | Delete section, then swap variant on a section AFTER it | Variant swap works (indices didn't desync) |
| **Authoring toggle** | OFF then ON again | Toolbars reappear, selections preserved, edits reset |

### Export JSON validation

Click "↓ Export JSON" and verify the downloaded file:

| Check | Pass criteria |
|---|---|
| Valid JSON | Parses without error |
| Section count | Matches DOM section count |
| Variant fields | Each component's `variant` matches current display |
| Edited text | Changes made during audit appear at correct path |
| Component types | Match `data-component-type` in DOM |
| No dropped components | Every JSON component has a DOM section |

### Console health

Dump browser console errors/warnings. Flag JS errors. Ignore benign 404s.

### Authoring OFF verification

Turn authoring OFF. Scroll through entire course:

| Check | Pass criteria |
|---|---|
| No toolbars visible | All authoring chrome hidden |
| No visual artefacts | No outlines, orphaned buttons, or editing indicators |
| Variants render correctly | Active variant looks correct without toolbar |
| Interactivity works | Spot-check 2-3 components — quiz, tabs, accordion function |
| Course looks complete | No missing sections or broken layouts masked by toolbars |

**Save checkpoint:** Update `audit-findings.json` with `completedPhases: [1, 2, 3]`.

---

## Phase 4: Classify, Fix, Verify, Report

### Classify all issues

Read `v5/output/audit-findings.json`. Compile all issues into one table:

| # | Component | Variant | Category | Severity | Description |
|---|---|---|---|---|---|

**Issue categories:**

| Category | Description |
|---|---|
| `RENDER-BROKEN` | Component doesn't display, content missing, completely broken layout |
| `RENDER-OVERFLOW` | Text or content overflows container, is clipped, or causes horizontal scroll |
| `RENDER-DEGRADED` | Visible problems (overlap, misalignment, collapsed element, orphaned card) |
| `VARIANT-IDENTICAL` | Two variants look the same — no visible difference within 2 seconds |
| `VARIANT-SWAP-FAIL` | Variant button doesn't change content, shows blank/stale, or errors |
| `VARIANT-LABEL-MISLEADING` | Button label doesn't match what the variant produces |
| `TOOLBAR-MISSING` | Section has no authoring toolbar |
| `TOOLBAR-LABEL` | Type or variant label shows raw internal name |
| `TOOLBAR-EDIT-TOGGLE` | Edit toggle missing on interactive, or present on non-interactive |
| `EDIT-BROKEN` | Text not editable, or interactivity not paused during edit |
| `TEXT-SIZING` | Text too small, heading not larger than body, stat numbers not prominent |
| `TEXT-CONTRAST` | Text not readable against background (fails WCAG AA) |
| `TEXT-OVERFLOW` | Text truncated, clipped, or extends beyond container |
| `SPACING` | Inconsistent padding/margins, cramped or overly sparse |
| `INTERACT-BROKEN` | Interactive component doesn't work (after swap, on mobile, or in general) |
| `MOBILE-BROKEN` | Component breaks at mobile viewport |
| `DARK-THEME` | Dark theme specific (white cards, invisible text, poor contrast) |
| `UX-CONFUSING` | Label or pattern would confuse a non-technical user |
| `DESIGN-QUALITY` | Visual polish — misalignment, inconsistent styling, unprofessional feel |
| `ACCESSIBILITY` | Missing focus indicators, insufficient tap targets, skipped headings |
| `NAV-BROKEN` | Nav bar, progress bar, section drawer, or hero CTA broken |
| `ANIMATION` | GSAP animation interferes with editing or leaves content invisible |

**Severity levels:**

| Level | Criteria | Action |
|---|---|---|
| **P0-CRITICAL** | Component unusable, invisible, or crashes JS. Data loss. | Must fix |
| **P1-HIGH** | Functionality broken. Content clipped or unreadable. | Must fix |
| **P2-MEDIUM** | Visual quality issue visible to user. | Should fix |
| **P3-LOW** | Minor polish. | Fix if easy |

### Fix

Fix all P0 first, then P1, then P2. P3 only if straightforward.

**All fixes go in the ENGINE** (build-course.js, hydrate.js). NEVER edit index.html or v5/output/ files directly.

**After each batch of related fixes:**
1. Rebuild: `node v5/scripts/build-course.js`
2. Reload in Playwright
3. Re-check the fixed components (screenshot before/after)
4. **Regression check:** verify previously-fixed issues are still fixed
5. Mark issues as FIXED in the log

**If variants are truly identical:** add structural differences in the fill function that don't depend on the design contract.

### Verify

After all fixes are complete:
1. `node v5/scripts/qa-course.js` — must pass
2. `node v5/scripts/qa-interactive.js` — must pass
3. Turn authoring OFF, scroll through course — no artefacts, interactivity works
4. Confirm all fixed issues are still fixed

### Report

Present to the user:

```
## Authoring Audit Summary

**Course:** [course title]
**Brand:** [brand from brand/url.txt]
**Theme:** [dark/light]
**Components in course:** X (Y with variants, Z without)
**Variants tested:** X/56

### Issues Found
| Severity | Found | Fixed | Deferred |
|---|---|---|---|
| P0 | | | |
| P1 | | | |
| P2 | | | |
| P3 | | | |

### Issues by Category
[count per category]

### Changes Made
| # | Issue | What was wrong | How it was fixed | Component affected |
|---|---|---|---|---|
| 1 | [plain English] | [what user would see] | [what was done, no code] | [component] |

### Components with No Issues
[list]

### Deferred Issues
[table with reason for deferring]

### Variant Quality Assessment
[Are variants meaningfully different? Any to merge or relabel?]

### UX Recommendations
[Label changes, discoverability, workflow friction]

### Rebuild Verification
- [ ] qa-course.js passes
- [ ] qa-interactive.js passes
- [ ] Authoring OFF renders correctly
- [ ] All fixed issues confirmed still fixed
```

### Post-Audit Change Audit

If ANY engine files were modified, run `v5/CHANGE-AUDIT.md`. This catches stale docs, mismatched counts, and label sync issues.

### Clean up

Delete `v5/output/audit-findings.json` — it was a working file, not a permanent output.

---

## Component Audit Checklist

This is the checklist used in Phase 1 and Phase 2 for each component during the desktop sweep. Do everything at one component before moving to the next.

### 1. Toolbar (once — doesn't change with variant swap)

| Check | Pass criteria |
|---|---|
| Toolbar visible | Coloured bar above the component |
| Toolbar colour | Matches category (Content=blue, Explore=purple, Assess=red, Layout=green, Media=cyan, Structure=amber) |
| Type label clear | User-friendly name (e.g. "Quiz" not "mcq"). **UX:** would a non-technical author understand this? |
| Variant buttons | One per variant; count matches VARIANT_MAP. Skip for no-variant components. |
| Variant labels clear | Friendly labels (e.g. "Side by side" not "split"). **UX:** could a user predict the result without clicking? |
| Active button state | Active variant visually distinct (darker background) |
| Edit text toggle | Present ONLY on: mcq, tabs, flashcard, narrative, checklist, branching, path-selector. ABSENT on all others including accordion. |
| Delete button | "✕ Delete" visible, right-aligned. **UX:** easy to accidentally click? No-undo clear? |
| Toolbar overflow | No awkward wrapping or off-screen buttons |
| Toolbar z-index | Not hidden behind adjacent full-bleed/hero sections |

### 2. Variant cycle

**Components WITH variants:** click each variant button one at a time, screenshot each. Run checks A–D per variant. For interactive components, also run D (interactivity) on each variant. After all variants, evaluate E (differentiation).

**Components WITHOUT variants:** run A–C on the single rendered state. If interactive, also run D. Skip E.

**Consult the component-specific criteria reference** to know what "correct" looks like for each variant.

---

**A. Structure + output quality (per variant)**

| Check | Pass criteria |
|---|---|
| Content visible | No invisible content from stale opacity/animation |
| Variant attribute | `data-variant` matches clicked variant |
| Active button updated | Correct button highlighted |
| Layout intact | No overlap, no content outside container |
| Images render | No broken icons, no collapsed images |
| Section width preserved | Width doesn't jump on swap |
| Scroll position stable | No page jump from height change |
| Heading hierarchy | h2 sections, h3 sub-items, h1 hero only, no skips |
| Heading size > body | Visually larger |
| Body text readable | 16px+ desktop. Nothing below 14px except labels |
| Line length | 45-85 chars. Flag over 90 |
| Text overflow | Nothing escaping container, no horizontal scroll |
| Long title wrap | 60+ char headings wrap cleanly |
| Card content balance | Different text lengths don't break grid alignment |

**B. Contrast (per variant)**

| Check | Pass criteria |
|---|---|
| Text WCAG AA | 4.5:1 body, 3:1 large, against ACTUAL background |
| Card backgrounds | Dark: no white cards. Light: visible boundaries |
| Gradient text | Stat numbers visible, not transparent |
| Button contrast | Interactive elements have readable text |

**C. Spacing and design (per variant)**

| Check | Pass criteria |
|---|---|
| Internal padding | 16px minimum horizontal. Content never touches edges |
| Card alignment | No orphaned cards on last row |
| Section spacing | Consistent with adjacent sections |
| Full-bleed/hero | Full viewport width, no edge gaps |
| Narrow sections | Visibly narrower if narrow sectionWidth |
| Visual hierarchy | Heading → visual → body → supporting, immediately clear |
| White space | Not cramped, not disconnected |
| Professional feel | Intentional and polished |
| Brand consistency | Palette consistent with rest of course |

**D. Interactivity (per variant — interactive components only)**

| Component | Checks |
|---|---|
| **MCQ** | Wrong → Submit → failure → Retry → correct → success |
| **Tabs** | Each tab → correct panel, others hide, highlighted, no empty |
| **Flashcard** | Click → flip → back readable → click → back → independent |
| **Narrative** | Next → advance → dot → Prev → back → correct dot |
| **Accordion** | Click → expand → visible → click → collapse. Body contrast readable |
| **Checklist** | Check → counter → uncheck → decrement → progress bar |
| **Branching** | Click → feedback appears |
| **Edit toggle** | Edit text → green Done → paused → text editable → Done → resumes |
| **Stat animation** | Scroll to trigger → edit mode → number editable (not overwritten) |
| **Post-swap animation** | Swap → scroll away/back → content visible (not stuck invisible) |

**E. Variant differentiation (after ALL variants for this component)**

| Check | Evaluate |
|---|---|
| Visual distinction | Obvious difference within 2 seconds? Flag identical pairs. |
| Functional distinction | Different use cases or cosmetic nudge? |
| Label-to-visual match | Label describes what you see? |
| Author would choose? | Would a non-technical user understand the choice? |

---

### Component-specific criteria reference

Consult during check A. Defines the **minimum visible difference** between variants:

| Component | What MUST be different |
|---|---|
| **hero** | centered-overlay: centred over image. split-screen: two-column on desktop. minimal-text: no image, border accent |
| **text** | standard: single column. two-column: splits on desktop. highlight-box: bordered/shaded box |
| **graphic** | standard: image only. captioned-card: visible caption |
| **graphic-text** | split: side-by-side. overlap: image into text. full-overlay: text ON image |
| **pullquote** | accent-bar: left border + quote mark. centered: large quote above. minimal: no decoration. ALL: distinct from body text |
| **stat-callout** | centered: plain grid. card-row: cards with progress bars. BOTH: numbers large, labels smaller |
| **callout** | info/warning/tip/success: DIFFERENT icon AND colour each |
| **divider** | line: rule. spacing: empty space. icon: icon between lines |
| **accordion** | standard: plain. accent-border: coloured border and/or icons |
| **tabs** | horizontal: top. vertical: left side |
| **narrative** | image-focused: larger image. text-focused: larger text |
| **flashcard** | grid: multiple cards. single-large: one card. Back readable |
| **labeled-image** | numbered-dots: on image. side-panel: beside image |
| **mcq** | stacked: vertical. grid: multi-column |
| **branching** | cards: blocks. list: linear |
| **checklist** | standard: checkboxes. card-style: cards. numbered: numbers |
| **bento** | grid-4: 4 cols. wide-2: 2 cols. featured: one large + small. Body clamps 4 lines |
| **comparison** | columns: side-by-side. stacked-rows: vertical |
| **data-table** | standard: plain. striped-card: alternating/card. Both: horizontal scroll if needed |
| **timeline** | vertical: left-aligned. centered-alternating: left/right |
| **process-flow** | vertical: top-bottom. horizontal: left-right with connectors |
| **key-term** | list: definition list. card-grid: cards |
| **full-bleed** | center/left/right: different text position |
