// SW - Panel AutoParts
const CACHE_NAME = 'panel-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest-panel.json',
  './icon.png'
];
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin) && !e.request.url.startsWith('https://fonts.')) return;
  e.respondWith(
    fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request))
  );
});
