import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';
import type {
  CourseIR, ImageManifest, ImageIntelligenceEntry, EvolutionConfig,
  BrandProfile, AssetEntry,
} from '../ir/types';
import { generateImage } from './generator';

// ============================================================
// Image Intelligence — Analyzes original SCORM images to
// understand what they depict, then generates new brand-aligned
// replacements via AI image generation.
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

  for (const asset of contentImages) {
    const entry = analyzeImage(asset, course, config.scormInputDir);
    entries.push(entry);
  }

  // Generate new images (sequentially to avoid rate limits)
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

// ---- Image Analysis ----

function isContentImage(asset: AssetEntry): boolean {
  const url = asset.originalPath.toLowerCase();

  // Skip tiny UI shapes (icons, buttons, radio indicators)
  if (url.includes('shape') && (asset.sizeBytes || 0) < 5000) return false;

  // Skip poster frames (duplicates of video content)
  if (url.includes('poster_')) return false;

  // Skip very small images (likely UI elements)
  if (asset.sizeBytes && asset.sizeBytes < 2000) return false;

  // Skip logos (these come from the brand, not regenerated)
  if (url.includes('logo')) return false;

  // Only process actual image formats
  const ext = extname(url).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) return false;

  return true;
}

function analyzeImage(
  asset: AssetEntry,
  course: CourseIR,
  scormDir: string,
): ImageIntelligenceEntry {
  const fullPath = join(scormDir, asset.originalPath);
  const altText = findAltTextForAsset(asset.id, course);
  const slideContext = findSlideContextForAsset(asset.id, course);

  // Build description from alt text and context
  const description = buildDescription(altText, slideContext, asset);

  // Build instructional role
  const instructionalRole = determineInstructionalRole(
    asset, altText, slideContext
  );

  // Build generation prompt
  const generationPrompt = buildGenerationPrompt(
    description, instructionalRole, course.meta.title
  );

  return {
    originalAssetId: asset.id,
    originalPath: asset.originalPath,
    description,
    instructionalRole,
    generationPrompt,
    status: 'pending',
  };
}

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

  // Use alt text as primary description
  if (altText && !altText.startsWith('Rectangle') && altText.length > 3) {
    // Clean up Storyline's auto-generated alt text (often just the filename)
    const cleaned = altText
      .replace(/\.(jpg|jpeg|png|gif|webp)$/i, '')
      .replace(/_/g, ' ')
      .replace(/\s+\d+$/, '') // remove trailing numbers
      .trim();
    parts.push(cleaned);
  }

  // Add context from the slide it appears on
  if (context) {
    parts.push(`Used on "${context.slideTitle}" (${context.slideType} slide)`);
  }

  // Add size context
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
    case 'title':
      return 'Hero/title visual — sets the tone and subject matter for the course';
    case 'objectives':
      return 'Supporting visual for learning objectives section';
    case 'content':
      return 'Illustrative content image — supports the learning material';
    case 'form':
      return 'Background/contextual image for the data collection section';
    case 'branching':
      return 'Background image for role/path selection interface';
    case 'quiz':
      return 'Visual context for assessment questions';
    case 'results':
      return 'Background visual for results/completion screen';
    default:
      return 'Course content image';
  }
}

function buildGenerationPrompt(
  description: string,
  instructionalRole: string,
  courseTitle: string,
): string {
  // Create a high-quality image generation prompt
  const parts: string[] = [];

  // Subject from description
  parts.push(description);

  // Context from the course
  parts.push(`for a professional eLearning course about "${courseTitle}"`);

  // Quality modifiers
  parts.push(
    'Modern, clean, professional photography style. ' +
    'High resolution, well-lit, corporate quality. ' +
    'Suitable for professional training materials.'
  );

  return parts.join('. ');
}

function buildBrandHints(brand: BrandProfile): string {
  const hints: string[] = [];

  // Color hints
  hints.push(`Brand colors: ${brand.colors.primary} and ${brand.colors.secondary}`);

  // Mood
  hints.push(`${brand.style.mood} mood`);

  // Image style
  if (brand.style.imageStyle === 'rounded') hints.push('soft rounded edges');
  if (brand.style.mood === 'corporate') hints.push('clean corporate aesthetic');
  if (brand.style.mood === 'friendly') hints.push('warm welcoming feel');

  return hints.join(', ');
}
