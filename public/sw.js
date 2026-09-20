// Bumped on every deploy to force-refresh PWA caches.
// When this string changes, SW activates fresh, deletes old caches,
// and serves the latest JS bundle on next request.
const CACHE = 'synrg-v57-2026-09-20';
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

// ── Web Push ───────────────────────────────────────────────────
// Payload shape: { title, body, tag, url, icon }
// A push with no/!JSON payload still shows a generic notification rather than
// nothing — Chrome penalises (and eventually revokes) silent pushes.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || 'SYNRG';
  e.waitUntil(self.registration.showNotification(title, {
    body:  d.body || '',
    tag:   d.tag  || 'synrg',
    icon:  d.icon || BASE + 'icon-192.png',
    badge: BASE + 'icon-192.png',
    data:  { url: d.url || BASE },
    renotify: !!d.tag,
  }));
});

// Focus an already-open tab instead of piling up new ones.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || BASE;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(BASE) && 'focus' in c) {
          if ('navigate' in c && !c.url.endsWith(target)) c.navigate(target).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// Chrome can rotate a subscription; re-register so we don't go silently dead.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true })
      .then(list => list.forEach(c => c.postMessage({ type: 'PUSH_RESUBSCRIBE' })))
  );
});
