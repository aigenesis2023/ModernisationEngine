import { existsSync } from 'fs';
import { join, extname } from 'path';
import type {
  CourseIR, ImageManifest, ImageIntelligenceEntry, EvolutionConfig,
  BrandProfile, AssetEntry,
} from '../ir/types';
import { generateImage } from './generator';
import { analyzeImageWithVision, isVisionAvailable } from './vision';

// ============================================================
// Image Intelligence — Two-stage pipeline:
//   1. ANALYZE: Use AI vision (Claude) to understand what each
//      image depicts, its instructional role, and visual style.
//      Falls back to metadata analysis when no API key is set.
//   2. GENERATE: Use those rich descriptions to create new,
//      higher-quality, brand-aligned replacements.
// ============================================================

export async function processImages(
  course: CourseIR,
  config: EvolutionConfig,
  brand?: BrandProfile,
): Promise<ImageManifest> {
  const entries: ImageIntelligenceEntry[] = [];

  // Get content images (skip tiny shapes/icons and UI elements)
  const contentImages = course.assets.images.filter(asset =>
    isContentImage(asset)
  );

  console.log(`    Found ${contentImages.length} content images to process`);

  const useVision = isVisionAvailable();
  if (useVision) {
    console.log('    Using AI vision analysis (ANTHROPIC_API_KEY detected)');
  } else {
    console.log('    Using metadata-only analysis (set ANTHROPIC_API_KEY for AI vision)');
  }

  // Stage 1: Analyze all images
  for (let i = 0; i < contentImages.length; i++) {
    const asset = contentImages[i];
    console.log(`    Analyzing image ${i + 1}/${contentImages.length}: ${asset.originalPath}...`);

    const entry = await analyzeImage(asset, course, config.scormInputDir, useVision);
    entries.push(entry);

    if (config.verbose) {
      console.log(`      Description: ${entry.description.substring(0, 100)}...`);
      console.log(`      Role: ${entry.instructionalRole.substring(0, 80)}`);
    }
  }

  // Stage 2: Generate new images
  if (!config.skipImageGen) {
    const brandHints = brand ? buildBrandHints(brand) : '';

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      console.log(`    Generating image ${i + 1}/${entries.length}: ${entry.description.substring(0, 60)}...`);

      // Enhance prompt with brand style hints
      const enhancedPrompt = brandHints
        ? `${entry.generationPrompt}. Style: ${brandHints}`
        : entry.generationPrompt;

      try {
        const outputPath = join(config.outputDir, 'assets', 'images', `generated_${entry.originalAssetId}.jpg`);
        await generateImage(enhancedPrompt, outputPath, config.imageGenProvider);
        entry.generatedPath = outputPath;
        entry.status = 'generated';
      } catch (err: any) {
        entry.status = 'failed';
        entry.error = err.message;
        console.log(`    Warning: Image generation failed for asset ${entry.originalAssetId}: ${err.message}`);
      }
    }
  }

  return { entries };
}

// ---- Image Analysis (Vision-first, metadata fallback) ----

async function analyzeImage(
  asset: AssetEntry,
  course: CourseIR,
  scormDir: string,
  useVision: boolean,
): Promise<ImageIntelligenceEntry> {
  const fullPath = join(scormDir, asset.originalPath);
  const slideContext = findSlideContextForAsset(asset.id, course);
  const context = {
    slideTitle: slideContext?.slideTitle || 'Unknown',
    slideType: slideContext?.slideType || 'content',
    courseTitle: course.meta.title,
  };

  // Try vision-based analysis first
  if (useVision && existsSync(fullPath)) {
    try {
      const vision = await analyzeImageWithVision(fullPath, context);
      return {
        originalAssetId: asset.id,
        originalPath: asset.originalPath,
        description: vision.description,
        instructionalRole: vision.instructionalRole,
        generationPrompt: vision.generationPrompt,
        status: 'pending',
      };
    } catch (err: any) {
      console.log(`      Vision analysis failed, falling back to metadata: ${err.message}`);
    }
  }

  // Fallback: metadata-based analysis
  return analyzeFromMetadata(asset, course, scormDir);
}

