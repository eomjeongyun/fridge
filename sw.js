const CACHE = 'fridge-v1';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './fonts/GangwonEduSaeeum.woff2', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
async function cachedFirst(request, fallback) {
  const cache = await caches.open(CACHE);
  const cacheKey = fallback || request;
  const cached = await cache.match(cacheKey);
  const refresh = fetch(request).then(response => {
    if (response && response.ok) cache.put(cacheKey, response.clone());
    return response;
  }).catch(() => null);
  return cached || await refresh || new Response('오프라인입니다.', {status: 503});
}
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') event.respondWith(cachedFirst(event.request, './index.html'));
  else event.respondWith(cachedFirst(event.request));
});
