/**
 * Notifications utilisateur
 */
import { query } from "../config/db.js";
import { ok, created } from "../utils/response.js";

/* GET /api/v1/notifications — liste les notifs de l'user connecté */
export const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit  = Math.min(parseInt(req.query.limit) || 30, 100);

    const { rows } = await query(
      `SELECT id, type, title, body, meta, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const unread = rows.filter(n => !n.is_read).length;
    return ok(res, { notifications: rows, unread });
  } catch (err) { next(err); }
};

/* PATCH /api/v1/notifications/read-all — marque tout comme lu */
export const markAllRead = async (req, res, next) => {
  try {
    await query(
      "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
      [req.user.id]
    );
    return ok(res, null, "Notifications marquées comme lues");
  } catch (err) { next(err); }
};

/* PATCH /api/v1/notifications/:id/read */
export const markOneRead = async (req, res, next) => {
  try {
    await query(
      "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    return ok(res, null, "Notification lue");
  } catch (err) { next(err); }
};
