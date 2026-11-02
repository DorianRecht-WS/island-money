// The web app is gone (Island Money is an Android app now). This replaces the old service worker on devices that installed the web app:
// it deletes what the old one had cached and removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then((clients) => clients.forEach((c) => c.navigate(c.url)))
));
