# Logic Extraction Architecture

> **Status:** Research complete, architecture defined, implementation pending.
> **Last updated:** 2026-03-25

This document defines how the Modernisation Engine extracts and preserves interactive logic from Storyline SCORM exports. It covers the fixed Storyline schema our engine reads, the behavioral patterns it detects, and how extracted logic flows through the pipeline.

**Key principle:** Storyline's export schema is fixed — every course uses the same JSON keys, action kinds, event kinds, and reference patterns. Author-created variable names, slide IDs, state names, and content text differ per course. The engine reads the fixed schema and discovers relationships behaviorally. It never assumes specific names.

---

## Why This Matters

The product differentiator is not just visual modernisation — it's preserving the **learning design intent** of the original course. When an SME builds a course with difficulty levels, conditional content, and gated sections, the output must reflect that structure. Losing the logic means the output is just a flat dump of all content from all paths, which is useless.

---

## Storyline's Fixed Export Schema

### How Storyline stores data

Every Storyline 360 HTML5 export contains:

| File | Content | Format |
|---|---|---|
| `html5/data/js/data.js` | Global variables, scenes, quizzes, navigation map, question banks, scoring | `window.globalProvideData('data', '{...}')` |
| `html5/data/js/{slideHash}.js` | Per-slide content, objects, layers, triggers, conditions, actions | `window.globalProvideData('slide', '{...}')` |
| `html5/data/js/paths.js` | SVG rendering paths (visual only, no logic) | `window.globalProvideData('paths', '{...}')` |
| `story_content/user.js` | Custom JavaScript functions (rare, simple) | Plain JS |
| `story_content/triggers.js` | Script execution dispatch (maps IDs to functions in user.js) | Plain JS |
| `story_content/frame.xml` | Scene/slide hierarchy for the player menu | XML |

All data files use the same pattern: `window.globalProvideData(type, jsonString)`. Our `parseStorylineJs()` handles this via a fake `window` object.

**Schema stability:** These structures are part of Storyline's HTML5 runtime engine — the contract between exported content and the player. Stable across all Storyline 360 builds. Storyline 2 uses a different format (out of scope). Storyline 1 is Flash-only (irrelevant).

### Where logic lives (four fixed locations)

Per-slide triggers and actions always appear in these four places:

| Location | Path | Fires when |
|---|---|---|
| **Slide events** | `slide.events[]` | Slide loads, transitions, next/prev pressed |
| **Action groups** | `slide.actionGroups{}` | Named reusable sequences, called by `exe_actiongroup` |
| **Object events** | `slide.slideLayers[N].objects[N].events[]` | User interacts with an object (click, hover, etc.) |
| **Timeline events** | `slide.slideLayers[N].timeline.events[]` | Timeline reaches a specific millisecond |

### Event kinds (23 — fixed set)

These are Storyline's built-in event types. Every course uses the same event kind strings:

| Event kind | Where it appears | Meaning |
|---|---|---|
| `onslidestart` | slide.events | Slide begins loading |
| `onbeforeslidein` | slide.events | Before slide transition starts |
| `ontransitionin` | slide/object events | After transition animation completes |
| `ontransitionincomplete` | slide/object events | Transition animation interrupted |
| `ontransitionout` | slide events | Slide transition out begins |
| `onallopentimelinescomplete` | slide.events | All timelines on slide have finished |
| `onnextslide` | slide.events | Next navigation triggered |
| `onprevslide` | slide.events | Previous navigation triggered |
| `onsubmitslide` | slide.events | Slide submission triggered |
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
| `ondragconnect` | object.events | Drag-and-drop: object connected to target |
| `ondragout` | object.events | Drag-and-drop: object dragged away from target |
| `ondragstart` | object.events | Drag-and-drop: drag begins |

### Action kinds (33 — fixed set)

These are Storyline's built-in action types. The `kind` field always uses these exact strings:

