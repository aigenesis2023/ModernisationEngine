import fetch from 'node-fetch';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

// ============================================================
// Image Generator — Swappable backend for AI image generation.
// Currently supports Pollinations.ai (free, no API key).
// Designed so swapping to Stability AI, DALL-E, etc. is a
// one-line change in the provider config.
// ============================================================

export type ImageGenProvider = 'pollinations' | 'stability' | 'dalle' | 'none';

export async function generateImage(
  prompt: string,
  outputPath: string,
  provider: ImageGenProvider = 'pollinations',
): Promise<void> {
  // Ensure output directory exists
  const dir = dirname(outputPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  switch (provider) {
    case 'pollinations':
      return generateWithPollinations(prompt, outputPath);
    case 'stability':
      return generateWithStability(prompt, outputPath);
    case 'dalle':
      return generateWithDalle(prompt, outputPath);
    case 'none':
      return; // skip generation
    default:
      throw new Error(`Unknown image generation provider: ${provider}`);
  }
}

// ---- Pollinations.ai (Free, no API key) ----

async function generateWithPollinations(prompt: string, outputPath: string): Promise<void> {
  // Pollinations provides a simple URL-based API:
  // https://image.pollinations.ai/prompt/{encoded_prompt}
  const encodedPrompt = encodeURIComponent(prompt);
  const width = 1200;
  const height = 675; // 16:9 aspect ratio
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

  const response = await fetch(url, {
    timeout: 60000, // Image gen can take a while
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Pollinations API error: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.buffer();

  if (buffer.length < 1000) {
    throw new Error('Generated image too small — likely an error response');
  }

  writeFileSync(outputPath, buffer);
}

// ---- Stability AI (placeholder — requires API key) ----

async function generateWithStability(prompt: string, outputPath: string): Promise<void> {
  const apiKey = process.env.STABILITY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'STABILITY_API_KEY environment variable required. ' +
      'Get one at https://platform.stability.ai/'
    );
  }

  const response = await fetch(
    'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text_prompts: [{ text: prompt, weight: 1 }],
        cfg_scale: 7,
        width: 1216,
        height: 832,
        steps: 30,
        samples: 1,
      }),
      timeout: 60000,
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Stability API error: ${response.status} — ${errBody}`);
  }

  const result: any = await response.json();
  const imageData = result.artifacts?.[0]?.base64;
  if (!imageData) throw new Error('No image data in Stability response');

  writeFileSync(outputPath, Buffer.from(imageData, 'base64'));
}

// ---- DALL-E (placeholder — requires API key) ----

async function generateWithDalle(prompt: string, outputPath: string): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable required. ' +
      'Get one at https://platform.openai.com/'
    );
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      response_format: 'b64_json',
    }),
    timeout: 60000,
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`DALL-E API error: ${response.status} — ${errBody}`);
  }

  const result: any = await response.json();
  const imageData = result.data?.[0]?.b64_json;
  if (!imageData) throw new Error('No image data in DALL-E response');

  writeFileSync(outputPath, Buffer.from(imageData, 'base64'));
}
