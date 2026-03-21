import express from 'express';
import multer from 'multer';
import archiver from 'archiver';
import { createReadStream, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { EvolutionEngine } from './engine';
import type { EvolutionConfig } from './ir/types';

const app = express();
const PORT = process.env.PORT || 3000;

// Store progress updates per job
const jobProgress = new Map<string, string[]>();

// Configure file upload — store in uploads/ directory
const uploadDir = resolve('uploads');
const outputBase = resolve('output_jobs');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
if (!existsSync(outputBase)) mkdirSync(outputBase, { recursive: true });

const upload = multer({ dest: uploadDir });

// Serve the web UI
app.get('/', (_req, res) => {
  res.send(getHtmlPage());
});

// Handle SCORM upload + brand URL → run engine
app.post('/evolve', upload.array('scormFiles'), async (req, res) => {
  const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  jobProgress.set(jobId, ['Starting Evolution Engine...']);

  try {
    const brandUrl = req.body.brandUrl;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No SCORM files uploaded' });
      return;
    }
    if (!brandUrl) {
      res.status(400).json({ error: 'Brand URL is required' });
      return;
    }

    // Reconstruct folder structure from uploaded files
    const scormDir = join(uploadDir, jobId);
    mkdirSync(scormDir, { recursive: true });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Get the relative path sent from the frontend
      const relativePath = req.body[`path_file_${i}`] || file.originalname;
      const destPath = join(scormDir, relativePath);
      const destDir = join(destPath, '..');
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

      // Move uploaded file to correct location
      const { renameSync } = require('fs');
      renameSync(file.path, destPath);
    }

    const outputDir = join(outputBase, jobId);

    // Send job ID immediately so frontend can poll progress
    res.json({ jobId, status: 'started' });

    // Run engine in background
    const config: EvolutionConfig = {
      scormInputDir: scormDir,
      brandUrl,
      outputDir,
      imageGenProvider: 'pollinations',
      skipImageGen: false,
      verbose: true,
    };

    // Intercept console.log to capture progress
    const origLog = console.log;
    console.log = (...args: any[]) => {
      const msg = args.map(a => String(a)).join(' ');
      const progress = jobProgress.get(jobId);
      if (progress) progress.push(msg);
      origLog.apply(console, args);
    };

    try {
      const engine = new EvolutionEngine(config);
      await engine.run();
      const progress = jobProgress.get(jobId);
      if (progress) progress.push('__COMPLETE__');
    } catch (err: any) {
      const progress = jobProgress.get(jobId);
      if (progress) progress.push('__ERROR__: ' + err.message);
    } finally {
      console.log = origLog;
    }

  } catch (err: any) {
    const progress = jobProgress.get(jobId);
    if (progress) progress.push('__ERROR__: ' + err.message);
  }
});

// Poll for progress
app.get('/progress/:jobId', (req, res) => {
  const progress = jobProgress.get(req.params.jobId);
  if (!progress) {
    res.json({ status: 'unknown', messages: [] });
    return;
  }

  const isComplete = progress.some(m => m.includes('__COMPLETE__'));
  const hasError = progress.find(m => m.includes('__ERROR__'));

  res.json({
    status: isComplete ? 'complete' : hasError ? 'error' : 'running',
    messages: progress.filter(m => !m.startsWith('__')),
    error: hasError ? hasError.replace('__ERROR__: ', '') : undefined,
  });
});

// Preview the generated output
app.get('/preview/:jobId', (req, res) => {
  const outputDir = join(outputBase, req.params.jobId);
  const indexPath = join(outputDir, 'index.html');
  if (!existsSync(indexPath)) {
    res.status(404).send('Output not ready yet');
    return;
  }
  res.sendFile(indexPath);
});

// Serve generated assets (images, media)
app.get('/preview/:jobId/*assetPath', (req, res) => {
  const outputDir = join(outputBase, req.params.jobId);
  const assetPath = (req.params as any).assetPath || '';
  const fullPath = join(outputDir, assetPath);
  if (!existsSync(fullPath)) {
    res.status(404).send('Asset not found');
    return;
  }
  res.sendFile(fullPath);
});

