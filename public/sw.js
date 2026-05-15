const CACHE_NAME = 'smart-note-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
});

// Activate and clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim(); // Take control of all open clients immediately
});

// Fetch logic: Network-first, fallback to cache
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // CRITICAL: Bypass Service Worker for external APIs (Google Drive, etc.)
  // and non-GET requests to avoid CORS and auth interference
  if (url.origin !== self.location.origin || event.request.method !== 'GET') {
    return; // Let the browser handle it normally
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful local responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
