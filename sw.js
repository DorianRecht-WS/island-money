// Makes the app open fast and lets the browser offer to install it. The page itself always comes from the network (so an update shows at
// once, and the old copy is only the fallback when you are offline); the scripts, styles, icons and the Supabase library are answered
// from the cache straight away and refreshed in the background. Their addresses carry ?v=N, so bump N in index.html when one changes.
// Never cached: the Supabase API (your data).
const CACHE = 'island-money-v4';
const CACHED_HOSTS = [self.location.host, 'cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || !CACHED_HOSTS.includes(u.host)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }).catch(() => caches.match(req)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
