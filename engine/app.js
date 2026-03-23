/**
 * Main Pipeline — Wires the upload UI to the engine modules.
 * Handles file upload, runs the pipeline, shows progress, enables download/preview.
 */
(function () {
  'use strict';

  // Simple SCORM manifest generator
  function generateSimpleManifest(title, courseId) {
    var t = (title || 'Modernised Course').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    var id = courseId || 'modernised-' + Date.now();
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<manifest identifier="' + id + '" version="1.0"\n' +
      '  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"\n' +
      '  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"\n' +
      '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n' +
      '  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>\n' +
      '  <organizations default="org1"><organization identifier="org1">\n' +
      '    <title>' + t + '</title>\n' +
      '    <item identifier="item1" identifierref="res1"><title>' + t + '</title></item>\n' +
      '  </organization></organizations>\n' +
      '  <resources><resource identifier="res1" type="webcontent" adlcp:scormtype="sco" href="index.html">\n' +
      '    <file href="index.html"/></resource></resources>\n' +
      '</manifest>';
  }

  // DOM refs
  var uploadZone = document.getElementById('uploadZone');
  var fileInput = document.getElementById('fileInput');
  var fileCountEl = document.getElementById('fileCount');
  var brandUrlInput = document.getElementById('brandUrl');
  var corsProxyInput = document.getElementById('corsProxy');
  var btnGenerate = document.getElementById('btnGenerate');
  var progressSection = document.getElementById('progressSection');
  var progressBar = document.getElementById('progressBar');
  var logEl = document.getElementById('log');
  var resultSection = document.getElementById('resultSection');
  var btnDownload = document.getElementById('btnDownload');
  var btnPreview = document.getElementById('btnPreview');

  // State
  var fileMap = new Map(); // relativePath -> File
  var generatedHtml = null;
  var generatedBlob = null;

  // ---- File Upload ----

  uploadZone.addEventListener('click', function () { fileInput.click(); });
  uploadZone.addEventListener('dragover', function (ev) {
    ev.preventDefault(); uploadZone.classList.add('dragover');
  });
  uploadZone.addEventListener('dragleave', function () {
    uploadZone.classList.remove('dragover');
  });
  uploadZone.addEventListener('drop', function (ev) {
    ev.preventDefault(); uploadZone.classList.remove('dragover');
    // Use DataTransferItem API to handle dropped folders properly
    var items = ev.dataTransfer.items;
    if (items && items.length > 0) {
      var entries = [];
      for (var i = 0; i < items.length; i++) {
        var entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      if (entries.length > 0) {
        handleDroppedEntries(entries);
        return;
      }
    }
    // Fallback for browsers without webkitGetAsEntry
    handleFiles(ev.dataTransfer.files);
  });
  fileInput.addEventListener('change', function () {
    handleFiles(fileInput.files);
  });

  function handleDroppedEntries(entries) {
    fileMap.clear();
    var pending = 0;
    var topLevelName = (entries.length === 1 && entries[0].isDirectory) ? entries[0].name : null;

    function readEntry(entry, path) {
      if (entry.isFile) {
        pending++;
        entry.file(function (file) {
          var relativePath = path;
          // Strip top-level folder name (same as handleFiles does)
          if (topLevelName) {
            var parts = relativePath.split('/');
            if (parts.length > 1 && parts[0] === topLevelName) parts.shift();
            relativePath = parts.join('/');
          }
          fileMap.set(relativePath, file);
          pending--;
          if (pending === 0) onFilesReady();
        });
      } else if (entry.isDirectory) {
        pending++;
        var reader = entry.createReader();
        var allEntries = [];
        (function readBatch() {
          reader.readEntries(function (batch) {
            if (batch.length === 0) {
              pending--;
              allEntries.forEach(function (e) { readEntry(e, path + '/' + e.name); });
              if (pending === 0) onFilesReady();
            } else {
              allEntries = allEntries.concat(Array.from(batch));
              readBatch();
            }
          });
        })();
      }
    }

    entries.forEach(function (entry) {
      readEntry(entry, entry.name);
    });

    function onFilesReady() {
      fileCountEl.textContent = fileMap.size + ' files loaded';
      uploadZone.classList.add('has-files');
      updateGenerateButton();
    }
  }

  function handleFiles(files) {
    fileMap.clear();
    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      // webkitRelativePath gives "folderName/subfolder/file.ext"
      var path = file.webkitRelativePath || file.name;
      // Strip the top-level folder name to normalize paths
      var parts = path.split('/');
      if (parts.length > 1) parts.shift();
      var relativePath = parts.join('/');
      fileMap.set(relativePath, file);
    }

    fileCountEl.textContent = fileMap.size + ' files loaded';
    uploadZone.classList.add('has-files');
    updateGenerateButton();
  }

  function updateGenerateButton() {
    var hasFiles = fileMap.size > 0;
    var hasUrl = brandUrlInput.value.trim().length > 5;
    btnGenerate.disabled = !(hasFiles && hasUrl);
  }

  brandUrlInput.addEventListener('input', updateGenerateButton);

  // ---- Logging ----

  function log(msg, type) {
    var entry = document.createElement('div');
    entry.className = 'log-entry' + (type ? ' ' + type : '');
    entry.textContent = msg;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setProgress(percent) {
    progressBar.style.width = percent + '%';
  }

  // ---- Pipeline ----

  btnGenerate.addEventListener('click', async function () {
    btnGenerate.disabled = true;
    progressSection.classList.add('active');
    resultSection.classList.remove('active');
    logEl.innerHTML = '';
    setProgress(0);

    try {
      // Phase 1: Parse SCORM
      log('Phase 1: Parsing SCORM package...', 'info');
      setProgress(10);
      var course = await SCORMParser.extractCourse(fileMap, function (msg) { log('  ' + msg); });
      setProgress(30);
      log('SCORM parsing complete.', 'success');

      // Phase 2: Content Intelligence
      log('Phase 2: Analysing course structure...', 'info');
      var coursePlan = ContentPlanner.planCourse(course, function (msg) { log('  ' + msg); });
      setProgress(40);
      log('Content planning complete.', 'success');

      // Phase 3: Scrape brand
      log('Phase 3: Scraping brand from URL...', 'info');
      var brandUrl = brandUrlInput.value.trim();
      var corsProxy = corsProxyInput.value.trim();
      var brand = await BrandScraper.scrapeBrand(brandUrl, corsProxy, function (msg) { log('  ' + msg); });
      setProgress(55);
      log('Brand extraction complete.', 'success');

      // Phase 4: Translate to Adapt JSON
      log('Phase 4: Translating to Adapt format...', 'info');
      var adaptJson = AdaptTranslator.translate(coursePlan, brand, function (msg) { log('  ' + msg); });
      // Disable trickle for free-scroll experience
      adaptJson.course._trickle = { _isEnabled: false };
      setProgress(65);
      log('Adapt JSON generated: ' + adaptJson.components.length + ' components', 'success');

      // Phase 5: Generate brand CSS + bundle single HTML
      log('Phase 5: Building course...', 'info');
      var brandCSS = AdaptTranslator.generateBrandCSS(brand);
      generatedHtml = await AdaptBundler.bundle(adaptJson, brandCSS, coursePlan, function (msg) { log('  ' + msg); });
      setProgress(90);
      log('Course built (' + (generatedHtml.length / 1024).toFixed(0) + ' KB)', 'success');

      // Phase 6: Package SCORM zip (HTML + images)
      log('Phase 6: Creating SCORM package...', 'info');
      var zip = new JSZip();
      // Add the single HTML file
      zip.file('index.html', generatedHtml);
      // Add SCORM manifest
      zip.file('imsmanifest.xml', generateSimpleManifest(coursePlan.meta.title, coursePlan.meta.courseId));
      // Copy images from original SCORM
      var imgCount = 0;
      for (var entry of fileMap) {
        var fPath = entry[0], fObj = entry[1];
        if (/^(story_content|mobile)\/.*\.(jpg|jpeg|png|gif|svg|webp)$/i.test(fPath)) {
          try {
            var buf = await fObj.arrayBuffer();
            zip.file('course/en/images/' + fPath.split('/').pop(), buf);
            imgCount++;
          } catch (e) {}
        }
        if (/^story_content\/.*\.(mp4|webm)$/i.test(fPath)) {
          try {
            var buf = await fObj.arrayBuffer();
            zip.file('course/en/video/' + fPath.split('/').pop(), buf);
            imgCount++;
          } catch (e) {}
        }
      }
      generatedBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      setProgress(100);
      log('Done! ' + imgCount + ' assets, ' + (generatedBlob.size / 1024 / 1024).toFixed(1) + ' MB package', 'success');

      // Show results
      resultSection.classList.add('active');

    } catch (err) {
      log('Error: ' + err.message, 'error');
      console.error(err);
    }

    btnGenerate.disabled = false;
  });

  // ---- Download ----

  btnDownload.addEventListener('click', function () {
    if (!generatedBlob) return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(generatedBlob);
    a.download = 'modernised-course.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---- Preview Toggle ----

  btnPreview.addEventListener('click', function () {
    if (!generatedHtml) return;
    // Preview the single-file HTML in a new tab
    var previewUrl = URL.createObjectURL(new Blob([generatedHtml], { type: 'text/html' }));
    window.open(previewUrl, '_blank');
  });

})();
