// ══════════════════════════════════════════════
// SERVICE WORKER — Panel de Licencias AutoParts
// ══════════════════════════════════════════════
const CACHE_NAME = 'licencias-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest-panel.json',
  './icon.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&display=swap'
];

// Instalar: cachear todos los assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches viejos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network first, cache fallback
self.addEventListener('fetch', e => {
  // Solo interceptar requests del mismo origen + fonts de Google
  if (!e.request.url.startsWith(self.location.origin) &&
      !e.request.url.startsWith('https://fonts.')) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Cachear respuesta fresca
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
