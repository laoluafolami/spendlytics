/**
 * WealthPulse Service Worker v5.0
 * Advanced PWA with offline support, background sync, and seamless share handling
 * v5: Aggressive cache clearing and instant updates
 */

const CACHE_VERSION = 'v5.11';
const STATIC_CACHE = `wealthpulse-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `wealthpulse-dynamic-${CACHE_VERSION}`;
const SHARE_CACHE = `wealthpulse-share-${CACHE_VERSION}`;
const IMAGE_CACHE = `wealthpulse-images-${CACHE_VERSION}`;

// Core app shell - always cache these
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/offline.html'
];

// Cache size limits
const CACHE_LIMITS = {
  dynamic: 100,
  images: 50
};

// Install event - pre-cache static assets but WAIT for user approval before activating
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker v5.4...');

  event.waitUntil(
    // First, delete ALL old caches to ensure clean slate
    caches.keys()
      .then((cacheNames) => {
        console.log('[SW] Clearing all old caches before install...');
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => caches.open(STATIC_CACHE))
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn('[SW] Some static assets failed to cache:', err);
          // Don't fail install if some assets are missing
          return Promise.resolve();
        });
      })
      .then(() => {
        // DON'T call skipWaiting() here!
        // Wait for user to click "Update Now" which sends SKIP_WAITING message
        console.log('[SW] Installed and waiting. User must approve update.');
      })
  );
});

// Activate event - clean old caches, take control, and force reload all clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker v5...');

  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, SHARE_CACHE, IMAGE_CACHE];

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients that an update has occurred
        return self.clients.matchAll({ type: 'window' });
      })
      .then((clients) => {
        console.log('[SW] Notifying', clients.length, 'clients of update');
        clients.forEach((client) => {
          // Send update message with force refresh flag
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION,
            forceRefresh: true
          });
        });

        // If no clients, the caches are cleared anyway
        // When user opens app, they'll get fresh content
        if (clients.length === 0) {
          console.log('[SW] No active clients - caches cleared for next visit');
        }
      })
  );
});

// Fetch event - intelligent caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle share target POST requests
  if (url.pathname === '/share' && request.method === 'POST') {
    event.respondWith(handleShareTarget(request));
    return;
  }

  // Handle share data retrieval API
  if (url.pathname === '/api/share-data') {
    if (request.method === 'GET') {
      event.respondWith(getShareData());
    } else if (request.method === 'DELETE') {
      event.respondWith(clearShareData());
    }
    return;
  }

  // Skip non-GET requests and external URLs
  if (request.method !== 'GET' || url.origin !== location.origin) {
    return;
  }

  // Handle different asset types with appropriate strategies
  if (isStaticAsset(url.pathname)) {
    // Static assets: Cache First
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  } else if (isImageAsset(url.pathname)) {
    // Images: Cache First with network fallback
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
  } else if (isApiRequest(url.pathname)) {
    // API calls: Network First with cache fallback
    event.respondWith(networkFirst(request, DYNAMIC_CACHE));
  } else if (isNavigationRequest(request)) {
    // Navigation: Network First, fall back to cached index.html
    event.respondWith(navigationHandler(request));
  } else {
    // Default: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
  }
});

// ===== CACHING STRATEGIES =====

// Cache First - best for static assets
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn('[SW] Cache first failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

// Network First - best for dynamic content
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
      await trimCache(cacheName, CACHE_LIMITS.dynamic);
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Stale While Revalidate - good balance
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
      trimCache(cacheName, CACHE_LIMITS.dynamic);
    }
    return networkResponse;
  }).catch(() => null);

  return cachedResponse || fetchPromise;
}

// Navigation handler - special handling for SPA
async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    // Try to serve cached index.html for SPA routing
    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) {
      return cachedIndex;
    }

    // Fallback to offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }

    return new Response(getOfflineHTML(), {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// ===== SHARE TARGET HANDLING =====

async function handleShareTarget(request) {
  console.log('[SW] Handling share target request');

  try {
    const formData = await request.formData();

    const shareData = {
      timestamp: Date.now(),
      id: generateId(),
      title: formData.get('title') || '',
      text: formData.get('text') || '',
      url: formData.get('url') || '',
      files: [],
      processed: false
    };

    // Process shared files (images, PDFs)
    const files = formData.getAll('media');
    console.log('[SW] Received', files.length, 'files');

    for (const file of files) {
      if (file && file.size > 0) {
        try {
          // Limit file size to 10MB
          if (file.size > 10 * 1024 * 1024) {
            console.warn('[SW] File too large:', file.name);
            continue;
          }

          const arrayBuffer = await file.arrayBuffer();
          const base64 = arrayBufferToBase64(arrayBuffer);

          shareData.files.push({
            name: file.name,
            type: file.type,
            size: file.size,
            data: base64,
            lastModified: file.lastModified || Date.now()
          });

          console.log('[SW] Processed file:', file.name, file.type, file.size);
        } catch (fileError) {
          console.error('[SW] Error processing file:', file.name, fileError);
        }
      }
    }

    // Store share data
    const cache = await caches.open(SHARE_CACHE);
    const response = new Response(JSON.stringify(shareData), {
      headers: {
        'Content-Type': 'application/json',
        'X-Share-Id': shareData.id
      }
    });
    await cache.put('/shared-content', response);

    console.log('[SW] Share data stored, redirecting to app');

    // Redirect to app with share indicator
    return Response.redirect('/app?shared=true&share_id=' + shareData.id, 303);

  } catch (error) {
    console.error('[SW] Share handling error:', error);
    return Response.redirect('/app?share_error=true&error=' + encodeURIComponent(error.message), 303);
  }
}

async function getShareData() {
  try {
    const cache = await caches.open(SHARE_CACHE);
    const response = await cache.match('/shared-content');

    if (response) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify(null), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[SW] Error getting share data:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function clearShareData() {
  try {
    const cache = await caches.open(SHARE_CACHE);
    await cache.delete('/shared-content');
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[SW] Error clearing share data:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ===== BACKGROUND SYNC =====

self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'sync-transactions' || event.tag === 'sync-expenses' || event.tag === 'sync-income') {
    event.waitUntil(notifyClientsToSync());
  }
});

// Notify all clients to perform sync
async function notifyClientsToSync() {
  console.log('[SW] Notifying clients to sync...');

  const clients = await self.clients.matchAll({ type: 'window' });

  for (const client of clients) {
    client.postMessage({
      type: 'SYNC_REQUIRED',
      timestamp: Date.now()
    });
  }

  // If no clients are open, we can't sync (data is in IndexedDB which SW can't access easily)
  // The sync will happen when the app opens
  if (clients.length === 0) {
    console.log('[SW] No active clients, sync will occur when app opens');
  }
}

// ===== PUSH NOTIFICATIONS =====

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = { title: 'WealthPulse', body: 'You have a new notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);

  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url.includes('/app') && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow('/app');
      }
    })
  );
});

// ===== MESSAGE HANDLING =====

self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
    );
  }

  if (event.data && event.data.type === 'ONLINE') {
    console.log('[SW] Client reports online, triggering sync notification');
    notifyClientsToSync();
  }
});

// ===== UTILITY FUNCTIONS =====

function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot)$/i.test(pathname) ||
         STATIC_ASSETS.includes(pathname);
}

function isImageAsset(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(pathname);
}

function isApiRequest(pathname) {
  return pathname.startsWith('/api/') ||
         pathname.includes('supabase') ||
         pathname.includes('googleapis');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' ||
         request.destination === 'document';
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length > maxItems) {
    const deleteCount = keys.length - maxItems;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;

  // Process in chunks to avoid call stack size exceeded
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }

  return btoa(binary);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getOfflineHTML() {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#3B82F6">
  <title>Offline - WealthPulse</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 50%, #fdf2f8 100%);
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 400px;
    }
    .icon {
      width: 80px;
      height: 80px;
      margin: 0 auto 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .icon svg {
      width: 40px;
      height: 40px;
      fill: white;
    }
    h1 {
      font-size: 24px;
      color: #1f2937;
      margin-bottom: 12px;
    }
    p {
      color: #6b7280;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    button {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: white;
      border: none;
      padding: 14px 28px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(59, 130, 246, 0.3);
    }
    button:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    </div>
    <h1>You're Offline</h1>
    <p>It looks like you've lost your internet connection. Don't worry - WealthPulse will work again once you're back online.</p>
    <button onclick="window.location.reload()">Try Again</button>
  </div>
</body>
</html>
  `.trim();
}

console.log('[SW] Service worker loaded');
