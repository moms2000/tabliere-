/**
 * Cache mémoire côté frontend
 * Évite de refaire les mêmes appels API lors des navigations entre onglets.
 * TTL par défaut : 2 minutes.
 */

const store = new Map(); // key → { data, expiresAt }

export const memCache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
    return entry.data;
  },

  set(key, data, ttlMs = 120_000) {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  },

  del(key) { store.delete(key); },

  delPrefix(prefix) {
    for (const k of store.keys()) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  },

  clear() { store.clear(); },
};
