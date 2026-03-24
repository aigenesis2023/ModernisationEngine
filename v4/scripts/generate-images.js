#!/usr/bin/env node
/**
 * V4 Image Generator
 *
 * Reads course-layout.json, generates images via Hugging Face Inference API,
 * and updates the layout JSON with actual image paths.
 *
 * Usage:
 *   HF_TOKEN=hf_... node v4/scripts/generate-images.js
 *   node v4/scripts/generate-images.js                    # reads from env
 *
 * Input:  v4/output/course-layout.json
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

// Rate limiting: 3s between requests (HF free tier)
const DELAY_MS = 3000;
const RETRY_DELAY_MS = 8000;

// HF Inference has max dimensions — we generate at supported sizes
// then the renderer scales them via CSS. FLUX.1-schnell supports up to 1024.
const MAX_DIM = 1024;

// ─── Dimensions by component type ────────────────────────────────────
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

function parseDimensionString(dimStr) {
  const match = (dimStr || '').match(/(\d+)x(\d+)/);
  if (match) {
    // Clamp to max supported dimensions
    return {
      width: Math.min(+match[1], MAX_DIM),
      height: Math.min(+match[2], MAX_DIM),
    };
  }
  return DIMENSIONS.default;
}

// ─── Brand color enhancement ─────────────────────────────────────────
function buildBrandSuffix(brand) {
  if (!brand?.colors) return '';
  const c = brand.colors;
  const parts = [];
  if (c.primary) parts.push(`accent color ${c.primary}`);
  if (c.accent && c.accent !== c.primary) parts.push(`highlight color ${c.accent}`);

  const bgLum = c.background ? perceivedLuminance(c.background) : 0.5;
  if (bgLum < 0.4) {
    parts.push('dark moody atmosphere');
  } else {
    parts.push('bright clean atmosphere');
  }

  return parts.length > 0 ? ', ' + parts.join(', ') : '';
}

function perceivedLuminance(hex) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return 0.5;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ─── Image generation via Hugging Face ───────────────────────────────
async function generateImage(prompt, dimensions, outputFilename) {
  const { width, height } = dimensions;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  // Skip if already exists and is a real image
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    if (stats.size > 5000) {
      console.log(`  Skip (exists): ${outputFilename}`);
      return outputPath;
    }
  }

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
        signal: AbortSignal.timeout(120000), // 2 min timeout — generation can be slow
      });

      // HF returns 503 when model is loading — wait and retry
      if (resp.status === 503) {
        const body = await resp.json().catch(() => ({}));
        const waitTime = (body.estimated_time || 20) * 1000;
        console.log(`  Model loading, waiting ${Math.round(waitTime / 1000)}s...`);
        await sleep(Math.min(waitTime, 30000));
        continue;
      }

      // HF returns 429 for rate limiting
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

      // Verify it's actually an image (not JSON error)
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

// ─── Process all components ──────────────────────────────────────────
async function main() {
  // Check for token
  if (!HF_TOKEN) {
    console.error('Error: HF_TOKEN environment variable not set.');
    console.error('Usage: HF_TOKEN=hf_... node v4/scripts/generate-images.js');
    process.exit(1);
  }

  // Load layout
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('Error: course-layout.json not found at', LAYOUT_PATH);
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));

  // Load brand (optional, for color hints)
  let brand = null;
  if (fs.existsSync(BRAND_PATH)) {
    brand = JSON.parse(fs.readFileSync(BRAND_PATH, 'utf-8'));
  }
  const brandSuffix = buildBrandSuffix(brand);

  // Ensure output directory
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const queue = [];

  // Collect all image generation tasks
  for (const section of layout.sections) {
    for (const comp of section.components) {
      if (comp.imagePrompt) {
        const dims = getDimensions(comp.type);
        queue.push({
          prompt: comp.imagePrompt + brandSuffix,
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
          queue.push({
            prompt: ip.prompt + brandSuffix,
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
  console.log(`\nGenerating ${totalImages} images via Hugging Face (${HF_MODEL})...\n`);

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

  if (successImages < totalImages) {
    console.log(`\nTo retry failed images, run the script again — it skips existing ones.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
