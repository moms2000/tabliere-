/**
 * Client Axios — TablièreCI
 * Intercepteurs automatiques pour JWT + refresh token
 *
 * "Rester connecté" (remember me) :
 *   - OUI → tokens dans localStorage  (persistent après fermeture navigateur, 30j)
 *   - NON → tokens dans sessionStorage (effacés à la fermeture de l'onglet)
 */

import axios from "axios";

export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  // 30s : laisse le temps au backend Render de se réveiller (cold start) sans
  // faire échouer la requête → évite les pages blanches qui obligent à rafraîchir
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── Helpers stockage ──────────────────────────────────────────────────────────
// Lit dans sessionStorage d'abord, puis localStorage (ordre de priorité)
export const getStoredToken = (key) =>
  sessionStorage.getItem(key) || localStorage.getItem(key);

export const setTokens = (accessToken, refreshToken, remember = true) => {
  const storage = remember ? localStorage : sessionStorage;
  // Nettoyer l'autre storage pour éviter les conflits
  const other = remember ? sessionStorage : localStorage;
  other.removeItem("access_token");
  other.removeItem("refresh_token");

  storage.setItem("access_token",  accessToken);
  storage.setItem("refresh_token", refreshToken);
  // Mémoriser le choix pour le refresh automatique
  storage.setItem("tci_remember", remember ? "1" : "0");
};

// Purge TOUTES les données propres à un utilisateur (sauf préférences neutres
// d'appareil). CRUCIAL : sans ça, le compte suivant sur le même appareil hérite
// des favoris, de l'état d'accueil et surtout de la session staff du précédent
// → bascule de compte / fuite de données. Appelé au login ET au logout.
const KEEP_KEYS = new Set(["tci_lang", "tci_notif_optin", "tci_order_sound", "tci_debug"]);
export const clearUserScopedData = () => {
  for (const store of [localStorage, sessionStorage]) {
    try {
      Object.keys(store)
        .filter(k => k.startsWith("tci_") && !KEEP_KEYS.has(k))
        .forEach(k => store.removeItem(k));
    } catch { /* storage indisponible */ }
  }
};

export const clearTokens = () => {
  ["access_token", "refresh_token", "tci_remember", "tci_staff"].forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  clearUserScopedData();
};

// "Remember me" = les tokens vivent dans localStorage (persistants)
const isRemembered = () => localStorage.getItem("refresh_token") !== null;

// Pages publiques : ne PAS éjecter l'utilisateur vers /connexion s'il y est déjà
function onPublicPage() {
  const p = window.location.pathname;
  const PUBLIC = ["/", "/connexion", "/inscription", "/restaurants", "/menu",
    "/verify-email", "/mot-de-passe", "/reset-password", "/cgu",
    "/mentions-legales", "/confidentialite"];
  return PUBLIC.some((x) => p === x || p.startsWith(x + "/") || (x !== "/" && p.startsWith(x)));
}

// Refresh résilient : réessaie sur erreur réseau/timeout/5xx (cold start Render),
// mais échoue immédiatement sur 401/403 (refresh token réellement invalide).
async function attemptRefresh(refreshToken) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      return await axios.post(
        `${BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { timeout: 30_000 } // large : survit aux réveils à froid du backend
      );
    } catch (e) {
      const st = e.response?.status;
      if (st === 401 || st === 403) throw e; // token invalide → inutile de réessayer
      lastErr = e;
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr;
}

// ── Intercepteur requête : injecter le token ─────────────────────────────────
api.interceptors.request.use((config) => {
  // Défense anti-cache : empêche la WebView (app Capacitor) de resservir une
  // réponse authentifiée mise en cache (ex : /auth/me d'une session précédente
  // → bascule de compte). Complète le `no-store` posé côté serveur.
  config.headers["Cache-Control"] = "no-cache";
  config.headers["Pragma"] = "no-cache";
  // Ne PAS écraser un header Authorization déjà posé explicitement (ex: token staff)
  if (config.headers?.Authorization) return config;
  const token = getStoredToken("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Intercepteur réponse : refresh automatique si 401 ───────────────────────
let isRefreshing = false;
let queue = [];

function processQueue(error, token = null) {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const status   = err.response?.status;

    // Mode maintenance : le backend renvoie 503 + code MAINTENANCE → on prévient
    // l'app (MaintenanceGate affiche la page d'interruption).
    if (status === 503 && err.response?.data?.code === "MAINTENANCE") {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("tci:maintenance"));
    }

    // Ne PAS tenter de refresh sur login/register/refresh (sinon boucle ou
    // mauvais message d'erreur). MAIS inclure /auth/me pour rester connecté.
    const noRefresh = ["/auth/login", "/auth/register", "/auth/refresh"]
      .some((u) => original.url?.includes(u));

    if (status === 401 && !original._retry && !noRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        const refreshToken = getStoredToken("refresh_token");
        if (!refreshToken) {
          // Pas de refresh token du tout → session absente. On rejette sans
          // rediriger brutalement (l'app/route protégée gère l'absence de user).
          const noTok = new Error("No refresh token");
          noTok._noToken = true;
          throw noTok;
        }

        const { data } = await attemptRefresh(refreshToken);

        const { access_token, refresh_token } = data.data;
        // Conserver le même storage que lors du login
        setTokens(access_token, refresh_token, isRemembered());

        processQueue(null, access_token);
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);

        // Déconnexion UNIQUEMENT si le refresh token est réellement invalide/expiré
        // (401/403) ou absent. Sur erreur réseau/timeout/5xx (cold start, coupure
        // passagère) : NE PAS déconnecter — la session reste valide, on rejette
        // juste la requête pour un nouvel essai ultérieur.
        const st = refreshErr.response?.status;
        const authFailure = st === 401 || st === 403 || refreshErr._noToken;
        if (authFailure) {
          clearTokens();
          if (!onPublicPage()) window.location.href = "/connexion";
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
