import { readFileSync } from 'fs';
import type {
  EvolutionConfig,
  CourseIR,
  BrandProfile,
  ImageManifest,
  PipelineResult,
  PipelineStats,
} from './ir/types';

export class EvolutionEngine {
  constructor(private config: EvolutionConfig) {}

  async run(): Promise<PipelineResult> {
    const startTime = Date.now();

    console.log('  Phase 1/6 — Extracting SCORM content...');
    const course = await this.extract();

    console.log('  Phase 2/6 — Scanning brand from URL...');
    const brand = await this.scanBrand();

    console.log('  Phase 3/6 — Transforming content...');
    const transformed = await this.transform(course, brand);

    console.log('  Phase 4/6 — Processing images...');
    const images = await this.processImages(transformed, brand);

    console.log('  Phase 5/6 — Generating web application...');
    await this.generate(transformed, brand, images);

    console.log('  Phase 6/6 — Packaging SCORM output...');
    const outputPath = await this.package(transformed);

    const stats: PipelineStats = {
      totalSlides: transformed.slides.length,
      totalQuestions: transformed.questionBanks.reduce((sum, qb) => sum + qb.questions.length, 0),
      imagesProcessed: images.entries.length,
      imagesGenerated: images.entries.filter(e => e.status === 'generated').length,
      imagesFailed: images.entries.filter(e => e.status === 'failed').length,
      durationMs: Date.now() - startTime,
    };

    this.printSummary(stats);

    return { config: this.config, course: transformed, brand, images, outputPath, stats };
  }

  private async extract(): Promise<CourseIR> {
    const { extractCourse } = await import('./extractor/scorm-parser');
    return extractCourse(this.config.scormInputDir, this.config.verbose);
  }

  private async scanBrand(): Promise<BrandProfile> {
    if (this.config.brandJsonPath) {
      console.log(`    Loading brand profile from ${this.config.brandJsonPath}`);
      return JSON.parse(readFileSync(this.config.brandJsonPath, 'utf-8'));
    }
    const { scrapeBrand } = await import('./brand/scraper');
    return scrapeBrand(this.config.brandUrl, this.config.verbose);
  }

  private async transform(course: CourseIR, brand: BrandProfile): Promise<CourseIR> {
    const { transformCourse } = await import('./transformer/index');
    return transformCourse(course, brand);
  }

  private async processImages(course: CourseIR, brand: BrandProfile): Promise<ImageManifest> {
    if (this.config.imageManifestPath) {
      console.log(`    Loading image manifest from ${this.config.imageManifestPath}`);
      return JSON.parse(readFileSync(this.config.imageManifestPath, 'utf-8'));
    }
    if (this.config.skipImageGen) {
      console.log('    Skipping image generation (--skip-images)');
      return { entries: [] };
    }
    const { processImages } = await import('./images/analyzer');
    return processImages(course, this.config, brand);
  }

  private async generate(course: CourseIR, brand: BrandProfile, images: ImageManifest): Promise<void> {
    const { generateApp } = await import('./generator/index');
    return generateApp(course, brand, images, this.config);
  }

  private async package(course: CourseIR): Promise<string> {
    const { packageScorm } = await import('./packager/index');
    return packageScorm(this.config, course);
  }

  private printSummary(stats: PipelineStats): void {
    const seconds = (stats.durationMs / 1000).toFixed(1);
    console.log(`
  ──────────────────────────────────
  Evolution complete in ${seconds}s

    Slides:     ${stats.totalSlides}
    Questions:  ${stats.totalQuestions}
    Images:     ${stats.imagesGenerated}/${stats.imagesProcessed} generated
    Output:     ${this.config.outputDir}
  ──────────────────────────────────
    `);
  }
}