| Category | Action kind | Key properties | Purpose |
|---|---|---|---|
| **Navigation** | `gotoplay` | `window`, `wndtype`, `objRef` | Navigate to slide. `window`: `"_current"` (standard), `"LightboxWnd"` (popup) |
| | `history_prev` | — | Navigate back in slide history |
| | `nextviewedslide` | — | Route to next quiz draw slide |
| | `playnextdrawslide` | — | Advance within a question bank draw |
| **Logic** | `if_action` | `condition`, `thenActions[]`, `elseActions[]` | Conditional branch — the core logic structure |
| | `adjustvar` | `variable`, `operator`, `value` | Set/modify variable. Operators: `set`, `add`, `toggle` |
| | `exe_actiongroup` | `id`, `scopeRef?` | Execute a named action group |
| **Layers** | `show_slidelayer` | `hideOthers`, `transition`, `objRef` | Show overlay layer |
| | `hide_slidelayer` | `transition`, `objRef` | Hide overlay layer |
| **Objects** | `show` / `hide` | `transition`, `objRef` | Show/hide specific object |
| | `setobjstate` | `stateRef`, `objRef` | Change object's visual state |
| | `set_enabled` | `objRef`, `enabled` | Enable/disable object |
| | `setfocus` | `objRef` | Set keyboard focus to object |
| **Player** | `enable_window_control` | `name`, `enable` | Enable/disable player nav buttons |
| | `enable_frame_control` | `name`, `enable` | Enable/disable frame controls |
| | `set_frame_layout` | `name` | Set player frame layout |
| | `set_window_control_layout` | `name` | Set window control layout |
| **Quiz** | `eval_interaction` | `id` | Submit and evaluate a quiz interaction |
| | `resetquiz` | quiz ref | Reset quiz to unanswered state |
| | `setquizcomplete` | quiz ref | Mark quiz as complete |
| | `setdrawreview` | draw ref | Set draw to review mode |
| **Media** | `media_play` / `media_toggle` | media ref | Control media playback |
| | `set_volume` | volume ref | Set audio volume level |
| **Animation** | `exe_animation` | animation ref | Trigger an animation |
| | `tween` | tween properties | Animate object properties |
| | `setactivetimeline` | timeline ref | Switch active timeline |
| **External** | `exe_javascript` | `id` | Execute custom JS (references triggers.js) |
| | `open_url` | URL ref | Open external URL |
| | `show_prompt` | prompt ref | Show a dialog prompt |
| | `close_player` / `close_window` | — | Close the course |

### Condition structure (inside `if_action`)

Conditions always use this recursive tree of `compare`, `and`, `or` nodes:

```json
{
  "kind": "if_action",
  "condition": {
    "statement": {
      "kind": "compare",
      "operator": "eq",
      "valuea": "_player.#SomeAuthorVariable",
      "typea": "var",
      "valueb": true,
      "typeb": "boolean"
    }
  },
  "thenActions": [ ... ],
  "elseActions": [ ... ]
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
        { "kind": "compare", "operator": "eq", "valuea": "_player.#VarA", "typea": "var", "valueb": true, "typeb": "boolean" },
        { "kind": "compare", "operator": "eq", "valuea": "_player.#VarB", "typea": "var", "valueb": true, "typeb": "boolean" }
      ]
    }
  ]
}
```

**Fixed comparison operators:** `eq` (equals), `gte` (greater than or equal), `lt` (less than), `ne` (not equal).

**In practice**, nesting depth is bounded — typically 2-3 levels. This is tractable, not unbounded recursion.

### Variable reference conventions (fixed patterns)

These prefix/suffix patterns are how Storyline always references different types of data:

| Pattern | Meaning |
|---|---|
| `_player.#VarName` | Custom project variable (the `#` prefix always means author-created) |
| `_player.VarName` | Built-in system variable (no `#`) |
| `_parent.ObjectId.#_checked` | Object state property (checkbox/radio checked state) |
| `ObjectId.$Status` | Object interaction status (correct/incorrect) |
| `ObjectId.$AttemptCount` | Object attempt counter |
| `ObjectId.$OnStage` | Whether object is currently visible |
| `$WindowId` | Current window/slide reference |
| `$AbsoluteId` | Current slide absolute ID |

**Critical:** The `#` prefix on variable names is how our engine distinguishes custom author variables from built-in system variables. This is fixed across all Storyline exports.

---

## Global Data (from data.js)

### Top-level structure (fixed keys)

`data.js` always contains these top-level keys:

