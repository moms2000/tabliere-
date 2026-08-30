import admin from "firebase-admin";
import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Notifications push via Firebase Cloud Messaging (API HTTP v1, firebase-admin).
 * - Nécessite la variable d'env FCM_SERVICE_ACCOUNT = le JSON du compte de
 *   service Firebase (Paramètres → Comptes de service → Générer une clé privée).
 * - Fonctionne pour iOS ET Android tant que l'app envoie des tokens FCM.
 * - Sans credentials : mode simulation (n'échoue jamais).
 */
let messaging = null;
let initTried = false;

function getMessaging() {
  if (initTried) return messaging;
  initTried = true;
  if (!env.FCM_SERVICE_ACCOUNT) return null;
  try {
    const svc = typeof env.FCM_SERVICE_ACCOUNT === "string"
      ? JSON.parse(env.FCM_SERVICE_ACCOUNT)
      : env.FCM_SERVICE_ACCOUNT;
    if (svc.private_key) svc.private_key = svc.private_key.replace(/\\n/g, "\n");
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(svc) });
    }
    messaging = admin.messaging();
    logger.info("[Push] Firebase Admin initialisé");
  } catch (e) {
    logger.warn("[Push] Initialisation Firebase échouée", { error: e.message });
    messaging = null;
  }
  return messaging;
}

// Envoi bas-niveau : découpe en lots de 500 (limite FCM), purge les tokens morts,
// renvoie le total OK/KO. Ne lève jamais.
async function dispatch(tokens, { title, body, data = {} }) {
  const m = getMessaging();
  if (!m) {
    logger.info("[Push MOCK]", { title, appareils: tokens.length });
    return { ok: 0, ko: 0, devices: tokens.length, mock: true };
  }
  const strData = {}; // FCM v1 exige des valeurs data en chaîne
  for (const k of Object.keys(data || {})) strData[k] = String(data[k]);

  let ok = 0, ko = 0;
  const dead = [];
  for (let i = 0; i < tokens.length; i += 500) {
    const chunk = tokens.slice(i, i + 500);
    try {
      const res = await m.sendEachForMulticast({
        tokens: chunk,
        notification: { title, body },
        data: strData,
        // Son + priorité haute sur iOS ET Android → alerte audible même app fermée.
        apns: { payload: { aps: { sound: "default" } }, headers: { "apns-priority": "10" } },
        android: { priority: "high", notification: { sound: "default", defaultSound: true } },
      });
      ok += res.successCount; ko += res.failureCount;
      res.responses.forEach((r, j) => {
        const code = r.error?.code || "";
        if (!r.success && (code.includes("registration-token-not-registered") ||
                           code.includes("invalid-argument"))) dead.push(chunk[j]);
      });
    } catch (e) {
      ko += chunk.length;
      logger.warn("[Push] échec lot", { error: e.message });
    }
  }
  if (dead.length) {
    await query("DELETE FROM device_tokens WHERE token = ANY($1)", [dead]).catch(() => {});
  }
  return { ok, ko, devices: tokens.length };
}

export async function sendPushToUser(userId, { title, body, data = {} }) {
  if (!userId || !title) return;
  const { rows } = await query(
    "SELECT token FROM device_tokens WHERE user_id = $1", [userId]
  ).catch(() => ({ rows: [] }));
  if (!rows.length) return;
  const res = await dispatch(rows.map((r) => r.token), { title, body, data });
  logger.info("[Push] envoyée", { userId, ...res });
  return res;
}

/**
 * Diffusion admin : envoie une notification à toutes les catégories demandées.
 * `roles` = tableau parmi "client" | "restaurateur" | "organisateur" (une, deux
 * ou trois catégories). Ne vise que les comptes actifs.
 * Renvoie { recipients, devices, ok, ko }.
 */
export async function sendPushToRoles(roles, { title, body, data = {} }) {
  const valid = (Array.isArray(roles) ? roles : [])
    .filter((r) => ["client", "restaurateur", "organisateur"].includes(r));
  if (!valid.length || !title) return { recipients: 0, devices: 0, ok: 0, ko: 0 };

  const { rows } = await query(
    `SELECT DISTINCT dt.token, dt.user_id
       FROM device_tokens dt
       JOIN users u ON u.id = dt.user_id
      WHERE u.role = ANY($1) AND u.status = 'actif'`, [valid]
  ).catch(() => ({ rows: [] }));

  const recipients = new Set(rows.map((r) => r.user_id)).size;
  if (!rows.length) {
    logger.info("[Push] diffusion : aucun appareil", { roles: valid });
    return { recipients: 0, devices: 0, ok: 0, ko: 0 };
  }
  const res = await dispatch(rows.map((r) => r.token), { title, body, data });
  logger.info("[Push] diffusion", { roles: valid, recipients, ...res });
  return { recipients, ...res };
}
