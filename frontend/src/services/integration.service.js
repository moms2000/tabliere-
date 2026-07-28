import api from "./api.js";

// L'admin cible un restaurant précis via ?restaurant_id ; le restaurateur, lui,
// n'envoie rien (le backend résout son propre restaurant).
const rp = (restaurantId) => (restaurantId ? { params: { restaurant_id: restaurantId } } : {});

// Intégration caisse tierce (clé API + webhooks).
export const integrationService = {
  // Configuration d'un restaurant (le sien, ou celui ciblé si admin)
  async get(restaurantId) {
    return (await api.get("/integration", rp(restaurantId))).data.data;
  },
  // (Re)génère la clé API — renvoyée UNE SEULE FOIS ({ api_key, api_key_prefix, webhook_secret })
  // NB : corps {} (pas null) — l'instance force Content-Type json, et `null` partirait
  // comme le corps "null" que le body-parser strict d'Express refuse (400).
  async generateKey(restaurantId) {
    return (await api.post("/integration/key", {}, rp(restaurantId))).data.data;
  },
  // { webhook_url?, is_active? }
  async update(body, restaurantId) {
    return (await api.patch("/integration", body, rp(restaurantId))).data.data;
  },
  // Admin : toutes les intégrations avec leur état (sans aucune clé)
  async listAll() {
    return (await api.get("/integration/admin/all")).data.data.integrations;
  },
};
