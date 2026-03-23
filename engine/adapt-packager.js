/**
 * adapt-packager.js — Packages an Adapt course as a SCORM 1.2 zip
 *
 * Combines pre-built Adapt runtime files with generated course JSON,
 * brand CSS overrides, and course assets into a downloadable SCORM zip.
 *
 * Works in the browser using JSZip. The pre-built runtime is loaded
 * from the adapt-template/ directory. Course JSON and brand CSS are
 * generated at runtime by the translator.
 */
window.AdaptPackager = (function () {
  'use strict';

  // ---- SCORM 1.2 manifest for Adapt ----
  function generateManifest(courseTitle, courseId) {
    var title = (courseTitle || 'Modernised Course')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var id = courseId || 'modernised-' + Date.now();

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<manifest identifier="' + id + '" version="1.0"\n' +
      '  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"\n' +
      '  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"\n' +
      '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n' +
      '  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd\n' +
      '                       http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">\n' +
      '  <metadata>\n' +
      '    <schema>ADL SCORM</schema>\n' +
      '    <schemaversion>1.2</schemaversion>\n' +
      '  </metadata>\n' +
      '  <organizations default="org1">\n' +
      '    <organization identifier="org1">\n' +
      '      <title>' + title + '</title>\n' +
      '      <item identifier="item1" identifierref="res1">\n' +
      '        <title>' + title + '</title>\n' +
      '      </item>\n' +
      '    </organization>\n' +
      '  </organizations>\n' +
      '  <resources>\n' +
      '    <resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">\n' +
      '      <file href="index.html"/>\n' +
      '    </resource>\n' +
      '  </resources>\n' +
      '</manifest>';
  }

  // ---- Adapt index.html template ----
  function generateIndexHtml(courseTitle) {
    return '<!doctype html>\n' +
      '<html id="adapt" class="html no-js" lang="en" dir="ltr">\n' +
      '  <head>\n' +
      '    <script>\n' +
      '      window.ADAPT_BUILD_TYPE = \'production\';\n' +
      '      window.ISCOOKIELMS = false;\n' +
      '    </script>\n' +
      '    <meta http-equiv="X-UA-Compatible" content="IE=edge">\n' +
      '    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">\n' +
      '    <title>' + (courseTitle || '') + '</title>\n' +
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '    <link href="adapt.css" type="text/css" rel="stylesheet">\n' +
      '    <link href="brand-override.css" type="text/css" rel="stylesheet">\n' +
      '    <script src="libraries/modernizr.js"></script>\n' +
      '    <script src="adapt/js/scriptLoader.js"></script>\n' +
      '  </head>\n' +
      '  <body>\n' +
      '    <div id="app">\n' +
      '      <div id="wrapper"></div>\n' +
      '    </div>\n' +
      '  </body>\n' +
      '</html>';
  }

  /**
   * Package an Adapt course into a SCORM zip.
   *
   * @param {Object} adaptJson - Output from AdaptTranslator.translate()
   * @param {string} brandCSS - Output from AdaptTranslator.generateBrandCSS()
   * @param {Map} originalFileMap - Original SCORM file map (for copying assets)
   * @param {Object} coursePlan - The course plan (for metadata)
   * @param {Function} log - Logging function
   * @returns {Promise<Blob>} - The zip as a Blob
   */
  async function packageCourse(adaptJson, brandCSS, originalFileMap, coursePlan, log) {
    log = log || function () {};
    var zip = new JSZip();

    var courseTitle = coursePlan.meta.title || 'Modernised Course';
    var courseId = coursePlan.meta.courseId || 'modernised-course';

    log('Packaging Adapt course: ' + courseTitle);

    // 1. Add SCORM manifest
    zip.file('imsmanifest.xml', generateManifest(courseTitle, courseId));

    // 2. Add index.html
    zip.file('index.html', generateIndexHtml(courseTitle));

    // 3. Add brand CSS overrides
    zip.file('brand-override.css', brandCSS || '/* No brand overrides */');

    // 4. Add Adapt runtime files from template
    // These are loaded from the adapt-template/ directory
    log('Adding Adapt runtime files...');
    var templateFiles = await loadTemplateFiles();
    for (var path in templateFiles) {
      zip.file(path, templateFiles[path]);
    }

    // 5. Add course JSON files
    log('Adding course content JSON...');
    zip.file('course/en/course.json', JSON.stringify(adaptJson.course, null, 2));
    zip.file('course/en/contentObjects.json', JSON.stringify(adaptJson.contentObjects, null, 2));
    zip.file('course/en/articles.json', JSON.stringify(adaptJson.articles, null, 2));
    zip.file('course/en/blocks.json', JSON.stringify(adaptJson.blocks, null, 2));
    zip.file('course/en/components.json', JSON.stringify(adaptJson.components, null, 2));

    // 6. Add language data manifest (required by Adapt)
    zip.file('course/en/language_data_manifest.js',
      'window.__loadedLanguageData = window.__loadedLanguageData || [];\n' +
      'window.__loadedLanguageData.push(["en"]);');

    // 7. Copy original SCORM assets (images, video, audio)
    log('Copying course assets...');
    var assetCount = 0;
    if (originalFileMap) {
      for (var [filePath, fileObj] of originalFileMap) {
        // Copy images from story_content/ and mobile/ to course/en/images/
        if (/^(story_content|mobile)\/.*\.(jpg|jpeg|png|gif|svg|webp)$/i.test(filePath)) {
          var filename = filePath.split('/').pop();
          try {
            var content = await fileObj.text();
            // For binary files, we need the raw data
            if (fileObj.arrayBuffer) {
              var buf = await fileObj.arrayBuffer();
              zip.file('course/en/images/' + filename, buf);
            } else {
              zip.file('course/en/images/' + filename, content);
            }
            assetCount++;
          } catch (e) {
            // Skip files that can't be read
          }
        }
        // Copy videos to course/en/video/
        if (/^story_content\/.*\.(mp4|webm|ogv)$/i.test(filePath)) {
          var filename = filePath.split('/').pop();
          try {
            if (fileObj.arrayBuffer) {
              var buf = await fileObj.arrayBuffer();
              zip.file('course/en/video/' + filename, buf);
            }
            assetCount++;
          } catch (e) {}
        }
        // Copy audio to course/en/audio/
        if (/^story_content\/.*\.(mp3|wav|ogg)$/i.test(filePath)) {
          var filename = filePath.split('/').pop();
          try {
            if (fileObj.arrayBuffer) {
              var buf = await fileObj.arrayBuffer();
              zip.file('course/en/audio/' + filename, buf);
            }
            assetCount++;
          } catch (e) {}
        }
      }
    }
    log('Copied ' + assetCount + ' assets');

    // 8. Add SCORM schema files
    zip.file('adlcp_rootv1p2.xsd', ADLCP_SCHEMA);
    zip.file('imscp_rootv1p1p2.xsd', IMSCP_SCHEMA);
    zip.file('ims_xml.xsd', IMS_XML_SCHEMA);
    zip.file('imsmd_rootv1p2p1.xsd', IMSMD_SCHEMA);

    // 9. Generate zip
    log('Generating zip file...');
    var blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    log('Package complete: ' + Math.round(blob.size / 1024) + ' KB');
    return blob;
  }

  // ---- Load pre-built Adapt template files ----
  // In browser context, these are fetched from the adapt-template/ directory
  // In Node.js test context, they're read from the filesystem
  async function loadTemplateFiles() {
    var files = {};

    // Fetch the template manifest to know which files to include
    // The manifest is generated during build and lists all runtime files
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        var manifestResp = await fetch('adapt-template/manifest.json');
        if (manifestResp.ok) {
          var manifest = await manifestResp.json();
          for (var i = 0; i < manifest.length; i++) {
            var path = manifest[i];
            try {
              var resp = await fetch('adapt-template/' + path);
              if (resp.ok) {
                // Binary files (fonts, etc.)
                if (/\.(woff2?|ttf|eot|png|jpg|gif|ico)$/i.test(path)) {
                  var buf = await resp.arrayBuffer();
                  files[path] = buf;
                } else {
                  var content = await resp.text();
                  files[path] = content;
                }
              }
            } catch (e) {}
          }
        }
      } catch (e) {
        // Fallback: if no manifest, try to fetch known essential files
        var essentials = [
          'adapt.css', 'templates.js',
          'adapt/js/adapt.min.js', 'adapt/js/build.min.js', 'adapt/js/scriptLoader.js',
          'libraries/modernizr.js', 'libraries/SCORM_API_wrapper.js',
          'libraries/jquery.min.js', 'libraries/backbone.min.js',
          'libraries/handlebars.min.js', 'libraries/require.min.js',
          'libraries/underscore.min.js', 'libraries/velocity.min.js',
          'libraries/react.production.min.js', 'libraries/react-dom.production.min.js',
          'libraries/core-js.min.js', 'libraries/regenerator-runtime.min.js',
          'libraries/imageReady.js', 'libraries/inview.js', 'libraries/bowser.js',
          'fonts/vanilla.woff', 'fonts/vanilla.woff2'
        ];
        for (var i = 0; i < essentials.length; i++) {
          try {
            var resp = await fetch('adapt-template/' + essentials[i]);
            if (resp.ok) {
              if (/\.(woff2?|ttf|eot)$/i.test(essentials[i])) {
                files[essentials[i]] = await resp.arrayBuffer();
              } else {
                files[essentials[i]] = await resp.text();
              }
            }
          } catch (e) {}
        }
      }
    }

    return files;
  }

  // ---- Minimal SCORM schema stubs ----
  var ADLCP_SCHEMA = '<?xml version="1.0" encoding="UTF-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"/>';
  var IMSCP_SCHEMA = '<?xml version="1.0" encoding="UTF-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"/>';
  var IMS_XML_SCHEMA = '<?xml version="1.0" encoding="UTF-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"/>';
  var IMSMD_SCHEMA = '<?xml version="1.0" encoding="UTF-8"?>\n<xsd:schema xmlns:xsd="http://www.w3.org/2001/XMLSchema"/>';

  return {
    packageCourse: packageCourse
  };
})();
