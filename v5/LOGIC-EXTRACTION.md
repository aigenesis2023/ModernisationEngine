# Logic Extraction Architecture

> **Status:** Research complete, architecture defined, implementation pending.
> **Last updated:** 2026-03-25

This document defines how the Modernisation Engine extracts and preserves interactive logic from Storyline SCORM exports. It covers the data structures Storyline exports, the patterns we handle, and how extracted logic flows through the pipeline into the final course output.

---

## Why This Matters

The product differentiator is not just visual modernisation — it's preserving the **learning design intent** of the original course. When an SME builds a course with difficulty levels, conditional content, and gated sections, the output must reflect that structure. Losing the logic means the output is just a flat dump of all content from all paths, which is useless.

Current `extract.js` extracts text and quiz answers but **throws away the entire logic layer**. This document defines what that logic layer contains and how to capture it.

---

## Storyline Export Schema

### How Storyline stores data

Every Storyline HTML5 export contains:

| File | Content | Format |
|---|---|---|
| `html5/data/js/data.js` | Global variables, scenes, quizzes, navigation map, scoring | `window.globalProvideData('data', '{...}')` |
| `html5/data/js/{slideHash}.js` | Per-slide content, objects, layers, triggers, conditions, actions | `window.globalProvideData('slide', '{...}')` |
| `html5/data/js/paths.js` | SVG rendering paths (visual only, no logic) | `window.globalProvideData('paths', '{...}')` |
| `story_content/user.js` | Custom JavaScript functions (rare, simple) | Plain JS |
| `story_content/triggers.js` | Script execution dispatch (maps IDs to functions in user.js) | Plain JS |
| `story_content/frame.xml` | Scene/slide hierarchy for the player menu | XML |

All data files use the same pattern: `window.globalProvideData(type, jsonString)`. The JSON is a string that must be parsed. Our existing `parseStorylineJs()` already handles this via a fake `window` object.

### Where logic lives (four locations)

Per-slide triggers and actions appear in four places within each slide's JSON:

| Location | Path | Fires when |
|---|---|---|
| **Slide events** | `slide.events[]` | Slide loads, transitions, next/prev pressed |
| **Action groups** | `slide.actionGroups{}` | Named reusable sequences, called by `exe_actiongroup` |
| **Object events** | `slide.slideLayers[N].objects[N].events[]` | User interacts with an object (click, hover, etc.) |
| **Timeline events** | `slide.slideLayers[N].timeline.events[]` | Timeline reaches a specific millisecond |

### Event kinds (what triggers an action)

| Event kind | Where it appears | Meaning |
|---|---|---|
| `onslidestart` | slide.events | Slide begins loading |
| `onbeforeslidein` | slide.events | Before slide transition starts |
| `ontransitionin` | slide/object events | After transition animation completes |
| `onallopentimelinescomplete` | slide.events | All timelines on slide have finished |
| `onnextslide` | slide.events | Next navigation triggered |
| `onprevslide` | slide.events | Previous navigation triggered |
| `onrelease` | object.events | User clicks/taps an object (primary interaction trigger) |
| `onpress` | object.events | Mouse button down on object |
| `onreleaseoutside` | object.events | Mouse released outside object bounds |
| `onrollover` / `onrollout` | object.events | Mouse hover enter/leave |
| `onvarchanged` | object.events | A specific variable's value changed (has `varname` property) |
| `onmediacomplete` | object.events | Audio/video playback finished |
| `ontimelinetick` | timeline.events | Timeline reaches a specific `time` (milliseconds) |
| `ontimelinecomplete` | layer events | Layer's timeline reaches end |
| `ontopmostlayer` | layer events | Layer becomes the topmost visible layer |
| `onlosefocus` | object.events | Object loses keyboard/interaction focus |

### Action kinds (what happens)

