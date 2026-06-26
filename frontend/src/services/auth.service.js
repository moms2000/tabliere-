import api from "./api.js";

export const authService = {
  async register(data) {
    const res = await api.post("/auth/register", data);
    // Stocker les tokens si présents (inscription + connexion auto)
    const { access_token, refresh_token } = res.data.data || {};
    if (access_token) localStorage.setItem("access_token", access_token);
    if (refresh_token) localStorage.setItem("refresh_token", refresh_token);
    return res.data;
  },

  async login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, refresh_token, user } = res.data.data;
    localStorage.setItem("access_token",  access_token);
    localStorage.setItem("refresh_token", refresh_token);
    return user;
  },

  async logout() {
    try { await api.post("/auth/logout"); } catch (_) { /* ignore */ }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  },

  async me() {
    const res = await api.get("/auth/me");
    return res.data.data.user;
  },
};
