/**
 * Notifications in-app (table user_notifications)
 */
import { query } from "../config/db.js";
import { ok } from "../utils/response.js";

// POST /notifications/device — enregistrement PUBLIC d'un jeton push (appareil
// anonyme : app installée sans connexion). Aucun compte rattaché. Dès que la
// personne se connecte, l'app ré-enregistre via /users/me/device-token, ce qui
// rattache le jeton à son compte (ON CONFLICT (token) → user_id). Ne bloque jamais.
export const registerDeviceAnon = async (req, res, next) => {
  try {
    const token = String(req.body?.token || "");
    const platform = (String(req.body?.platform || "").slice(0, 10)) || null;
    if (token) {
      await query(
        `INSERT INTO device_tokens (user_id, token, platform)
         VALUES (NULL, $1, $2)
         ON CONFLICT (token) DO UPDATE SET platform = EXCLUDED.platform`,
        [token, platform]
      ).catch(() => {});
    }
    return ok(res, null, "Appareil enregistré");
  } catch (e) { next(e); }
};

export const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit  = Math.min(parseInt(req.query.limit) || 30, 100);

    const { rows } = await query(
      `SELECT id, type, title, body, meta, is_read, created_at
       FROM user_notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const unread = rows.filter(n => !n.is_read).length;
    return ok(res, { notifications: rows, unread });
  } catch (err) { next(err); }
};

export const markAllRead = async (req, res, next) => {
  try {
    await query(
      "UPDATE user_notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
      [req.user.id]
    );
    return ok(res, null, "Notifications lues");
  } catch (err) { next(err); }
};

export const markOneRead = async (req, res, next) => {
  try {
    await query(
      "UPDATE user_notifications SET is_read = true WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    return ok(res, null, "Notification lue");
  } catch (err) { next(err); }
};