| Key | Type | Purpose |
|---|---|---|
| `playervars[]` | array | Built-in system variables (always ~37, same across all courses) — ignore |
| `variables[]` | array | All variables — system-generated + custom author variables |
| `slideMap` | object | Navigation graph: slide refs with links |
| `scenes[]` | array | Scene definitions with embedded slide metadata |
| `quizzes[]` | array | Quiz definitions with pass thresholds |
| `scorings[]` | array | LMS scoring rules |
| `slideBank` | object | Question bank slides (separate pool, outside scene hierarchy) |
| `actionGroups` | object | Global action groups (player button handlers) |
| `events[]` | array | Global event bindings |

### Variables

`data.js` contains two variable arrays:

1. **`playervars[]`** — built-in Storyline system variables (menu tracking, project progress, etc.). Always the same set across all courses. **Ignore these.**

2. **`variables[]`** — ALL variables. Categories identified by fixed naming patterns:

| Category | Fixed pattern | Purpose |
|---|---|---|
| **Custom author vars** | Everything NOT matching the system patterns below | **This is the logic our engine needs to discover** |
| **Quiz tracking** | `CurrentQuiz_*` | System-managed quiz state |
| **Retry mode** | `*_RetryModeInteractionIncompleteOnLoad` | One per slide, system-managed |
| **Review mode** | `ReviewMode_*` | One per slide, system-managed |
| **Retry flags** | `RetryMode_*` | One per quiz |
| **Resume bookmark** | `LastSlideViewed_*` | LMS resume tracking |

**Extraction rule:** Filter out variables matching the system patterns above. Everything remaining is a custom author variable. The engine then discovers what each variable does by analyzing trigger behavior — not by reading the variable name.

### Question Banks and Slide Draws

**Question banks** always live in `slideBank.slides[]` — completely **outside** the scene/slide hierarchy.

Each bank slide entry in `data.js` contains:
- `html5url` — path to the individual JS file (same format as regular slides)
- `interactions[]` — quiz interaction data including choices with correct answers (marked with `*` suffix in `lmstext`)
- `answers[]` — each with `status` ("correct"/"incorrect") and `evaluate.statements`

**Slidedraws** are always in `scene.slidedraws[]` and have this fixed structure:

```json
{
  "kind": "slidedraw",
  "shuffle": true,
  "shufflecount": 10,
  "sliderefs": [
    { "kind": "slideref", "id": "{bankSlideId}", "shuffleinclude": true }
  ],
  "exitaction": {
    "kind": "gotoplay",
    "objRef": { "value": "_player.{sceneId}.{resultSlideId}" }
  }
}
```

Fixed properties:
- **`shuffle`** — randomize question order (true/false)
- **`shufflecount`** — how many to present (can be less than pool size)
- **`sliderefs[].id`** — references bank slide IDs
- **`exitaction`** — navigation target when the draw completes
- Multiple draws can share the same bank slides

Bank slide JS files have the **exact same structure** as regular slide JS files.

### Slide Map (Navigation Graph)

`data.js` always contains a `slideMap` with:
- Regular slides (`type: "slide"`) linking to other slides or slidedraws via `linksTo[]`
- Slidedraws (`type: "slidedraw"`) linking to their exit slides
- Action links: `nextviewedslide` and `playnextdrawslide` types

### Quizzes

`data.js` always contains a `quizzes[]` array. Each quiz has:
- `passPercent` — pass threshold
- `scoretype` — "all" or "partial"
- Reference to a slidedraw
- `EvaluateQuiz` action group

---

## Slide Structure (fixed schema)

### Layers

Every slide has a `slideLayers[]` array. Index 0 is always the base layer.

**Base layer** (always present, identified by fixed property):
```json
{
  "kind": "slidelayer",
  "isBaseLayer": true,
  "timeline": { ... },
  "objects": [ ... ]
}
```

**Overlay layers** (index 1+, identified by fixed properties):
```json
{
  "kind": "slidelayer",
  "id": "{layerId}",
  "modal": false,
  "pauseParent": false,
  "presentAs": "layer",
  "timeline": { ... },
  "objects": [ ... ]
}
```

Fixed differences: base layer always has `isBaseLayer: true` and no `id`. Overlays always have `id` (referenced by `show_slidelayer`/`hide_slidelayer`), `modal`, `pauseParent`, and `presentAs`.

