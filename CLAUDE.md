# CLAUDE.md — Modernisation Engine

## What This Project Is
An AI-powered tool that converts legacy SCORM 1.2 e-learning courses (Articulate Storyline exports) into modern, branded, premium deep-scroll web experiences. The SCORM file is treated as a **knowledge base** (not a blueprint) — content is extracted, then an AI layout engine redesigns the course from scratch using a premium component library with AI-generated branded images.

**Live at:** https://aigenesis2023.github.io/ModernisationEngine/

---

## Architecture: V2 (AI-Powered Redesign)

### Core Principle
The SCORM file is a **knowledge base**, not a blueprint. We extract all text, quiz data, and media inventory — then an AI "Senior Instructional Designer" creates a brand-new course layout using premium React components and AI-generated branded images. This gives full creative control over the output without being constrained by Storyline's internal structure.

### Pipeline Overview
```
1. EXTRACTION:  SCORM file → Simplified Parser → Content Bucket (JSON)
2. BRANDING:    Brand URL → Brand Scraper → Brand Profile (colors, fonts, logo, style)
3. DESIGN:      Content Bucket + Brand Profile → LLM Layout Engine → Course Layout (JSON)
4. IMAGES:      Course Layout → AI Image Generator (Pollinations) → Branded images
5. RENDER:      Course Layout + Images → React Component Renderer → Beautiful course
6. EDIT:        Course JSON → AI Editor UI → User customization (future)
```

### Why V2 (not the old V1 rule-based approach)
The V1 approach tried to reverse-engineer Storyline's internal structure (layers, triggers, states, coordinates) and mechanically transform it into web components using if/else heuristics. After extensive development, this approach hit a hard ceiling:
- 95% of images were discarded by the role classifier
- Rule-based heuristics can't make intelligent design decisions (sees "4 layers" → always picks accordion, regardless of content meaning)
- Output was visually monotonous (same glass card treatment for everything)
- Every fix created new edge cases because Storyline's structure was never designed for external consumption

V2 solves this by treating the SCORM as raw content and letting AI intelligence handle all design decisions.

---

## Development Workflow (Current — Proof of Concept)

### Key Principle: Everything in the codebase, nothing ad-hoc
All prompts, schemas, and scripts live in the repo under `v2/`. The only difference between testing and production is WHO runs the layout engine prompt — Claude Code (testing) vs API call (production). Everything else is automated code that works identically in both modes.

### Directory structure:
```
v2/
  schemas/
    content-bucket.schema.json    ← Validated extraction output format
    course-layout.schema.json     ← Validated layout engine output format
    component-library.json        ← All components: type, props, when to use, examples
  prompts/
    layout-engine.md              ← Full system prompt for AI layout engine
    image-generator.md            ← Prompt templates for image generation per component
  scripts/
    extract.js                    ← Simplified SCORM parser → content-bucket.json
    scrape-brand.js               ← Brand URL → brand-profile.json
    generate-images.js            ← Layout JSON → Pollinations API → images
    build-course.js               ← Layout + images + brand → final static HTML
  output/
    content-bucket.json           ← Extracted from test SCORM
    brand-profile.json            ← Scraped from brand URL
    course-layout.json            ← Layout engine output
    images/                       ← Generated images
```

### Workflow (same for testing AND production):
1. `node v2/scripts/extract.js EV/` → `v2/output/content-bucket.json`
2. `node v2/scripts/scrape-brand.js "https://www.backgrounds.supply"` → `v2/output/brand-profile.json`
3. **Layout engine**: feed content + brand + prompt → `v2/output/course-layout.json`
   - **Testing**: Claude Code reads the prompt file and content, writes the layout JSON
   - **Production**: API call sends the same prompt + content, receives the same JSON
4. `node v2/scripts/generate-images.js` → images in `v2/output/images/`
5. `node v2/scripts/build-course.js` → final HTML at GitHub Pages URL

### Testing setup:
- Test SCORM: `EV/` directory (gitignored, uploaded to Codespace)
- Brand URL: `https://www.backgrounds.supply/?ref=onepagelove` (in `WEBSITE BRANDING REF.rtf`)
- GitHub Pages URL serves the finished course directly — no upload UI
- User previews, gives feedback, engines are iterated and improved

**Once concept is proven**, we add:
- Upload UI for SCORM file + brand URL + API key
- Claude API integration (swaps in for the manual layout engine step)
- AI editor for end-user customization

---

