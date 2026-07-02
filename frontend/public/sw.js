// Service Worker désactivé — se désinstalle lui-même.
// Le SW causait des erreurs MIME après déploiement (anciens chunks en cache).
// Cette version se supprime et purge tous les caches pour nettoyer les
// utilisateurs qui l'ont encore enregistré.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purger tous les caches
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      // Se désinstaller
      await self.registration.unregister();
      // Recharger les onglets ouverts pour repartir sur une base propre
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});

// Ne rien intercepter — laisser toutes les requêtes passer normalement au réseau
self.addEventListener("fetch", () => {});
