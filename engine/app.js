/**
 * Main Pipeline — Wires the upload UI to the engine modules.
 * Handles file upload, runs the pipeline, shows progress, enables download/preview.
 */
(function () {
  'use strict';

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
  var previewFrame = document.getElementById('previewFrame');

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

      // Phase 2: Scrape brand
      log('Phase 2: Scraping brand from URL...', 'info');
      var brandUrl = brandUrlInput.value.trim();
      var corsProxy = corsProxyInput.value.trim();
      var brand = await BrandScraper.scrapeBrand(brandUrl, corsProxy, function (msg) { log('  ' + msg); });
      setProgress(50);
      log('Brand extraction complete.', 'success');

      // Phase 3: AI Image Generation
      log('Phase 3: Generating AI images...', 'info');
      var images = await ImageGenerator.generateImages(course, brand, function (msg) { log('  ' + msg); });
      setProgress(65);
      log('Image generation complete.', 'success');

      // Phase 4: Generate HTML
      log('Phase 4: Generating modernised course...', 'info');
      generatedHtml = GeneratorApp.generateHtml(course, brand, images);
      setProgress(80);
      log('Course HTML generated (' + (generatedHtml.length / 1024).toFixed(0) + ' KB)', 'success');

      // Phase 5: Package SCORM
      log('Phase 5: Creating SCORM package...', 'info');
      generatedBlob = await Packager.packageCourse(generatedHtml, course, fileMap, images, function (msg) { log('  ' + msg); });
      setProgress(100);
      log('Done! Your modernised course is ready.', 'success');

      // Show results
      resultSection.classList.add('active');

      // Load preview
      var previewUrl = URL.createObjectURL(new Blob([generatedHtml], { type: 'text/html' }));
      previewFrame.src = previewUrl;

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
    var previewUrl = URL.createObjectURL(new Blob([generatedHtml], { type: 'text/html' }));
    window.open(previewUrl, '_blank');
  });

})();
