const CACHE = 'pausekeeper-shell-v8';
const SHELL = ['/', '/index.html', '/404.html', '/offline.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/assets/hero-recorder.avif', '/assets/hero-recorder-720.webp', '/assets/hero-recorder.webp', '/assets/hero-recorder.jpg', '/assets/pausekeeper-social.jpg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(async cache => {
  await cache.addAll(SHELL);
  const appShell = await cache.match('/index.html');
  const html = await appShell?.clone().text();
  const hashedAssets = [...(html?.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|css))"/g) ?? [])].map(match => match[1]);
  await cache.addAll(hashedAssets);
  if (appShell) await Promise.all(['/demo', '/privacy', '/terms'].map(route => cache.put(route, appShell.clone())));
})));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname === 'api.sociobot.in' || url.hostname === 'pilot-api.sociobot.in') {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); return response; }).catch(async () => (await caches.match(event.request, { ignoreVary: true })) || (await caches.match('/index.html', { ignoreVary: true })) || caches.match('/offline.html', { ignoreVary: true })));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then(cached => cached || fetch(event.request).then(response => { if (url.origin === location.origin) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy)); } return response; })));
});
