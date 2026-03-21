import { readFileSync } from 'fs';
import { extname } from 'path';

// ============================================================
// Vision Analyzer — Uses AI vision (Claude) to analyze images
// and produce rich descriptions of what they depict, their
// instructional purpose, and optimized image generation prompts.
//
// Requires ANTHROPIC_API_KEY env var.
// Falls back to metadata-only analysis when unavailable.
// ============================================================

export interface VisionAnalysis {
  description: string;
  instructionalRole: string;
  subjectMatter: string;
  visualStyle: string;
  generationPrompt: string;
}

export async function analyzeImageWithVision(
  imagePath: string,
  slideContext: { slideTitle: string; slideType: string; courseTitle: string },
): Promise<VisionAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  const imageData = readFileSync(imagePath);
  const base64 = imageData.toString('base64');
  const ext = extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png'
    : ext === '.gif' ? 'image/gif'
    : ext === '.webp' ? 'image/webp'
    : 'image/jpeg';

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey });

  const prompt = `You are analyzing an image from an eLearning course titled "${slideContext.courseTitle}".
This image appears on a slide called "${slideContext.slideTitle}" (slide type: ${slideContext.slideType}).

Analyze this image and respond in EXACTLY this JSON format (no markdown, no code fences, just raw JSON):
{
  "description": "A detailed description of what the image shows — subjects, setting, objects, colors, composition",
  "instructionalRole": "Why this image is in the course — what learning purpose it serves (e.g., 'Illustrates the EV charging process', 'Sets professional tone for the course intro')",
  "subjectMatter": "The core subject shown (e.g., 'electric vehicle charging port', 'team meeting', 'safety equipment')",
  "visualStyle": "The photographic/artistic style (e.g., 'professional corporate photography', 'close-up macro shot', 'flat illustration')",
  "generationPrompt": "An optimized prompt to generate a NEW, higher-quality version of this image for the same instructional purpose. Be specific about composition, lighting, style. Do NOT mention the original image."
}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        { type: 'text', text: prompt },
      ],
    }],
  });

  // Extract text from response
  const text = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as any).text as string)
    .join('');

  try {
    const parsed = JSON.parse(text);
    return {
      description: parsed.description || 'Course-related image',
      instructionalRole: parsed.instructionalRole || 'Supporting visual',
      subjectMatter: parsed.subjectMatter || 'course content',
      visualStyle: parsed.visualStyle || 'professional photography',
      generationPrompt: parsed.generationPrompt || text,
    };
  } catch {
    // If JSON parsing fails, use the raw text as description
    return {
      description: text.substring(0, 500),
      instructionalRole: 'Supporting visual for course content',
      subjectMatter: 'course content',
      visualStyle: 'professional photography',
      generationPrompt: text.substring(0, 300),
    };
  }
}

export function isVisionAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}
