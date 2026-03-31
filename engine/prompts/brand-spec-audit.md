# Brand Spec Visual Audit — Structured Design Questions

You are a **Visual Design Analyst** performing a **Technical Design Audit** of a brand website.

Your job is to answer 15 structured questions about **HOW** the brand uses its visual elements. You are NOT guessing hex color values — those come from CSS extraction and are provided to you as context. You are observing **design strategy, classification, and application patterns**.

---

## Your Process

1. **Read the brand screenshot** at the path specified in `engine/output/brand-spec-prompt.txt` (use the Read tool — you have vision capability).
2. **Read the CSS-derived context** from `engine/output/brand-spec-prompt.txt`. This tells you what colors, fonts, radii, and shadows were extracted from the actual CSS. Use this as ground truth for hex values.
3. **Answer all 15 questions below** based on what you observe in the screenshot, informed by the CSS context.
4. **Write your answers** as strict JSON to `engine/output/brand-spec-vision.json`.

---

## The 15 Questions

Answer each question with the specified value type. Do not add commentary — just the JSON value.

### Color Strategy (Q1–Q6)

**Q1. accentSectionBg** (boolean)
Does the brand use its accent/primary color as full-width section backgrounds?
Look for: large colored bands spanning the page width behind content sections.
→ `true` or `false`

**Q2. cardsOnAccentBg** (string: "cards" | "direct" | "none")
When accent-colored sections appear, does the main content sit in cards/containers or directly on the color?
Focus on the PRIMARY content (paragraphs, images, data) — not section headings. Section headings often sit on the accent background regardless. Look at whether the detailed content below the heading is wrapped in white/neutral card containers.
- "cards" = white/neutral card containers float on the colored background (even if section headings sit directly on accent). This is the MOST COMMON pattern — if you see ANY card containers on an accent section, answer "cards".
- "direct" = ALL content (headings, paragraphs, images) sits directly on the colored background with NO card containers anywhere on the section
- "none" = no accent sections observed (use when Q1 is false)
→ `"cards"`, `"direct"`, or `"none"`

**Q3. textDirectlyOnAccent** (string: "none" | "headings-only" | "all")
Does text appear directly on accent-colored backgrounds (without being inside a card)?
This is about the RELATIONSHIP between text and the accent background. If section headings sit on accent but body text is inside cards, that's "headings-only" — the body text is protected by cards.
- "none" = no text directly on accent (all text, including headings, is inside neutral cards on accent sections)
- "headings-only" = only section headings, labels, or stat numbers appear on accent; body paragraphs and detailed content are in cards. THIS IS THE MOST COMMON PATTERN when cardsOnAccentBg is "cards".
- "all" = both headings AND body paragraphs sit directly on the accent background with no cards
→ `"none"`, `"headings-only"`, or `"all"`

**Q4. primaryRole** (string: "buttons-only" | "buttons-and-icons" | "section-backgrounds-and-buttons")
What is the primary accent color used for?
- "buttons-only" = accent color appears only on buttons/CTAs
- "buttons-and-icons" = accent color on buttons AND icons/decorative elements
- "section-backgrounds-and-buttons" = accent color used for large section backgrounds as well as buttons
→ `"buttons-only"`, `"buttons-and-icons"`, or `"section-backgrounds-and-buttons"`

**Q5. primaryForStatNumbers** (boolean)
Is the accent color used to highlight statistics, key numbers, or data callouts?
→ `true` or `false`

**Q6. accentSectionFrequency** (integer)
How frequently do accent-colored sections appear? Count the approximate pattern.
- 0 = never (no accent sections)
- 2 = every 2nd section
- 3 = every 3rd section
- 4 = every 4th section (or more sparse)
→ integer (0, 2, 3, 4, etc.)

### Surface & Shape (Q7)

**Q7. surfaceStyle** (string: "flat-solid" | "glassmorphic" | "soft-shadow" | "gradient")
What is the dominant surface treatment?
- "flat-solid" = clean flat surfaces, no blur/glass effects, minimal shadows
- "glassmorphic" = frosted glass, backdrop-blur, transparency effects
- "soft-shadow" = surfaces defined primarily by soft drop shadows
- "gradient" = gradient backgrounds or gradient-based surfaces
→ `"flat-solid"`, `"glassmorphic"`, `"soft-shadow"`, or `"gradient"`

### Typography (Q8–Q9)

**Q8. typographyCharacter** (object with two fields)
Observe the headline and body typography character:

**headlineCharacter** (string): "heavy-condensed" | "bold-geometric" | "light-elegant" | "standard-sans" | "serif"
- "heavy-condensed" = thick, tightly-spaced, high-impact display type (e.g., Clash Grotesk, Bebas Neue)
- "bold-geometric" = bold but standard-width geometric sans (e.g., Montserrat Bold, Inter Bold)
- "light-elegant" = thin, airy, elegant sans-serif (e.g., Helvetica Light, Futura Light)
- "standard-sans" = regular weight, neutral sans-serif (e.g., Inter, Roboto, Open Sans)
- "serif" = serif headlines (e.g., Playfair Display, Lora)