| Action kind | Key properties | Purpose |
|---|---|---|
| `if_action` | `condition`, `thenActions[]`, `elseActions[]` | Conditional branch — the core logic structure |
| `adjustvar` | `variable`, `operator`, `value` | Set/modify a variable (`set`, `add`, `toggle`) |
| `gotoplay` | `window`, `wndtype`, `objRef` | Navigate to a specific slide |
| `show_slidelayer` | `hideOthers`, `transition`, `objRef` | Show an overlay layer |
| `hide_slidelayer` | `transition`, `objRef` | Hide an overlay layer |
| `exe_actiongroup` | `id`, `scopeRef?` | Execute a named action group |
| `show` / `hide` | `transition`, `objRef` | Show/hide a specific object |
| `setobjstate` | `stateRef`, `objRef` | Change an object's visual state |
| `set_enabled` | `objRef`, `enabled` | Enable/disable an object |
| `enable_window_control` | `name`, `enable` | Enable/disable player nav buttons (next/prev/submit) |
| `eval_interaction` | `id` | Submit and evaluate a quiz interaction |
| `exe_javascript` | `id` | Execute custom JavaScript (references triggers.js) |
| `history_prev` | — | Navigate back in slide history |
| `open_url` | URL ref | Open an external URL |
| `resetquiz` | quiz ref | Reset a quiz to unanswered state |
| `media_play` / `media_toggle` | media ref | Control media playback |
| `close_player` / `close_window` | — | Close the course |
| `set_volume` | volume ref | Set audio volume level |

### Condition structure (inside `if_action`)

Conditions use a recursive tree of comparisons and logical combinators:

```json
{
  "kind": "if_action",
  "condition": {
    "statement": {
      "kind": "compare",
      "operator": "eq",
      "valuea": "_player.#Group3Technical",
      "typea": "var",
      "valueb": true,
      "typeb": "boolean"
    }
  },
  "thenActions": [
    { "kind": "gotoplay", "objRef": "slide-27" }
  ],
  "elseActions": [
    { "kind": "gotoplay", "objRef": "slide-15" }
  ]
}
```

Logical combinators nest recursively:

```json
{
  "kind": "or",
  "statements": [
    {
      "kind": "and",
      "statements": [
        { "kind": "compare", "operator": "eq", "valuea": "_player.#Group2SemiTechnical", "typea": "var", "valueb": true, "typeb": "boolean" },
        { "kind": "compare", "operator": "eq", "valuea": "_player.#Group3Technical", "typea": "var", "valueb": true, "typeb": "boolean" }
      ]
    }
  ]
}
```

**Comparison operators:** `eq` (equals), `gte` (greater than or equal), `lt` (less than), `ne` (not equal).

**In practice**, nesting depth is bounded — the EV course (relatively complex) uses at most 2-3 levels. This is tractable, not unbounded recursion.

### Variable reference conventions

| Pattern | Meaning | Example |
|---|---|---|
| `_player.#VarName` | Custom project variable | `_player.#Group3Technical` |
| `_player.VarName` | Built-in system variable | `_player.currentSlideId` |
| `_parent.ObjectId.#_checked` | Object state property (checkbox/radio checked) | `_parent.5gUMY3Kl71q.#_checked` |
| `ObjectId.$Status` | Object interaction status | `6PHP67HzAfO.$Status` (correct/incorrect) |
| `ObjectId.$AttemptCount` | Object attempt counter | Used for retry logic |
| `$WindowId` | Current window/slide reference | Navigation context |
| `$AbsoluteId` | Current slide absolute ID | Used in conditions |

**Critical:** The `#` prefix on variable names distinguishes custom author variables from built-in system variables. This is how we identify the logic that matters.

---

## Global Data (from data.js)

### Variables

`data.js` contains two variable arrays:

1. **`playervars[]`** — 37 built-in Storyline system variables (menu tracking, project progress, etc.). Always the same across all courses. **Ignore these.**

2. **`variables[]`** — ALL variables (system-generated + custom). In the EV course: 298 total. Categories:

| Category | Pattern | Count (EV) | Purpose |
|---|---|---|---|
| **Custom author vars** | Meaningful names like `Group3Technical`, `Section1complete` | ~50 | **This is the logic we need** |
| **Quiz tracking** | `CurrentQuiz_*` | ~48 | System-managed quiz state |
| **Retry mode** | `*_RetryModeInteractionIncompleteOnLoad` | ~131 | One per slide, system-managed |
| **Review mode** | `ReviewMode_*` | ~60 | One per slide, system-managed |
| **Retry flags** | `RetryMode_*` | ~6 | One per quiz |

**Extraction rule:** Extract all variables from the `variables[]` array. Categorize by pattern. Custom author variables (those without system-generated naming patterns) are the logic layer we care about.

### Quizzes

`data.js` contains a `quizzes[]` array with pass thresholds, scoring rules, and slide draw references. The EV course has 6 quizzes, all requiring 80% except one at 100%.

### Slide Map

`data.js` contains a `slideMap` object with 113 slide references and navigation links between them. Link types include direct slide-to-slide links, slide draw links (question bank randomizers), and action links (`nextviewedslide`, `playnextdrawslide`).

### Question Banks

`data.js` contains a `slideBank` object with 41 question bank slides that are drawn randomly during quiz sequences. Each bank entry references the actual slide JS file.

---

## Logic Patterns in Storyline Courses

### Pattern: Path Selection (difficulty/role branching)

**How it works in Storyline:**
1. A slide presents selectable options (checkboxes, radio buttons, or clickable objects)
2. An `onrelease` event on a submit/confirm button checks which option is selected via `_parent.ObjectId.#_checked`
3. Sets boolean variables (`Group1NonTechnical = true`) via `adjustvar`
4. Subsequent slides check these variables in `onslidestart` or `onnextslide` events to route navigation via `gotoplay`

**EV course example:**
- Slide `5qTAlMk2jlu` (Role Selector) — sets `Group1NonTechnical`, `Group2SemiTechnical`, or `Group3Technical` based on checkbox state
- 9+ downstream slides read these variables to branch navigation

**Modern web equivalent:**
- A path-selector component at the start of the course
- `data-show-if="difficulty==advanced"` attributes on sections
- `hydrate.js` manages a simple `{ difficulty: "advanced" }` state store
- Sections show/hide based on the selected path

### Pattern: Section Completion Gating

**How it works in Storyline:**
- Variables like `Section1complete` through `Section5complete` are set to `true` when the user reaches the end of each section
- Navigation triggers on later slides check these variables and either allow or block progression

**Modern web equivalent:**
- In a deep-scroll format, linear progression is natural (you scroll down)
- Section completion can be tracked via scroll position or explicit "mark complete" buttons
- The layout engine can add a progress tracker component

### Pattern: Drag-and-Drop Tracking

**How it works in Storyline:**
- Individual boolean variables (`DD_ICE_badge`, `DD_BEV_badge`, etc.) track each correct drop
- Completion conditions check all flags with `and` combinators
- Often uses `_dropcorrect` / `_dropincorrect` state variables

**Modern web equivalent:**
- Drag-and-drop is **out of scope** for automated modernisation
- Extract the underlying knowledge being tested (e.g., "match vehicle type to component")
- Map to a supported interactive component (matching quiz, comparison table, or branching cards)
- Flag to the user that the interaction type was simplified

### Pattern: Explore-and-Track (hotspots, feature discovery)

**How it works in Storyline:**
- Counter variables (`360Image1_VisitedItems`) track how many items the user has explored
- Total variables (`360Image1_TotalItems`) set the completion threshold
- `onvarchanged` events fire when the counter changes, comparing visited vs total

**Modern web equivalent:**
- Map to tabs, accordion, or labeled-image components
- Optional: track exploration with `hydrate.js` counter + progress indicator
- Content from each hotspot/reveal becomes an item in the interactive component

