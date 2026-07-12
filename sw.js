/* Service Worker: App lädt auch im Funkloch.
   Strategie: Netz zuerst (immer aktuellste Version), Cache als Fallback.
   Cloud-Sync-Requests (fremde Origins, z. B. Firebase) werden nie angefasst. */
const CACHE = 'sizigia-app-v3';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './map-data.js',
  './app.js',
  './manifest.webmanifest',
  './app-icon.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('sizigia-app-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // Firebase & Co. nie cachen
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copy = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request).then(m => {
        if (m) return m;
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
