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
  // No Service Worker needed — Blade Runner Engine runs as single file

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
      log('Phase 4: Translating course content...', 'info');
      var adaptJson = AdaptTranslator.translate(coursePlan, brand, function (msg) { log('  ' + msg); });
      adaptJson.course._trickle = { _isEnabled: false };
      setProgress(65);
      log('Course mapped: ' + adaptJson.components.length + ' components', 'success');

      // Phase 5: Build single-file HTML (Blade Runner Engine)
      log('Phase 5: Building course output...', 'info');
      var templateHtml = null;
      // Try multiple paths to find the Blade Runner Engine template
      var templatePaths = [
        'blade-runner-template.html',
        'blade-runner-engine/dist/index.html',
        './blade-runner-template.html'
      ];
      for (var tp = 0; tp < templatePaths.length; tp++) {
        if (templateHtml) break;
        try {
          log('  Trying template: ' + templatePaths[tp], 'info');
          var templateResp = await fetch(templatePaths[tp]);
          if (templateResp.ok) {
            templateHtml = await templateResp.text();
            // Verify it's actually the React app (not a 404 page)
            if (templateHtml.indexOf('courseData') === -1 && templateHtml.indexOf('react') === -1 && templateHtml.indexOf('React') === -1) {
              log('  Template loaded but not React app, skipping', 'info');
              templateHtml = null;
            } else {
              log('  Template loaded: ' + (templateHtml.length / 1024).toFixed(0) + ' KB', 'success');
            }
          }
        } catch (e) {
          log('  Template fetch failed: ' + e.message, 'info');
        }
      }

      if (templateHtml) {
        // Embed images as base64 data URLs so they work from blob:// preview
        log('  Embedding images...', 'info');
        var imageMap = {}; // filename → data URL
        var embedCount = 0;
        for (var imgEntry of fileMap) {
          var imgPath = imgEntry[0], imgFile = imgEntry[1];
          if (/^(story_content|mobile)\/.*\.(jpg|jpeg|png|gif|svg|webp)$/i.test(imgPath)) {
            try {
              var imgBuf = await imgFile.arrayBuffer();
              var imgBytes = new Uint8Array(imgBuf);
              // Only embed images under 500KB to keep HTML size reasonable
              if (imgBytes.length < 2097152) {
                var binary = '';
                for (var bi = 0; bi < imgBytes.length; bi++) binary += String.fromCharCode(imgBytes[bi]);
                var ext = imgPath.split('.').pop().toLowerCase();
                var mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                           ext === 'png' ? 'image/png' :
                           ext === 'gif' ? 'image/gif' :
                           ext === 'svg' ? 'image/svg+xml' : 'image/' + ext;
                var dataUrl = 'data:' + mime + ';base64,' + btoa(binary);
                imageMap['course/en/images/' + imgPath.split('/').pop()] = dataUrl;
                embedCount++;
              }
            } catch (e) {}
          }
        }
        log('  Embedded ' + embedCount + ' images', 'info');

        // Replace image paths in components with data URLs
        var componentsStr = JSON.stringify(adaptJson.components);
        for (var imgKey in imageMap) {
          // Replace all occurrences of the path with the data URL
          componentsStr = componentsStr.split(imgKey).join(imageMap[imgKey]);
        }
        adaptJson.components = JSON.parse(componentsStr);

        // Inject course data + brand data into the template
        var injectScript = '<script>\n';
        injectScript += 'window.courseData = ' + JSON.stringify(adaptJson) + ';\n';
        injectScript += 'window.brandData = ' + JSON.stringify(brand) + ';\n';
        injectScript += '<\/script>\n';
        generatedHtml = templateHtml.replace('</head>', injectScript + '</head>');
        log('Blade Runner Engine output: ' + (generatedHtml.length / 1024).toFixed(0) + ' KB', 'success');
      } else {
        log('Warning: Template not found, using inline preview', 'info');
        // Store data for the fallback preview
        generatedHtml = JSON.stringify({
          course: adaptJson.course,
          contentObjects: adaptJson.contentObjects,
          articles: adaptJson.articles,
          blocks: adaptJson.blocks,
          components: adaptJson.components,
          brand: brand,
          title: coursePlan.meta.title
        });
      }

      setProgress(85);

      // Phase 6: Package SCORM zip
      log('Phase 6: Packaging SCORM...', 'info');
      var zip = new JSZip();
      zip.file('index.html', generatedHtml);
      zip.file('imsmanifest.xml', generateSimpleManifest(coursePlan.meta.title, coursePlan.meta.courseId));

      // Copy original SCORM images
      var assetCount = 0;
      for (var entry of fileMap) {
        var fPath = entry[0], fObj = entry[1];
        if (/^(story_content|mobile)\/.*\.(jpg|jpeg|png|gif|svg|webp)$/i.test(fPath)) {
          try {
            var buf = await fObj.arrayBuffer();
            zip.file('course/en/images/' + fPath.split('/').pop(), buf);
            assetCount++;
          } catch (e) {}
        }
        if (/^story_content\/.*\.(mp4|webm)$/i.test(fPath)) {
          try {
            var buf = await fObj.arrayBuffer();
            zip.file('course/en/video/' + fPath.split('/').pop(), buf);
            assetCount++;
          } catch (e) {}
        }
      }
      generatedBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      setProgress(100);
      log('Done! ' + assetCount + ' assets, ' + (generatedBlob.size / 1024 / 1024).toFixed(1) + ' MB', 'success');

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

    // Check if generatedHtml is a full HTML document (starts with <!doctype or <html)
    var isFullHtml = generatedHtml.trim().substring(0, 20).toLowerCase().indexOf('<!doctype') >= 0 ||
                     generatedHtml.trim().substring(0, 20).toLowerCase().indexOf('<html') >= 0;

    if (isFullHtml) {
      // Open the single-file HTML directly — this is the Blade Runner Engine output
      var previewUrl = URL.createObjectURL(new Blob([generatedHtml], { type: 'text/html' }));
      window.open(previewUrl, '_blank');
      return;
    }

    // Fallback: lightweight preview from JSON data
    var data;
    try { data = JSON.parse(generatedHtml); } catch (e) { return; }
    var previewHtml = buildPreviewHtml(data);
    var fallbackUrl = URL.createObjectURL(new Blob([previewHtml], { type: 'text/html' }));
    window.open(fallbackUrl, '_blank');
  });

  // Fallback preview: lightweight HTML from Adapt JSON
  function buildPreviewHtml(data) {
    var css = data.brandCSS || '';
    var title = data.title || 'Course Preview';
    var html = '<!doctype html><html lang="en"><head>';
    html += '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">';
    html += '<title>' + title + '</title>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">';
    html += '<style>';
    html += '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }';
    html += 'body { font-family: Inter, system-ui, sans-serif; line-height: 1.6; max-width: 900px; margin: 0 auto; padding: 20px; }';
    html += 'h1 { font-size: 2.5rem; margin: 2rem 0 1rem; }';
    html += 'h2 { font-size: 1.8rem; margin: 2rem 0 0.5rem; color: #117F93; }';
    html += 'h3 { font-size: 1.3rem; margin: 1rem 0 0.3rem; }';
    html += 'p { margin: 0.5rem 0; }';
    html += '.article { margin: 3rem 0; padding: 2rem 0; border-top: 3px solid #117F93; }';
    html += '.block { margin: 1.5rem 0; }';
    html += '.component { margin: 1rem 0; padding: 1.5rem; background: #f8f9fa; border-radius: 12px; }';
    html += '.accordion-item { border: 1px solid #ddd; border-radius: 8px; margin: 0.5rem 0; overflow: hidden; }';
    html += '.accordion-btn { width: 100%; padding: 1rem 1.5rem; background: #117F93; color: #fff; border: none; text-align: left; font-size: 1rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }';
    html += '.accordion-btn:hover { background: #0e6b7a; }';
    html += '.accordion-body { padding: 1rem 1.5rem; display: none; }';
    html += '.accordion-item.open .accordion-body { display: block; }';
    html += '.mcq-item { padding: 0.8rem 1.2rem; margin: 0.5rem 0; background: #fff; border: 2px solid #ddd; border-radius: 8px; cursor: pointer; }';
    html += '.mcq-item:hover { border-color: #117F93; }';
    html += '.mcq-item.selected { border-color: #117F93; background: #e8f7fa; }';
    html += 'img { max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0; }';
    html += '.split { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; }';
    html += '@media (max-width: 768px) { .split { grid-template-columns: 1fr; } }';
    html += '.preview-badge { position: fixed; top: 10px; right: 10px; background: #117F93; color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem; z-index: 999; }';
    html += css;
    html += '</style></head><body>';
    html += '<div class="preview-badge">Preview — Download SCORM zip for full Adapt experience</div>';
    html += '<h1>' + esc(title) + '</h1>';

    // Render articles (sections)
    (data.articles || []).forEach(function (article) {
      html += '<div class="article">';
      if (article.displayTitle) html += '<h2>' + esc(article.displayTitle) + '</h2>';

      // Find blocks for this article
      var blocks = (data.blocks || []).filter(function (b) { return b._parentId === article._id; });
      blocks.forEach(function (block) {
        html += '<div class="block">';

        // Find components for this block
        var comps = (data.components || []).filter(function (c) { return c._parentId === block._id; });

        // Check if split layout (left + right components)
        var hasLeft = comps.some(function (c) { return c._layout === 'left'; });
        var hasRight = comps.some(function (c) { return c._layout === 'right'; });
        if (hasLeft && hasRight) html += '<div class="split">';

        comps.forEach(function (comp) {
          html += '<div class="component">';

          if (comp._component === 'text') {
            if (comp.displayTitle) html += '<h3>' + comp.displayTitle + '</h3>';
            if (comp.body) html += comp.body;
          } else if (comp._component === 'graphic') {
            if (comp.displayTitle) html += '<h3>' + comp.displayTitle + '</h3>';
            if (comp._graphic && comp._graphic.large) {
              html += '<img src="' + esc(comp._graphic.large) + '" alt="' + esc(comp._graphic.alt || '') + '">';
            }
          } else if (comp._component === 'accordion') {
            if (comp.displayTitle) html += '<h3>' + comp.displayTitle + '</h3>';
            if (comp.body) html += comp.body;
            if (comp.instruction) html += '<p><em>' + esc(comp.instruction) + '</em></p>';
            (comp._items || []).forEach(function (item, idx) {
              html += '<div class="accordion-item" onclick="this.classList.toggle(\'open\')">';
              html += '<button class="accordion-btn">' + esc(item.title) + '<span>+</span></button>';
              html += '<div class="accordion-body">' + (item.body || '') + '</div>';
              html += '</div>';
            });
          } else if (comp._component === 'mcq') {
            if (comp.body) html += comp.body;
            if (comp.instruction) html += '<p><em>' + esc(comp.instruction) + '</em></p>';
            (comp._items || []).forEach(function (item) {
              html += '<div class="mcq-item" onclick="this.classList.toggle(\'selected\')">';
              html += esc(item.text);
              html += '</div>';
            });
          } else if (comp._component === 'media') {
            if (comp.displayTitle) html += '<h3>' + comp.displayTitle + '</h3>';
            if (comp.body) html += comp.body;
            if (comp._media && comp._media.mp4) {
              html += '<video controls style="width:100%;border-radius:8px"><source src="' + esc(comp._media.mp4) + '" type="video/mp4"></video>';
            }
          } else if (comp._component === 'textinput') {
            if (comp.body) html += comp.body;
            html += '<input type="text" style="width:100%;padding:10px;border:2px solid #ddd;border-radius:8px;font-size:1rem" placeholder="Type your answer...">';
          } else {
            // Generic fallback
            if (comp.displayTitle) html += '<h3>' + comp.displayTitle + '</h3>';
            if (comp.body) html += comp.body;
          }

          html += '</div>';
        });

        if (hasLeft && hasRight) html += '</div>';
        html += '</div>';
      });

      html += '</div>';
    });

    html += '</body></html>';
    return html;
  }

  function esc(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
