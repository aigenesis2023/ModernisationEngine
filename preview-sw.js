/**
 * Preview Service Worker
 *
 * Intercepts requests to /preview/* and serves Adapt course files
 * from in-memory cache. This allows the full Adapt framework to run
 * from a preview URL without needing a separate web server.
 */

var CACHE = {};

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// Receive files from the main page
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SET_PREVIEW_FILES') {
    CACHE = event.data.files || {};
    // Notify the sender that files are cached
    event.ports[0].postMessage({ status: 'ready', fileCount: Object.keys(CACHE).length });
  }
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);

  // Only intercept /preview/ requests
  if (!url.pathname.startsWith('/preview/')) return;

  // Strip /preview/ prefix to get the file path
  var filePath = url.pathname.replace('/preview/', '');
  if (filePath === '' || filePath === '/') filePath = 'index.html';

  // Strip query params (Adapt adds ?timestamp=xxx)
  filePath = filePath.split('?')[0];

  var cached = CACHE[filePath];
  if (cached !== undefined) {
    var contentType = getContentType(filePath);
    var body;

    if (typeof cached === 'string') {
      body = cached;
    } else if (cached instanceof ArrayBuffer || cached instanceof Uint8Array) {
      body = cached;
    } else {
      // JSON data — serialize it
      body = JSON.stringify(cached);
      if (filePath.endsWith('.js') && !filePath.endsWith('.json')) {
        // language_data_manifest.js is a JS file that sets a global
        contentType = 'application/javascript';
      } else {
        contentType = 'application/json';
      }
    }

    event.respondWith(new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      }
    }));
  }
  // If not in cache, let it fall through to network (404)
});

function getContentType(path) {
  if (path.endsWith('.html')) return 'text/html';
  if (path.endsWith('.css')) return 'text/css';
  if (path.endsWith('.js')) return 'application/javascript';
  if (path.endsWith('.json')) return 'application/json';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.mp4')) return 'video/mp4';
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  return 'application/octet-stream';
}
