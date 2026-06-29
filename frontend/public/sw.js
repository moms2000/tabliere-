// TablièreCI Service Worker — PWA
const CACHE = "tabliereci-v1";
const OFFLINE_URL = "/";

// Installation — mise en cache des ressources essentielles
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/", "/manifest.json"])
    )
  );
  self.skipWaiting();
});

// Activation — nettoyage des anciens caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, cache fallback
self.addEventListener("fetch", (e) => {
  // Ne pas intercepter les appels API
  if (e.request.url.includes("/api/")) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match(OFFLINE_URL)))
  );
});
