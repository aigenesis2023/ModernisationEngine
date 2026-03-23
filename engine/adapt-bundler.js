/**
 * adapt-bundler.js — "Wrappadapt" Single-File Bundler
 *
 * Inlines ALL Adapt runtime JS, CSS, and course JSON into a single
 * self-contained HTML file that works from file:// protocol.
 *
 * Architecture:
 * 1. All JS libraries inlined as <script> tags
 * 2. All CSS inlined as <style> tags
 * 3. Course JSON inlined as window.__adaptInlineData
 * 4. $.getJSON overridden to serve from inline data
 * 5. Images referenced as relative paths (stay in /assets/ folder)
 * 6. Every component gets data-id for future AI editing
 *
 * The result is a single HTML file that renders the full Adapt course
 * without needing a web server. Works on desktop, LMS, or any browser.
 */
window.AdaptBundler = (function () {
  'use strict';

  // Cache for template files (loaded once, reused)
  var templateCache = null;

  /**
   * Load all template files into memory (fetches once, caches)
   */
  async function loadTemplateFiles(log) {
    if (templateCache) return templateCache;

    log('Loading Adapt runtime template...');
    templateCache = { js: {}, css: '', fonts: {} };

    // Load manifest
    var manifest;
    try {
      var resp = await fetch('adapt-template/manifest.json');
      manifest = await resp.json();
    } catch (e) {
      log('Warning: Could not load template manifest, using essentials');
      manifest = [
        'adapt.css', 'templates.js',
        'adapt/js/adapt.min.js', 'adapt/js/build.min.js', 'adapt/js/scriptLoader.js',
        'libraries/modernizr.js', 'libraries/SCORM_API_wrapper.js',
        'libraries/jquery.min.js', 'libraries/backbone.min.js',
        'libraries/handlebars.min.js', 'libraries/require.min.js',
        'libraries/underscore.min.js', 'libraries/velocity.min.js',
        'libraries/react.production.min.js', 'libraries/react-dom.production.min.js',
        'libraries/core-js.min.js', 'libraries/regenerator-runtime.min.js',
        'libraries/imageReady.js', 'libraries/inview.js', 'libraries/bowser.js',
        'libraries/scrollTo.min.js', 'libraries/semver.js', 'libraries/enum.js',
        'libraries/backbone.es6.js', 'libraries/backbone.controller.js',
        'libraries/backbone.controller.results.js', 'libraries/underscore.results.js',
        'libraries/html-react-parser.min.js', 'libraries/lzma-min.js',
        'libraries/js-cookie.js', 'libraries/jquery.keycombo.js',
        'libraries/jquery.resize.js', 'libraries/jquery.mobile.custom.min.js',
        'libraries/mediaelement-and-player.js'
      ];
    }

    var loaded = 0;
    for (var i = 0; i < manifest.length; i++) {
      var path = manifest[i];
      try {
        var resp = await fetch('adapt-template/' + path);
        if (!resp.ok) continue;

        if (path === 'adapt.css') {
          templateCache.css = await resp.text();
        } else if (/\.(woff2?|ttf|eot)$/i.test(path)) {
          // Convert font to base64 data URL
          var buf = await resp.arrayBuffer();
          var bytes = new Uint8Array(buf);
          var binary = '';
          for (var b = 0; b < bytes.length; b++) binary += String.fromCharCode(bytes[b]);
          var ext = path.split('.').pop().toLowerCase();
          var mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : 'font/' + ext;
          templateCache.fonts[path] = 'data:' + mime + ';base64,' + btoa(binary);
        } else if (/\.js$/i.test(path)) {
          templateCache.js[path] = await resp.text();
        }
        loaded++;
      } catch (e) {
        // Skip files that can't be loaded
      }
    }

    log('Loaded ' + loaded + ' template files');
    return templateCache;
  }

  /**
   * Generate the single-file HTML bundle
   *
   * @param {Object} adaptJson - Output from AdaptTranslator.translate()
   * @param {string} brandCSS - Output from AdaptTranslator.generateBrandCSS()
   * @param {Object} coursePlan - Course metadata
   * @param {Function} log
   * @returns {Promise<string>} - Complete HTML string
   */
  async function bundle(adaptJson, brandCSS, coursePlan, log) {
    log = log || function () {};
    var template = await loadTemplateFiles(log);

    var courseTitle = coursePlan.meta.title || 'Modernised Course';

    log('Bundling single-file HTML...');

    // ---- Build the inline data object ----
    // This maps Adapt's expected AJAX URLs to their JSON data
    var inlineData = {
      'course/en/language_data_manifest.js': [
        'course.json', 'contentObjects.json', 'articles.json',
        'blocks.json', 'components.json'
      ],
      'course/en/course.json': adaptJson.course,
      'course/en/contentObjects.json': adaptJson.contentObjects,
      'course/en/articles.json': adaptJson.articles,
      'course/en/blocks.json': adaptJson.blocks,
      'course/en/components.json': adaptJson.components
    };

    // Add data-id to each component for AI editing
    adaptJson.components.forEach(function (comp) {
      comp._classes = (comp._classes || '') + ' data-id-' + comp._id;
    });

    // ---- Replace font URLs in CSS with base64 data URLs ----
    var css = template.css;
    for (var fontPath in template.fonts) {
      var fontFile = fontPath.split('/').pop();
      // Replace url("../fonts/filename") or url("fonts/filename") patterns
      var pattern = new RegExp('url\\(["\']?[^"\']*' + fontFile.replace('.', '\\.') + '["\']?\\)', 'g');
      css = css.replace(pattern, 'url("' + template.fonts[fontPath] + '")');
    }

    // ---- Determine script loading order ----
    // Adapt uses RequireJS, so we need specific order
    var scriptOrder = [
      'libraries/modernizr.js',
      'libraries/jquery.min.js',
      'libraries/jquery.mobile.custom.min.js',
      'libraries/jquery.resize.js',
      'libraries/jquery.keycombo.js',
      'libraries/underscore.min.js',
      'libraries/underscore.results.js',
      'libraries/backbone.min.js',
      'libraries/backbone.es6.js',
      'libraries/backbone.controller.js',
      'libraries/backbone.controller.results.js',
      'libraries/handlebars.min.js',
      'libraries/velocity.min.js',
      'libraries/scrollTo.min.js',
      'libraries/imageReady.js',
      'libraries/inview.js',
      'libraries/bowser.js',
      'libraries/semver.js',
      'libraries/enum.js',
      'libraries/core-js.min.js',
      'libraries/regenerator-runtime.min.js',
      'libraries/react.production.min.js',
      'libraries/react-dom.production.min.js',
      'libraries/html-react-parser.min.js',
      'libraries/lzma-min.js',
      'libraries/js-cookie.js',
      'libraries/mediaelement-and-player.js',
      'libraries/SCORM_API_wrapper.js',
      'templates.js',
      'adapt/js/adapt.min.js',
      'adapt/js/scriptLoader.js'
    ];

    // ---- Build HTML ----
    var html = '<!doctype html>\n';
    html += '<html id="adapt" class="html no-js" lang="en" dir="ltr">\n';
    html += '<head>\n';
    html += '<meta http-equiv="X-UA-Compatible" content="IE=edge">\n';
    html += '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n';
    html += '<title>' + escHtml(courseTitle) + '</title>\n';
    html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';

    // Inline CSS
    html += '<style>\n' + css + '\n</style>\n';

    // Brand CSS overrides
    if (brandCSS) {
      html += '<style>\n' + brandCSS + '\n</style>\n';
    }

    html += '</head>\n<body>\n';
    html += '<script>\n';
    html += 'window.ADAPT_BUILD_TYPE = "production";\n';
    html += 'window.ISCOOKIELMS = false;\n';

    // ---- The key: inline course data and intercept AJAX ----
    html += '\n// === INLINE COURSE DATA ===\n';
    html += 'window.__adaptInlineData = ' + JSON.stringify(inlineData) + ';\n';
    html += 'window.courseData = window.__adaptInlineData;\n';

    // Override $.getJSON AFTER jQuery loads
    html += 'window.__patchAdaptAjax = function() {\n';
    html += '  if (!window.jQuery) return;\n';
    html += '  var _origGetJSON = jQuery.getJSON;\n';
    html += '  jQuery.getJSON = function(url, callback) {\n';
    html += '    // Strip timestamp query params\n';
    html += '    var cleanUrl = url.split("?")[0];\n';
    html += '    // Check inline data\n';
    html += '    if (window.__adaptInlineData[cleanUrl]) {\n';
    html += '      var data = JSON.parse(JSON.stringify(window.__adaptInlineData[cleanUrl]));\n';
    html += '      data.__path__ = cleanUrl;\n';
    html += '      if (callback) callback(data);\n';
    html += '      var d = jQuery.Deferred();\n';
    html += '      d.resolve(data);\n';
    html += '      return d.promise();\n';
    html += '    }\n';
    html += '    // Fallback to original for non-course requests\n';
    html += '    return _origGetJSON.apply(this, arguments);\n';
    html += '  };\n';
    html += '};\n';

    html += '</script>\n';

    // ---- Inline all JS libraries in order ----
    html += '<div id="app"><div id="wrapper"></div></div>\n';

    for (var i = 0; i < scriptOrder.length; i++) {
      var scriptPath = scriptOrder[i];
      var scriptContent = template.js[scriptPath];
      if (!scriptContent) continue;

      html += '<script>';

      // After jQuery loads, patch the AJAX
      if (scriptPath === 'libraries/jquery.min.js') {
        html += scriptContent;
        html += '\n;window.__patchAdaptAjax();\n';
      } else {
        html += scriptContent;
      }

      html += '</script>\n';
    }

    // Add any remaining JS files not in the ordered list
    for (var path in template.js) {
      if (scriptOrder.indexOf(path) === -1) {
        html += '<script>' + template.js[path] + '</script>\n';
      }
    }

    html += '</body>\n</html>';

    log('Bundle complete: ' + (html.length / 1024 / 1024).toFixed(1) + ' MB');
    return html;
  }

  function escHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    bundle: bundle,
    loadTemplateFiles: loadTemplateFiles
  };
})();
