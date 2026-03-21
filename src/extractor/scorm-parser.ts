import { readFileSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import type { CourseIR, CourseMeta } from '../ir/types';
import {
  parseDataJs,
  parseSlide,
  buildAssetManifest,
  buildNavigationMap,
  buildQuestionBanks,
} from './storyline-parser';

// ---- SCORM Manifest Parser ----

interface ManifestData {
  title: string;
  courseId: string;
  scormVersion: '1.2' | '2004';
  masteryScore: number;
}

function parseManifest(scormDir: string): ManifestData {
  const xmlPath = join(scormDir, 'imsmanifest.xml');
  const xmlContent = readFileSync(xmlPath, 'utf8');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });
  const doc = parser.parse(xmlContent);
  const manifest = doc.manifest;

  // Extract title
  const title =
    manifest?.organizations?.organization?.item?.title ||
    manifest?.metadata?.lom?.general?.title?.langstring?.['#text'] ||
    manifest?.metadata?.lom?.general?.title?.langstring ||
    'Untitled Course';

  // Extract course ID
  const courseId = manifest?.['@_identifier'] || 'unknown';

  // Detect SCORM version
  const schemaVersion = String(manifest?.metadata?.schemaversion || '1.2');
  const scormVersion = schemaVersion.includes('2004') ? '2004' as const : '1.2' as const;

  // Extract mastery score
  const masteryScore = parseInt(
    manifest?.organizations?.organization?.item?.masteryscore || '80',
    10
  );

  return { title, courseId, scormVersion, masteryScore };
}

// ---- Meta.xml Parser ----

function parseMetaXml(scormDir: string): { publishedDate?: string; author?: string } {
  try {
    const metaPath = join(scormDir, 'meta.xml');
    const xmlContent = readFileSync(metaPath, 'utf8');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const doc = parser.parse(xmlContent);
    return {
      publishedDate: doc?.meta?.['@_published'] || undefined,
      author: doc?.meta?.['@_author'] || undefined,
    };
  } catch {
    return {};
  }
}

// ---- Main Extraction Orchestrator ----

export async function extractCourse(scormDir: string, verbose: boolean): Promise<CourseIR> {
  if (verbose) console.log('    Parsing SCORM manifest...');
  const manifest = parseManifest(scormDir);
  const metaInfo = parseMetaXml(scormDir);

  if (verbose) console.log('    Parsing Storyline data files...');
  const storylineData = parseDataJs(scormDir);

  if (verbose) console.log(`    Found ${storylineData.slidesById.size} slide files`);

  // Build asset manifest from assetLib
  const assets = buildAssetManifest(storylineData.assetLib, scormDir);

  // Build navigation map
  const navigation = buildNavigationMap(storylineData.slideMap, storylineData.scenes);

  // Determine the ordered slide list from the slideMap
  const slideRefs = storylineData.slideMap?.slideRefs || [];
  const mainSlideRefs = slideRefs.filter((ref: any) =>
    ref.type === 'slide' && !ref.id.includes('Prompt') && !ref.id.includes('Msg')
  );

  // Parse each main slide
  const slides = mainSlideRefs.map((ref: any, index: number) => {
    const slideId = ref.id.split('.').pop() || ref.id;
    const slideData = storylineData.slidesById.get(slideId);
    if (!slideData) {
      if (verbose) console.log(`    Warning: No data for slide ${slideId}`);
      return null;
    }
    return parseSlide(slideId, slideData, index + 1, ref);
  }).filter((s: any): s is NonNullable<typeof s> => s !== null);

  // Build question banks
  const questionBanks = buildQuestionBanks(
    storylineData.scenes,
    storylineData.slidesById,
    storylineData.quizzes,
  );

  // Compute totals
  const totalAudioDurationMs = storylineData.assetLib
    .filter((a: any) => a.duration && !a.videoType)
    .reduce((sum: number, a: any) => sum + (a.duration || 0), 0);

  const totalVideoDurationMs = storylineData.assetLib
    .filter((a: any) => a.videoType)
    .reduce((sum: number, a: any) => sum + (a.duration || 0), 0);

  const meta: CourseMeta = {
    title: manifest.title,
    courseId: manifest.courseId,
    scormVersion: manifest.scormVersion,
    masteryScore: manifest.masteryScore,
    totalSlides: slides.length,
    totalAudioDurationMs,
    totalVideoDurationMs,
    publishedDate: metaInfo.publishedDate,
    author: metaInfo.author,
  };

  const course: CourseIR = {
    meta,
    slides,
    questionBanks,
    assets,
    navigation,
  };

  if (verbose) {
    console.log(`    Extracted: ${slides.length} slides, ${questionBanks.length} question banks`);
    console.log(`    Questions: ${questionBanks.reduce((sum, qb) => sum + qb.questions.length, 0)}`);
    console.log(`    Assets: ${assets.images.length} images, ${assets.videos.length} videos, ${assets.audio.length} audio`);
  }

  return course;
}
