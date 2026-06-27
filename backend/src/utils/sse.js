/**
 * SSE (Server-Sent Events) — Notifications temps réel
 * Map userId → Set<res> pour supporter plusieurs onglets par utilisateur
 */

const connections = new Map(); // userId → Set<res>

/**
 * Enregistre une connexion SSE
 */
export function addConnection(userId, res) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId).add(res);
}

/**
 * Supprime une connexion SSE
 */
export function removeConnection(userId, res) {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) connections.delete(userId);
}

/**
 * Envoie un événement SSE à un utilisateur spécifique
 */
export function emitToUser(userId, event, data) {
  const set = connections.get(String(userId));
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch (_) { set.delete(res); }
  }
}

/**
 * Envoie un événement SSE à tous les admins connectés
 */
export function emitToAll(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const [, set] of connections) {
    for (const res of set) {
      try { res.write(payload); } catch (_) {}
    }
  }
}

/**
 * Nombre de connexions actives (monitoring)
 */
export function activeConnections() {
  let count = 0;
  for (const set of connections.values()) count += set.size;
  return count;
}
