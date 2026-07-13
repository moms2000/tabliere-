/**
 * Opérations Événement — commandes de bouteilles (scan QR par les invités) et
 * check-in à l'entrée. Accès organisateur propriétaire OU staff (via ownerOrStaff),
 * sauf la création de commande qui est publique (invité qui scanne une table).
 */
import { query } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";

const ORDER_STATUSES = ["en_attente", "servi", "paye", "annule"];

// Le propriétaire (req.user, pas de req.staff) a tous les droits.
// Un staff est limité à son rôle : 'all' partout, 'bar' = commandes, 'checkin' = entrées.
function assertStaffRole(req, allowed) {
  if (!req.staff) return; // organisateur / admin
  if (req.staff.role === "all" || allowed.includes(req.staff.role)) return;
  throw new AppError("Action non autorisée pour ce rôle staff", 403);
}

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

  // Prix SERVEUR depuis la carte (jamais confiance au prix envoyé par le client)
  const ids = [...new Set(b.items.map(it => it.id).filter(Boolean))];
  const { rows: bRows } = ids.length
    ? await query("SELECT id, name, price FROM event_bottles WHERE event_id = $1 AND id = ANY($2) AND is_active = TRUE", [event.id, ids])
    : { rows: [] };
  const bMap = new Map(bRows.map(x => [String(x.id), x]));
  const items = b.items.map(it => {
    const m = bMap.get(String(it.id));
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    return m
      ? { id: m.id, name: m.name, price: Number(m.price) || 0, qty }
      : { name: String(it.name || "Article").slice(0, 120), price: 0, qty };
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
  assertStaffRole(req, ["bar"]);
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
  assertStaffRole(req, ["bar"]);
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
  assertStaffRole(req, ["checkin"]);
  const { rows } = await query(
    `SELECT r.id, r.ref, r.party_size, r.arrived_size, r.status, r.checked_in_at, r.promoter_code,
            r.special_request, r.created_at,
            COALESCE(r.guest_name, u.full_name) AS client_name,
            COALESCE(r.guest_phone, u.phone)    AS client_phone,
            t.label AS table_label, t.kind AS table_kind, t.price AS table_price, t.capacity AS table_capacity
     FROM event_reservations r
     LEFT JOIN users u ON u.id = r.client_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.event_id = $1 AND r.status = 'confirme'
     ORDER BY r.checked_in_at NULLS FIRST, r.created_at DESC`,
    [req.eventScope]
  );
  const arrivedRows = rows.filter(r => r.checked_in_at);
  // Personnes réellement arrivées = arrived_size si saisi, sinon party_size
  const arrivedPax = (r) => (r.arrived_size != null ? r.arrived_size : (r.party_size || 0));
  const { rows: [ev] } = await query("SELECT capacity FROM events WHERE id = $1", [req.eventScope]);
  const arrivedCovers = arrivedRows.reduce((a, c) => a + arrivedPax(c), 0);
  const capacity = ev?.capacity ?? null;
  return ok(res, {
    reservations: rows,
    totals: {
      total: rows.length,
      arrived: arrivedRows.length,
      arrived_covers: arrivedCovers,
      covers: rows.reduce((a, c) => a + (c.party_size || 0), 0),
      capacity,
      remaining: capacity != null ? Math.max(0, capacity - arrivedCovers) : null,
    },
  });
});

// Marque (ou libère) la table d'une réservation à l'arrivée
async function syncTableStatus(resaId, occupied) {
  await query(
    `UPDATE event_tables SET status = $1, updated_at = NOW()
     WHERE id = (SELECT table_id FROM event_reservations WHERE id = $2) AND status <> $1`,
    [occupied ? "occupe" : "reserve", resaId]
  ).catch(() => {});
}
// Nombre de personnes arrivées (saisi au check-in), borné ; défaut = party_size
const arrivedFromBody = (body, fallback) => {
  const n = parseInt(body?.arrived_size, 10);
  return Number.isFinite(n) && n >= 0 ? n : (fallback ?? null);
};

// Capacité du salon/table d'une réservation (null = pas de table / pas de limite)
async function tableCapacityForResa(resaId) {
  const { rows: [r] } = await query(
    `SELECT t.capacity FROM event_reservations er
     JOIN event_tables t ON t.id = er.table_id WHERE er.id = $1`, [resaId]
  );
  return r?.capacity ?? null;
}
// Refuse un nombre d'arrivées supérieur à la capacité du salon
async function assertArrivedFits(resaId, arrived) {
  if (arrived == null) return;
  const cap = await tableCapacityForResa(resaId);
  if (cap && arrived > cap) {
    throw new AppError(`Ce salon accueille au maximum ${cap} personnes (vous avez saisi ${arrived}).`, 400);
  }
}

// ── POST /event-checkin/:resaId — pointer une arrivée (organisateur/staff) ────
export const doCheckin = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["checkin"]);
  const undo = req.body?.undo === true;
  const arrived = undo ? null : arrivedFromBody(req.body);
  if (!undo) await assertArrivedFits(req.params.resaId, arrived);
  const { rows: [resa] } = await query(
    `UPDATE event_reservations
       SET checked_in_at = ${undo ? "NULL" : "NOW()"},
           arrived_size  = ${undo ? "NULL" : "COALESCE($3, party_size)"},
           updated_at = NOW()
     WHERE id = $1 AND event_id = $2
     RETURNING id, ref, party_size, arrived_size, checked_in_at, table_id`,
    undo ? [req.params.resaId, req.eventScope] : [req.params.resaId, req.eventScope, arrived]
  );
  if (!resa) return notFound(res, "Réservation introuvable");
  if (resa.table_id) await syncTableStatus(resa.id, !undo);
  return ok(res, { reservation: resa }, undo ? "Check-in annulé" : "Arrivée confirmée");
});

// ── POST /event-checkin/by-ref — pointer via QR (ref scannée) ─────────────────
export const checkinByRef = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["checkin"]);
  const ref = String(req.body?.ref || "").trim().toUpperCase();
  if (!ref) throw new AppError("Référence requise", 400);
  const arrived = arrivedFromBody(req.body);
  // On vérifie d'abord l'existence + le statut pour un message clair
  const { rows: [found] } = await query(
    "SELECT id, status FROM event_reservations WHERE ref = $1 AND event_id = $2", [ref, req.eventScope]
  );
  if (!found) return notFound(res, "Réservation introuvable pour cet événement");
  if (found.status !== "confirme") {
    throw new AppError(
      found.status === "annule"
        ? "Cette réservation est annulée."
        : "Réservation non confirmée — l'organisateur doit la valider avant le check-in.",
      400
    );
  }
  await assertArrivedFits(found.id, arrived);
  const { rows: [resa] } = await query(
    `UPDATE event_reservations
       SET checked_in_at = NOW(), arrived_size = COALESCE($3, party_size), updated_at = NOW()
     WHERE id = $1 AND event_id = $2
     RETURNING id, ref, party_size, arrived_size, checked_in_at, table_id`,
    [found.id, req.eventScope, arrived]
  );
  if (resa.table_id) await syncTableStatus(resa.id, true);
  return ok(res, { reservation: resa }, "Arrivée confirmée");
});
