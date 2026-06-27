import api from "./api.js";

export const ordersService = {
  // Public — client via QR
  async create(data) {
    const res = await api.post("/orders", data);
    return res.data.data;
  },

  // Restaurateur
  async list(params = {}) {
    const res = await api.get("/orders", { params });
    return res.data;
  },

  async getStats(params = {}) {
    const res = await api.get("/orders/stats", { params });
    return res.data.data;
  },

  async updateStatus(id, status) {
    const res = await api.patch(`/orders/${id}`, { status });
    return res.data.data;
  },
};
