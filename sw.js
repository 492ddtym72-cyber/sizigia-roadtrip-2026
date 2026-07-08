/* Service Worker: App lädt auch im Funkloch.
   Strategie: Netz zuerst (immer aktuellste Version), Cache als Fallback.
   Cloud-Sync-Requests (fremde Origins, z. B. Firebase) werden nie angefasst. */
const CACHE = 'sizigia-app-v2';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([
    './',
    './index.html',
    './manifest.webmanifest',
    './app-icon.png',
    './icon-180.png',
    './icon-192.png',
    './icon-512.png',
    './icon-maskable-512.png'
  ]).catch(()=>{})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
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
      .catch(() =>
        caches.match(e.request).then(m => m || caches.match('./index.html'))
      )
  );
});
