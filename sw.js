// Makes the app open fast and lets the browser offer to install it. The page itself always comes from the network (so an update shows at
// once, and the old copy is only the fallback when you are offline); the scripts, styles, icons and the Supabase library are answered
// from the cache straight away and refreshed in the background. Their addresses carry ?v=N, so bump N in index.html when one changes.
// Never cached: the Supabase API (your data).
const CACHE = 'island-money-v6';
const CACHED_HOSTS = [self.location.host, 'cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', (e) => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || !CACHED_HOSTS.includes(u.host)) return;
  if (req.mode === 'navigate') {
    // the saved page opens at once (waiting for the network is what made the app slow to start); a newer one is fetched behind it, kept
    // for the next start, and announced to an app that is still opening so it can reload into it
    e.respondWith(caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(async (res) => {
        if (res.ok) {
          const fresh = await res.clone().text(), old = hit ? await hit.clone().text() : null;
          await cache.put(req, res.clone());
          if (old !== null && old !== fresh) (await self.clients.matchAll()).forEach((c) => c.postMessage('updated'));
        }
        return res;
      }).catch(() => hit);
      e.waitUntil(net.catch(() => {}));
      if (!hit) return net;
      // the saved page wins only when the network is slow (over a second): otherwise an update shows on the first open, not the second
      return Promise.race([net.catch(() => hit), new Promise((r) => setTimeout(() => r(hit), 1200))]);
    }));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
