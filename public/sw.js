// NearSpot PWA Service Worker — cache-first for media/fonts, network-first for JS/CSS/HTML/API
const CACHE_NAME = 'nearspot-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
];

// Install: pre-cache static shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean ALL old caches (including nearspot-v1)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
//  - API / WS calls:            pass-through (no cache)
//  - HTML navigations:          network-first, cached fallback for offline
//  - JS / CSS bundles:          network-first (must always be fresh)
//  - Images / fonts:            cache-first (safe to serve stale)
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin (except Google Fonts)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) return;

  // API / WebSocket — never cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;

  // HTML navigations — network-first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then(r => r ?? caches.match('/')))
    );
    return;
  }

  const ext = url.pathname.split('.').pop()?.toLowerCase();

  // JS / CSS — always network-first so code updates are instant
  if (ext === 'js' || ext === 'mjs' || ext === 'css' || ext === 'ts' || ext === 'tsx') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') return response;
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images / fonts / other static assets — cache-first (safe to serve stale)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
