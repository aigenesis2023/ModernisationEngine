#!/usr/bin/env node
/**
 * V5 Image Generator — Brand-Description-Informed
 *
 * Reads course-layout.json for content subjects and brand-design.md for
 * photographic treatment. Generates images that match the brand mood.
 *
 * The image prompts from course-layout.json describe WHAT to show (subject).
 * The brand description determines HOW it should look (photographic mood).
 * Image prompts contain ONLY photographic terms — never UI design elements.
 *
 * Usage:
 *   node v5/scripts/generate-images.js
 *
 * Input:  v5/output/course-layout.json   (content subjects)
 *         v5/output/brand-design.md       (primary — natural language brand description)
 *         v5/output/brand-profile.json    (fallback — imageTreatment field)
 *         v5/output/design-tokens.json    (legacy fallback)
 *         v5/output/stitch-course-raw.html (legacy fallback)
 * Output: v5/output/images/*.jpg + updated course-layout.json
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

// ─── Config ──────────────────────────────────────────────────────────
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const HF_TOKEN = process.env.HF_TOKEN || '';

const OUTPUT_DIR = path.resolve('v5/output/images');
const LAYOUT_PATH = path.resolve('v5/output/course-layout.json');
const BRAND_DESIGN_PATH = path.resolve('v5/output/brand-design.md');
const BRAND_PATH = path.resolve('v5/output/brand-profile.json');
const TOKENS_PATH = path.resolve('v5/output/design-tokens.json');
const STITCH_PATH = path.resolve('v5/output/stitch-course-raw.html');

const DELAY_MS = 3000;
const RETRY_DELAY_MS = 8000;
const MAX_DIM = 1024;

// ─── Dimensions by component type ────────────────────────────────────
// Fallback dimensions when Stitch HTML doesn't provide sizing info
const DIMENSIONS = {
  hero:           { width: 1024, height: 576  },  // 16:9
  graphic:        { width: 1024, height: 576  },  // 16:9
  'graphic-text': { width: 768,  height: 576  },  // 4:3
  bento:          { width: 576,  height: 384  },  // 3:2
  narrative:      { width: 768,  height: 576  },  // 4:3
  'full-bleed':   { width: 1024, height: 432  },  // ~12:5
  'labeled-image':{ width: 1024, height: 680  },  // 3:2
  'image-gallery':{ width: 576,  height: 384  },  // 3:2
  default:        { width: 768,  height: 576  },
};

function getDimensions(componentType) {
  return DIMENSIONS[componentType] || DIMENSIONS.default;
}

// ─── Design Token Analysis (V5) ──────────────────────────────────────
// Reads from extracted design-tokens.json for cleaner, more reliable analysis
function analyseDesignTokens(tokens) {
  const design = {
    colourTemperature: 'neutral',
    lightingMood: 'balanced',
    styleRegister: 'professional',
    dominantTones: [],
    isDark: tokens.isDark || false,
  };

  // Theme-based lighting
  if (tokens.isDark) {
    const bgColor = tokens.colors?.background || '';
    const lum = bgColor ? perceivedLuminance(bgColor) : 0.1;
    design.lightingMood = lum < 0.15 ? 'moody' : 'balanced';
  } else {
    design.lightingMood = 'bright';
  }

  // Colour temperature from primary/secondary
  const primary = tokens.colors?.primary;
  const secondary = tokens.colors?.secondary;
  const tones = [];
  if (primary) { tones.push(primary); design.colourTemperature = getColourTemperature(primary); }
  if (secondary) {
    tones.push(secondary);
    const temp2 = getColourTemperature(secondary);
    if (design.colourTemperature !== temp2 && temp2 !== 'neutral') {
      design.colourTemperature = temp2;
    }
  }
  design.dominantTones = tones;

  // Style register from border radius and glass effects
  const hasSmallRadius = tokens.borderRadius?.DEFAULT && parseFloat(tokens.borderRadius.DEFAULT) < 0.2;
  const hasGlass = tokens.tailwindConfig && /glass|blur|backdrop/i.test(tokens.tailwindConfig);

  if (hasGlass) design.styleRegister = 'creative';
  else if (hasSmallRadius) design.styleRegister = 'editorial';
  else design.styleRegister = 'professional';

  return design;
}

// ─── Stitch Design Analysis ──────────────────────────────────────────
// Extracts design treatment from Stitch's actual HTML output (V4 fallback)
function analyseStitchDesign(stitchHtml) {
  const design = {
    colourTemperature: 'neutral',  // warm, cool, neutral
    lightingMood: 'moody',         // moody, bright, balanced
    styleRegister: 'professional', // professional, creative, technical, editorial
    dominantTones: [],             // hex colours that dominate the design
    isDark: true,
  };

  // Extract Tailwind config colours from Stitch output
  const configMatch = stitchHtml.match(/tailwind\.config\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (!configMatch) return design;

  // Extract background colour
  const bgMatch = stitchHtml.match(/"background"\s*:\s*"(#[0-9a-fA-F]{3,8})"/);
  if (bgMatch) {
    const lum = perceivedLuminance(bgMatch[1]);
    design.isDark = lum < 0.4;
    design.lightingMood = lum < 0.15 ? 'moody' : lum < 0.4 ? 'balanced' : 'bright';
  }

  // Extract primary and secondary colours to determine temperature
  const primaryMatch = stitchHtml.match(/"primary"\s*:\s*"(#[0-9a-fA-F]{3,8})"/);
  const secondaryMatch = stitchHtml.match(/"secondary"\s*:\s*"(#[0-9a-fA-F]{3,8})"/);
  const surfaceMatch = stitchHtml.match(/"surface"\s*:\s*"(#[0-9a-fA-F]{3,8})"/);

  const tones = [];
  if (primaryMatch) tones.push(primaryMatch[1]);
  if (secondaryMatch) tones.push(secondaryMatch[1]);
  if (surfaceMatch) tones.push(surfaceMatch[1]);
  design.dominantTones = tones;

  // Determine colour temperature from primary/secondary
  if (primaryMatch) {
    const temp = getColourTemperature(primaryMatch[1]);
    if (secondaryMatch) {
      const temp2 = getColourTemperature(secondaryMatch[1]);
      // Average the two
      design.colourTemperature = (temp === temp2) ? temp :
        (temp === 'neutral' || temp2 === 'neutral') ? (temp === 'neutral' ? temp2 : temp) : 'neutral';
    } else {
      design.colourTemperature = temp;
    }
  }

  // Determine style register from CSS patterns
  const hasGlass = /glass|backdrop-filter|blur/i.test(stitchHtml);
  const hasGradients = (stitchHtml.match(/gradient/gi) || []).length > 5;
  const hasSharpCorners = /"borderRadius".*?"DEFAULT"\s*:\s*"0\.(0|1)/i.test(stitchHtml);

  if (hasGlass && hasGradients) {
    design.styleRegister = 'creative';
  } else if (hasSharpCorners) {
    design.styleRegister = 'editorial';
  } else {
    design.styleRegister = 'professional';
  }

  return design;
}

function getColourTemperature(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 'neutral';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Warm = red/orange/yellow dominant, Cool = blue/purple dominant
  const warmth = (r * 1.2 + g * 0.5) - (b * 1.5 + g * 0.3);
  if (warmth > 60) return 'warm';
  if (warmth < -60) return 'cool';
  return 'neutral';
}

function perceivedLuminance(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ─── Extract Image Treatment from Brand Description ─────────────────
// Reads brand-design.md and extracts just the photographic mood for images.
// NEVER includes UI design elements (glassmorphism, pill buttons, etc.)
function extractTreatmentFromDescription(description) {
  // Try to find an "Image Treatment" section
  const sectionMatch = description.match(/##\s*Image Treatment\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
  if (sectionMatch) {
    const raw = sectionMatch[1].trim();
    // Clean: take first paragraph, strip markdown formatting
    const firstPara = raw.split('\n\n')[0].replace(/[*_#]/g, '').trim();
    if (firstPara.length > 10) return firstPara;
  }

  // Fallback: derive photographic mood from overall tone words in the description
  const lower = description.toLowerCase();
  const parts = [];

  // Lighting
  if (lower.includes('dark') || lower.includes('moody') || lower.includes('midnight') || lower.includes('deep shadow')) {
    parts.push('dramatic low-key lighting, deep shadows');
  } else if (lower.includes('bright') || lower.includes('airy') || lower.includes('light') || lower.includes('luminous')) {
    parts.push('clean bright natural lighting, soft even illumination');
  } else {
    parts.push('balanced professional lighting');
  }

  // Colour temperature
  if (lower.includes('warm') || lower.includes('coral') || lower.includes('amber') || lower.includes('golden')) {
    parts.push('warm colour tones');
  } else if (lower.includes('cool') || lower.includes('blue') || lower.includes('teal') || lower.includes('cyan') || lower.includes('ice')) {
    parts.push('cool blue-toned atmosphere');
  }

  // Style
  if (lower.includes('elegant') || lower.includes('sophisticated') || lower.includes('premium') || lower.includes('luxury')) {
    parts.push('refined professional photography');
  } else if (lower.includes('creative') || lower.includes('bold') || lower.includes('dynamic') || lower.includes('vibrant')) {
    parts.push('dynamic artistic composition');
  } else {
    parts.push('professional photography, clean composition');
  }

  return parts.join(', ');
}

// ─── Design-Informed Prompt Enhancement ──────────────────────────────
// Combines the content subject (from layout) with visual treatment (from Stitch)
function buildDesignTreatment(design) {
  const parts = [];

  // Lighting mood
  if (design.lightingMood === 'moody') {
    parts.push('dramatic low-key lighting, deep shadows, selective highlights');
  } else if (design.lightingMood === 'bright') {
    parts.push('clean bright natural lighting, soft even illumination');
  } else {
    parts.push('balanced professional lighting');
  }

  // Colour temperature
  if (design.colourTemperature === 'warm') {
    parts.push('warm colour tones in highlights and ambient light');
  } else if (design.colourTemperature === 'cool') {
    parts.push('cool blue-toned shadows and ambient light');
  }

  // Style register
  if (design.styleRegister === 'creative') {
    parts.push('artistic composition, dynamic angles');
  } else if (design.styleRegister === 'editorial') {
    parts.push('editorial photography style, precise composition');
  } else if (design.styleRegister === 'technical') {
    parts.push('technical precision, clean detailed rendering');
  } else {
    parts.push('professional photography, clean composition');
  }

  return parts.join(', ');
}

// ─── Image generation via Hugging Face ───────────────────────────────
async function generateImage(prompt, dimensions, outputFilename) {
  const { width, height } = dimensions;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  const enhancedPrompt = `${prompt}, high resolution, sharp details, no text, no watermarks`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  Generating: ${outputFilename} (attempt ${attempt})...`);

      const resp = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: enhancedPrompt,
          parameters: { width, height },
        }),
        signal: AbortSignal.timeout(120000),
      });

      if (resp.status === 503) {
        const body = await resp.json().catch(() => ({}));
        const waitTime = (body.estimated_time || 20) * 1000;
        console.log(`  Model loading, waiting ${Math.round(waitTime / 1000)}s...`);
        await sleep(Math.min(waitTime, 30000));
        continue;
      }

      if (resp.status === 429) {
        console.log(`  Rate limited, waiting ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errText.substring(0, 200)}`);
      }

      const buffer = Buffer.from(await resp.arrayBuffer());

      if (buffer.length < 1000) {
        const text = buffer.toString('utf-8');
        if (text.includes('"error"')) throw new Error(`API error: ${text.substring(0, 200)}`);
      }

      fs.writeFileSync(outputPath, buffer);
      console.log(`  Saved: ${outputFilename} (${Math.round(buffer.length / 1024)}KB)`);
      return outputPath;

    } catch (err) {
      console.log(`  Failed (attempt ${attempt}): ${err.message}`);
      if (attempt < 3) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.log(`  FAILED: ${outputFilename} — will use placeholder`);
  return null;
}

// ─── SVG Placeholder Generator ──────────────────────────────────────
// Creates a brand-tinted placeholder SVG that respects the component's
// aspect ratio. Used when HuggingFace fails after all retries.
// Universal: works for any brand (reads design tokens for tinting).
function generatePlaceholder(dimensions, outputFilename, treatment) {
  const { width, height } = dimensions;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  // Derive a subtle tint from the treatment text
  const isWarm = /warm|amber|golden|coral/i.test(treatment);
  const isCool = /cool|blue|cyan|teal/i.test(treatment);
  const isDark = /dark|moody|shadow|dramatic/i.test(treatment);

  const bgColor = isDark ? '#1a1a2e' : '#e8edf2';
  const fgColor = isDark ? '#2d2d44' : '#d0d8e0';
  const iconColor = isDark ? '#4a4a6a' : '#a0aab4';
  const accentColor = isWarm ? '#8b6914' : isCool ? '#1a5276' : '#5a5a7a';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  <rect x="0" y="0" width="${width}" height="${height}" fill="${fgColor}" opacity="0.3" rx="0"/>
  <g transform="translate(${width / 2}, ${height / 2})" opacity="0.4">
    <circle r="40" fill="none" stroke="${iconColor}" stroke-width="2"/>
    <path d="M-12,-16 L-12,16 L16,0 Z" fill="${accentColor}" opacity="0.6"/>
  </g>
  <line x1="0" y1="0" x2="${width}" y2="${height}" stroke="${fgColor}" stroke-width="0.5" opacity="0.2"/>
  <line x1="${width}" y1="0" x2="0" y2="${height}" stroke="${fgColor}" stroke-width="0.5" opacity="0.2"/>
</svg>`;

  // Convert SVG to a JPEG-like file (actually save as PNG for SVG, but rename to .jpg)
  // Since build-course.js embeds as base64, we'll save the SVG as a proper image format
  // Use a simple approach: save as SVG with .svg extension, and update the path
  const svgFilename = outputFilename.replace('.jpg', '.svg');
  const svgPath = path.join(OUTPUT_DIR, svgFilename);
  fs.writeFileSync(svgPath, svg);
  console.log(`  Placeholder: ${svgFilename} (${width}x${height})`);
  return { path: svgPath, filename: svgFilename };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  if (!HF_TOKEN) {
    console.error('Error: HF_TOKEN environment variable not set.');
    console.error('Usage: node v5/scripts/generate-images.js');
    process.exit(1);
  }

  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('Error: course-layout.json not found at', LAYOUT_PATH);
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));

  // Determine image treatment
  // Priority: brand-design.md (natural language) → brand-profile.json (imageTreatment field)
  //         → design-tokens.json (legacy fallback) → stitch-course-raw.html (legacy fallback)
  let treatment;

  if (fs.existsSync(BRAND_DESIGN_PATH)) {
    const brandDescription = fs.readFileSync(BRAND_DESIGN_PATH, 'utf-8');
    console.log('Using brand-design.md for image treatment:');
    treatment = extractTreatmentFromDescription(brandDescription);
    console.log(`  Treatment: ${treatment}\n`);
  } else if (fs.existsSync(BRAND_PATH)) {
    try {
      const brandProfile = JSON.parse(fs.readFileSync(BRAND_PATH, 'utf-8'));
      if (brandProfile.imageTreatment) {
        console.log('Using brand-profile.json imageTreatment:');
        treatment = brandProfile.imageTreatment;
        console.log(`  Treatment: ${treatment}\n`);
      }
    } catch {}
  }

  if (!treatment) {
    // Legacy fallback: design-tokens.json or stitch-course-raw.html
    let design;
    if (fs.existsSync(TOKENS_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8'));
      console.log('Using design-tokens.json for image treatment (legacy fallback):');
      design = analyseDesignTokens(tokens);
    } else if (fs.existsSync(STITCH_PATH)) {
      const stitchHtml = fs.readFileSync(STITCH_PATH, 'utf-8');
      console.log('Using stitch-course-raw.html for image treatment (legacy fallback):');
      design = analyseStitchDesign(stitchHtml);
    } else {
      console.log('No design source found — using default treatment.');
      design = {
        colourTemperature: 'neutral',
        lightingMood: 'balanced',
        styleRegister: 'professional',
        dominantTones: [],
        isDark: false,
      };
    }
    treatment = buildDesignTreatment(design);
    console.log(`  Treatment: ${treatment}\n`);
  }

  // Clear existing images — always regenerate
  if (fs.existsSync(OUTPUT_DIR)) {
    const existing = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
    if (existing.length > 0) {
      console.log(`Clearing ${existing.length} existing images...\n`);
      for (const file of existing) {
        fs.unlinkSync(path.join(OUTPUT_DIR, file));
      }
    }
  }
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const queue = [];

  // Collect all image generation tasks
  for (const section of layout.sections) {
    for (const comp of section.components) {
      if (comp.imagePrompt) {
        const dims = getDimensions(comp.type);
        // Combine content subject + design treatment
        const fullPrompt = `${comp.imagePrompt}, ${treatment}`;
        queue.push({
          prompt: fullPrompt,
          dimensions: dims,
          filename: `${comp.componentId}.jpg`,
          component: comp,
          target: '_graphic',
          targetKey: null,
        });
      }

      if (comp.imagePrompts && Array.isArray(comp.imagePrompts)) {
        for (const ip of comp.imagePrompts) {
          const dims = ip.dimensions ? parseDimensionString(ip.dimensions) : getDimensions(comp.type);
          const fullPrompt = `${ip.prompt}, ${treatment}`;
          queue.push({
            prompt: fullPrompt,
            dimensions: dims,
            filename: `${comp.componentId}-${ip.key}.jpg`,
            component: comp,
            target: '_items',
            targetKey: ip.key,
          });
        }
      }
    }
  }

  const totalImages = queue.length;
  console.log(`Generating ${totalImages} images via Hugging Face (${HF_MODEL})...\n`);

  let successImages = 0;
  const failedTasks = [];

  // ─── Pass 1: Generate all images ────────────────────────────────────
  for (let i = 0; i < queue.length; i++) {
    const task = queue[i];
    console.log(`[${i + 1}/${totalImages}] ${task.filename}`);

    const result = await generateImage(task.prompt, task.dimensions, task.filename);

    if (result) {
      successImages++;
      updateLayout(task, `images/${task.filename}`);
    } else {
      failedTasks.push(task);
    }

    // Rate limit (skip delay on last item)
    if (i < queue.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // ─── Pass 2: Retry failures with longer delay ──────────────────────
  if (failedTasks.length > 0) {
    console.log(`\n─── Retrying ${failedTasks.length} failed images (pass 2, longer delay)... ───\n`);
    await sleep(10000); // 10s cooldown before retry pass

    const stillFailed = [];
    for (let i = 0; i < failedTasks.length; i++) {
      const task = failedTasks[i];
      console.log(`[retry ${i + 1}/${failedTasks.length}] ${task.filename}`);

      const result = await generateImage(task.prompt, task.dimensions, task.filename);

      if (result) {
        successImages++;
        updateLayout(task, `images/${task.filename}`);
      } else {
        stillFailed.push(task);
      }

      if (i < failedTasks.length - 1) {
        await sleep(DELAY_MS * 2); // Double delay on retry pass
      }
    }

    // ─── Pass 3: Placeholder fallback for persistent failures ────────
    if (stillFailed.length > 0) {
      console.log(`\n─── ${stillFailed.length} images still failing — generating placeholders... ───\n`);

      for (const task of stillFailed) {
        const placeholder = generatePlaceholder(task.dimensions, task.filename, treatment);
        updateLayout(task, `images/${placeholder.filename}`);
        successImages++; // Count placeholders as present for 100% coverage
      }
    }
  }

  // Save updated layout
  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, 2));

  const placeholderCount = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.svg')).length;
  const realCount = successImages - placeholderCount;

  console.log(`\nComplete: ${realCount}/${totalImages} real images, ${placeholderCount} placeholders`);
  console.log(`Asset coverage: ${totalImages}/${totalImages} (100%)`);
  console.log(`Layout updated: ${LAYOUT_PATH}`);
  console.log(`Images saved to: ${OUTPUT_DIR}`);
}

// ─── Update layout with image path ──────────────────────────────────
function updateLayout(task, relativePath) {
  if (task.target === '_graphic') {
    if (!task.component._graphic) task.component._graphic = {};
    task.component._graphic.large = relativePath;
  } else if (task.target === '_items' && task.targetKey) {
    const itemIndex = parseInt(task.targetKey.replace('item-', ''));
    if (task.component._items && task.component._items[itemIndex]) {
      if (!task.component._items[itemIndex]._graphic) {
        task.component._items[itemIndex]._graphic = {};
      }
      task.component._items[itemIndex]._graphic.large = relativePath;
    }
  }
}

function parseDimensionString(dimStr) {
  const match = (dimStr || '').match(/(\d+)x(\d+)/);
  if (match) {
    return {
      width: Math.min(+match[1], MAX_DIM),
      height: Math.min(+match[2], MAX_DIM),
    };
  }
  return DIMENSIONS.default;
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