## Phase 1: Content Extraction (Simplified Parser)

The parser's job is now "structured dumb" — extract all meaningful content without trying to interpret Storyline's layout or interaction model.

### What to extract:
- **Course title** from imsmanifest.xml
- **Scene boundaries** (Storyline's intentional topic groupings — use as section markers)
- **All text content** per slide (headings, body text, callouts — cleaned of junk)
- **Quiz data** (question text, choices with correct answers, feedback) — structured, not raw text
- **Form fields** (labels, field types)
- **Media inventory** (list of all image/video files with filenames)
- **Video references** (which slides reference which video files)

### What to NOT extract (removed from V1):
- Layer hierarchy, trigger patterns, state analysis
- Image role classification (background/hero/content/icon/decorative)
- Interaction model analysis (click-reveal, auto-reveal, conditional)
- Presentation heuristics (classifyPresentation)
- Coordinate/depth/size data for layout inference

### Content Bucket schema:
```json
{
  "title": "EV Awareness & Safety",
  "sections": [
    {
      "sceneId": "scene1",
      "sceneTitle": "Recognising an EV",
      "slides": [
        {
          "slideId": "5WKv4q3uVlq",
          "texts": ["heading text", "body paragraph 1", "body paragraph 2"],
          "images": ["5d4Z2zggdHJ.jpg"],
          "videos": [],
          "quiz": null,
          "formFields": []
        }
      ]
    }
  ],
  "media": {
    "images": ["5d4Z2zggdHJ.jpg", "6FsIKpGsVCv.jpg", ...],
    "videos": ["video_5g5siribedP.mp4"]
  },
  "noiseStats": { "textsDropped": 264, "shapesDropped": 55 }
}
```

### Noise filtering (still needed):
- Auto-generated labels ("Rectangle 1", "Shape 3")
- Icon alt-text ("arrow icon 1")
- Shape filenames (Shape*.png, txt__default_*.png)
- Storyline UI text ("Click to reveal", player instructions)
- Very short text (< 3 chars)

---

## Phase 2: Brand Scraping (Keep from V1)

Brand scraper (`brand-scraper.js`) works well and is kept as-is:
- Fetches URL via CORS proxy (`https://cors-proxy.leoduncan-elearning.workers.dev`)
- Extracts: colors (primary, secondary, accent, background, text), typography (fonts, sizes, weights), style (border-radius, button style, mood), logo
- Falls back to SCORM project colors if scraping fails, then to generic defaults

---

## Phase 3: AI Layout Engine

### For proof-of-concept (current):
Claude Code (this tool) acts as the layout engine. It reads the Content Bucket + Brand Profile and manually designs the course layout JSON.

### For production (future):
An LLM API call (Claude Sonnet or Haiku) replaces this manual step. The system prompt describes a Senior Instructional Designer persona with a component reference sheet.

### Component Library (target: 25-30 premium components)

**Existing (from V1 — keep and polish):**
| Component | Purpose |
|---|---|
| `hero` / HeroSplash | Full-viewport opening with animated title, background image, scroll indicator |
| `text` / TextBlock | Clean text with heading, body, instruction |
| `graphic` / GraphicBlock | Full-width image with hover zoom |
| `graphic-text` / GraphicText | Side-by-side text + image split (alternating left/right) |
| `accordion` / SilkyAccordion | Expandable panels with completion tracking |
| `mcq` / MCQPro | Quiz with selection, submit, feedback, retry |
| `narrative` / NarrativeSlider | Prev/next carousel with dots |
| `bento` / BentoGrid | Multi-card grid with image backgrounds |
| `data-table` / DataTable | Auto-parsed table from structured data |
| `media` / MediaBlock | Video player with custom play overlay |
| `textinput` / TextInputBlock | Multi-field form with labels + submit |
| `branching` / BranchingCards | Selectable option cards with letter badges |

**New components to build:**
| Component | Purpose |
|---|---|
| `timeline` / TimelineStepper | Numbered sequential steps with connecting line |
| `comparison` / ComparisonTable | Side-by-side columns with checkmarks/crosses |
| `stat-callout` / StatCallout | Large numbers with context labels |
| `pullquote` / PullQuote | Emphasized text with accent bar (key takeaways, warnings) |
| `key-term` / KeyTerm | Highlighted vocabulary with inline definition |
| `checklist` / Checklist | Checkable items with completion tracking |
| `tabs` / TabPanel | Horizontal tabbed content panels |
| `flashcard` / Flashcard | Flip interaction for term/definition pairs |
| `labeled-image` / LabeledImage | Image with numbered hotspot markers |
| `process-flow` / ProcessFlow | Connected nodes showing a workflow |
| `image-gallery` / ImageGallery | Grid/masonry of multiple images |
| `full-bleed` / FullBleedImage | Edge-to-edge image with overlay text (section breaks) |
| `video-transcript` / VideoTranscript | Video player with expandable transcript |

---

## Phase 4: AI Image Generation

**Strategy: Generate ALL images with AI for MVP.**

The SCORM file's original images are mostly Storyline artifacts (shapes, text-as-image, low-res screenshots). Instead of trying to salvage them, generate fresh branded images for every section.

### Image generation approach:
- Use **Pollinations** free API for MVP (`https://image.pollinations.ai/prompt/...`)
- Prompt includes: section topic, brand colors from URL (#0099ff, #ff3c71), style directive
- Dimensions specified per component type (16:9 for hero/full-bleed, 1:1 for cards, 4:3 for graphic-text)
- Style: modern, clean, tech-professional, matching brand aesthetic
- **User can replace any image** via the AI editor (future)

### Moving to better image generation later:
- DALL-E 3, Flux, or Stable Diffusion for higher quality
- Brand style consistency via image-to-image with brand colors
- Potentially keep original SCORM photos where they're high-quality (editor option)

---

## Phase 5: React Renderer (Keep and Polish from V1)

### Tech Stack (unchanged):
- React 19.2 + Vite 8.0
- Tailwind CSS 4.2
- Framer Motion 12.38
- Zustand 5.0
- vite-plugin-singlefile 2.3

### Building the Template:
```bash
cd blade-runner-engine
npm install
npx vite build
cp dist/index.html ../blade-runner-template.html
```

### Key files:
- `blade-runner-engine/src/App.jsx` — loads window.courseData + window.brandData
- `blade-runner-engine/src/components/CourseRenderer.jsx` — recursive JSON → React tree
- `blade-runner-engine/src/components/ComponentRegistry.js` — maps type strings → components
- `blade-runner-engine/src/theme/ThemeEngine.js` — brand → CSS variables
- `blade-runner-engine/src/store/courseStore.js` — Zustand state management
- `blade-runner-engine/src/index.css` — CSS design system variables

### Design System:
- All colors/fonts/radii are CSS custom properties set by ThemeEngine at runtime
- Dark mode default, light mode when brand background luminance > 0.55
- Glass card styling adapts to background brightness
- All components use `var(--ui-glass)`, `var(--brand-primary)`, etc. — never hardcoded colors

---

## Phase 6: AI Editor (Future)

Since the course is a JSON tree of components, building an editor is straightforward:
- User clicks a block → sidebar opens
- Options: "Change to Accordion", "Swap Image", "Regenerate Image", "Edit Text", "Delete Section"
- "Regenerate" sends the section content back to the LLM for a redesign
- Image replacement via upload or AI regeneration with new prompt
- Export: download as SCORM package, HTML, or JSON

---

## Test Files
- `EV/` — Full 108-slide EV Awareness & Safety course (gitignored, uploaded to Codespace)
- `WEBSITE BRANDING REF.rtf` — Contains brand URL: `https://www.backgrounds.supply/?ref=onepagelove`
- `TEST SCORM/` — Small test SCORM (committed to repo)

## CORS Proxy
`https://cors-proxy.leoduncan-elearning.workers.dev`

---

## ⛔ ABSOLUTE RULE — UNIVERSAL ENGINE, NOT SPECIFIC FIXES

**Every engine change must work for ANY Storyline SCORM file.**

The test SCORM files are diagnostic tools. Fixing specific output for specific files is counterproductive.

**Branding source of truth:**
- Brand URL website → ONLY source for visual identity
- SCORM file → ONLY source for content and structure
- Original SCORM styling is IRRELEVANT

---

## V1 Architecture (Legacy — kept in codebase for reference)

The old rule-based pipeline is still in the codebase but will be superseded by V2:
- `engine/scorm-parser.js` — full Storyline structure extraction (to be simplified)
- `engine/content-planner.js` — heuristic presentation classification (to be replaced by LLM)
- `engine/adapt-translator.js` — rule-based component mapping (to be replaced by LLM)
- `engine/brand-scraper.js` — brand extraction (kept as-is)
- `engine/app.js` — pipeline orchestrator (to be rewritten for V2)