**Layer references** in actions always use these path patterns:
- `"{layerId}"` — simple ID (from slide-level events)
- `"_parent._parent.{layerId}"` — relative path (from within another overlay)
- `"_parent.{layerId}"` — from base layer objects

**Critical:** `data.js` only stores base layer stubs. Full layer data lives exclusively in individual slide JS files.

### Object States — Both Visual AND Informational

States can contain entirely different text content per state. A label might show prompt text in its default state and detailed information in its hover state.

Each state always has this structure:

```json
{
  "kind": "state",
  "name": "{stateName}",
  "data": {
    "vectorData": "[SVG data — may contain different text]",
    "html5data": { "xPos": 0, "yPos": 0, "width": 351, "height": 29 }
  }
}
```

**Built-in state names (fixed, always the same across all courses):**
`_default`, `_default_Hover`, `_default_Selected`, `_default_Visited`, `_default_Disabled`, `_default_Down`, plus compounds like `_default_Hover_Selected`.

**Custom state names (author-chosen, differ per course):**
Authors create custom states with any name. Common examples include states indicating completion, correctness, or category — but the engine cannot assume any specific names. It reads the state content and the triggers that activate them.

**State changes are triggered two ways:**

1. **`actionstates` on stategroup objects** — built-in state machine for hover/selected/visited transitions. Automatic visual feedback.

2. **Explicit `setobjstate` in event handlers** — custom state changes driven by course logic.

**Extraction rule:** For each object with states, extract text from ALL states (not just default). Tag each block with the state name. Map interaction patterns:
- `_default` → always visible content
- `_default_Hover` → hover-reveal content
- `_default_Selected` / any custom state → click-reveal content

### Custom Navigation

Most Storyline courses override the default player navigation. The fixed pattern is:

```json
"ActGrpOnNextButtonClick": {
  "kind": "actiongroup",
  "actions": [{
    "kind": "gotoplay",
    "window": "_current",
    "objRef": { "type": "string", "value": "_player.{sceneId}.{slideId}" }
  }]
}
```

When `ActGrpOnNextButtonClick` has zero actions, the player uses built-in next/prev. When it has actions, those define the navigation.

Canvas-level navigation uses `onrelease` events on objects with `gotoplay` actions — the real navigation when the default player is disabled.

**Lightbox navigation** uses `"window": "LightboxWnd"` — opens a slide as a popup.

**`NavigationRestrictionNextSlide_*`** wraps `ActGrpOnNextButtonClick` and is triggered by `onnextslide`. This is how Storyline overrides the player's next button.

---

## Objects Are Identified by Actions, Not Labels

**Critical engine principle:** Storyline authors frequently build everything on the canvas with custom navigation. Objects are often auto-named ("Rectangle 5", "Group 12") with no meaningful alt text. Button labels may not exist in accessible text properties.

**The only reliable way to understand what an object does is to read its triggers.** An unnamed object with `onrelease → adjustvar → gotoplay` IS a navigation button. An object with `onrelease → show_slidelayer` IS a reveal trigger. The action chain defines the object's role, not any text or label.

This means extraction is **trigger-first**: walk every object's events, resolve what actions they perform, classify the object by behavior.

---

## Behavioral Pattern Detection

The engine detects these patterns by analyzing **trigger behavior across slides**, never by reading variable names or content text. Each pattern is identified by a specific behavioral signature.

### Pattern: Path Selection (difficulty/role/audience branching)

**Behavioral signature:** 2+ boolean variables SET on the same slide, AND those variables READ on 2+ other slides where they gate navigation (`if_action` → `gotoplay`).

**How it works in Storyline:**
1. A slide presents selectable options (checkboxes, radio buttons, or clickable objects)
2. An `onrelease` event checks which option is selected via `_parent.{objectId}.#_checked`
3. Sets boolean variables via `adjustvar`
4. Subsequent slides check these variables in `if_action` conditions to route navigation via `gotoplay`

**Modern web equivalent:**
- A path-selector component at the start of the course
- `data-show-if` attributes on sections
- `hydrate.js` manages a simple state store
- Sections show/hide based on the selected path

### Pattern: Section Completion Gating

**Behavioral signature:** Boolean variables each WRITTEN on 1-2 slides and READ on other slides, where they're not part of a path-selection group (not set together on one slide).

