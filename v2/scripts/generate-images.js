#!/usr/bin/env node
/**
 * V2 Image Generator
 *
 * Reads course-layout.json, generates images via Pollinations API,
 * and updates the layout JSON with actual image paths.
 *
 * Usage: node v2/scripts/generate-images.js
 * Input:  v2/output/course-layout.json
 * Output: v2/output/images/*.jpg + updated course-layout.json
 */

const fs = require('fs');
const path = require('path');

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';
const OUTPUT_DIR = path.resolve('v2/output/images');
const LAYOUT_PATH = path.resolve('v2/output/course-layout.json');
const BRAND_PATH = path.resolve('v2/output/brand-profile.json');

// Rate limiting: 2s between requests
const DELAY_MS = 2000;
const RETRY_DELAY_MS = 5000;

// ─── Dimensions by component type ────────────────────────────────────
const DIMENSIONS = {
  hero:           { width: 1920, height: 1080 },
  graphic:        { width: 1920, height: 1080 },
  'graphic-text': { width: 800,  height: 600  },
  bento:          { width: 600,  height: 400  },
  narrative:      { width: 800,  height: 600  },
  'full-bleed':   { width: 1920, height: 800  },
  'labeled-image':{ width: 1200, height: 800  },
  'image-gallery':{ width: 600,  height: 400  },
  // Default for anything else
  default:        { width: 800,  height: 600  },
};

function getDimensions(componentType) {
  return DIMENSIONS[componentType] || DIMENSIONS.default;
}

function parseDimensionString(dimStr) {
  const match = (dimStr || '').match(/(\d+)x(\d+)/);
  if (match) return { width: +match[1], height: +match[2] };
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

// ─── Image download ──────────────────────────────────────────────────
async function downloadImage(prompt, dimensions, outputFilename) {
  const { width, height } = dimensions;
  const seed = hashString(outputFilename);
  const enhancedPrompt = `${prompt}, high resolution, sharp details, no text, no watermarks`;
  const encodedPrompt = encodeURIComponent(enhancedPrompt);
  const url = `${POLLINATIONS_BASE}/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;

  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  // Skip if already exists
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    if (stats.size > 1000) {
      console.log(`  Skip (exists): ${outputFilename}`);
      return outputPath;
    }
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`  Downloading: ${outputFilename} (attempt ${attempt})...`);
      const resp = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const buffer = Buffer.from(await resp.arrayBuffer());
      if (buffer.length < 500) throw new Error('Response too small — likely error page');

      fs.writeFileSync(outputPath, buffer);
      console.log(`  Saved: ${outputFilename} (${Math.round(buffer.length / 1024)}KB)`);
      return outputPath;
    } catch (err) {
      console.log(`  Failed (attempt ${attempt}): ${err.message}`);
      if (attempt < 2) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.log(`  FAILED: ${outputFilename} — skipping`);
  return null;
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Process all components ──────────────────────────────────────────
async function generateImages() {
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

  let totalImages = 0;
  let successImages = 0;
  const queue = [];

  // Collect all image generation tasks
  for (const section of layout.sections) {
    for (const comp of section.components) {
      // Single image prompt
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

      // Multiple image prompts
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

  totalImages = queue.length;
  console.log(`\nGenerating ${totalImages} images via Pollinations...\n`);

  // Process queue with rate limiting
  for (let i = 0; i < queue.length; i++) {
    const task = queue[i];
    console.log(`[${i + 1}/${totalImages}] ${task.filename}`);

    const result = await downloadImage(task.prompt, task.dimensions, task.filename);

    if (result) {
      successImages++;
      const relativePath = `images/${task.filename}`;

      // Update layout JSON with image path
      if (task.target === '_graphic') {
        if (!task.component._graphic) task.component._graphic = {};
        task.component._graphic.large = relativePath;
      } else if (task.target === '_items' && task.targetKey) {
        // Find the matching item and update its graphic
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

// ─── CLI entry point ─────────────────────────────────────────────────
generateImages().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