### Pattern: Layer Show/Hide (click-to-reveal)

**How it works in Storyline:**
- Button click (`onrelease`) fires `show_slidelayer` with a layer reference
- Layer contains additional content (text, images, interactions)
- Close button on layer fires `hide_slidelayer`

**Modern web equivalent:**
- Map to accordion panels, tabs, or modal-style components
- Each layer's content becomes an item in the interactive component
- No runtime layer logic needed — the component handles show/hide natively

### Pattern: Knowledge Gate (pass quiz to continue)

**How it works in Storyline:**
- Quiz result slide checks score via `if_action` with `ObjectId.$Status == correct`
- Pass: `gotoplay` to next section
- Fail: show retry layer or `gotoplay` to review content

**Modern web equivalent:**
- MCQ component with built-in pass/fail feedback
- In deep-scroll format, the "gate" is softer — show feedback and allow scrolling
- Optional: lock next section behind quiz completion with `hydrate.js` state

### Pattern: Custom JavaScript

**How it works in Storyline:**
- `exe_javascript` action references an ID in `triggers.js`
- `triggers.js` dispatches to functions in `user.js`
- Common use: score rounding, custom calculations, external API calls

**EV course example:** `user.js` contains one function — rounding `Quiz3.ScorePercent` to `RoundedScorePercent`.

**Modern web equivalent:**
- Simple math/formatting: handle in `hydrate.js` or build step
- External API calls: flag as out of scope
- Extract the custom JS as metadata for manual review

---

## Objects Are Identified by Actions, Not Labels

**Critical design principle:** Storyline authors frequently build everything on the canvas with custom navigation. Objects are often named "Rectangle 5" or "Group 12" with no meaningful alt text. The **only reliable way** to understand what an object does is to read its triggers.

A button with no label that has `onrelease → adjustvar: Group3Technical = true → gotoplay: nextSlide` IS a difficulty selector button. We know that from the trigger chain, not from any text property.

This means extraction must be **trigger-first**: walk every object's events, resolve what actions they perform, and classify the object by its behavior.

---

## The Tagged Content Model

### What changes in content-bucket.json

Current structure (flat):
```json
{
  "scenes": [{ "slides": [{ "contentBlocks": [{ "type": "body", "text": "..." }] }] }]
}
```

Enhanced structure (tagged with conditions):
```json
{
  "variables": [
    {
      "name": "Group3Technical",
      "type": "boolean",
      "default": false,
      "category": "path-selection",
      "setBy": [{ "slideId": "5qTAlMk2jlu", "mechanism": "checkbox-submit" }],
      "usedBy": ["6BXFYXQ6yMJ", "5nqI3GTCAkG", "5WjBQWIVtnZ"]
    }
  ],
  "pathGroups": [
    {
      "name": "difficulty",
      "type": "user-choice",
      "options": [
        { "variable": "Group1NonTechnical", "label": "Non-Technical" },
        { "variable": "Group2SemiTechnical", "label": "Semi-Technical" },
        { "variable": "Group3Technical", "label": "Technical" }
      ],
      "selectorSlide": "5qTAlMk2jlu"
    }
  ],
  "scenes": [{
    "slides": [{
      "contentBlocks": [
        {
          "type": "body",
          "text": "Advanced charging concepts...",
          "conditions": [{ "var": "Group3Technical", "op": "eq", "val": true }]
        }
      ],
      "navigation": {
        "next": [
          { "target": "6RxY5G1tSMC", "condition": { "var": "Group1NonTechnical", "op": "eq", "val": true } },
          { "target": "6hmrHWHv9Py", "condition": { "var": "Group2SemiTechnical", "op": "eq", "val": true } }
        ]
      }
    }]
  }],
  "complexity": {
    "tier": 2,
    "customVariables": 50,
    "triggerCount": 312,
    "conditionMaxDepth": 3,
    "patterns": ["path-selection", "section-gating", "drag-drop", "explore-track"],
    "outOfScope": ["drag-drop-simulation"],
    "notes": "Difficulty branching with 3 paths. Drag-and-drop simplified to matching quiz."
  }
}
```