**How it works in Storyline:**
- A variable is set to `true` via `adjustvar` when the user reaches the end of a section
- Navigation triggers on later slides check these variables and either allow or block progression

**Modern web equivalent:**
- In a deep-scroll format, linear progression is natural (scroll order)
- Section completion can be tracked via scroll position or explicit "mark complete" buttons

### Pattern: Question Banks (randomised quizzes)

**Behavioral signature:** `slideBank.slides[]` exists in `data.js`, `scene.slidedraws[]` exist with `sliderefs` and `shufflecount`.

**How it works in Storyline:**
- Bank slides live outside the scene hierarchy in a separate pool
- Slidedraws define how to draw from the pool (count, shuffle, exit)
- Navigation reaches a draw conditionally or unconditionally
- The draw presents questions and routes to a results slide on completion

**Path association:** The engine traces which slides navigate TO each draw and what conditions gate that navigation. If a draw is only reachable via `if_action` checking path variables, that draw's questions belong to that path. If the condition is on a layer show rather than direct navigation, the engine infers path dependency from the slide's variable reads.

**Modern web equivalent:**
- Quiz sections with the appropriate questions per path
- Draw metadata (shuffle, count) preserved for authoring tool / hydrate.js

### Pattern: Completion-Gated Navigation

**Behavioral signature:** Navigation (`gotoplay`) wrapped in `if_action` where the condition checks object state properties (`#_state`, `$Status`, `_visited`) rather than custom variables.

**How it works in Storyline:**
- A "next" button only navigates when all interactive items have been visited/completed
- The condition checks multiple object states with `and` combinators
- If not complete, shows a warning layer or does nothing

**Modern web equivalent:**
- Tag the slide's interactive content as "mandatory completion"
- `requiredItems: N` in the navigation metadata
- The layout engine makes the interactive component require completion

### Pattern: Drag-and-Drop

**Behavioral signature:** `ondragconnect`, `ondragout`, or `ondragstart` events in the trigger data.

**How it works in Storyline:**
- Drag events trigger `adjustvar` and `setobjstate`
- Boolean variables track each correct/incorrect drop
- Completion conditions check all flags

**Modern web equivalent:**
- **Out of scope** for automated modernisation
- Extract the underlying knowledge being tested
- Map to a matching quiz, comparison table, or branching cards
- Flag to the user that the interaction type was simplified

### Pattern: Explore-and-Track (hotspots, feature discovery)

**Behavioral signature:** Number variables that are both WRITTEN and READ across slides (counter being incremented and compared to a threshold).

**How it works in Storyline:**
- Counter variables track how many items the user has explored
- `onvarchanged` events fire when the counter changes, comparing visited vs total
- Completion triggers when counter reaches threshold

**Modern web equivalent:**
- Map to tabs, accordion, or labeled-image components
- Optional: track exploration with `hydrate.js` counter + progress indicator

### Pattern: Layer Show/Hide (click-to-reveal)

**Behavioral signature:** `show_slidelayer` / `hide_slidelayer` actions in object `onrelease` events.

**How it works in Storyline:**
- Button click fires `show_slidelayer` with a layer reference
- Layer contains additional content
- `hideOthers: "oncomplete"` means showing one layer hides the others (tab-like behavior)

**Modern web equivalent:**
- Map to accordion panels, tabs, or modal-style components
- Each layer's content becomes an item in the interactive component
- `hideOthers` → tab behavior (one visible at a time)

### Pattern: State-Based Content (hover/click reveals)

**Behavioral signature:** Objects with multiple states containing different text in `textLib` or `vectorData`.

**How it works in Storyline:**
- `_default` state shows initial text
- `_default_Hover` state shows different text when hovered
- Custom states show different text after interaction via `setobjstate`

**Modern web equivalent:**
- Default state text → visible label or heading
- Hover state text → tooltip or expandable detail
- Custom state text → revealed content after click

### Pattern: Knowledge Gate (pass quiz to continue)

**Behavioral signature:** `if_action` condition checking `ObjectId.$Status == correct` followed by `gotoplay`.

**How it works in Storyline:**
- Quiz result checks score
- Pass → navigate to next section
- Fail → show retry layer or route to review content

