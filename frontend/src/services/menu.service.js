import api from "./api.js";

export const menuService = {
  // Public — QR
  async getPublicMenu(slug, preview) {
    const res = await api.get(`/menu/${slug}`, { params: preview ? { preview } : {} });
    return res.data.data;
  },

  // Restaurateur/Admin
  async getFullMenu(slug) {
    const res = await api.get(`/menu/${slug}/manage`);
    return res.data.data;
  },

  async createCategory(restoId, data) {
    const res = await api.post("/menu/categories", data);
    return res.data.data;
  },

  async updateCategory(id, data) {
    const res = await api.patch(`/menu/categories/${id}`, data);
    return res.data.data;
  },

  async deleteCategory(id) {
    await api.delete(`/menu/categories/${id}`);
  },

  async createItem(data) {
    const res = await api.post("/menu/items", data);
    return res.data.data;
  },

  async updateItem(id, data) {
    const res = await api.patch(`/menu/items/${id}`, data);
    return res.data.data;
  },

  async deleteItem(id) {
    await api.delete(`/menu/items/${id}`);
  },
};
