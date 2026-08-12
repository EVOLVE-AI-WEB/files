/*
 * Evolve Fitness — service worker (Task 17.4; R23.2, R23.4).
 *
 * Honest, minimal offline behavior:
 *   - App shell (navigation documents + static assets) uses a cache-first
 *     strategy so the installed PWA can open and render its UI offline.
 *   - Data requests (Supabase API / auth) are ALWAYS network-first and are
 *     never served stale from cache; when offline they simply fail, and the UI
 *     shows its normal loading/empty states. We deliberately do NOT claim full
 *     offline sync or background scheduling — only cached app-shell + cached
 *     reads that the browser already holds (R23.4).
 */
const CACHE_VERSION = 'evolve-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/3D_mobile_.jpeg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle same-origin GET requests. Anything else (Supabase API, auth,
  // POST/PATCH/DELETE) goes straight to the network — never cached, never
  // served stale.
  if (request.method !== 'GET') {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests: cache-first on the app shell so the PWA opens offline,
  // falling back to the network and finally the cached index document.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).catch(() => caches.match('/index.html')),
      ),
    );
    return;
  }

  // Static same-origin assets: cache-first, populating the cache on first hit.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
