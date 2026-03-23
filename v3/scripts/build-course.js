#!/usr/bin/env node
/**
 * V3 Course Builder (with Stitch Design DNA support)
 *
 * Converts course-layout.json into the Adapt-style data format expected by
 * the blade-runner-engine React renderer, embeds images as base64 data URLs,
 * injects brand data, and produces a single static HTML file.
 *
 * Usage: node v3/scripts/build-course.js
 * Input:  v3/output/course-layout.json, v3/output/brand-profile.json, v3/output/images/
 * Output: v3/output/course.html (self-contained single-file)
 */

const fs = require('fs');
const path = require('path');

const LAYOUT_PATH = path.resolve('v3/output/course-layout.json');
const BRAND_PATH = path.resolve('v3/output/brand-profile.json');
const IMAGES_DIR = path.resolve('v3/output/images');
const DNA_PATH = path.resolve('v3/output/design-dna.json');
const TEMPLATE_PATH = path.resolve('blade-runner-template.html');
const OUTPUT_PATH = path.resolve('v3/output/course.html');

// Also write to docs root for GitHub Pages
const PAGES_PATH = path.resolve('index.html');

// ─── Image embedding ─────────────────────────────────────────────────
function embedImage(imagePath) {
  if (!imagePath) return '';

  // If already a data URL or remote URL, pass through
  if (imagePath.startsWith('data:') || imagePath.startsWith('http')) return imagePath;

  // Resolve relative to output dir
  const fullPath = path.resolve('v3/output', imagePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  Warning: image not found: ${fullPath}`);
    return '';
  }

  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml',
  };
  const mime = mimeMap[ext] || 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

// ─── Convert V2 layout → Adapt-style renderer data ──────────────────
function convertToRendererFormat(layout, embedImages) {
  const courseId = 'course-v2';
  const pageId = 'page-01';

  // Course object
  const course = {
    _id: courseId,
    displayTitle: layout.course.title,
    title: layout.course.title,
    body: layout.course.subtitle ? `<p>${layout.course.subtitle}</p>` : '',
  };

  // Single page (contentObject)
  const contentObjects = [{
    _id: pageId,
    _parentId: courseId,
    _type: 'page',
    displayTitle: layout.course.title,
    title: layout.course.title,
    body: '',
  }];

  const articles = [];
  const blocks = [];
  const components = [];

  for (const section of layout.sections) {
    const articleId = section.sectionId;

    // Determine if this is a hero section
    const isHero = section.components.some(c => c.type === 'hero');

    articles.push({
      _id: articleId,
      _parentId: pageId,
      _type: 'article',
      displayTitle: section.title || '',
      title: section.title || '',
      _classes: isHero ? 'section-hero' : '',
    });

    for (const comp of section.components) {
      const blockId = `block-${comp.componentId}`;

      blocks.push({
        _id: blockId,
        _parentId: articleId,
        _type: 'block',
        displayTitle: '',
        title: '',
      });

      // Process images
      const processedComp = { ...comp };

      if (embedImages) {
        // Embed main graphic
        if (processedComp._graphic?.large) {
          processedComp._graphic = {
            ...processedComp._graphic,
            large: embedImage(processedComp._graphic.large),
          };
        }

        // Embed item graphics
        if (processedComp._items) {
          processedComp._items = processedComp._items.map(item => {
            if (item._graphic?.large) {
              return {
                ...item,
                _graphic: { ...item._graphic, large: embedImage(item._graphic.large) },
              };
            }
            return item;
          });
        }

        // Embed media poster
        if (processedComp._media?.poster) {
          processedComp._media = {
            ...processedComp._media,
            poster: embedImage(processedComp._media.poster),
          };
        }
      }

      components.push({
        _id: comp.componentId,
        _parentId: blockId,
        _type: 'component',
        _component: comp.type,
        displayTitle: comp.displayTitle || '',
        title: comp.displayTitle || '',
        body: comp.body || '',
        instruction: comp.instruction || '',
        // Pass through all component-specific props
        _graphic: processedComp._graphic,
        _imageAlign: comp._imageAlign,
        _items: processedComp._items,
        _selectable: comp._selectable,
        _feedback: comp._feedback,
        _media: processedComp._media,
        _markers: comp._markers,
        _nodes: comp._nodes,
        columns: comp.columns,
        rows: comp.rows,
        transcript: comp.transcript,
        attribution: comp.attribution,
        role: comp.role,
        overlayPosition: comp.overlayPosition,
      });
    }
  }

  return { course, contentObjects, articles, blocks, components };
}

// ─── Build the final HTML ────────────────────────────────────────────
function buildCourse() {
  console.log('\nBuilding course...\n');

  // Load layout
  if (!fs.existsSync(LAYOUT_PATH)) {
    console.error('Error: course-layout.json not found. Run the layout engine first.');
    process.exit(1);
  }
  const layout = JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf-8'));
  console.log(`Layout: ${layout.sections.length} sections, ${layout.sections.reduce((s, sec) => s + sec.components.length, 0)} components`);

  // Load brand
  let brand = null;
  if (fs.existsSync(BRAND_PATH)) {
    brand = JSON.parse(fs.readFileSync(BRAND_PATH, 'utf-8'));
    console.log(`Brand: ${brand.sourceUrl} (${brand.style?.mood || 'unknown'} mood)`);
  } else {
    console.log('Warning: brand-profile.json not found. Using defaults.');
  }

  // Load Design DNA (optional — Stitch-generated enhanced tokens)
  let designDNA = null;
  if (fs.existsSync(DNA_PATH)) {
    designDNA = JSON.parse(fs.readFileSync(DNA_PATH, 'utf-8'));
    console.log(`Design DNA: ${Object.keys(designDNA.colors || {}).length} colors, ${Object.keys(designDNA.surfaceHierarchy || {}).length} surface levels`);
  } else {
    console.log('Design DNA: not found (optional — run v3/scripts/generate-design-dna.js)');
  }

  // Load template
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error('Error: blade-runner-template.html not found. Build the renderer first:');
    console.error('  cd blade-runner-engine && npm install && npx vite build && cp dist/index.html ../blade-runner-template.html');
    process.exit(1);
  }
  let template = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  console.log(`Template: ${Math.round(template.length / 1024)}KB`);

  // Convert layout to renderer format
  const rendererData = convertToRendererFormat(layout, true);
  console.log(`Renderer data: ${rendererData.components.length} components`);

  // Build injection scripts
  const courseDataScript = `<script>window.courseData = ${JSON.stringify(rendererData)};</script>`;
  const brandDataScript = brand
    ? `<script>window.brandData = ${JSON.stringify(brand)};</script>`
    : '';
  const dnaDataScript = designDNA
    ? `<script>window.designDNA = ${JSON.stringify(designDNA)};</script>`
    : '';

  // Inject data before the closing </head> or before the first <script>
  // Strategy: inject before </head> tag
  if (template.includes('</head>')) {
    template = template.replace('</head>', `${courseDataScript}\n${brandDataScript}\n${dnaDataScript}\n</head>`);
  } else {
    // Fallback: prepend to body
    template = template.replace('<body>', `<body>\n${courseDataScript}\n${brandDataScript}\n${dnaDataScript}`);
  }

  // Update page title
  template = template.replace(/<title>[^<]*<\/title>/, `<title>${layout.course.title}</title>`);

  // Write output
  fs.writeFileSync(OUTPUT_PATH, template);
  console.log(`\nOutput: ${OUTPUT_PATH} (${Math.round(template.length / 1024)}KB)`);

  // Also write to repo root for GitHub Pages
  fs.writeFileSync(PAGES_PATH, template);
  console.log(`GitHub Pages: ${PAGES_PATH}`);

  console.log('\nDone. Open course.html in a browser to preview.');
}

// ─── CLI entry point ─────────────────────────────────────────────────
buildCourse();
