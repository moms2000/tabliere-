import api from "./api.js";

export const adminService = {
  async getStats() {
    const res = await api.get("/admin/stats");
    return res.data.data;
  },

  async listRestaurants(params = {}) {
    const res = await api.get("/admin/restaurants", { params });
    return res.data;
  },

  async setRestaurantStatus(id, status) {
    const res = await api.patch(`/admin/restaurants/${id}/status`, { status });
    return res.data.data;
  },

  async setRestaurantPlan(id, plan) {
    const res = await api.patch(`/admin/restaurants/${id}/plan`, { plan });
    return res.data.data;
  },

  async listUsers(params = {}) {
    const res = await api.get("/admin/users", { params });
    return res.data;
  },

  async setUserStatus(id, status) {
    const res = await api.patch(`/admin/users/${id}/status`, { status });
    return res.data.data;
  },

  async listReservations(params = {}) {
    const res = await api.get("/admin/reservations", { params });
    return res.data;
  },

  async updateReservation(id, fields) {
    const res = await api.patch(`/admin/reservations/${id}`, fields);
    return res.data.data;
  },

  async listPayments(params = {}) {
    const res = await api.get("/admin/payments", { params });
    return res.data;
  },

  async listTransactions(params = {}) {
    const res = await api.get("/admin/payments", { params: { limit: 200, ...params } });
    return res.data;
  },

  async batchRestaurantStatus(ids, status) {
    const res = await api.patch("/admin/restaurants/batch", { ids, status });
    return res.data.data;
  },

  async batchUserStatus(ids, status) {
    const res = await api.patch("/admin/users/batch", { ids, status });
    return res.data.data;
  },

  async exportCSV(type) {
    const res = await api.get("/admin/export", { params: { type }, responseType: "blob" });
    const url  = URL.createObjectURL(res.data);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${type}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