// Download as ZIP
app.get('/download/:jobId', (req, res) => {
  const outputDir = join(outputBase, req.params.jobId);
  if (!existsSync(outputDir)) {
    res.status(404).send('Output not found');
    return;
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="evolved-course-${req.params.jobId}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.directory(outputDir, false);
  archive.finalize();
});

app.listen(PORT, () => {
  console.log(`\n  Evolution Engine Web UI`);
  console.log(`  Running at: http://localhost:${PORT}\n`);
});

// ---- HTML Page ----

function getHtmlPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evolution Engine</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #0a0a1a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 560px;
      padding: 24px;
    }
    .logo {
      text-align: center;
      margin-bottom: 48px;
    }
    .logo h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8, #c084fc);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .logo p {
      color: #64748b;
      font-size: 14px;
    }
    .card {
      background: #111827;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 32px;
    }

    /* Upload area */
    .upload-area {
      border: 2px dashed #334155;
      border-radius: 12px;
      padding: 32px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 24px;
      position: relative;
    }
    .upload-area:hover, .upload-area.dragover {
      border-color: #818cf8;
      background: rgba(129, 140, 248, 0.05);
    }
    .upload-area.has-files {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.05);
    }
    .upload-area input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .upload-icon {
      font-size: 32px;
      margin-bottom: 12px;
      display: block;
    }
    .upload-area h3 {
      font-size: 16px;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .upload-area p {
      color: #64748b;
      font-size: 13px;
    }
    .file-count {
      color: #10b981;
      font-weight: 600;
      font-size: 14px;
      margin-top: 8px;
    }

    /* URL input */
    .form-group {
      margin-bottom: 24px;
    }
    .form-group label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
      color: #94a3b8;
    }
    .form-group input {
      width: 100%;
      padding: 12px 16px;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 10px;
      color: #e2e8f0;
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      border-color: #818cf8;
    }
    .form-group input::placeholder {
      color: #475569;
    }

    /* Button */
    .btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Progress */
    .progress-section {
      display: none;
      margin-top: 24px;
    }
    .progress-section.visible {
      display: block;
    }
    .progress-bar-outer {
      height: 6px;
      background: #1e293b;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .progress-bar-inner {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 3px;
      transition: width 0.4s ease;
      width: 0%;
    }
    .progress-log {
      background: #0f172a;
      border-radius: 10px;
      padding: 16px;
      max-height: 200px;
      overflow-y: auto;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.8;
      color: #94a3b8;
    }
    .progress-log .phase {
      color: #818cf8;
    }

    /* Results */
    .results {
      display: none;
      margin-top: 24px;
      text-align: center;
    }
    .results.visible {
      display: block;
    }
    .results h3 {
      color: #10b981;
      margin-bottom: 16px;
      font-size: 18px;
    }
    .result-buttons {
      display: flex;
      gap: 12px;
    }
    .result-buttons a {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }
    .btn-preview {
      background: #6366f1;
      color: white;
    }
    .btn-preview:hover { background: #5558e6; }
    .btn-download {
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid #334155;
    }
    .btn-download:hover { border-color: #818cf8; }

    .error-msg {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      padding: 12px 16px;
      border-radius: 10px;
      font-size: 14px;
      margin-top: 16px;
      display: none;
    }
    .error-msg.visible { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Evolution Engine</h1>
      <p>Transform legacy SCORM into modern web experiences</p>
    </div>

    <div class="card">
      <div class="upload-area" id="uploadArea">
        <input type="file" id="fileInput" webkitdirectory directory multiple />
        <span class="upload-icon">&#128193;</span>
        <h3>Upload SCORM Package</h3>
        <p>Click to select your SCORM export folder</p>
        <div class="file-count" id="fileCount"></div>
      </div>

      <div class="form-group">
        <label>Brand Website URL</label>
        <input type="url" id="brandUrl" placeholder="https://your-company.com" />
      </div>

      <button class="btn" id="evolveBtn" disabled onclick="startEvolution()">
        Select files to begin
      </button>

      <div class="progress-section" id="progressSection">
        <div class="progress-bar-outer">
          <div class="progress-bar-inner" id="progressBar"></div>
        </div>
        <div class="progress-log" id="progressLog"></div>
      </div>

      <div class="error-msg" id="errorMsg"></div>

      <div class="results" id="results">
        <h3>Evolution Complete</h3>
        <div class="result-buttons">
          <a href="#" class="btn-preview" id="previewLink" target="_blank">Preview Course</a>
          <a href="#" class="btn-download" id="downloadLink">Download ZIP</a>
        </div>
      </div>
    </div>
  </div>

  <script>
    var selectedFiles = [];
    var fileInput = document.getElementById('fileInput');
    var uploadArea = document.getElementById('uploadArea');
    var fileCount = document.getElementById('fileCount');
    var evolveBtn = document.getElementById('evolveBtn');
    var brandUrl = document.getElementById('brandUrl');

    // Handle file selection
    fileInput.addEventListener('change', function(e) {
      selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length > 0) {
        uploadArea.classList.add('has-files');
        fileCount.textContent = selectedFiles.length + ' files selected';
        updateButton();
      }
    });

    // Drag and drop visual feedback
    uploadArea.addEventListener('dragover', function(e) {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', function() {
      uploadArea.classList.remove('dragover');
    });

    // Update button state
    brandUrl.addEventListener('input', updateButton);
    function updateButton() {
      var hasFiles = selectedFiles.length > 0;
      var hasUrl = brandUrl.value.trim().length > 5;
      evolveBtn.disabled = !(hasFiles && hasUrl);
      evolveBtn.textContent = !hasFiles ? 'Select files to begin'
        : !hasUrl ? 'Enter brand URL to begin'
        : 'Evolve';
    }

    // Start the evolution
    function startEvolution() {
      evolveBtn.disabled = true;
      evolveBtn.textContent = 'Processing...';

      var progressSection = document.getElementById('progressSection');
      var progressLog = document.getElementById('progressLog');
      var progressBar = document.getElementById('progressBar');
      var errorMsg = document.getElementById('errorMsg');
      var results = document.getElementById('results');

      progressSection.classList.add('visible');
      results.classList.remove('visible');
      errorMsg.classList.remove('visible');
      progressLog.innerHTML = '';

      // Build FormData with files and their relative paths
      var formData = new FormData();
      formData.append('brandUrl', brandUrl.value.trim());

      for (var i = 0; i < selectedFiles.length; i++) {
        var file = selectedFiles[i];
        var fieldName = 'file_' + i;
        formData.append('scormFiles', file, file.name);
        // Send relative path info
        var relPath = file.webkitRelativePath || file.name;
        // Strip the top-level folder name for cleaner paths
        var parts = relPath.split('/');
        if (parts.length > 1) parts.shift();
        formData.append('path_' + fieldName, parts.join('/'));
      }

      // Upload and start
      fetch('/evolve', { method: 'POST', body: formData })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) {
            showError(data.error);
            return;
          }
          // Poll for progress
          pollProgress(data.jobId);
        })
        .catch(function(err) {
          showError('Upload failed: ' + err.message);
        });
    }

    function pollProgress(jobId) {
      var progressLog = document.getElementById('progressLog');
      var progressBar = document.getElementById('progressBar');
      var lastCount = 0;

      var interval = setInterval(function() {
        fetch('/progress/' + jobId)
          .then(function(r) { return r.json(); })
          .then(function(data) {
            // Add new messages
            for (var i = lastCount; i < data.messages.length; i++) {
              var msg = data.messages[i];
              var line = document.createElement('div');
              if (msg.indexOf('Phase') !== -1) {
                line.className = 'phase';
                // Update progress bar
                var phaseMatch = msg.match(/Phase (\\d)\\/6/);
                if (phaseMatch) {
                  progressBar.style.width = (parseInt(phaseMatch[1]) / 6 * 100) + '%';
                }
              }
              line.textContent = msg.replace(/^\\s+/, '');
              progressLog.appendChild(line);
              progressLog.scrollTop = progressLog.scrollHeight;
            }
            lastCount = data.messages.length;

            if (data.status === 'complete') {
              clearInterval(interval);
              progressBar.style.width = '100%';
              showResults(jobId);
            } else if (data.status === 'error') {
              clearInterval(interval);
              showError(data.error || 'An error occurred');
            }
          })
          .catch(function() {
            // Ignore polling errors, retry
          });
      }, 1000);
    }

    function showResults(jobId) {
      var results = document.getElementById('results');
      var previewLink = document.getElementById('previewLink');
      var downloadLink = document.getElementById('downloadLink');
      var evolveBtn = document.getElementById('evolveBtn');

      previewLink.href = '/preview/' + jobId;
      downloadLink.href = '/download/' + jobId;
      results.classList.add('visible');
      evolveBtn.textContent = 'Evolve Another';
      evolveBtn.disabled = false;
    }

    function showError(msg) {
      var errorMsg = document.getElementById('errorMsg');
      errorMsg.textContent = msg;
      errorMsg.classList.add('visible');
      evolveBtn.textContent = 'Try Again';
      evolveBtn.disabled = false;
    }
  </script>
</body>
</html>`;
}
