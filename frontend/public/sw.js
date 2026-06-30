// TablièreCI Service Worker — PWA
// IMPORTANT : incrémenter CACHE_VERSION à chaque déploiement majeur
// pour forcer la mise à jour du cache chez tous les utilisateurs.
const CACHE_VERSION = "tabliereci-v3";
const STATIC_CACHE  = `${CACHE_VERSION}-static`;

// ── Installation — précache du shell ─────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(["/", "/manifest.json"]))
      .then(() => self.skipWaiting())
  );
});

// ── Activation — purger TOUS les caches des versions précédentes ─────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 1. Ne jamais intercepter les appels API backend
  if (url.pathname.startsWith("/api/")) return;

  // 2. Ne JAMAIS cacher les chunks JS/CSS de Vite (/assets/*)
  //    Ces fichiers ont des noms avec hash de contenu.
  //    Les cacher dans le SW provoque des erreurs MIME type après
  //    chaque redéploiement (le SW sert du HTML à la place des JS).
  if (url.pathname.startsWith("/assets/")) return;

  // 3. Tout le reste : Network First + cache offline fallback
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((r) => r || caches.match("/"))
      )
  );
});
