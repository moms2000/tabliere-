/**
 * Opérations Événement — commandes de bouteilles (scan QR par les invités) et
 * check-in à l'entrée. Accès organisateur propriétaire OU staff (via ownerOrStaff),
 * sauf la création de commande qui est publique (invité qui scanne une table).
 */
import { query } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";

const ORDER_STATUSES = ["en_attente", "servi", "paye", "annule"];

// ── POST /event-orders — commande d'un invité (public, scan QR) ────────────────
export const createOrder = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.slug && !b.event_id) throw new AppError("Événement requis", 400);
  const { rows: [event] } = await query(
    `SELECT id, status, bottles_enabled FROM events WHERE ${b.slug ? "slug = $1" : "id = $1"}`,
    [b.slug || b.event_id]
  );
  if (!event) return notFound(res, "Événement introuvable");
  if (event.status !== "publie" || !event.bottles_enabled) throw new AppError("Les commandes ne sont pas ouvertes", 400);
  if (!Array.isArray(b.items) || b.items.length === 0) throw new AppError("Panier vide", 400);

  // Total serveur (jamais confiance au client)
  const items = b.items.map(it => {
    const price = Number(it.price); const qty = Number(it.qty);
    return { name: String(it.name || "Article").slice(0, 120),
             price: Number.isFinite(price) && price >= 0 ? Math.round(price) : 0,
             qty: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1 };
  });
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);

  let tableLabel = b.table_label || null, tableId = null;
  if (b.table_id) {
    const { rows: [t] } = await query("SELECT id, label FROM event_tables WHERE id = $1 AND event_id = $2", [b.table_id, event.id]);
    if (t) { tableId = t.id; tableLabel = tableLabel || t.label; }
  }

  const { rows: [order] } = await query(
    `INSERT INTO event_orders (ref, event_id, table_id, table_label, guest_name, items, total, note)
     VALUES ('EVO-' || LPAD(nextval('event_order_ref_seq')::text, 4, '0'), $1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [event.id, tableId, tableLabel, b.guest_name || null, JSON.stringify(items), total, b.note || null]
  );
  return created(res, { order }, "Commande envoyée");
});

// ── GET /event-orders?event_id= — tableau des commandes (organisateur/staff) ──
export const listOrders = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT o.*, t.kind AS table_kind FROM event_orders o
     LEFT JOIN event_tables t ON t.id = o.table_id
     WHERE o.event_id = $1 ORDER BY o.created_at DESC LIMIT 300`,
    [req.eventScope]
  );
  return ok(res, { orders: rows });
});

// ── PATCH /event-orders/:id/status ────────────────────────────────────────────
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const status = req.body?.status;
  if (!ORDER_STATUSES.includes(status)) throw new AppError("Statut invalide", 400);
  const { rows: [order] } = await query(
    "UPDATE event_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND event_id = $3 RETURNING *",
    [status, req.params.id, req.eventScope]
  );
  if (!order) return notFound(res, "Commande introuvable");
  return ok(res, { order }, "Commande mise à jour");
});

// ── GET /event-checkin?event_id= — liste des arrivées (organisateur/staff) ────
export const listCheckin = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.ref, r.party_size, r.status, r.checked_in_at, r.promoter_code,
            COALESCE(r.guest_name, u.full_name) AS client_name,
            COALESCE(r.guest_phone, u.phone)    AS client_phone,
            t.label AS table_label, t.kind AS table_kind
     FROM event_reservations r
     LEFT JOIN users u ON u.id = r.client_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.event_id = $1 AND r.status <> 'annule'
     ORDER BY r.checked_in_at NULLS FIRST, r.created_at DESC`,
    [req.eventScope]
  );
  const arrived = rows.filter(r => r.checked_in_at).length;
  return ok(res, { reservations: rows, totals: { total: rows.length, arrived, covers: rows.reduce((a, c) => a + (c.party_size || 0), 0) } });
});

// ── POST /event-checkin/:resaId — pointer une arrivée (organisateur/staff) ────
export const doCheckin = asyncHandler(async (req, res) => {
  const undo = req.body?.undo === true;
  const { rows: [resa] } = await query(
    `UPDATE event_reservations SET checked_in_at = ${undo ? "NULL" : "NOW()"}, updated_at = NOW()
     WHERE id = $1 AND event_id = $2 RETURNING id, ref, checked_in_at`,
    [req.params.resaId, req.eventScope]
  );
  if (!resa) return notFound(res, "Réservation introuvable");
  return ok(res, { reservation: resa }, undo ? "Check-in annulé" : "Arrivée confirmée");
});

// ── POST /event-checkin/by-ref — pointer via QR (ref scannée) ─────────────────
export const checkinByRef = asyncHandler(async (req, res) => {
  const ref = String(req.body?.ref || "").trim().toUpperCase();
  if (!ref) throw new AppError("Référence requise", 400);
  const { rows: [resa] } = await query(
    `UPDATE event_reservations SET checked_in_at = NOW(), updated_at = NOW()
     WHERE ref = $1 AND event_id = $2 AND status <> 'annule'
     RETURNING id, ref, party_size, checked_in_at`,
    [ref, req.eventScope]
  );
  if (!resa) return notFound(res, "Réservation introuvable pour cet événement");
  return ok(res, { reservation: resa }, "Arrivée confirmée");
});
