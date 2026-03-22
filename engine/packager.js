/**
 * SCORM Packager — Creates a downloadable SCORM 1.2 zip using JSZip.
 * Includes imsmanifest.xml, the generated index.html, and copied assets.
 */
window.Packager = (function () {
  'use strict';

  function generateManifest(course) {
    var title = course.meta.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var courseId = course.meta.courseId || 'modernised-course';
    var mastery = course.meta.masteryScore || 80;

    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<manifest identifier="' + courseId + '" version="1.0"\n' +
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
      '        <adlcp:masteryscore>' + mastery + '</adlcp:masteryscore>\n' +
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

  /**
   * Package the course into a SCORM zip.
   * @param {string} html - The generated course HTML
   * @param {object} course - The CourseIR object
   * @param {Map} fileMap - Original uploaded files (for copying assets)
   * @param {object} images - Generated images object with entries array
   * @param {Function} log - Logging function
   * @returns {Promise<Blob>} - The zip as a Blob
   */
  async function packageCourse(html, course, fileMap, images, log) {
    log('Creating SCORM package...');
    var zip = new JSZip();

    // Add the generated course page
    zip.file('index.html', html);

    // Add SCORM manifest
    zip.file('imsmanifest.xml', generateManifest(course));

    // Copy media assets from the uploaded SCORM folder
    var assetCount = 0;
    var assetsFolder = zip.folder('assets');
    var imagesFolder = assetsFolder.folder('images');
    var mediaFolder = assetsFolder.folder('media');

    var seenImages = new Set();
    var seenMedia = new Set();
    for (var [path, file] of fileMap) {
      var lower = path.toLowerCase();
      // Storyline exports assets in multiple directories:
      // - story_content/ — images, audio, video, fonts
      // - html5/ — CSS, scripts, fonts
      // - mobile/ — mobile-optimized images (often used for backgrounds)
      var isAssetDir = lower.includes('story_content') || lower.includes('html5') || lower.includes('mobile');
      if (!isAssetDir) continue;

      var filename = path.split('/').pop();
      if (lower.match(/\.(jpg|jpeg|png|gif|svg|webp)$/) && !seenImages.has(filename)) {
        seenImages.add(filename);
        var imgData = await file.arrayBuffer();
        imagesFolder.file(filename, imgData);
        assetCount++;
      }
      if (lower.match(/\.(mp4|mp3|wav|ogg|webm)$/) && !seenMedia.has(filename)) {
        seenMedia.add(filename);
        var mediaData = await file.arrayBuffer();
        mediaFolder.file(filename, mediaData);
        assetCount++;
      }
    }

    log('Copied ' + assetCount + ' media assets');
    // Download React/ReactDOM and include in the package for offline LMS support
    try {
      var reactJs = await fetch('https://unpkg.com/react@18/umd/react.production.min.js').then(function(r) { return r.text(); });
      var reactDomJs = await fetch('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js').then(function(r) { return r.text(); });
      if (reactJs.length > 1000) {
        var libFolder = zip.folder('lib');
        libFolder.file('react.min.js', reactJs);
        libFolder.file('react-dom.min.js', reactDomJs);
        log('Included React/ReactDOM in package for offline LMS support');
      }
    } catch (e) {
      log('Could not download React for packaging — CDN fallback will be used');
    }

    log('Generating zip file...');

    var blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }, function (metadata) {
      if (metadata.percent % 20 < 1) {
        log('Zipping: ' + Math.round(metadata.percent) + '%');
      }
    });

    log('SCORM package ready (' + (blob.size / 1024 / 1024).toFixed(1) + ' MB)');
    return blob;
  }

  return { packageCourse: packageCourse };
})();
