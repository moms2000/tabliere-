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

export async function sendPushToUser(userId, { title, body, data = {} }) {
  if (!userId || !title) return;

  const { rows } = await query(
    "SELECT token FROM device_tokens WHERE user_id = $1", [userId]
  ).catch(() => ({ rows: [] }));
  if (!rows.length) return;

  const tokens = rows.map((r) => r.token);
  const m = getMessaging();
  if (!m) {
    logger.info("[Push MOCK]", { userId, title, appareils: tokens.length });
    return;
  }

  // FCM v1 exige des valeurs data en chaîne
  const strData = {};
  for (const k of Object.keys(data || {})) strData[k] = String(data[k]);

  try {
    const res = await m.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: strData,
      apns: { payload: { aps: { sound: "default" } } },
      android: { priority: "high" },
    });

    // Purger les tokens devenus invalides
    const dead = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code || "";
      if (!r.success && (code.includes("registration-token-not-registered") ||
                         code.includes("invalid-argument"))) {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) {
      await query("DELETE FROM device_tokens WHERE token = ANY($1)", [dead]).catch(() => {});
    }
    logger.info("[Push] envoyée", { userId, ok: res.successCount, ko: res.failureCount });
  } catch (e) {
    logger.warn("[Push] échec envoi", { error: e.message });
  }
}
