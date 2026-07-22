import api, { setTokens, clearTokens, getStoredToken } from "./api.js";

export const authService = {
  async register(data) {
    const res = await api.post("/auth/register", data);
    const { access_token, refresh_token } = res.data.data || {};
    // Vérification e-mail obligatoire : plus d'auto-connexion (aucun token renvoyé).
    if (access_token && refresh_token) setTokens(access_token, refresh_token, true);
    return res.data.data; // { user, email_sent, needs_verification }
  },

  async login(email, password, remember = true) {
    const res = await api.post("/auth/login", { email, password });
    const { access_token, refresh_token, user } = res.data.data;
    setTokens(access_token, refresh_token, remember);
    return user;
  },

  // Connexion d'un membre du staff restaurant (identifiant + PIN)
  async staffLogin(login_id, pin) {
    const res = await api.post("/restaurant-staff/login", { login_id, pin });
    const { token, staff, restaurant } = res.data.data;
    setTokens(token, "", true); // token staff (pas de refresh)
    return { staff, restaurant };
  },

  // Vérification e-mail → auto-connexion si le backend renvoie des tokens
  async verifyEmail(token) {
    const res = await api.get("/auth/verify-email", { params: { token } });
    const { access_token, refresh_token } = res.data.data || {};
    if (access_token && refresh_token) setTokens(access_token, refresh_token, true);
    return res.data.data; // { verified, already_verified, user? }
  },

  async resendVerification(email) {
    const res = await api.post("/auth/resend-verification", { email });
    return res.data;
  },

  async logout() {
    // Envoyer le refresh token pour que le serveur révoque la session (rotation).
    const refresh_token = getStoredToken("refresh_token");
    try { await api.post("/auth/logout", { refresh_token }); } catch (_) {}
    clearTokens();
  },

  async me() {
    const res = await api.get("/auth/me");
    return res.data.data.user;
  },
};
