#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync } from 'fs';
import { EvolutionEngine } from './engine';
import type { EvolutionConfig } from './ir/types';

function parseArgs(args: string[]): Partial<EvolutionConfig> {
  const config: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scorm' && args[i + 1]) config.scormInputDir = args[++i];
    else if (arg === '--brand-url' && args[i + 1]) config.brandUrl = args[++i];
    else if (arg === '--output' && args[i + 1]) config.outputDir = args[++i];
    else if (arg === '--skip-images') config.skipImageGen = 'true';
    else if (arg === '--verbose') config.verbose = 'true';
    else if (arg === '--help') { printHelp(); process.exit(0); }
  }
  return {
    scormInputDir: config.scormInputDir,
    brandUrl: config.brandUrl,
    outputDir: config.outputDir || 'output',
    imageGenProvider: 'pollinations',
    skipImageGen: config.skipImageGen === 'true',
    verbose: config.verbose === 'true',
  };
}

function printHelp(): void {
  console.log(`
  Evolution Engine — Transform legacy SCORM into modern web experiences

  Usage:
    npx ts-node src/cli.ts --scorm <folder> --brand-url <url> [options]

  Required:
    --scorm <folder>     Path to the SCORM export folder
    --brand-url <url>    Website URL for brand alignment

  Options:
    --output <folder>    Output directory (default: ./output)
    --skip-images        Skip AI image generation
    --verbose            Enable detailed logging
    --help               Show this help message

  Environment Variables:
    ANTHROPIC_API_KEY    Enables AI vision analysis of SCORM images (recommended)
    STABILITY_API_KEY    Use Stability AI for image generation
    OPENAI_API_KEY       Use DALL-E 3 for image generation

  Example:
    npx ts-node src/cli.ts --scorm "./Test intro scene" --brand-url "https://example.com"
  `);
}

async function main(): Promise<void> {
  console.log('\n  ⚡ Evolution Engine v1.0.0\n');

  const config = parseArgs(process.argv.slice(2)) as EvolutionConfig;

  if (!config.scormInputDir || !config.brandUrl) {
    console.error('  Error: --scorm and --brand-url are required.\n');
    printHelp();
    process.exit(1);
  }

  config.scormInputDir = resolve(config.scormInputDir);
  config.outputDir = resolve(config.outputDir);

  if (!existsSync(config.scormInputDir)) {
    console.error(`  Error: SCORM folder not found: ${config.scormInputDir}\n`);
    process.exit(1);
  }

  const engine = new EvolutionEngine(config);
  await engine.run();
}

main().catch((err) => {
  console.error('\n  Fatal error:', err.message);
  process.exit(1);
});
