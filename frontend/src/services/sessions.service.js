import api from "./api.js";

// Notes de table (additions ouvertes) — côté restaurateur / serveur
export const sessionsService = {
  // Notes ouvertes (ou fermées) du restaurant
  async list(status = "open") {
    return (await api.get("/sessions", { params: { status } })).data.data;
  },
  // Ouvre (ou récupère) la note ouverte d'une table
  async open(table_label) {
    return (await api.post("/sessions", { table_label })).data.data;
  },
  async get(id) {
    return (await api.get(`/sessions/${id}`)).data.data;
  },
  // Ajoute une tournée d'articles à la note
  async addItems(id, items) {
    return (await api.post(`/sessions/${id}/items`, { items })).data.data;
  },
  // Modifie un article : { qty }, { convive_id } (réassigner), { status }
  async updateItem(id, itemId, patch) {
    return (await api.patch(`/sessions/${id}/items/${itemId}`, patch)).data.data;
  },
  async addConvive(id, name) {
    return (await api.post(`/sessions/${id}/convives`, { name })).data.data;
  },
  async updateConvive(id, cid, name) {
    return (await api.patch(`/sessions/${id}/convives/${cid}`, { name })).data.data;
  },
  // Encaissement : { payments: [{ method, amount, convive_id? }], close? }
  async pay(id, body) {
    return (await api.post(`/sessions/${id}/pay`, body)).data.data;
  },
  // Rapport de caisse : total encaissé + par mode (period: day|week|month)
  async report(period = "day") {
    return (await api.get("/sessions/report", { params: { period } })).data.data;
  },
  async close(id) {
    return (await api.post(`/sessions/${id}/close`)).data;
  },
};
