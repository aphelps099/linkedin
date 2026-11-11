// SYNERGY.EXE service worker. Scope: /game/ only. It makes the game installable
// and playable with no signal: the page is fetched fresh when there is a
// network and served from the cache when there is not; hashed bundles, fonts,
// icons and voice takes never change, so they are served from the cache first.
// Bump CACHE to drop everything a previous version stored.
const CACHE = 'synergy-exe-v2';
const KEEP = /\/assets\/|\.(mp3|woff2?|ttf|png|svg|webmanifest)$/;

const put = (req, res) => { if (res.ok && res.status === 200 && res.type === 'basic') caches.open(CACHE).then(c => c.put(req, res)).catch(() => {}); };

self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.add('./')).catch(() => {})); });
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('synergy-exe-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.includes('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { put(req, res.clone()); return res; }).catch(() => caches.match(req, { ignoreSearch:true }).then(hit => hit || caches.match('./'))));
  } else if (KEEP.test(url.pathname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { put(req, res.clone()); return res; })));
  } else {
    e.respondWith(fetch(req).then(res => { put(req, res.clone()); return res; }).catch(() => caches.match(req)));
  }
});

// The page lists what it loaded before this worker took over, so the first visit is enough to play offline.
self.addEventListener('message', e => {
  const d = e.data;
  if (!d || d.type !== 'warm' || !Array.isArray(d.urls)) return;
  e.waitUntil(caches.open(CACHE).then(async c => {
    for (const u of d.urls.slice(0, 80)) {
      try { const url = new URL(u, location.href); if (url.origin !== location.origin || url.pathname.includes('/api/') || await c.match(url.href)) continue;
        const res = await fetch(url.href); if (res.ok && res.type === 'basic') await c.put(url.href, res); } catch (x) { /* offline or blocked: skip */ }
    }
  }));
});
