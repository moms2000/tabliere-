import api from "./api.js";

export const menuService = {
  // Public — QR
  async getPublicMenu(slug) {
    const res = await api.get(`/menu/${slug}`);
    return res.data.data;
  },

  // Restaurateur/Admin
  async getFullMenu(slug) {
    const res = await api.get(`/menu/${slug}/manage`);
    return res.data.data;
  },

  async createCategory(slug, name, position = 0) {
    const res = await api.post("/menu/categories", { slug, name, position });
    return res.data.data;
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
