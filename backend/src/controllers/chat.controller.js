/**
 * Chat privé restaurateur ↔ client
 * Messages liés à une réservation (conversations par réservation)
 */
import { query } from "../config/db.js";
import { ok, created, badRequest, forbidden, notFound } from "../utils/response.js";

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/chat/:reservation_id
────────────────────────────────────────────────────────────────────────── */
export const getMessages = async (req, res, next) => {
  try {
    const { reservation_id } = req.params;
    const userId = req.user.id;
    const role   = req.user.role;

    // Vérifier accès (client_id dans reservations, owner_id dans restaurants)
    const { rows: check } = await query(
      `SELECT r.id, r.client_id, rest.owner_id
       FROM reservations r
       JOIN restaurants rest ON rest.id = r.restaurant_id
       WHERE r.id = $1`,
      [reservation_id]
    );
    if (!check.length) return notFound(res, "Réservation introuvable");

    const resa = check[0];
    const ok2 = role === "admin" || resa.client_id === userId || resa.owner_id === userId;
    if (!ok2) return forbidden(res, "Accès refusé");

    const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const { rows } = await query(
      `SELECT m.id, m.content, m.created_at, m.sender_id, m.is_read,
              u.full_name AS sender_name, u.role AS sender_role
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.reservation_id = $1
       ORDER BY m.created_at ASC
       LIMIT $2 OFFSET $3`,
      [reservation_id, limit, offset]
    );

    // Marquer les messages reçus comme lus
    await query(
      `UPDATE messages SET is_read = true
       WHERE reservation_id = $1 AND sender_id != $2 AND is_read = false`,
      [reservation_id, userId]
    );

    return ok(res, rows);
  } catch (err) { next(err); }
};

/* ──────────────────────────────────────────────────────────────────────────
   POST /api/v1/chat/:reservation_id
────────────────────────────────────────────────────────────────────────── */
export const sendMessage = async (req, res, next) => {
  try {
    const { reservation_id } = req.params;
    const { content }        = req.body;
    const userId = req.user.id;
    const role   = req.user.role;

    if (!content?.trim()) return badRequest(res, "Message vide");

    const { rows: check } = await query(
      `SELECT r.id, r.client_id, rest.owner_id
       FROM reservations r
       JOIN restaurants rest ON rest.id = r.restaurant_id
       WHERE r.id = $1`,
      [reservation_id]
    );
    if (!check.length) return notFound(res, "Réservation introuvable");

    const resa = check[0];
    const hasAccess = role === "admin" || resa.client_id === userId || resa.owner_id === userId;
    if (!hasAccess) return forbidden(res, "Accès refusé");

    const { rows } = await query(
      `INSERT INTO messages (reservation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, content, created_at, sender_id, is_read`,
      [reservation_id, userId, content.trim()]
    );

    const msg = { ...rows[0], sender_name: req.user.full_name, sender_role: role };

    // Notif in-app pour le destinataire
    const recipientId = userId === resa.client_id ? resa.owner_id : resa.client_id;
    await query(
      `INSERT INTO user_notifications (user_id, type, title, body, meta)
       VALUES ($1, 'message', 'Nouveau message', $2, $3)`,
      [
        recipientId,
        `${req.user.full_name} vous a envoyé un message`,
        JSON.stringify({ reservation_id, sender_name: req.user.full_name }),
      ]
    ).catch(() => {});

    return created(res, msg, "Message envoyé");
  } catch (err) { next(err); }
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/chat/conversations
────────────────────────────────────────────────────────────────────────── */
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    let rows;

    if (role === "restaurateur") {
      // Toutes les conversations des réservations de ce resto
      const result = await query(
        `SELECT DISTINCT ON (r.id)
           r.id AS reservation_id, r.ref,
           u.full_name AS client_name, u.id AS client_id,
           rest.name AS resto_name,
           m.content AS last_message, m.created_at AS last_message_at,
           (SELECT COUNT(*) FROM messages m2
            WHERE m2.reservation_id = r.id AND m2.sender_id != $1 AND m2.is_read = false
           ) AS unread_count
         FROM reservations r
         JOIN restaurants rest ON rest.id = r.restaurant_id AND rest.owner_id = $1
         JOIN users u ON u.id = r.client_id
         JOIN messages m ON m.reservation_id = r.id
         ORDER BY r.id, m.created_at DESC`,
        [userId]
      );
      rows = result.rows;
    } else {
      // Conversations du client
      const result = await query(
        `SELECT DISTINCT ON (r.id)
           r.id AS reservation_id, r.ref,
           rest.name AS resto_name, rest.id AS resto_id,
           ru.full_name AS owner_name,
           m.content AS last_message, m.created_at AS last_message_at,
           (SELECT COUNT(*) FROM messages m2
            WHERE m2.reservation_id = r.id AND m2.sender_id != $1 AND m2.is_read = false
           ) AS unread_count
         FROM reservations r
         JOIN restaurants rest ON rest.id = r.restaurant_id
         JOIN users ru ON ru.id = rest.owner_id
         JOIN messages m ON m.reservation_id = r.id
         WHERE r.client_id = $1
         ORDER BY r.id, m.created_at DESC`,
        [userId]
      );
      rows = result.rows;
    }

    return ok(res, rows);
  } catch (err) { next(err); }
};