function analyzeFromMetadata(
  asset: AssetEntry,
  course: CourseIR,
  scormDir: string,
): ImageIntelligenceEntry {
  const altText = findAltTextForAsset(asset.id, course);
  const slideContext = findSlideContextForAsset(asset.id, course);

  const description = buildDescription(altText, slideContext, asset);
  const instructionalRole = determineInstructionalRole(asset, altText, slideContext);
  const generationPrompt = buildGenerationPrompt(description, instructionalRole, course.meta.title);

  return {
    originalAssetId: asset.id,
    originalPath: asset.originalPath,
    description,
    instructionalRole,
    generationPrompt,
    status: 'pending',
  };
}

// ---- Content Image Filter ----

function isContentImage(asset: AssetEntry): boolean {
  const url = asset.originalPath.toLowerCase();
  if (url.includes('shape') && (asset.sizeBytes || 0) < 5000) return false;
  if (url.includes('poster_')) return false;
  if (asset.sizeBytes && asset.sizeBytes < 2000) return false;
  if (url.includes('logo')) return false;
  const ext = extname(url).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return false;
  return true;
}

// ---- Metadata Helpers ----

function findAltTextForAsset(assetId: number, course: CourseIR): string {
  for (const slide of course.slides) {
    for (const el of slide.elements) {
      if (el.type === 'image' && el.assetId === assetId) {
        return el.altText;
      }
    }
  }
  return '';
}

function findSlideContextForAsset(assetId: number, course: CourseIR): { slideTitle: string; slideType: string } | null {
  for (const slide of course.slides) {
    for (const el of slide.elements) {
      if (el.type === 'image' && el.assetId === assetId) {
        return { slideTitle: slide.title, slideType: slide.type };
      }
    }
  }
  return null;
}

function buildDescription(
  altText: string,
  context: { slideTitle: string; slideType: string } | null,
  asset: AssetEntry,
): string {
  const parts: string[] = [];
  if (altText && !altText.startsWith('Rectangle') && altText.length > 3) {
    const cleaned = altText
      .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
      .replace(/_/g, ' ')
      .replace(/\s+\d+$/, '')
      .trim();
    parts.push(cleaned);
  }
  if (context) {
    parts.push(`Used on "${context.slideTitle}" (${context.slideType} slide)`);
  }
  if (asset.sizeBytes && asset.sizeBytes > 100000) {
    parts.push('High-resolution content image');
  }
  return parts.join('. ') || 'Course-related image';
}

function determineInstructionalRole(
  asset: AssetEntry,
  altText: string,
  context: { slideTitle: string; slideType: string } | null,
): string {
  if (!context) return 'Supplementary visual';
  switch (context.slideType) {
    case 'title': return 'Hero/title visual — sets the tone and subject matter for the course';
    case 'objectives': return 'Supporting visual for learning objectives section';
    case 'content': return 'Illustrative content image — supports the learning material';
    case 'form': return 'Background/contextual image for the data collection section';
    case 'branching': return 'Background image for role/path selection interface';
    case 'quiz': return 'Visual context for assessment questions';
    case 'results': return 'Background visual for results/completion screen';
    default: return 'Course content image';
  }
}

function buildGenerationPrompt(
  description: string,
  instructionalRole: string,
  courseTitle: string,
): string {
  return [
    description,
    `for a professional eLearning course about "${courseTitle}"`,
    'Modern, clean, professional photography style. High resolution, well-lit, corporate quality. Suitable for professional training materials.',
  ].join('. ');
}

function buildBrandHints(brand: BrandProfile): string {
  const hints: string[] = [];
  hints.push(`Brand colors: ${brand.colors.primary} and ${brand.colors.secondary}`);
  hints.push(`${brand.style.mood} mood`);
  if (brand.style.imageStyle === 'rounded') hints.push('soft rounded edges');
  if (brand.style.mood === 'corporate') hints.push('clean corporate aesthetic');
  if (brand.style.mood === 'friendly') hints.push('warm welcoming feel');
  return hints.join(', ');
}
