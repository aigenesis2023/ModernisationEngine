# AI Image Generator — Prompt Templates

Prompt templates for generating images via the Pollinations free API. Each template is tailored to a specific component type, with the right dimensions, style, and brand color integration.

---

## API Endpoint

```
https://image.pollinations.ai/prompt/{encoded_prompt}?width={w}&height={h}&seed={seed}&nologo=true&enhance=true
```

- `{encoded_prompt}` — URL-encoded prompt string
- `width` / `height` — Target dimensions
- `seed` — Random integer for reproducibility (use componentId hash)
- `nologo=true` — Remove Pollinations watermark
- `enhance=true` — Enable prompt enhancement for better quality

---

## Dimensions by Component Type

| Component Type | Dimensions | Aspect Ratio | Use |
|---|---|---|---|
| `hero` | 1920 x 1080 | 16:9 | Full-viewport background |
| `graphic` | 1920 x 1080 | 16:9 | Full-width showcase |
| `graphic-text` | 800 x 600 | 4:3 | Side-by-side with text |
| `bento` (per card) | 600 x 400 | 3:2 | Card background |
| `narrative` (per slide) | 800 x 600 | 4:3 | Carousel slide image |
| `full-bleed` | 1920 x 800 | 12:5 | Ultra-wide section divider |
| `labeled-image` | 1200 x 800 | 3:2 | Annotated diagram |
| `image-gallery` (per image) | 600 x 400 | 3:2 | Gallery grid item |

---

## Base Prompt Template

Every image prompt should follow this structure:

```
{subject_description}, {style_directive}, {color_hints}, {mood}, {technical_specs}
```

### Subject Description
The specific visual content. Be concrete and descriptive:
- Good: "Cutaway technical diagram of an electric vehicle battery pack showing individual cells and cooling channels"
- Bad: "EV battery"

### Style Directive
Match the brand mood and maintain consistency across the course:

| Brand Mood | Style Directive |
|---|---|
| `corporate` | "clean corporate photography, professional lighting, neutral background, sharp focus" |
| `creative` | "modern creative illustration, bold colors, dynamic composition, artistic flair" |
| `elegant` | "sophisticated photography, soft lighting, premium feel, subtle gradients" |
| `friendly` | "warm approachable illustration, soft colors, inviting atmosphere, rounded shapes" |
| `technical` | "precise technical illustration, blueprint style, clean lines, informational" |

### Color Hints
Integrate brand colors naturally:
- For dark themes: "dark background with {brand.accent} accent highlights, {brand.primary} glow effects"
- For light themes: "clean white background, {brand.primary} color accents, bright and airy"
- Always: "color palette featuring {brand.primary} and {brand.accent}"

### Mood
Derived from brand and content:
- "professional and authoritative"
- "modern and innovative"
- "warm and educational"
- "sleek and futuristic"

### Technical Specs
Always append:
- "high resolution, sharp details, no text, no watermarks, no logos"
- For photographs: "professional photography, shallow depth of field"
- For illustrations: "flat design illustration, vector style" or "3D rendered illustration"
- For diagrams: "technical diagram, clean labels, infographic style"

---

## Per-Component Prompt Templates

### Hero Background
```
{course_topic} themed wide-angle scene, cinematic composition, dramatic lighting,
color palette featuring {brand.primary} and {brand.accent} tones,
{brand_mood} atmosphere, slight motion blur for dynamism,
dark enough to overlay white text legibly,
professional photography, high resolution, no text, no watermarks, 16:9 aspect ratio
```

### Graphic (Full-Width)
```
{specific_subject_from_content}, {style_for_mood},
color accents of {brand.primary} and {brand.accent},
centered composition with breathing room,
high resolution, sharp details, no text, no watermarks, 16:9 aspect ratio
```

### Graphic-Text (Side Image)
```
{specific_subject_paired_with_text_content}, {style_for_mood},
{brand.primary} color accents, clean background,
portrait-friendly composition (subject fills frame),
professional quality, no text, no watermarks, 4:3 aspect ratio
```

### Bento Card Background
```
{card_topic} concept, {style_for_mood},
dark gradient overlay safe (content will overlay this image),
{brand.accent} color tones, atmospheric,
high contrast, no text, no watermarks, 3:2 aspect ratio
```

### Narrative Slide Image
```
{slide_step_topic}, {style_for_mood},
{brand.primary} and {brand.accent} color tones,
clear focal point, educational illustration style,
no text, no watermarks, 4:3 aspect ratio
```

### Full-Bleed (Section Divider)
```
{transition_topic} wide panoramic scene, ultra-wide cinematic composition,
{brand.primary} and {brand.secondary} color grading,
atmospheric depth, dramatic lighting, {brand_mood} mood,
dark enough for text overlay in center,
professional photography, no text, no watermarks, ultra-wide 12:5 aspect ratio
```

### Labeled Image (Annotated Diagram)
```
{subject_for_annotation} technical illustration, clean clinical style,
neutral background ({brand.background} tones), clear distinct labeled areas,
well-separated components for marker placement,
precise technical rendering, educational diagram,
no text labels (markers added programmatically), no watermarks, 3:2 aspect ratio
```

### Image Gallery Item
```
{specific_item_being_shown}, {style_for_mood},
consistent style with other gallery items,
{brand.accent} color accents, clean background,
product-photography style, no text, no watermarks, 3:2 aspect ratio
```

---

## Brand Color Integration Examples

### Dark Theme (e.g. #383838 bg, #0099ff primary, #ff3c71 accent)
```
"...dark moody background with electric blue (#0099ff) accent lighting and subtle pink (#ff3c71) highlights,
deep shadows, neon-accented atmosphere..."
```

### Light Theme (e.g. #ffffff bg, #2563eb primary, #f59e0b accent)
```
"...clean white background with bright blue (#2563eb) color accents and warm amber (#f59e0b) highlights,
bright and airy, professional studio lighting..."
```

---

## Prompt Construction Script Logic

The `generate-images.js` script should:

1. Read `course-layout.json`
2. For each component with `imagePrompt`:
   - Use the prompt directly (the layout engine already wrote a good prompt)
   - Append brand color hints if not already present
   - Append "no text, no watermarks, high resolution"
   - URL-encode the final prompt
   - Set dimensions based on the component type table above
3. For each component with `imagePrompts` (plural):
   - Process each item's `prompt` with the same enhancement
   - Use the specified `dimensions` from each item
4. Download each image and save to `v2/output/images/`
5. Update the layout JSON with the actual image paths

### File Naming Convention
```
{componentId}.jpg                    — Single image components
{componentId}-{key}.jpg              — Multi-image components (e.g. comp-005-item-0.jpg)
```

### Rate Limiting
- Pollinations is free but rate-limited
- Add a 2-second delay between requests
- Retry failed requests once after a 5-second wait

### Fallback
- If image generation fails after retry, leave `_graphic.large` empty
- The renderer gracefully handles missing images (components still render, just without visuals)

---

## Quality Guidelines for Image Prompts

### Do
- Be specific about the subject ("lithium-ion battery cell cross-section" not "battery")
- Include the educational context ("emergency responder approaching damaged vehicle")
- Reference the brand color palette by hex values
- Specify the visual style consistently across all images in a course
- Match the brand mood (corporate = photo, creative = illustration, etc.)

### Don't
- Include text in images (it renders poorly in AI generation)
- Reference brand names, trademarks, or real company logos
- Use violent, graphic, or inappropriate imagery
- Request photorealistic faces (AI struggles with these)
- Specify more than 3-4 style keywords (keeps the prompt focused)
