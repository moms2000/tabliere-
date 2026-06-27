import api from "./api.js";

export const chatService = {
  async getConversations() {
    const res = await api.get("/chat/conversations");
    return res.data.data || [];
  },

  async getMessages(reservationId, params = {}) {
    const res = await api.get(`/chat/${reservationId}`, { params });
    return res.data.data || [];
  },

  async sendMessage(reservationId, content) {
    const res = await api.post(`/chat/${reservationId}`, { content });
    return res.data.data;
  },
};

export const notificationsService = {
  async list(params = {}) {
    const res = await api.get("/notifications", { params });
    return res.data.data || { notifications: [], unread: 0 };
  },

  async markAllRead() {
    await api.patch("/notifications/read-all");
  },

  async markOneRead(id) {
    await api.patch(`/notifications/${id}/read`);
  },
};
