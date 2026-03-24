#!/usr/bin/env node
/**
 * generate-placeholders.js
 *
 * Reads course-layout.json, finds all components with imagePrompt or
 * imagePrompts fields, creates SVG placeholder images in v5/output/images/,
 * and updates _graphic.large paths in course-layout.json to point to them.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');
const LAYOUT_PATH = path.join(OUTPUT_DIR, 'course-layout.json');
const IMAGES_DIR = path.join(OUTPUT_DIR, 'images');

// Component types that get the wide 1920x800 treatment
const WIDE_TYPES = new Set(['hero', 'full-bleed']);

function makeSVG(width, height, label) {
  // Gray gradient placeholder with centered label text
  const fontSize = Math.min(32, Math.floor(width / label.length * 1.2));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4a4a4a;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#2a2a2a;stop-opacity:1"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="${width / 2}" y="${height / 2}" font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}" fill="#999" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>
</svg>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function main() {
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('ERROR: course-layout.json not found at', LAYOUT_PATH);
    process.exit(1);
  }

  // Ensure images directory exists
  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  let created = 0;

  for (const section of layout.sections) {
    for (const comp of section.components) {
      const compId = comp.componentId;
      const compType = comp.type;
      const isWide = WIDE_TYPES.has(compType);

      // --- Top-level imagePrompt → top-level _graphic ---
      if (comp.imagePrompt) {
        const w = isWide ? 1920 : 800;
        const h = isWide ? 800 : 600;
        const filename = `${compId}.svg`;
        const svgPath = path.join(IMAGES_DIR, filename);
        const label = `${compId} [${compType}]`;

        fs.writeFileSync(svgPath, makeSVG(w, h, label));
        created++;

        // Ensure _graphic object exists and set path
        if (!comp._graphic) comp._graphic = {};
        comp._graphic.large = `images/${filename}`;

        console.log(`  ${filename} (${w}x${h}) — ${compType}`);
      }

      // --- imagePrompts array (narrative / image-gallery) → per-item _graphic ---
      if (Array.isArray(comp.imagePrompts)) {
        for (const imgEntry of comp.imagePrompts) {
          const key = imgEntry.key; // e.g. "item-0"
          const filename = `${compId}-${key}.svg`;
          const svgPath = path.join(IMAGES_DIR, filename);
          const label = `${compId}-${key} [${compType}]`;

          // Parse dimensions from entry if available, else default
          let w = 800, h = 600;
          if (imgEntry.dimensions) {
            const parts = imgEntry.dimensions.split('x');
            if (parts.length === 2) {
              w = parseInt(parts[0], 10) || 800;
              h = parseInt(parts[1], 10) || 600;
            }
          }

          fs.writeFileSync(svgPath, makeSVG(w, h, label));
          created++;
          console.log(`  ${filename} (${w}x${h}) — ${compType}/${key}`);
        }

        // Also update _graphic.large on matching _items entries
        if (Array.isArray(comp._items)) {
          for (let i = 0; i < comp._items.length; i++) {
            const item = comp._items[i];
            const expectedFile = `${compId}-item-${i}.svg`;
            // Only update if there's a matching imagePrompts entry
            const hasMatch = comp.imagePrompts.some(ip => ip.key === `item-${i}`);
            if (hasMatch) {
              if (!item._graphic) item._graphic = {};
              item._graphic.large = `images/${expectedFile}`;
            }
          }
        }
      }
    }
  }

  // Write updated layout back
  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(layout, null, 2) + '\n');

  console.log(`\nDone. Created ${created} SVG placeholders in ${IMAGES_DIR}`);
  console.log('Updated course-layout.json with SVG paths.');
}

main();