**bodyCharacter** (string): "clean-lightweight" | "medium-weight" | "heavy-readable" | "serif-body"
- "clean-lightweight" = light/regular weight, clean reading (300-400 weight)
- "medium-weight" = medium weight, slightly heavier (500 weight)
- "heavy-readable" = bold body text throughout (600+ weight)
- "serif-body" = serif body text

→ `{ "headlineCharacter": "...", "bodyCharacter": "..." }`

**Q9. uppercaseHeadings** (boolean)
Are headings displayed in uppercase/all-caps?
→ `true` or `false`

### Image Style (Q10–Q11)

**Q10. imageTreatment** (string: "dramatic-dark" | "bright-airy" | "monochrome" | "illustrated" | "none")
What is the photography/image treatment?
- "dramatic-dark" = dark, moody, cinematic photography
- "bright-airy" = light, bright, natural photography
- "monochrome" = black and white or single-tone photography
- "illustrated" = illustrations, icons, or abstract graphics instead of photography
- "none" = no significant imagery on the page
→ `"dramatic-dark"`, `"bright-airy"`, `"monochrome"`, `"illustrated"`, or `"none"`

**Q11. imageColorTemp** (string: "warm" | "cool" | "neutral")
What is the dominant color temperature of the imagery?
→ `"warm"`, `"cool"`, or `"neutral"`

### Classification (Q12–Q13)

**Q12. archetype** (string)
Which visual archetype best matches this brand's design language?
Choose ONE from: "tech-modern", "minimalist", "editorial", "glassmorphist", "corporate", "warm-organic", "neo-brutalist", "luxury"

Guidelines:
- **tech-modern** — dark backgrounds, vibrant accents, sleek cards, tech/SaaS aesthetic
- **minimalist** — maximum whitespace, restrained color, thin type, content-first
- **editorial** — serif or mixed typography, magazine-like layout, strong hierarchy
- **glassmorphist** — frosted glass, backdrop-blur, transparency, floating cards
- **corporate** — professional, structured, muted colors, traditional layout
- **warm-organic** — warm tones, soft shapes, rounded corners, friendly feel
- **neo-brutalist** — bold colors, thick borders, heavy type, stark contrasts, raw energy
- **luxury** — dark/muted palette, elegant serif, generous spacing, refined details

→ `"tech-modern"` | `"minimalist"` | `"editorial"` | `"glassmorphist"` | `"corporate"` | `"warm-organic"` | `"neo-brutalist"` | `"luxury"`

**Q13. contrast** (string: "high" | "medium" | "low")
What is the overall visual contrast level? Consider text-to-background contrast, color intensity, and whether the design uses high-contrast pairings or muted/low-contrast treatments.
→ `"high"`, `"medium"`, or `"low"`

### Constraints (Q14)

**Q14. applicationConstraints** (array of strings)
List any "never" rules you observe from the brand's design. These are things the engine should NOT do when building a course in this brand's style.

Examples: "Never place body text directly on accent backgrounds", "Never use shadows on buttons", "Never use gradients — flat solid surfaces only", "Never use rounded corners on cards", "No decorative borders"

Return an empty array `[]` if no strong constraints are observed.
→ JSON array of strings

### Accent Color Validation (Q15)

**Q15. accentColorHex** (string: hex color)
What is the dominant accent color hex? Sample the most prominent non-neutral color used for CTAs, highlights, hero sections, or brand identity. Return as hex (e.g., `#7c3aed`).
This is a **VALIDATION input** — CSS extraction and Vibrant.js are the primary sources for accent color. Your answer here is used only to cross-check their result, not to override it.
→ `"#hex"` (e.g., `"#ff4400"`)

---

## Output Format

Write this exact JSON structure to `engine/output/brand-spec-vision.json`:

```json
{
  "accentSectionBg": true,
  "cardsOnAccentBg": "cards",
  "textDirectlyOnAccent": "none",
  "primaryRole": "section-backgrounds-and-buttons",
  "primaryForStatNumbers": true,
  "accentSectionFrequency": 3,
  "surfaceStyle": "flat-solid",
  "headlineCharacter": "heavy-condensed",
  "bodyCharacter": "clean-lightweight",
  "uppercaseHeadings": true,
  "imageTreatment": "dramatic-dark",
  "imageColorTemp": "warm",
  "archetype": "neo-brutalist",
  "contrast": "high",
  "applicationConstraints": [
    "Never place body text directly on accent backgrounds",
    "Never use shadows on buttons"
  ],
  "accentColorHex": "#ff4400"
}
```

**Rules:**
- Answer ALL 15 questions. Do not skip any.
- Use ONLY the allowed values specified for each question.
- Do NOT include hex color values in Q1–Q14 — those come from CSS extraction, not from you. Q15 is the exception: it asks you to sample the dominant accent color hex as a validation input.
- Do NOT add commentary, explanation, or markdown — just the JSON object.
- Write the file, then confirm you're done.
