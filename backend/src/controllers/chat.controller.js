/**
 * Chat privé restaurateur ↔ client
 * Les messages sont liés à une réservation (conversation par réservation)
 */
import { query }  from "../config/db.js";
import { ok, created, badRequest, forbidden, notFound, paginated } from "../utils/response.js";

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/chat/:reservation_id
   Récupère les messages d'une conversation
────────────────────────────────────────────────────────────────────────── */
export const getMessages = async (req, res, next) => {
  try {
    const { reservation_id } = req.params;
    const userId = req.user.id;
    const role   = req.user.role;

    // Vérifier que l'utilisateur a accès à cette réservation
    const resaCheck = await query(
      `SELECT r.id, r.user_id, rest.user_id AS owner_id
       FROM reservations r
       JOIN restaurants rest ON rest.id = r.restaurant_id
       WHERE r.id = $1`,
      [reservation_id]
    );
    if (!resaCheck.rows.length) return notFound(res, "Réservation introuvable");

    const resa = resaCheck.rows[0];
    const hasAccess = role === "admin" ||
                      resa.user_id === userId ||
                      resa.owner_id === userId;
    if (!hasAccess) return forbidden(res, "Accès refusé à cette conversation");

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

    // Marquer les messages non lus comme lus
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
   Envoyer un message
────────────────────────────────────────────────────────────────────────── */
export const sendMessage = async (req, res, next) => {
  try {
    const { reservation_id } = req.params;
    const { content }        = req.body;
    const userId = req.user.id;
    const role   = req.user.role;

    if (!content?.trim()) return badRequest(res, "Le message ne peut pas être vide");

    // Vérifier accès
    const resaCheck = await query(
      `SELECT r.id, r.user_id, rest.user_id AS owner_id
       FROM reservations r
       JOIN restaurants rest ON rest.id = r.restaurant_id
       WHERE r.id = $1`,
      [reservation_id]
    );
    if (!resaCheck.rows.length) return notFound(res, "Réservation introuvable");

    const resa = resaCheck.rows[0];
    const hasAccess = role === "admin" ||
                      resa.user_id === userId ||
                      resa.owner_id === userId;
    if (!hasAccess) return forbidden(res, "Accès refusé");

    const { rows } = await query(
      `INSERT INTO messages (reservation_id, sender_id, content, is_read)
       VALUES ($1, $2, $3, false)
       RETURNING id, content, created_at, sender_id, is_read`,
      [reservation_id, userId, content.trim()]
    );

    const msg = { ...rows[0], sender_name: req.user.full_name, sender_role: role };

    // Créer une notification pour le destinataire
    const recipientId = userId === resa.user_id ? resa.owner_id : resa.user_id;
    await query(
      `INSERT INTO notifications (user_id, type, title, body, meta)
       VALUES ($1, 'message', 'Nouveau message', $2, $3)`,
      [
        recipientId,
        `${req.user.full_name} vous a envoyé un message`,
        JSON.stringify({ reservation_id, sender_name: req.user.full_name }),
      ]
    ).catch(() => {}); // Non bloquant

    return created(res, msg, "Message envoyé");
  } catch (err) { next(err); }
};

/* ──────────────────────────────────────────────────────────────────────────
   GET /api/v1/chat/conversations
   Liste toutes les conversations de l'utilisateur connecté
────────────────────────────────────────────────────────────────────────── */
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role   = req.user.role;

    let sql;
    if (role === "restaurateur") {
      sql = `
        SELECT DISTINCT ON (r.id)
          r.id AS reservation_id, r.ref, r.reserved_at,
          u.full_name AS client_name, u.id AS client_id,
          rest.name AS resto_name,
          m.content AS last_message, m.created_at AS last_message_at,
          COUNT(m2.id) FILTER (WHERE m2.is_read = false AND m2.sender_id != $1) AS unread_count
        FROM reservations r
        JOIN restaurants rest ON rest.id = r.restaurant_id AND rest.user_id = $1
        JOIN users u ON u.id = r.user_id
        LEFT JOIN messages m ON m.reservation_id = r.id
        LEFT JOIN messages m2 ON m2.reservation_id = r.id
        WHERE EXISTS (SELECT 1 FROM messages WHERE reservation_id = r.id)
        GROUP BY r.id, r.ref, r.reserved_at, u.full_name, u.id, rest.name, m.content, m.created_at
        ORDER BY r.id, m.created_at DESC
      `;
    } else {
      sql = `
        SELECT DISTINCT ON (r.id)
          r.id AS reservation_id, r.ref, r.reserved_at,
          rest.name AS resto_name, rest.id AS resto_id,
          ru.full_name AS owner_name,
          m.content AS last_message, m.created_at AS last_message_at,
          COUNT(m2.id) FILTER (WHERE m2.is_read = false AND m2.sender_id != $1) AS unread_count
        FROM reservations r
        JOIN restaurants rest ON rest.id = r.restaurant_id
        JOIN users ru ON ru.id = rest.user_id
        LEFT JOIN messages m ON m.reservation_id = r.id
        LEFT JOIN messages m2 ON m2.reservation_id = r.id
        WHERE r.user_id = $1
          AND EXISTS (SELECT 1 FROM messages WHERE reservation_id = r.id)
        GROUP BY r.id, r.ref, r.reserved_at, rest.name, rest.id, ru.full_name, m.content, m.created_at
        ORDER BY r.id, m.created_at DESC
      `;
    }

    const { rows } = await query(sql, [userId]);
    return ok(res, rows);
  } catch (err) { next(err); }
};
