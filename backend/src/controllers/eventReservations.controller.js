/**
 * Event Reservations Controller — réservations de tables / packs VIP d'un événement.
 * Cash sur place, aucun paiement in-app. L'organisateur confirme les demandes.
 * Statuts VARCHAR : en_attente | confirme | annule | termine.
 */
import { query, withTransaction } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";

async function resaById(id) {
  const { rows } = await query(
    `SELECT r.*, e.owner_id, e.name AS event_name, e.slug AS event_slug
     FROM event_reservations r JOIN events e ON e.id = r.event_id
     WHERE r.id = $1`, [id]
  );
  return rows[0] || null;
}

function assertOwner(req, resa) {
  if (req.user.role === "admin") return;
  if (resa && resa.owner_id === req.user.id) return;
  throw new AppError("Accès refusé", 403);
}
function assertOwnerOrClient(req, resa) {
  if (req.user.role === "admin") return;
  if (resa && (resa.owner_id === req.user.id || resa.client_id === req.user.id)) return;
  throw new AppError("Accès refusé", 403);
}

// ── POST /event-reservations — réserver (client connecté) ────────────────────
export const createEventReservation = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const slug = b.slug;
  if (!slug && !b.event_id) throw new AppError("Événement requis", 400);

  const { rows: [event] } = await query(
    `SELECT * FROM events WHERE ${slug ? "slug = $1" : "id = $1"}`, [slug || b.event_id]
  );
  if (!event) return notFound(res, "Événement introuvable");
  if (event.status !== "publie") throw new AppError("Cet événement n'accepte pas encore de réservations", 400);

  const partySize = Math.max(1, parseInt(b.party_size, 10) || 1);
  const promoter = b.promoter_code ? String(b.promoter_code).trim().toUpperCase().slice(0, 30) : null;

  // Verrou + vérification dans une transaction (anti-double-booking) + contrôle capacité.
  const resa = await withTransaction(async (client) => {
    let tableId = null;
    if (b.table_id) {
      const { rows: [t] } = await client.query(
        "SELECT id, status, is_active, capacity FROM event_tables WHERE id = $1 AND event_id = $2 FOR UPDATE",
        [b.table_id, event.id]
      );
      if (!t || !t.is_active) throw new AppError("Table introuvable", 404);
      if (t.status !== "libre") throw new AppError("Cette table n'est plus disponible", 409);
      if (t.capacity && partySize > t.capacity)
        throw new AppError(`Cette table accueille au maximum ${t.capacity} personnes`, 400);
      tableId = t.id;
    }
    const { rows: [r] } = await client.query(
      `INSERT INTO event_reservations
         (ref, event_id, client_id, table_id, party_size, guest_name, guest_phone, special_request, promoter_code, status)
       VALUES ('EVT-' || LPAD(nextval('event_resa_ref_seq')::text, 4, '0'),
               $1, $2, $3, $4, $5, $6, $7, $8, 'en_attente')
       RETURNING *`,
      [event.id, req.user.id, tableId, partySize,
       b.guest_name || null, b.guest_phone || null, b.special_request || null, promoter]
    );
    if (tableId) {
      await client.query("UPDATE event_tables SET status = 'reserve', updated_at = NOW() WHERE id = $1", [tableId]);
    }
    return r;
  });
  return created(res, { reservation: resa }, "Demande de réservation envoyée");
});

// ── GET /event-reservations?event_id= — liste pour l'organisateur ────────────
export const listForEvent = asyncHandler(async (req, res) => {
  const eventId = req.query.event_id;
  if (!eventId) throw new AppError("event_id requis", 400);
  const { rows: [event] } = await query("SELECT id, owner_id FROM events WHERE id = $1", [eventId]);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);

  const { rows } = await query(
    `SELECT r.*,
            COALESCE(r.guest_name, u.full_name) AS client_name,
            COALESCE(r.guest_phone, u.phone)    AS client_phone,
            u.email AS client_email,
            t.label AS table_label, t.kind AS table_kind, t.price AS table_price
     FROM event_reservations r
     JOIN users u ON u.id = r.client_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.event_id = $1
     ORDER BY r.created_at DESC`, [eventId]
  );
  return ok(res, { reservations: rows });
});

// ── GET /event-reservations/mine — réservations du client connecté ───────────
export const listMine = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, e.name AS event_name, e.slug AS event_slug, e.starts_at, e.venue_name,
            t.label AS table_label, t.kind AS table_kind
     FROM event_reservations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.client_id = $1
     ORDER BY e.starts_at DESC`, [req.user.id]
  );
  return ok(res, { reservations: rows });
});

// ── PATCH /event-reservations/:id/confirm — organisateur confirme ────────────
export const confirmEventReservation = asyncHandler(async (req, res) => {
  const resa = await resaById(req.params.id);
  if (!resa) return notFound(res, "Réservation introuvable");
  assertOwner(req, resa);
  if (resa.status === "annule") throw new AppError("Cette réservation est annulée", 400);
  const { rows: [updated] } = await query(
    "UPDATE event_reservations SET status = 'confirme', confirmed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    [resa.id]
  );
  return ok(res, { reservation: updated }, "Réservation confirmée");
});

// ── PATCH /event-reservations/:id/cancel — organisateur ou client annule ─────
export const cancelEventReservation = asyncHandler(async (req, res) => {
  const resa = await resaById(req.params.id);
  if (!resa) return notFound(res, "Réservation introuvable");
  assertOwnerOrClient(req, resa);
  const { rows: [updated] } = await query(
    "UPDATE event_reservations SET status = 'annule', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    [resa.id]
  );
  // Libérer la table SEULEMENT si aucune autre réservation active ne la détient
  if (resa.table_id) {
    await query(
      `UPDATE event_tables SET status = 'libre', updated_at = NOW()
       WHERE id = $1 AND NOT EXISTS (
         SELECT 1 FROM event_reservations
         WHERE table_id = $1 AND status IN ('en_attente','confirme') AND id <> $2
       )`,
      [resa.table_id, resa.id]
    );
  }
  return ok(res, { reservation: updated }, "Réservation annulée");
});
