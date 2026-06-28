import api from "./api.js";

export const restaurantsService = {
  async list(params = {}) {
    const res = await api.get("/restaurants", { params });
    return res.data;
  },

  async getBySlug(slug) {
    const res = await api.get(`/restaurants/${slug}`);
    return res.data.data;
  },

  async getAvailability(slug, date, partySize) {
    const res = await api.get(`/restaurants/${slug}/availability`, {
      params: { date, party_size: partySize },
    });
    return res.data.data;
  },

  async getManage(id) {
    const res = await api.get(`/restaurants/${id}/manage`);
    return res.data.data;
  },

  async update(id, data) {
    const res = await api.patch(`/restaurants/${id}`, data);
    return res.data.data;
  },

  async generateQR(id) {
    const res = await api.post(`/restaurants/${id}/qr`);
    return res.data.data;
  },

  async createTable(id, data) {
    const res = await api.post(`/restaurants/${id}/tables`, data);
    return res.data.data;
  },

  async updateTable(restoId, tableId, data) {
    const res = await api.patch(`/restaurants/${restoId}/tables/${tableId}`, data);
    return res.data.data;
  },

  async deleteTable(restoId, tableId) {
    await api.delete(`/restaurants/${restoId}/tables/${tableId}`);
  },

  async generateTableQR(restoId, tableId) {
    const res = await api.post(`/restaurants/${restoId}/tables/${tableId}/qr`);
    return res.data.data;
  },
};
