import api, { setTokens, clearTokens } from "./api.js";

export const authService = {
  async register(data) {
    const res = await api.post("/auth/register", data);
    const { access_token, refresh_token } = res.data.data || {};
    // Inscription : toujours mémoriser (l'utilisateur vient de créer son compte)
    if (access_token && refresh_token) setTokens(access_token, refresh_token, true);
    return res.data;
  },

  async login(email, password, remember = true) {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, refresh_token, user } = res.data.data;
    setTokens(access_token, refresh_token, remember);
    return user;
  },

  async logout() {
    try { await api.post("/auth/logout"); } catch (_) {}
    clearTokens();
  },

  async me() {
    const res = await api.get("/auth/me");
    return res.data.data.user;
  },
};
