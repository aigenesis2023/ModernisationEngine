/**
 * AI Image Generator — Uses Pollinations.ai to generate brand-aligned images
 * for each slide's hero/content image. Free, no API key required.
 *
 * API: https://image.pollinations.ai/prompt/{prompt}?width={w}&height={h}&nologo=true
 */
window.ImageGenerator = (function () {
  'use strict';

  var BASE_URL = 'https://image.pollinations.ai/prompt/';

  /**
   * Build a prompt for image generation based on slide context and brand.
   */
  function buildPrompt(slideTitle, slideTexts, altText, role, brand) {
    var style = 'modern, professional, clean, high quality';
    if (brand && brand.style && brand.style.mood) style += ', ' + brand.style.mood + ' style';

    // Use brand colors to guide the palette
    var colorHint = '';
    if (brand && brand.colors) {
      var colorValues = Object.values(brand.colors).filter(function (c) {
        return typeof c === 'string' && c.startsWith('#');
      }).slice(0, 3);
      if (colorValues.length > 0) {
        colorHint = ', color palette using ' + colorValues.join(' and ');
      }
    }

    // Build context from slide content — combine multiple sources for richer prompts
    var context = '';

    // Start with alt text if it's descriptive (not auto-generated placeholder names
    // or application export names like "Adobe Express - file (6).png")
    if (altText && altText.length > 3 &&
        !/^(image|photo|picture|shape|rectangle|oval|group|placeholder)/i.test(altText) &&
        !/^(adobe|canva|figma|photoshop|illustrator|express|stock)/i.test(altText) &&
        !/\.(png|jpg|jpeg|gif|svg|webp|bmp|tiff)$/i.test(altText.trim())) {
      context = altText;
    }

    // Enrich with slide texts — summarize the topic for contextual relevance
    if (slideTexts && slideTexts.length > 0) {
      var meaningfulTexts = slideTexts.filter(function (t) {
        return t.length > 10 && !/^(rectangle|oval|shape|slide|scene|question|correct|incorrect)/i.test(t.trim());
      });
      if (meaningfulTexts.length > 0) {
        // Extract key phrases from the content to describe what the image should depict
        var contentSummary = meaningfulTexts.slice(0, 2).join('. ').substring(0, 150);
        context = context ? context + ', in the context of: ' + contentSummary : contentSummary;
      }
    }

    // Fall back to slide title
    if (!context && slideTitle) {
      context = slideTitle;
    }

    if (!context || context.length < 3) context = 'professional business concept';

    var roleStyle = '';
    switch (role) {
      case 'hero':
        roleStyle = 'wide hero banner image, cinematic composition';
        break;
      case 'background':
        roleStyle = 'subtle abstract background, soft gradients, minimal';
        break;
      case 'icon':
        roleStyle = 'simple flat icon, minimal design';
        break;
      default:
        roleStyle = 'professional illustration';
    }

    var prompt = roleStyle + ' depicting ' + context + ', ' + style + colorHint +
      ', no text, no watermark, no logos';

    return prompt;
  }

  /**
   * Fetch an image from Pollinations and return as a data URL.
   */
  async function fetchImage(prompt, width, height) {
    var encodedPrompt = encodeURIComponent(prompt);
    var url = BASE_URL + encodedPrompt + '?width=' + width + '&height=' + height + '&nologo=true';

    var response = await fetch(url);
    if (!response.ok) throw new Error('Pollinations API error: ' + response.status);

    var blob = await response.blob();
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('Failed to read image blob')); };
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Generate images for all slides that have hero/content/background images.
   * @param {object} course - The CourseIR object
   * @param {object} brand - The brand profile
   * @param {Function} log - Logging callback
   * @returns {Promise<object>} - The images object with entries array
   */
  async function generateImages(course, brand, log) {
    var entries = [];

    // Collect all image elements that need generation
    var tasks = [];
    course.slides.forEach(function (slide) {
      // Main slide images
      slide.elements.forEach(function (el) {
        if (el.type === 'image' && ['hero', 'content', 'background'].includes(el.instructionalRole)) {
          var slideTexts = slide.elements
            .filter(function (e) { return e.type === 'text'; })
            .map(function (e) { return e.content || ''; });
          tasks.push({
            assetId: el.assetId,
            altText: el.altText,
            role: el.instructionalRole,
            originalPath: el.originalPath || '',
            slideTitle: slide.title,
            slideTexts: slideTexts,
            width: Math.min(el.width || 960, 1280),
            height: Math.min(el.height || 540, 720),
          });
        }
      });

      // Layer images
      slide.layers.forEach(function (layer) {
        layer.elements.forEach(function (el) {
          if (el.type === 'image' && ['hero', 'content'].includes(el.instructionalRole)) {
            var layerTexts = layer.elements
              .filter(function (e) { return e.type === 'text'; })
              .map(function (e) { return e.content || ''; });
            tasks.push({
              assetId: el.assetId,
              altText: el.altText,
              role: el.instructionalRole,
              originalPath: el.originalPath || '',
              slideTitle: layer.name || slide.title,
              slideTexts: layerTexts,
              width: Math.min(el.width || 960, 1280),
              height: Math.min(el.height || 540, 720),
            });
          }
        });
      });
    });

    // Deduplicate by assetId
    var seen = new Set();
    tasks = tasks.filter(function (t) {
      if (seen.has(t.assetId)) return false;
      seen.add(t.assetId);
      return true;
    });

    if (tasks.length === 0) {
      log('No images to generate.');
      return { entries: entries };
    }

    log('Generating ' + tasks.length + ' AI image(s)...');

    // Track whether the AI API is responding. If the first request fails,
    // skip all subsequent API calls and use original images immediately.
    // This prevents wasting 10-15 seconds per image on a dead API.
    var apiAvailable = true;

    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      var prompt = buildPrompt(task.slideTitle, task.slideTexts, task.altText, task.role, brand);
      log('  Image ' + (i + 1) + '/' + tasks.length + ': ' + prompt.substring(0, 80) + '...');

      // If API already failed, skip straight to fallback (instant)
      if (!apiAvailable) {
        if (task.originalPath) {
          log('    Using original (API unavailable): ' + task.originalPath);
          entries.push({
            originalAssetId: task.assetId,
            status: 'original',
            generatedPath: 'assets/images/' + task.originalPath.split('/').pop(),
            originalPath: task.originalPath,
            role: task.role,
            prompt: prompt,
          });
        } else {
          entries.push({ originalAssetId: task.assetId, status: 'failed',
            error: 'API unavailable', prompt: prompt });
        }
        continue;
      }

      try {
        var w = Math.round(task.width / 2) * 2;
        var h = Math.round(task.height / 2) * 2;
        w = Math.max(512, Math.min(w, 1280));
        h = Math.max(384, Math.min(h, 720));

        var dataUrl = await fetchImage(prompt, w, h);
        entries.push({
          originalAssetId: task.assetId,
          status: 'generated',
          generatedPath: dataUrl,
          prompt: prompt,
        });
        log('    Generated successfully.');
      } catch (err) {
        // First failure = mark API as unavailable for remaining images
        apiAvailable = false;
        log('    AI generation failed (' + err.message + ') — using originals for remaining images.');

        if (task.originalPath) {
          entries.push({
            originalAssetId: task.assetId,
            status: 'original',
            generatedPath: 'assets/images/' + task.originalPath.split('/').pop(),
            originalPath: task.originalPath,
            role: task.role,
            prompt: prompt,
          });
        } else {
          entries.push({ originalAssetId: task.assetId, status: 'failed',
            error: err.message, prompt: prompt });
        }
      }
    }

    var successCount = entries.filter(function (e) { return e.status === 'generated'; }).length;
    var fallbackCount = entries.filter(function (e) { return e.status === 'original'; }).length;
    var failCount = entries.filter(function (e) { return e.status === 'failed'; }).length;
    log(successCount + ' AI generated, ' + fallbackCount + ' original fallback, ' + failCount + ' failed.');

    return { entries: entries };
  }

  return { generateImages: generateImages };
})();
