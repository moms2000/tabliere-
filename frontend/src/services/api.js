/**
 * Client Axios — TablièreCI
 * Intercepteurs automatiques pour JWT + refresh token
 *
 * "Rester connecté" (remember me) :
 *   - OUI → tokens dans localStorage  (persistent après fermeture navigateur, 30j)
 *   - NON → tokens dans sessionStorage (effacés à la fermeture de l'onglet)
 */

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
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

export const clearTokens = () => {
  ["access_token", "refresh_token", "tci_remember"].forEach(k => {
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
};

const isRemembered = () =>
  localStorage.getItem("tci_remember") === "1" ||
  // Si stocké en sessionStorage → pas remembered
  (sessionStorage.getItem("access_token") !== null ? false : true);

// ── Intercepteur requête : injecter le token ─────────────────────────────────
api.interceptors.request.use((config) => {
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

    if (status === 401 && !original._retry && !original.url?.includes("/auth/")) {
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
        if (!refreshToken) throw new Error("No refresh token");

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const { access_token, refresh_token } = data.data;
        // Conserver le même storage que lors du login
        setTokens(access_token, refresh_token, isRemembered());

        processQueue(null, access_token);
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearTokens();
        window.location.href = "/connexion";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
