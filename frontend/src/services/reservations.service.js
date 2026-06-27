import api from "./api.js";

export const reservationsService = {
  async create(data) {
    const res = await api.post("/reservations", data);
    return res.data.data;
  },

  async list(params = {}) {
    const res = await api.get("/reservations", { params });
    return res.data;
  },

  async getOne(id) {
    const res = await api.get(`/reservations/${id}`);
    return res.data.data;
  },

  async confirm(id, tableId = null) {
    const body = tableId ? { table_id: tableId } : {};
    const res = await api.patch(`/reservations/${id}/confirm`, body);
    return res.data.data;
  },

  async assignTable(id, tableId) {
    const res = await api.patch(`/reservations/${id}/assign-table`, { table_id: tableId });
    return res.data.data;
  },

  async cancel(id, reason) {
    const res = await api.patch(`/reservations/${id}/cancel`, { cancel_reason: reason });
    return res.data.data;
  },

  // Réservations de l'utilisateur connecté
  async myReservations(params = {}) {
    const res = await api.get("/users/me/reservations", { params });
    return res.data;
  },
};
