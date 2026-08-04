/* Service Worker: App lädt auch im Funkloch.
   Strategie: Netz zuerst (immer aktuellste Version), Cache als Fallback.
   Cloud-Sync-Requests (fremde Origins, z. B. Firebase) werden nie angefasst. */
const CACHE = 'sizigia-app-v37-raster-repair';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css?v=2026-07-20-sleep-ui-v25',
  './gatekeeper.css?v=2026-08-04-psy-v1',
  './passcode-gate.css?v=2026-08-04-v1',
  './redesign.css?v=2026-08-04-v2',
  './raster-art.css?v=2026-08-04-v2',
  './vendor/maplibre-gl.css',
  './vendor/maplibre-gl.js',
  './vendor/maplibre-LICENSE.txt',
  './map-data.js',
  './zfe-data.js',
  './gatekeeper.js?v=2026-08-04-psy-v1',
  './passcode-gate.js?v=2026-08-04-v2',
  './app.js?v=2026-07-20-sleep-ui-v24',
  './weighted-expenses.js?v=2026-08-03-v3',
  './redesign.js?v=2026-08-04-v2',
  './assets/home-roadtrip-sunset-v2.webp',
  './assets/home-crew-campfire-v2.webp',
  './assets/home-settings-van-v2.webp',
  './roadtrip-scene.svg',
  './game-scene.svg',
  './manifest.webmanifest',
  './app-icon.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('sizigia-app-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  const isAppShell = e.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/gatekeeper.js') ||
    url.pathname.endsWith('/gatekeeper.css') ||
    url.pathname.endsWith('/passcode-gate.js') ||
    url.pathname.endsWith('/passcode-gate.css') ||
    url.pathname.endsWith('/weighted-expenses.js') ||
    url.pathname.endsWith('/redesign.js') ||
    url.pathname.endsWith('/redesign.css') ||
    url.pathname.endsWith('/raster-art.css') ||
    url.pathname.endsWith('-v2.webp');
  const fetchOptions = isAppShell ? { cache: 'no-store' } : undefined;
  e.respondWith(
    fetch(e.request, fetchOptions)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(m => {
        if (m) return m;
        if (e.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});
