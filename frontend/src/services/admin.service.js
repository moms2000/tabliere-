import api from "./api.js";
import { memCache } from "./cache.js";

export const adminService = {
  async getStats() {
    const cKey = "admin:stats";
    const hit = memCache.get(cKey);
    if (hit) return hit;
    const res = await api.get("/admin/stats");
    const data = res.data.data;
    memCache.set(cKey, data, 5 * 60_000); // 5 min
    return data;
  },

  async listRestaurants(params = {}) {
    // Cache uniquement si pas de filtres dynamiques
    const hasFilters = params.search || params.status || params.plan;
    const cKey = hasFilters ? null : `admin:restaurants:${params.page || 1}:${params.limit || 20}`;
    if (cKey) { const hit = memCache.get(cKey); if (hit) return hit; }
    const res = await api.get("/admin/restaurants", { params });
    if (cKey) memCache.set(cKey, res.data, 2 * 60_000); // 2 min
    return res.data;
  },

  async setRestaurantStatus(id, status) {
    const res = await api.patch(`/admin/restaurants/${id}/status`, { status });
    memCache.delPrefix("admin:"); // invalider stats + liste
    return res.data.data;
  },

  async setRestaurantPlan(id, plan) {
    const res = await api.patch(`/admin/restaurants/${id}/plan`, { plan });
    memCache.delPrefix("admin:");
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

  async updateUser(id, data) {
    const res = await api.patch(`/admin/users/${id}`, data);
    return res.data.data;
  },

  async deleteUser(id) {
    const res = await api.delete(`/admin/users/${id}`);
    return res.data;
  },

  async toggleRestaurantQR(id, active) {
    const res = await api.patch(`/admin/restaurants/${id}/qr`, { active });
    return res.data.data;
  },

  async getSettings() {
    const res = await api.get("/admin/settings");
    return res.data.data.settings;
  },

  async updateSettings(settings) {
    const res = await api.patch("/admin/settings", settings);
    return res.data;
  },

  async changePassword(current_password, new_password) {
    const res = await api.post("/admin/change-password", { current_password, new_password });
    return res.data;
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