### How downstream phases use this

**Phase 3 (AI layout engine):** Sees `pathGroups` and understands "this course has a difficulty selector with 3 paths." Structures the output with a path-selector component and sections tagged to each path. Doesn't need to understand Storyline triggers — just the intent.

**Phase 5 (build-course.js):** Reads `conditions` on components and adds `data-show-if` attributes to sections. Adds the path-selector component at the appropriate point.

**Phase 5b (hydrate.js):** Gets a minimal state store — a `{ variable: value }` map. Path-selector sets the variable. Sections with `data-show-if` show/hide based on current state. Simple conditional rendering, not a trigger engine.

**Future authoring tool:** Shows a path switcher UI ("Beginner | Intermediate | Advanced | Shared"). Each section has a "visible in" property. Moving content between paths = changing a JSON property. No trigger wiring needed.

---

## Scope Boundaries

### In scope (automated modernisation)

- Path/role/difficulty selection → path-selector component + tagged sections
- Section completion gating → natural scroll order + progress tracking
- Layer show/hide (click-to-reveal) → accordion, tabs, or modal components
- Knowledge gates (pass quiz to continue) → MCQ with feedback
- Question banks per path → tagged quiz components per path
- Explore-and-track (hotspots) → tabs, accordion, or labeled-image components
- Simple custom JS (score rounding) → handle in build step

### Out of scope (flagged for manual review)

- Drag-and-drop simulations → simplify to matching quiz or comparison table
- Complex state machines (10+ interdependent variables) → flag, extract content only
- Canvas-drawn animations and motion paths → not representable in deep-scroll
- Custom JS with external API calls → flag as manual review needed
- Game-like interactions → flag, extract underlying content

### Complexity assessment

Every extraction should produce a `complexity` object that signals:
- How many custom variables exist
- How many triggers/conditions across all slides
- Maximum condition nesting depth
- Which logic patterns were detected
- What was simplified or flagged as out of scope

This gives the user (and eventually the authoring tool) a clear signal about extraction fidelity.

---

## Implementation Notes

### Parsing approach

Use the existing `parseStorylineJs()` pattern — it already captures the full JSON via `window.globalProvideData()`. The enhancement is reading additional keys from the parsed JSON that `extract.js` currently ignores.

### Variable classification

1. Parse `data.js` for the `variables[]` array
2. Filter out system-generated patterns: `CurrentQuiz_*`, `*_RetryMode*`, `ReviewMode_*`, `RetryMode_*`, `LastSlideViewed_*`
3. Remaining variables are custom author variables — the logic layer
4. Group related variables by naming patterns (e.g., `Group1*`, `Group2*`, `Group3*` → "path-selection" group; `Section*complete` → "section-gating" group)

### Trigger resolution

For each slide, walk all four trigger locations. For each action chain:
1. Resolve `exe_actiongroup` by looking up the named group in `slide.actionGroups`
2. Flatten nested `if_action` trees into a list of condition → action pairs
3. Track which variables are read (in conditions) and written (in `adjustvar`)
4. Track navigation targets (`gotoplay` references)
5. Track layer operations (`show_slidelayer`, `hide_slidelayer`)

### Content tagging

After resolving triggers, tag each content block with the conditions under which it's visible:
1. Content on the base layer with no conditions → always visible (shared content)
2. Content on a named layer that's shown conditionally → tagged with that condition
3. Content on a slide that's only reachable via conditional navigation → tagged with that path condition

### Storyline version compatibility

The EV course is version `3.110.36211.0` (Storyline 360). The JSON schema appears stable across Storyline 3/360 exports. Storyline 2 exports may differ — needs verification with a test file. Storyline 1 exports are HTML/Flash only and out of scope.
