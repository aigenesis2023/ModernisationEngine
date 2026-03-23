/**
 * Stitch Illustration Generator
 *
 * Reads the media plan, generates Stitch illustrations for components
 * marked as "illustration", downloads the screenshot images, and
 * updates the course layout with the image paths.
 *
 * Input:  v3/output/media-plan.json + v3/output/course-layout.json
 * Output: v3/output/illustrations/*.png + updated course-layout.json
 *
 * Requires: STITCH_API_KEY environment variable
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { StitchToolClient } from '@google/stitch-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const API_KEY = process.env.STITCH_API_KEY;
if (!API_KEY) {
  console.error('ERROR: Set STITCH_API_KEY environment variable');
  process.exit(1);
}

// Delay between requests to avoid rate limiting
const DELAY_MS = 3000;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function downloadImage(url, filepath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(filepath, buffer);
  return buffer.length;
}

async function main() {
  const mediaPlanPath = join(ROOT, 'v3/output/media-plan.json');
  const layoutPath = join(ROOT, 'v3/output/course-layout.json');
  const illustrationDir = join(ROOT, 'v3/output/illustrations');

  mkdirSync(illustrationDir, { recursive: true });

  const mediaPlan = JSON.parse(readFileSync(mediaPlanPath, 'utf8'));
  const layout = JSON.parse(readFileSync(layoutPath, 'utf8'));

  // Filter to illustration components only
  const illustrationItems = mediaPlan.components.filter(c => c.mediaType === 'illustration');

  if (illustrationItems.length === 0) {
    console.log('No illustrations to generate.');
    return;
  }

  console.log(`\n=== STITCH ILLUSTRATION GENERATOR ===`);
  console.log(`Generating ${illustrationItems.length} illustrations...\n`);

  const client = new StitchToolClient({
    apiKey: API_KEY,
    timeout: 300000
  });

  // Create a project for this course
  const courseTitle = mediaPlan.courseTitle || 'Course';
  const project = await client.callTool('create_project', {
    title: `${courseTitle} - Illustrations`
  });
  const projectId = project.name?.replace('projects/', '') || project.projectId;
  console.log(`Project created: ${projectId}\n`);

  const results = [];

  for (let i = 0; i < illustrationItems.length; i++) {
    const item = illustrationItems[i];
    const compId = item.componentId;

    console.log(`[${i + 1}/${illustrationItems.length}] ${item.displayTitle || compId} (${item.type})`);
    console.log(`  Prompt: ${item.illustrationPrompt.slice(0, 100)}...`);

    try {
      const result = await client.callTool('generate_screen_from_text', {
        projectId,
        prompt: item.illustrationPrompt,
        deviceType: 'DESKTOP',
        modelId: 'GEMINI_3_FLASH'
      });

      // Extract screenshot URL from result
      let screenshotUrl = null;
      let htmlUrl = null;

      if (result.outputComponents) {
        for (const comp of result.outputComponents) {
          if (comp.design?.screens) {
            for (const screen of comp.design.screens) {
              if (screen.screenshot?.downloadUrl) {
                screenshotUrl = screen.screenshot.downloadUrl;
              }
              if (screen.htmlCode?.downloadUrl) {
                htmlUrl = screen.htmlCode.downloadUrl;
              }
            }
          }
        }
      }

      if (screenshotUrl) {
        // Download the screenshot as the illustration image
        const imagePath = join(illustrationDir, `${compId}.png`);
        const size = await downloadImage(screenshotUrl, imagePath);
        console.log(`  ✓ Saved illustration (${Math.round(size / 1024)}KB)`);

        // Also save HTML for reference
        if (htmlUrl) {
          try {
            const htmlResp = await fetch(htmlUrl);
            const html = await htmlResp.text();
            writeFileSync(join(illustrationDir, `${compId}.html`), html);
          } catch (e) {
            // HTML save is optional
          }
        }

        results.push({
          componentId: compId,
          type: item.type,
          imagePath: `v3/output/illustrations/${compId}.png`,
          success: true
        });

        // Update the course layout with the illustration path
        for (const section of layout.sections) {
          for (const comp of section.components) {
            if (comp.componentId === compId) {
              if (!comp._graphic) comp._graphic = {};
              comp._graphic.large = `illustrations/${compId}.png`;
              comp._graphic.alt = item.displayTitle || `Illustration for ${compId}`;
              comp._illustrationType = 'stitch';
            }
          }
        }
      } else {
        console.log(`  ✗ No screenshot URL in response`);
        results.push({ componentId: compId, success: false, error: 'No screenshot URL' });
      }

    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      results.push({ componentId: compId, success: false, error: err.message });
    }

    // Rate limit
    if (i < illustrationItems.length - 1) {
      console.log(`  Waiting ${DELAY_MS / 1000}s...`);
      await sleep(DELAY_MS);
    }
  }

  await client.close();

  // Save updated layout
  const updatedLayoutPath = join(ROOT, 'v3/output/course-layout-with-illustrations.json');
  writeFileSync(updatedLayoutPath, JSON.stringify(layout, null, 2));

  // Summary
  const successes = results.filter(r => r.success).length;
  const failures = results.filter(r => !r.success).length;

  console.log(`\n=== SUMMARY ===`);
  console.log(`Generated: ${successes}/${illustrationItems.length}`);
  if (failures > 0) console.log(`Failed: ${failures}`);
  console.log(`Layout saved: ${updatedLayoutPath}`);
  console.log(`Illustrations: ${illustrationDir}/`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
