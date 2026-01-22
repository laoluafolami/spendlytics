const CACHE_NAME = 'spendlytics-v3';
const RUNTIME_CACHE = 'spendlytics-runtime';
const SHARE_CACHE = 'spendlytics-share';

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

// Install event - cache essential files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache).catch((err) => {
          console.error('Cache addAll failed:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME, RUNTIME_CACHE, SHARE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Handle share target - intercept POST to /share
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle share target POST requests
  if (url.pathname === '/share' && request.method === 'POST') {
    event.respondWith(handleShare(request));
    return;
  }

  // Handle share data retrieval
  if (url.pathname === '/api/share-data' && request.method === 'GET') {
    event.respondWith(getShareData());
    return;
  }

  // Handle share data clear
  if (url.pathname === '/api/share-data' && request.method === 'DELETE') {
    event.respondWith(clearShareData());
    return;
  }

  // Skip non-GET requests and external URLs
  if (url.origin !== location.origin || request.method !== 'GET') {
    return;
  }

  // Standard cache-first strategy
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();

        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      }).catch(() => {
        if (request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Handle incoming share
async function handleShare(request) {
  try {
    const formData = await request.formData();

    const shareData = {
      timestamp: Date.now(),
      title: formData.get('title') || '',
      text: formData.get('text') || '',
      url: formData.get('url') || '',
      files: []
    };

    // Process shared files (images, PDFs)
    const files = formData.getAll('media');
    for (const file of files) {
      if (file && file.size > 0) {
        // Convert file to base64 for storage
        const arrayBuffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(arrayBuffer);

        shareData.files.push({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64
        });
      }
    }

    // Store share data in cache
    const cache = await caches.open(SHARE_CACHE);
    const response = new Response(JSON.stringify(shareData), {
      headers: { 'Content-Type': 'application/json' }
    });
    await cache.put('/shared-content', response);

    // Redirect to app with share indicator
    return Response.redirect('/app?shared=true', 303);
  } catch (error) {
    console.error('Share handling error:', error);
    return Response.redirect('/app?share_error=true', 303);
  }
}

// Retrieve stored share data
async function getShareData() {
  try {
    const cache = await caches.open(SHARE_CACHE);
    const response = await cache.match('/shared-content');

    if (response) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(null), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Clear stored share data
async function clearShareData() {
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.delete('/shared-content');
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
