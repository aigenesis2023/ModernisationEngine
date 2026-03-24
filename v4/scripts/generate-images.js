#!/usr/bin/env node
/**
 * V4 Image Generator — Stitch-Informed
 *
 * Reads course-layout.json AND stitch-course-raw.html to generate images
 * that fit the actual designed page. Runs AFTER Stitch, not in parallel.
 *
 * The image prompts from course-layout.json describe WHAT to show (subject).
 * The Stitch design analysis determines HOW it should look (treatment).
 *
 * Usage:
 *   node v4/scripts/generate-images.js
 *
 * Input:  v4/output/course-layout.json  (content subjects)
 *         v4/output/stitch-course-raw.html  (design treatment source)
 *         v4/output/brand-profile.json  (fallback if no Stitch output)
 * Output: v4/output/images/*.jpg + updated course-layout.json
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

// ─── Config ──────────────────────────────────────────────────────────
const HF_MODEL = 'black-forest-labs/FLUX.1-schnell';
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}`;
const HF_TOKEN = process.env.HF_TOKEN || '';

const OUTPUT_DIR = path.resolve('v4/output/images');
const LAYOUT_PATH = path.resolve('v4/output/course-layout.json');
const BRAND_PATH = path.resolve('v4/output/brand-profile.json');
const STITCH_PATH = path.resolve('v4/output/stitch-course-raw.html');

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

// ─── Stitch Design Analysis ──────────────────────────────────────────
// Extracts design treatment from Stitch's actual HTML output
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

  console.log(`  FAILED: ${outputFilename} — skipping`);
  return null;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  if (!HF_TOKEN) {
    console.error('Error: HF_TOKEN environment variable not set.');
    console.error('Usage: node v4/scripts/generate-images.js');
    process.exit(1);
  }

  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('Error: course-layout.json not found at', LAYOUT_PATH);
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));

  // Analyse Stitch design for visual treatment
  let design;
  if (fs.existsSync(STITCH_PATH)) {
    const stitchHtml = fs.readFileSync(STITCH_PATH, 'utf-8');
    design = analyseStitchDesign(stitchHtml);
    console.log('Stitch design analysis:');
    console.log(`  Colour temperature: ${design.colourTemperature}`);
    console.log(`  Lighting mood: ${design.lightingMood}`);
    console.log(`  Style register: ${design.styleRegister}`);
    console.log(`  Theme: ${design.isDark ? 'dark' : 'light'}`);
  } else {
    // Fallback to brand profile if no Stitch output
    console.log('No Stitch output found — using brand profile for image treatment.');
    let brand = null;
    if (fs.existsSync(BRAND_PATH)) {
      brand = JSON.parse(fs.readFileSync(BRAND_PATH, 'utf-8'));
    }
    const isDark = brand?.style?.theme === 'dark';
    design = {
      colourTemperature: 'neutral',
      lightingMood: isDark ? 'moody' : 'bright',
      styleRegister: 'professional',
      dominantTones: [brand?.colors?.primary, brand?.colors?.secondary].filter(Boolean),
      isDark,
    };
  }

  const treatment = buildDesignTreatment(design);
  console.log(`  Treatment: ${treatment}\n`);

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

  for (let i = 0; i < queue.length; i++) {
    const task = queue[i];
    console.log(`[${i + 1}/${totalImages}] ${task.filename}`);

    const result = await generateImage(task.prompt, task.dimensions, task.filename);

    if (result) {
      successImages++;
      const relativePath = `images/${task.filename}`;

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

    // Rate limit (skip delay on last item)
    if (i < queue.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Save updated layout
  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, 2));

  console.log(`\nComplete: ${successImages}/${totalImages} images generated`);
  console.log(`Layout updated: ${LAYOUT_PATH}`);
  console.log(`Images saved to: ${OUTPUT_DIR}`);
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
