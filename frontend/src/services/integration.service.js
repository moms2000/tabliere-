import api from "./api.js";

// Intégration caisse tierce (clé API + webhooks). Côté propriétaire uniquement.
export const integrationService = {
  // Configuration actuelle (préfixe de clé, URL webhook, secret, statut, dernier envoi)
  async get() {
    return (await api.get("/integration")).data.data;
  },
  // (Re)génère la clé API — renvoyée UNE SEULE FOIS ({ api_key, api_key_prefix, webhook_secret })
  async generateKey() {
    return (await api.post("/integration/key")).data.data;
  },
  // { webhook_url?, is_active? }
  async update(body) {
    return (await api.patch("/integration", body)).data.data;
  },
};