**Modern web equivalent:**
- MCQ component with pass/fail feedback
- Optional: lock next section behind quiz completion

### Pattern: Lightbox Slides

**Behavioral signature:** `gotoplay` with `window: "LightboxWnd"`.

**Modern web equivalent:**
- Modal component or inline expandable section
- Extract lightbox slide content as accessible inline content

### Pattern: Custom JavaScript

**Behavioral signature:** `exe_javascript` action in trigger data.

**How it works in Storyline:**
- References an ID in `triggers.js` which dispatches to `user.js`
- Common use: score rounding, custom calculations

**Modern web equivalent:**
- Simple math: handle in `hydrate.js` or build step
- External API calls: flag as out of scope

---

## The Tagged Content Model

### Enhanced content-bucket.json structure

The extractor outputs tagged content where every piece of logic metadata was discovered behaviorally:

```json
{
  "variables": [
    {
      "name": "{authorChosenName}",
      "type": "boolean",
      "default": false
    }
  ],
  "pathGroups": [
    {
      "name": "{inferred from variable names}",
      "type": "user-choice",
      "selectorSlide": "{slideId}",
      "options": [
        { "variable": "{authorVar1}", "label": "{derived from var name}" },
        { "variable": "{authorVar2}", "label": "{derived from var name}" }
      ]
    }
  ],
  "questionBanks": {
    "draws": [
      {
        "drawId": "{id}",
        "shuffle": true,
        "drawCount": 10,
        "poolSize": 15,
        "conditions": { "var": "{authorVar}", "op": "eq", "val": true }
      }
    ],
    "questions": [
      {
        "slideId": "{id}",
        "question": "...",
        "choices": [...],
        "inDraws": ["{drawId}"],
        "conditions": { "var": "{authorVar}", "op": "eq", "val": true }
      }
    ]
  },
  "scenes": [{
    "slides": [{
      "contentBlocks": [
        { "type": "body", "text": "..." },
        {
          "type": "body",
          "text": "...",
          "state": "_default_Hover"
        }
      ],
      "layers": [
        {
          "layerId": "{id}",
          "contentBlocks": [{ "type": "body", "text": "..." }]
        }
      ],
      "logic": {
        "varsRead": ["{authorVar1}", "{authorVar2}"],
        "varsWritten": ["{authorVar3}"]
      },
      "navigation": {
        "next": [
          { "target": "{sceneId}.{slideId}", "condition": { "var": "{authorVar}", "op": "eq", "val": true } },
          { "target": "{sceneId}.{slideId}", "completionGate": true, "requiredItems": 3 }
        ]
      }
    }]
  }],
  "complexity": {
    "customVariables": 41,
    "triggerCount": 4043,
    "layerCount": 113,
    "questionBankSlides": 41,
    "questionDraws": 6,
    "patterns": ["path-selection", "section-gating", "question-banks", "layer-reveal", "state-content", "lightbox"],
    "outOfScope": ["drag-drop-simulation"]
  }
}
```

### How downstream phases use this

**Phase 3 (AI layout engine):** Sees `pathGroups` and understands "this course has a user-choice selector with N paths." Sees `questionBanks` with conditions and knows which quizzes belong to which path. Sees layer content and maps it to tabs/accordion. Structures the output with appropriate components per path.

**Phase 5 (build-course.js):** Reads `conditions` on components and adds `data-show-if` attributes. Adds the path-selector component.

**Phase 5b (hydrate.js):** Minimal state store — `{ variable: value }` map. Path-selector sets the variable. Sections show/hide based on current state.

**Future authoring tool:** Shows a path switcher UI with the discovered path names. Each section has a "visible in" property. Moving content between paths = changing a JSON property. No trigger wiring needed.

---

## Scope Boundaries

### In scope (automated modernisation)

- Path/role/difficulty selection → path-selector component + tagged sections
- Section completion gating → natural scroll order + progress tracking
- Layer show/hide (click-to-reveal) → accordion, tabs, or modal components
- State-based content (hover/click reveals) → tooltips, expandable text
- Completion-gated navigation → mandatory interactive content
- Knowledge gates (pass quiz to continue) → MCQ with feedback
- Question banks per path → tagged quiz components with draw metadata
- Lightbox slides → modal or inline expandable sections
- Simple custom JS → handle in build step

