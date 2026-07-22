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

    // Session staff : on la reconstruit depuis le marqueur local. Le token staff
    // agit comme l'owner côté API, donc /auth/me renverrait l'owner (tous les
    // onglets) — on ne l'appelle pas pour un staff.
    try {
      const staff = JSON.parse(localStorage.getItem("tci_staff") || "null");
      if (staff) { setUser({ role: "restaurateur", is_staff: true, ...staff }); setLoading(false); return; }
    } catch {}

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
    localStorage.removeItem("tci_staff"); // jamais de marqueur staff résiduel sur une connexion normale
    const u = await authService.login(email, password, remember);
    setUser(u);
    return u;
  }, []);

  // Connexion staff (identifiant + PIN) → session restreinte aux onglets autorisés
  const loginStaff = useCallback(async (login_id, pin) => {
    const { staff, restaurant } = await authService.staffLogin(login_id, pin);
    const u = {
      role: "restaurateur", is_staff: true, name: staff.name,
      permissions: Array.isArray(staff.permissions) ? staff.permissions : [],
      resto_id: restaurant?.id, resto_slug: restaurant?.slug, resto_name: restaurant?.name,
    };
    localStorage.setItem("tci_staff", JSON.stringify(u));
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem("tci_staff");
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
    <AuthContext.Provider value={{ user, loading, login, loginStaff, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
