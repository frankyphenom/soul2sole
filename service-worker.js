// Soul2Sole service worker — makes the app open instantly and work offline.
//
// This app is a single self-contained HTML file (no separate CSS/JS/image
// files to manage), so the "app shell" here is just that one file. Strategy:
//   - Same-origin GET requests: network-first, falling back to the cached
//     copy when offline. Every successful online load refreshes the cache,
//     so there's no manual "cache version" to remember to bump — users
//     online always get the newest file, and it's automatically what gets
//     served the next time they're offline.
//   - Cross-origin requests (the live weather/air-quality API calls) are
//     left completely alone — never cached, never intercepted. Conditions
//     data must always be live; a cached weather reading would be
//     actively misleading for a runner checking conditions before heading out.

const CACHE_NAME = 'soul2sole-shell-v1';
const SHELL_URL = './';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests for the app shell itself.
  // Everything else (weather API calls, any cross-origin request) passes
  // straight through untouched.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        // Only cache a genuinely good response — caching a transient 404/500
        // would mean that error page keeps getting served once offline, even
        // after the site recovers.
        if (networkResponse && networkResponse.ok) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkResponse;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match(SHELL_URL)))
  );
});
