import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authService } from "../services/auth.service.js";
import { initPushNotifications } from "../services/push.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true); // vrai au premier chargement

  // Recharger l'utilisateur depuis le token stocké au démarrage
  useEffect(() => {
    const token = localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
    if (!token) { setLoading(false); return; }

    authService.me()
      .then(setUser)
      .catch((e) => {
        // Nettoyer les tokens UNIQUEMENT si la session est réellement invalide
        // (401/403 après tentative de refresh). Sur erreur réseau/timeout/cold
        // start, on GARDE les tokens pour ne pas déconnecter à tort.
        const st = e?.response?.status;
        if (st === 401 || st === 403) {
          ["access_token", "refresh_token", "tci_remember"].forEach((k) => {
            localStorage.removeItem(k); sessionStorage.removeItem(k);
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Push natives : ré-enregistre le token uniquement si l'utilisateur a DÉJÀ
  // accepté les notifications (le premier opt-in passe par NotificationPrompt,
  // pour ne pas déclencher le dialogue système brutalement).
  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem("tci_notif_optin") === "granted") initPushNotifications();
    } catch {}
  }, [user]);

  const login = useCallback(async (email, password, remember = true) => {
    const u = await authService.login(email, password, remember);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const register = useCallback(async (data) => {
    const res = await authService.register(data);
    // Pas de connexion automatique — l'utilisateur doit se connecter
    return res;
  }, []);

  // Recharger l'utilisateur depuis le serveur (après mise à jour profil/avatar)
  const refreshUser = useCallback(async () => {
    try {
      const u = await authService.me();
      setUser(u);
      return u;
    } catch (_) { return null; }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