### Out of scope (flagged for manual review)

- Drag-and-drop simulations → simplify to matching quiz or comparison table
- Complex state machines (10+ interdependent variables) → flag, extract content only
- Canvas-drawn animations and motion paths → not representable in deep-scroll
- Custom JS with external API calls → flag as manual review needed
- Game-like interactions → flag, extract underlying content
- Tween/animation actions → visual-only, no content to extract

### Complexity assessment

Every extraction produces a `complexity` object signaling:
- How many custom variables exist
- How many triggers/conditions across all slides
- How many layers total
- How many question bank slides and draws
- Which behavioral patterns were detected
- What was simplified or flagged as out of scope

---

## Implementation Notes

### Parsing approach

Use the existing `parseStorylineJs()` — captures the full JSON via `window.globalProvideData()`. The engine reads additional keys that the original extractor ignored.

**Parsing targets:**
1. `data.js` → `variables[]`, `quizzes[]`, `slideBank`, `slideMap`, scene `slidedraws[]`
2. Per-slide JS → `events[]`, `actionGroups{}`, per-object events, timeline events
3. Per-slide JS → `slideLayers[]` structure (base vs overlay, layer IDs)
4. Per-slide JS → object `states[]` with text content per state

### Variable classification

1. Parse `data.js` for the `variables[]` array
2. Filter out variables matching fixed system patterns: `CurrentQuiz_*`, `*_RetryMode*`, `ReviewMode_*`, `RetryMode_*`, `LastSlideViewed_*`, `QuizAdvanceModeWarningShown`
3. Filter out object state references: anything with `_parent.`, `_this.`, dot-path object IDs, `_checked`, `_state`, `_hover`, `_disabled`, etc.
4. Remaining variables are custom author variables
5. **Classify by BEHAVIOR, not by naming convention.** Variable names are author-chosen and arbitrary:
   - **Path-selection:** 2+ boolean vars SET on the same slide AND READ on 2+ other slides to gate navigation
   - **Section-gating:** boolean vars each WRITTEN on 1-2 slides and READ elsewhere
   - **Explore-track:** number vars that are both WRITTEN and READ (counter pattern)
   - **Drag-drop:** detected by `ondragconnect`/`ondragout`/`ondragstart` events

### Trigger resolution

For each slide, walk all four trigger locations. For each action chain:
1. Resolve `exe_actiongroup` by looking up the named group in `slide.actionGroups`
2. Flatten nested `if_action` trees into condition → action pairs
3. Track which custom variables are read (in conditions) and written (in `adjustvar`)
4. Track navigation targets (`gotoplay`, including `window` type for lightbox detection)
5. Track layer operations (`show_slidelayer`, `hide_slidelayer`, `hideOthers`)
6. Track custom state changes (`setobjstate`)
7. Detect completion gates (conditions checking object states before navigation)

### Content tagging

After resolving triggers, tag each content block:
1. Base layer content with no conditions → always visible (shared)
2. Layer content → tagged with layer ID and trigger info
3. Slide reachable only via conditional navigation → tagged with path condition
4. Object state content → tagged with state name
5. Question bank slides → tagged with parent slidedraw(s) and path conditions

### Question bank path tracing

1. Parse `slideBank.slides[]` and each bank slide's JS file
2. Parse `scene.slidedraws[]` for draw configuration
3. For each draw, trace which slides navigate to it and what conditions gate that navigation
4. Direct conditional navigation: `if_action` → `gotoplay` to draw = exact condition
5. Layer-gated navigation: condition → show layer → layer button → draw = trace through layers
6. Inferred: slide reads path variables and navigates to draw = mark as path-dependent
7. Propagate draw conditions to their questions

### Navigation extraction

Extract from **both** sources:
1. **Player-level:** `ActGrpOnNextButtonClick` / `ActGrpOnPrevButtonClick` — may be phantom if default player is disabled
2. **Canvas-level:** `onrelease` → `gotoplay` on objects across all layers — the real navigation when player is disabled

Tag each navigation entry with its source. Downstream phases prioritise canvas navigation when both exist.

### Storyline version compatibility

**Supported:** Storyline 360 (all builds), Storyline 3
**Out of scope:** Storyline 2 (different export format), Storyline 1 (Flash-only)
