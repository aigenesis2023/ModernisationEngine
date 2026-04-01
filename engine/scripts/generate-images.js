#!/usr/bin/env node
/**
 * V5 Image Generator — AI Generation + Stock Fallback
 *
 * Priority chain: SiliconFlow AI (Tongyi Z-Image-Turbo) → Pexels stock → SVG placeholder
 *
 * Reads course-layout.json for content subjects. Image prompts describe
 * WHAT to show — for AI generation, brand-design.md provides photographic treatment.
 * For stock photos, prompts are converted to search queries.
 *
 * Usage:
 *   node engine/scripts/generate-images.js
 *
 * API Keys (in .env):
 *   SILICONFLOW_API_KEY — AI image generation via Tongyi Z-Image-Turbo (default)
 *   PEXELS_API_KEY      — Free stock photos fallback (200 req/hr)
 *
 * Output: engine/output/images/*.jpg + updated course-layout.json
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

// ─── Config ──────────────────────────────────────────────────────────
// Priority: SiliconFlow AI (Tongyi Z-Image-Turbo) → Pexels stock → SVG placeholder
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_MODEL = 'Tongyi-MAI/Z-Image-Turbo';
const SILICONFLOW_API_URL = 'https://api.siliconflow.com/v1/images/generations';

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';
const PEXELS_API_URL = 'https://api.pexels.com/v1/search';

const OUTPUT_DIR = path.resolve('engine/output/images');
const LAYOUT_PATH = path.resolve('engine/output/course-layout.json');
const BRAND_DESIGN_PATH = path.resolve('engine/output/brand-design.md');

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

// ─── Extract Image Treatment from Brand Description ─────────────────
// Reads brand-design.md and extracts just the photographic mood for images.
// NEVER includes UI design elements (glassmorphism, pill buttons, etc.)
function extractTreatmentFromDescription(description) {
  // Use Image Treatment section if present, otherwise full description
  const sectionMatch = description.match(/##\s*Image Treatment\s*\n([\s\S]*?)(?=\n##|\n$|$)/i);
  const source = sectionMatch ? sectionMatch[1].trim() : description;
  const lower = source.toLowerCase();

  // Extract only lighting/mood/style signals — never use the raw text as a prompt
  // (it may contain example photo descriptions like "person at laptop" that bleed into AI prompts)
  const parts = [];

  // Lighting
  if (lower.includes('dark') || lower.includes('moody') || lower.includes('midnight') || lower.includes('low-key') || lower.includes('deep shadow')) {
    parts.push('dramatic low-key lighting, deep shadows');
  } else if (lower.includes('bright') || lower.includes('airy') || lower.includes('luminous') || lower.includes('high-key')) {
    parts.push('clean bright natural lighting, soft even illumination');
  } else {
    parts.push('balanced professional lighting');
  }

  // Colour temperature
  if (lower.includes('warm') || lower.includes('coral') || lower.includes('amber') || lower.includes('golden')) {
    parts.push('warm colour tones');
  } else if (lower.includes('cool') || lower.includes('teal') || lower.includes('cyan') || lower.includes('ice') || lower.includes('cold') ||
             (lower.includes('blue') && !lower.includes('navy blue palette'))) {
    parts.push('cool blue-toned atmosphere');
  }

  // Style
  if (lower.includes('cinematic')) {
    parts.push('cinematic wide composition');
  } else if (lower.includes('elegant') || lower.includes('sophisticated') || lower.includes('premium') || lower.includes('luxury')) {
    parts.push('refined professional photography');
  } else if (lower.includes('creative') || lower.includes('bold') || lower.includes('dynamic') || lower.includes('vibrant')) {
    parts.push('dynamic artistic composition');
  } else {
    parts.push('professional photography, clean composition');
  }

  return parts.join(', ');
}

// ─── Stock photo via Pexels (default) ────────────────────────────────
// Converts the AI image prompt into a short Pexels-searchable query.
// Pexels is a stock photo library — it works best with concrete 2-4 word subjects,
// not abstract descriptions. We extract the core subject noun phrase.
function promptToSearchQuery(prompt, simplified = false) {
  // Strip everything after the first em-dash or comma — keep only the opening subject
  let subject = prompt
    .split(/—|–/)[0]          // cut at em-dash
    .split(',')[0]             // cut at first comma
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (simplified) {
    // For retry: reduce to first 2-3 meaningful words, drop adjectives
    const words = subject.split(' ').filter(w =>
      w.length > 3 &&
      !/^(deep|dark|bright|large|small|high|full|wide|long|dramatic|cinematic|abstract|photorealistic|close-up|artist|modern|dramatic|glowing|electric|faint|radiant|stunning|beautiful|stunning|vibrant|vast)/i.test(w)
    );
    subject = words.slice(0, 3).join(' ');
  }

  return subject.substring(0, 100);
}

async function fetchStockPhoto(prompt, dimensions, outputFilename, pexelsQuery = null) {
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  const orientation = dimensions.width > dimensions.height ? 'landscape' : 'portrait';

  for (let attempt = 1; attempt <= 2; attempt++) {
    // Attempt 1: use pexelsQuery if provided, otherwise derive from prompt
    // Attempt 2: fall back to simplified derived query
    const query = (attempt === 1 && pexelsQuery)
      ? pexelsQuery
      : promptToSearchQuery(prompt, attempt === 2);
    try {
      console.log(`  Searching Pexels: "${query}" (${orientation})...`);

      const url = `${PEXELS_API_URL}?query=${encodeURIComponent(query)}&per_page=5&orientation=${orientation}`;
      const resp = await fetch(url, {
        headers: { 'Authorization': PEXELS_API_KEY },
        signal: AbortSignal.timeout(15000),
      });

      if (resp.status === 429) {
        console.log(`  Pexels rate limited, waiting...`);
        await sleep(5000);
        continue;
      }

      if (!resp.ok) {
        throw new Error(`Pexels HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.photos || data.photos.length === 0) {
        if (attempt === 1) {
          console.log(`  No results for "${query}", retrying with simplified query...`);
          continue;
        }
        throw new Error('No photos found');
      }

      // Pick a random photo from top results for variety
      const photo = data.photos[Math.floor(Math.random() * Math.min(data.photos.length, 3))];

      // Choose size based on target dimensions
      const targetWidth = dimensions.width;
      let photoUrl;
      if (targetWidth > 900) {
        photoUrl = photo.src.large2x || photo.src.large;
      } else if (targetWidth > 500) {
        photoUrl = photo.src.large;
      } else {
        photoUrl = photo.src.medium;
      }

      // Download the image
      console.log(`  Downloading: ${photo.photographer} (${photo.width}x${photo.height})...`);
      const imgResp = await fetch(photoUrl, { signal: AbortSignal.timeout(30000) });
      if (!imgResp.ok) throw new Error(`Download failed: HTTP ${imgResp.status}`);

      const buffer = Buffer.from(await imgResp.arrayBuffer());
      if (buffer.length < 1000) throw new Error('Downloaded image too small');

      // Pexels always returns JPEG
      const jpgFilename = outputFilename.replace(/\.\w+$/, '.jpg');
      const jpgPath = path.join(OUTPUT_DIR, jpgFilename);
      fs.writeFileSync(jpgPath, buffer);
      console.log(`  Saved: ${jpgFilename} (${Math.round(buffer.length / 1024)}KB) — ${photo.photographer}`);
      return { path: jpgPath, filename: jpgFilename };

    } catch (err) {
      console.log(`  Pexels failed (attempt ${attempt}): ${err.message}`);
      if (attempt < 2) {
        await sleep(2000);
      }
    }
  }

  return null;
}

// ─── Image generation via SiliconFlow (Tongyi Z-Image-Turbo) ─────────
async function generateImageSiliconFlow(prompt, dimensions, outputFilename) {
  const { width, height } = dimensions;
  const enhancedPrompt = `${prompt}, photorealistic, high resolution, sharp details, no text overlays, no watermarks, no cartoon, no illustration, no anime, no drawing, no sketch, no vector art`;

  // SiliconFlow accepts specific image sizes — snap to nearest valid size
  const imageSize = `${width}x${height}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`  Generating via SiliconFlow: ${outputFilename} (attempt ${attempt})...`);

      const resp = await fetch(SILICONFLOW_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: SILICONFLOW_MODEL,
          prompt: enhancedPrompt,
          image_size: imageSize,
          num_inference_steps: 4,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (resp.status === 429) {
        console.log(`  Rate limited, waiting ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${errText.substring(0, 300)}`);
      }

      const data = await resp.json();

      // SiliconFlow returns { images: [{ url: "..." }] } or { data: [{ url: "..." }] }
      const images = data.images || data.data || [];
      if (images.length === 0) {
        throw new Error('No images in response');
      }

      const imageData = images[0];

      let buffer;
      if (imageData.url) {
        // Download from URL
        const imgResp = await fetch(imageData.url, { signal: AbortSignal.timeout(30000) });
        if (!imgResp.ok) throw new Error(`Image download failed: HTTP ${imgResp.status}`);
        buffer = Buffer.from(await imgResp.arrayBuffer());
      } else if (imageData.b64_json) {
        // Base64 encoded
        buffer = Buffer.from(imageData.b64_json, 'base64');
      } else {
        throw new Error('No url or b64_json in response');
      }

      if (buffer.length < 500) {
        throw new Error(`Image too small (${buffer.length} bytes)`);
      }

      // Detect format from buffer magic bytes, default to jpg
      const isPng = buffer[0] === 0x89 && buffer[1] === 0x50;
      const ext = isPng ? '.png' : '.jpg';
      const finalFilename = outputFilename.replace(/\.\w+$/, ext);
      const finalPath = path.join(OUTPUT_DIR, finalFilename);

      fs.writeFileSync(finalPath, buffer);
      console.log(`  Saved: ${finalFilename} (${Math.round(buffer.length / 1024)}KB)`);
      return { path: finalPath, filename: finalFilename };

    } catch (err) {
      console.log(`  Failed (attempt ${attempt}): ${err.message}`);
      if (attempt < 3) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  console.log(`  FAILED via SiliconFlow: ${outputFilename}`);
  return null;
}

// ─── SVG Placeholder Generator ──────────────────────────────────────
// Creates a brand-tinted placeholder SVG that respects the component's
// aspect ratio. Used when all image providers fail after retries.
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
  const useSiliconFlow = !!SILICONFLOW_API_KEY;
  const usePexels = !!PEXELS_API_KEY;

  if (!useSiliconFlow && !usePexels) {
    console.warn('Warning: No image API key found (SILICONFLOW_API_KEY or PEXELS_API_KEY).');
    console.warn('All images will be SVG placeholders.\n');
  }

  const provider = useSiliconFlow ? `SiliconFlow (${SILICONFLOW_MODEL})` : usePexels ? 'Pexels (stock)' : 'SVG placeholders only';
  console.log(`Image provider: ${provider}\n`);

  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('Error: course-layout.json not found at', LAYOUT_PATH);
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));

  // Determine image treatment — prefer brand-spec.json (structured), fall back to brand-design.md (prose)
  let treatment;
  const BRAND_SPEC_PATH = path.resolve('engine/output/brand-spec.json');

  if (fs.existsSync(BRAND_SPEC_PATH)) {
    try {
      const spec = JSON.parse(fs.readFileSync(BRAND_SPEC_PATH, 'utf-8'));
      const img = spec.imageStyle || {};
      const parts = [];
      // Treatment
      const treatmentMap = {
        'dramatic-dark': 'dramatic low-key lighting, deep shadows',
        'bright-airy': 'clean bright natural lighting, soft even illumination',
        'monochrome': 'desaturated monochrome tones, muted palette',
        'illustrated': 'dramatic low-key lighting, stylised atmosphere',
      };
      parts.push(treatmentMap[img.treatment] || 'balanced professional lighting');
      // Color temperature
      if (img.colorTemp === 'warm') parts.push('warm colour tones');
      else if (img.colorTemp === 'cool') parts.push('cool blue-toned palette');
      // Contrast
      if (img.contrast === 'high') parts.push('dynamic artistic composition');
      else if (img.contrast === 'low') parts.push('soft subtle composition');
      treatment = parts.join(', ');
      console.log(`Image treatment (from brand-spec.json): ${treatment}\n`);
    } catch (e) {
      treatment = null; // fall through to brand-design.md
    }
  }

  if (!treatment && fs.existsSync(BRAND_DESIGN_PATH)) {
    const brandDescription = fs.readFileSync(BRAND_DESIGN_PATH, 'utf-8');
    treatment = extractTreatmentFromDescription(brandDescription);
    console.log(`Image treatment (from brand-design.md): ${treatment}\n`);
  }

  if (!treatment) {
    treatment = 'balanced professional lighting, clean composition';
    console.log(`No brand data found — using default treatment: ${treatment}\n`);
  }

  // Clear existing images — always regenerate
  if (fs.existsSync(OUTPUT_DIR)) {
    const existing = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.svg'));
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
        const fullPrompt = `${comp.imagePrompt}, ${treatment}`;
        queue.push({
          prompt: fullPrompt,
          pexelsQuery: comp.pexelsQuery || null,
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
            pexelsQuery: ip.pexelsQuery || null,
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
  console.log(`Generating ${totalImages} images via ${provider}...\n`);

  let successImages = 0;
  const failedTasks = [];

  // ─── Pass 1: Generate all images ────────────────────────────────────
  for (let i = 0; i < queue.length; i++) {
    const task = queue[i];
    console.log(`[${i + 1}/${totalImages}] ${task.filename}`);

    let result = null;
    // Priority: SiliconFlow → Pexels → (SVG in pass 3)
    if (useSiliconFlow) {
      result = await generateImageSiliconFlow(task.prompt, task.dimensions, task.filename);
    }
    if (!result && usePexels) {
      console.log(`  Falling back to Pexels...`);
      result = await fetchStockPhoto(task.prompt, task.dimensions, task.filename, task.pexelsQuery);
    }

    if (result) {
      successImages++;
      const fn = result.filename || task.filename;
      updateLayout(task, `images/${fn}`);
    } else {
      failedTasks.push(task);
    }

    // Rate limit (skip delay on last item)
    if (i < queue.length - 1) {
      await sleep(useSiliconFlow ? 1500 : usePexels ? 500 : 0);
    }
  }

  // ─── Pass 2: Retry failures ────────────────────────────────────────
  if (failedTasks.length > 0) {
    console.log(`\n─── Retrying ${failedTasks.length} failed images (pass 2)... ───\n`);
    await sleep(5000);

    const stillFailed = [];
    for (let i = 0; i < failedTasks.length; i++) {
      const task = failedTasks[i];
      console.log(`[retry ${i + 1}/${failedTasks.length}] ${task.filename}`);

      let result = null;
      // Retry with same priority chain
      if (useSiliconFlow) {
        result = await generateImageSiliconFlow(task.prompt, task.dimensions, task.filename);
      }
      if (!result && usePexels) {
        result = await fetchStockPhoto(task.prompt, task.dimensions, task.filename, task.pexelsQuery);
      }

      if (result) {
        successImages++;
        const fn = result.filename || task.filename;
        updateLayout(task, `images/${fn}`);
      } else {
        stillFailed.push(task);
      }

      if (i < failedTasks.length - 1) {
        await sleep(DELAY_MS);
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
