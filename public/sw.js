// Bumped on every deploy to force-refresh PWA caches.
// When this string changes, SW activates fresh, deletes old caches,
// and serves the latest JS bundle on next request.
const CACHE = 'synrg-v9-2026-04-28';
const BASE = '/app/';
const ASSETS = [BASE, BASE + 'index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
      ),
      // Take control of all open tabs immediately (no need to close & reopen)
      self.clients.claim(),
    ])
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Never intercept cross-origin requests (Supabase API, CDNs, etc.)
  if (!e.request.url.startsWith(self.location.origin)) return;
  // Network-first for index.html (forces update check on every visit).
  // For static assets (JS, CSS with hash in filename), cache-first is fine.
  const isHtml = e.request.url.endsWith('/') || e.request.url.endsWith('.html') || e.request.mode === 'navigate';
  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return r;
        })
        .catch(() => caches.match(e.request).then(r => r || caches.match(BASE + 'index.html')))
    );
    return;
  }
  // For hashed assets, cache-first (filenames already include content hash)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      });
    })
  );
});

// Allow page to send 'SKIP_WAITING' to activate new SW immediately
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
