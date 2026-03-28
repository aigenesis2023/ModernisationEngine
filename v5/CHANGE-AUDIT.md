# Post-Change Audit Checklist

> Run this after every significant code change. Every item must be checked — not skimmed.
> "Run the change audit" = execute every check below and report pass/fail per item.

---

## 1. Component Count Sync

If any component was added, removed, or renamed:

- [ ] `CLAUDE.md` — component table count in heading + table rows
- [ ] `CLAUDE.md` — all inline references (search for old count number)
- [ ] `v5/BUILD-SYSTEM.md` — fill function count references
- [ ] `v5/CONTENT-STRUCTURING.md` — component count references
- [ ] `v5/STITCH-INTEGRATION.md` — component count references
- [ ] `v5/schemas/component-library.json` — component exists with all fields
- [ ] `v5/schemas/course-layout.schema.json` — type enum includes it
- [ ] `v5/prompts/generation-engine.md` — component referenced in guidance
- [ ] `v5/prompts/generation-agent.md` — count/reference updated
- [ ] `v5/prompts/representative-course.md` — HTML example exists
- [ ] `v5/scripts/build-course.js` — fill function exists + dispatcher case
- [ ] `v5/scripts/qa-course.js` — component type recognized

**How to check:** `grep -rn "25 component\|26 component\|25 type\|26 type\|25 fill\|26 fill" --include="*.md"` (replace numbers with the OLD count)

---

## 2. Variant Sync

If any variant was added, removed, or renamed:

- [ ] `CLAUDE.md` — Layout Variants table has the variant listed
- [ ] `v5/AUTHORING-LAYER.md` — Variant Inventory table matches (no duplicates)
- [ ] `v5/scripts/build-course.js` — `VARIANT_MAP` includes the variant
- [ ] `v5/scripts/build-course.js` — fill function has rendering logic (not just registered)
- [ ] `v5/scripts/build-course.js` — dispatcher passes `variant` param to fill function
- [ ] `v5/scripts/hydrate.js` — `variantLabels` has a human-friendly label
- [ ] `v5/scripts/qa-course.js` — variant registry includes it
- [ ] `v5/schemas/component-library.json` — variant listed in component's `variants` array
- [ ] `v5/prompts/representative-course.md` — HTML example for the variant exists

**How to check:** Compare VARIANT_MAP keys in build-course.js against variantLabels keys in hydrate.js. They should match.

---

## 3. Fill Function Consistency

If any fill function was added or modified:

- [ ] Function signature matches dispatcher call (check `variant` param is passed if VARIANT_MAP exists)
- [ ] All variants in VARIANT_MAP have actual rendering code (not just fallthrough to default)
- [ ] Output wraps in `<section data-component-type="TYPE">` (required for Phase 3 type swap)
- [ ] Interactive variants have correct `data-*` attributes for hydrate.js (`data-carousel`, `data-checklist`, `data-tabs`, `data-flashcard`)
- [ ] `<template>` alternate variants will generate correctly (fillComponentVariant receives variantOverride)

---

## 4. Hydrate.js Sync

If build-course.js output structure changed:

- [ ] Any new `data-*` attribute has a matching handler in hydrate.js
- [ ] Any new interactive element (counter, progress, navigation) gets updated by hydrate.js
- [ ] `hydrateComponent()` covers the new component type for DEV mode re-hydration
- [ ] No hardcoded selectors that assume a specific variant's DOM structure

---

## 5. Documentation Sync

After any change:

- [ ] `v5/AUTHORING-LAYER.md` — checklist items marked done, changelog entry added
- [ ] `v5/AUTHORING-LAYER.md` — no stale counts or duplicate table rows
- [ ] `CLAUDE.md` — architecture diagram counts match reality
- [ ] `CLAUDE.md` — file structure section counts match reality

---

## 6. Memory Sync

After any change to branches, component counts, architecture, or project status:

- [ ] `feedback_workflow.md` — correct active branch name
- [ ] `project_authoring_layer.md` — current phase status
- [ ] `project_engine_status.md` — component/variant counts, branch name
- [ ] `project_dev_toggle.md` — variant counts match VARIANT_MAP
- [ ] `MEMORY.md` index — descriptions match content

---

## 7. Knock-On Verification

Run these commands to catch drift:

```bash
# Count components in source of truth
node -e "const c = require('./v5/schemas/component-library.json'); console.log('Components:', Object.keys(c.components).length)"

# Count variants in VARIANT_MAP
grep -c "'" v5/scripts/build-course.js | head -1  # rough check
# Better: count unique variant names in VARIANT_MAP block

# Count variant labels in hydrate.js
grep -c "':'" v5/scripts/hydrate.js | head -1  # rough check

# Find stale count references
grep -rn "25 \|26 \|27 " --include="*.md" | grep -i "component\|type\|fill\|variant"
```
