import axios from "axios";
import { query } from "../config/db.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Envoie une notification push aux appareils d'un utilisateur (via FCM).
 * - Récupère les tokens enregistrés (table device_tokens).
 * - Si FCM_SERVER_KEY est défini, envoie via Firebase Cloud Messaging.
 * - Sinon, log en mode simulation (n'échoue jamais).
 *
 * Prérequis prod : créer un projet Firebase, activer Cloud Messaging, et
 * définir FCM_SERVER_KEY. Pour iOS, uploader la clé APNs (.p8) dans Firebase.
 */
export async function sendPushToUser(userId, { title, body, data = {} }) {
  if (!userId || !title) return;
  const { rows } = await query(
    "SELECT token FROM device_tokens WHERE user_id = $1", [userId]
  ).catch(() => ({ rows: [] }));
  if (!rows.length) return;

  if (!env.FCM_SERVER_KEY) {
    logger.info("[Push MOCK]", { userId, title, appareils: rows.length });
    return;
  }

  const tokens = rows.map((r) => r.token);
  try {
    await axios.post(
      "https://fcm.googleapis.com/fcm/send",
      {
        registration_ids: tokens,
        notification: { title, body, sound: "default" },
        data: { ...data },
        priority: "high",
      },
      { headers: { Authorization: `key=${env.FCM_SERVER_KEY}`, "Content-Type": "application/json" }, timeout: 8000 }
    );
    logger.info("[Push] envoyée", { userId, count: tokens.length });
  } catch (e) {
    logger.warn("[Push] échec", { error: e.response?.data || e.message });
  }
}
