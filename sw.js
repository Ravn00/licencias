const CACHE = 'acap-v1';
const FILES = ['./','./index.html','./manifest-panel.json','./icon.png',
  'css/styles.css',
  'js/config.js','js/supabase.js','js/constants.js',
  'js/license.js','js/init.js','js/ui.js','js/health.js','js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(location.origin) && !e.request.url.startsWith('https://fonts.')) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
