import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import type { CourseIR, BrandProfile, ImageManifest, EvolutionConfig } from '../ir/types';
import { generateHtml } from './templates';

// ============================================================
// Generator — Orchestrates the generation of the output web
// application from CourseIR, BrandProfile, and ImageManifest.
// ============================================================

export async function generateApp(
  course: CourseIR,
  brand: BrandProfile,
  images: ImageManifest,
  config: EvolutionConfig,
): Promise<void> {
  const outputDir = config.outputDir;

  // Create output directory structure
  const dirs = [
    outputDir,
    join(outputDir, 'assets'),
    join(outputDir, 'assets', 'images'),
    join(outputDir, 'assets', 'media'),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // Generate the main HTML file
  if (config.verbose) console.log('    Generating index.html...');
  const html = generateHtml(course, brand, images);
  writeFileSync(join(outputDir, 'index.html'), html, 'utf8');

  // Copy original media assets (video, audio) that are reused
  if (config.verbose) console.log('    Copying media assets...');
  copyMediaAssets(course, config.scormInputDir, outputDir);

  // Copy original images that weren't regenerated (as fallbacks)
  if (config.verbose) console.log('    Copying image assets...');
  copyImageAssets(course, images, config.scormInputDir, outputDir);

  if (config.verbose) {
    console.log(`    Generated output in ${outputDir}/`);
  }
}

function copyMediaAssets(course: CourseIR, scormDir: string, outputDir: string): void {
  // Copy videos
  for (const video of course.assets.videos) {
    const src = join(scormDir, video.originalPath);
    if (existsSync(src)) {
      const dest = join(outputDir, 'assets', 'media', basename(video.originalPath));
      copyFileSync(src, dest);
    }
  }

  // Copy audio
  for (const audio of course.assets.audio) {
    const src = join(scormDir, audio.originalPath);
    if (existsSync(src)) {
      const dest = join(outputDir, 'assets', 'media', basename(audio.originalPath));
      copyFileSync(src, dest);
    }
  }
}

function copyImageAssets(
  course: CourseIR,
  images: ImageManifest,
  scormDir: string,
  outputDir: string,
): void {
  for (const asset of course.assets.images) {
    // Skip if we have a generated replacement
    const hasReplacement = images.entries.some(
      e => e.originalAssetId === asset.id && e.status === 'generated'
    );
    if (hasReplacement) continue;

    const src = join(scormDir, asset.originalPath);
    if (existsSync(src)) {
      const dest = join(outputDir, 'assets', 'images', basename(asset.originalPath));
      copyFileSync(src, dest);
    }
  }
}

function basename(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}
