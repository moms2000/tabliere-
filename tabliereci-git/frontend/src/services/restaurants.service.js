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

  async getSlots(slug, date, partySize) {
    const res = await api.get(`/restaurants/${slug}/slots`, {
      params: { date, party_size: partySize },
    });
    return res.data.data;
  },

  async update(id, data) {
    const res = await api.patch(`/restaurants/${id}`, data);
    return res.data.data;
  },

  async toggleQR(id, enabled) {
    const res = await api.patch(`/restaurants/${id}/qr`, { enabled });
    return res.data.data;
  },
};
