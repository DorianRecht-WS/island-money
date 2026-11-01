// Lets the browser offer to install the app. It caches nothing: every load comes from the network, so updates show up at once.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
