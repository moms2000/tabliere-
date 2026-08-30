import api, { setTokens, clearTokens, getStoredToken } from "./api.js";

export const authService = {
  async register(data) {
    const res = await api.post("/auth/register", data);
    const { access_token, refresh_token } = res.data.data || {};
    // Vérification e-mail obligatoire : plus d'auto-connexion (aucun token renvoyé).
    if (access_token && refresh_token) setTokens(access_token, refresh_token, true);
    return res.data.data; // { user, email_sent, needs_verification }
  },

  async login(identifier, password, remember = true) {
    // `identifier` = numéro de téléphone OU e-mail. Le backend accepte les deux
    // (rétrocompatibilité des comptes e-mail existants) via le champ `identifier`.
    const res = await api.post("/auth/login", { identifier, password });
    const { access_token, refresh_token, user } = res.data.data;
    setTokens(access_token, refresh_token, remember);
    return user;
  },

  // ── Inscription / réinitialisation par NUMÉRO + OTP WhatsApp ────────────────
  // Étape 1 : demander un code. `purpose` = "register" | "reset".
  async sendOtp(phone, purpose = "register") {
    const res = await api.post("/auth/otp/send", { phone, purpose });
    return res.data.data; // { sent, dev_code? (mode simulation uniquement) }
  },

  // Étape 2 : vérifier le code → renvoie un ticket signé (courte durée).
  async verifyOtp(phone, code, purpose = "register") {
    const res = await api.post("/auth/otp/verify", { phone, code, purpose });
    return res.data.data.ticket;
  },

  // Étape 3a (inscription) : créer le compte + choisir SON mot de passe.
  // Le backend renvoie les tokens → connexion automatique (numéro déjà vérifié).
  async registerPhone(data, remember = true) {
    const res = await api.post("/auth/otp/register", data);
    const { access_token, refresh_token, user } = res.data.data || {};
    if (access_token && refresh_token) setTokens(access_token, refresh_token, remember);
    return { user, access_token, refresh_token };
  },

  // Étape 3b (mot de passe oublié) : définir un nouveau mot de passe via le ticket.
  async resetPasswordPhone(otp_ticket, password) {
    const res = await api.post("/auth/otp/reset", { otp_ticket, password });
    return res.data.data;
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
