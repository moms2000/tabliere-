/**
 * Reservations Controller — TablièreCI
 * create | list | getOne | confirm | cancel
 */

import { query, withTransaction } from "../config/db.js";
import { cache }  from "../config/redis.js";
import { ok, created, notFound, forbidden, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { notificationQueue }      from "../queues/index.js";
import { logger }                 from "../utils/logger.js";
import { emitToUser }             from "../utils/sse.js";

// ── POST /reservations ────────────────────────────────────────────────────────
export const create = asyncHandler(async (req, res) => {
  const { restaurant_id, table_id, reserved_at, party_size, special_request } = req.body;

  // Vérifier que le restaurant est actif
  const { rows: [resto] } = await query(
    "SELECT id, name, capacity FROM restaurants WHERE id = $1 AND status = 'actif'",
    [restaurant_id]
  );
  if (!resto) throw new AppError("Restaurant introuvable ou inactif", 404);
  if (party_size > resto.capacity) throw new AppError(`Ce restaurant accepte au maximum ${resto.capacity} couverts`, 400);

  // Vérifier que la table n'est pas déjà réservée sur ce créneau
  if (table_id) {
    const { rows: [conflict] } = await query(
      `SELECT id FROM reservations
       WHERE table_id = $1
         AND reserved_at::date = $2::date
         AND ABS(EXTRACT(EPOCH FROM (reserved_at - $2::timestamptz))) < 7200
         AND status IN ('en_attente','confirme')`,
      [table_id, reserved_at]
    );
    if (conflict) throw new AppError("Cette table est déjà réservée sur ce créneau", 409);
  }

  // Générer un ref unique RES-XXXX
  const { rows: [{ nextref }] } = await query(
    "SELECT 'RES-' || LPAD((COUNT(*) + 1)::text, 4, '0') AS nextref FROM reservations"
  );

  const resa = await withTransaction(async (client) => {
    const { rows: [newResa] } = await client.query(
      `INSERT INTO reservations
         (ref, restaurant_id, client_id, table_id, reserved_at, party_size, special_request, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'en_attente')
       RETURNING *`,
      [nextref, restaurant_id, req.user.id, table_id || null, reserved_at, party_size, special_request || null]
    );

    // Marquer la table comme réservée
    if (table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'reserve' WHERE id = $1",
        [table_id]
      );
    }

    return newResa;
  });

  // SSE temps réel → restaurateur (récupérer l'owner du resto)
  try {
    const { rows: [owner] } = await query(
      "SELECT owner_id FROM restaurants WHERE id = $1", [restaurant_id]
    );
    if (owner?.owner_id) {
      emitToUser(owner.owner_id, "new_reservation", {
        ref:        resa.ref,
        party_size: resa.party_size,
        reserved_at: resa.reserved_at,
        client_name: req.user.full_name || req.user.email,
      });
    }
    // Notifier les admins aussi
    emitToUser("admin", "new_reservation", { ref: resa.ref, resto: resto.name });
  } catch (_) {}

  // Notification WhatsApp asynchrone
  await notificationQueue.add("confirmation", {
    userId:         req.user.id,
    restoName:      resto.name,
    reservedAt:     reserved_at,
    partySize:      party_size,
    reservationRef: resa.ref,
  }).catch(() => {}); // ne pas bloquer si Redis absent

  logger.info("Réservation créée", { resaId: resa.id, ref: resa.ref, userId: req.user.id });
  return created(res, { reservation: resa }, "Réservation créée avec succès");
});

// ── GET /reservations ─────────────────────────────────────────────────────────
export const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, date } = req.query;
  const offset = (page - 1) * limit;
  const isAdmin = req.user.role === "admin";
  const isResto = req.user.role === "restaurateur";

  const params = [];
  const conditions = [];

  if (isResto) {
    params.push(req.user.restaurant_id);
    conditions.push(`r.restaurant_id = $${params.length}`);
  } else if (!isAdmin) {
    params.push(req.user.id);
    conditions.push(`r.client_id = $${params.length}`);
  }

  if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }
  if (date)   { params.push(date);   conditions.push(`r.reserved_at::date = $${params.length}::date`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT r.*, re.name AS resto_name, re.slug AS resto_slug,
            u.full_name AS client_name, u.phone AS client_phone,
            t.label AS table_label, t.zone AS table_zone
     FROM reservations r
     JOIN restaurants re ON re.id = r.restaurant_id
     JOIN users u ON u.id = r.client_id
     LEFT JOIN restaurant_tables t ON t.id = r.table_id
     ${where}
     ORDER BY r.reserved_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM reservations r ${where}`, params
  );

  return paginated(res, rows, +count, +page, +limit);
});

// ── GET /reservations/:id ─────────────────────────────────────────────────────
export const getOne = asyncHandler(async (req, res) => {
  const { rows: [resa] } = await query(
    `SELECT r.*, re.name AS resto_name, re.slug AS resto_slug, re.address, re.phone AS resto_phone,
            u.full_name AS client_name, u.phone AS client_phone,
            t.label AS table_label, t.zone AS table_zone,
            p.status AS payment_status, p.method AS payment_method, p.amount AS payment_amount
     FROM reservations r
     JOIN restaurants re ON re.id = r.restaurant_id
     JOIN users u ON u.id = r.client_id
     LEFT JOIN restaurant_tables t ON t.id = r.table_id
     LEFT JOIN payments p ON p.reservation_id = r.id
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  // Vérifier droits d'accès
  _assertAccess(req, resa);

  return ok(res, { reservation: resa });
});

// ── PATCH /reservations/:id/confirm ──────────────────────────────────────────
// Accepte un table_id optionnel dans le body pour assigner la table au moment de la confirmation
export const confirm = asyncHandler(async (req, res) => {
  const { table_id } = req.body; // optionnel

  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  if (req.user.role === "restaurateur" && req.user.restaurant_id !== resa.restaurant_id) {
    throw new AppError("Accès refusé", 403);
  }
  if (resa.status !== "en_attente") throw new AppError("Seules les réservations en attente peuvent être confirmées", 400);

  // Vérifier que la table appartient bien au restaurant et est libre
  if (table_id) {
    const { rows: [tbl] } = await query(
      "SELECT id, status FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2",
      [table_id, resa.restaurant_id]
    );
    if (!tbl) throw new AppError("Table introuvable dans ce restaurant", 404);
    if (tbl.status === "occupe") throw new AppError("Cette table est déjà occupée", 409);
  }

  const updated = await withTransaction(async (client) => {
    // Si on change de table, libérer l'ancienne
    if (resa.table_id && resa.table_id !== table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'libre' WHERE id = $1",
        [resa.table_id]
      );
    }

    const { rows: [r] } = await client.query(
      `UPDATE reservations
       SET status = 'confirme', confirmed_at = NOW(), updated_at = NOW(),
           table_id = COALESCE($2, table_id)
       WHERE id = $1 RETURNING *`,
      [req.params.id, table_id || null]
    );

    // Marquer la nouvelle table comme réservée
    if (table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'reserve' WHERE id = $1",
        [table_id]
      );
    }

    return r;
  });

  await notificationQueue.add("confirmation_client", { reservationId: resa.id }).catch(() => {});

  // SSE temps réel → client
  try {
    emitToUser(resa.client_id, "reservation_confirmed", {
      ref:        resa.ref,
      reserved_at: resa.reserved_at,
    });
  } catch (_) {}

  logger.info("Réservation confirmée", { resaId: resa.id, ref: resa.ref, table_id });
  return ok(res, { reservation: updated }, "Réservation confirmée");
});

// ── PATCH /reservations/:id/assign-table ─────────────────────────────────────
// Assigner ou changer la table d'une réservation déjà confirmée
export const assignTable = asyncHandler(async (req, res) => {
  const { table_id } = req.body;
  if (!table_id) throw new AppError("table_id requis", 400);

  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  if (req.user.role === "restaurateur" && req.user.restaurant_id !== resa.restaurant_id) {
    throw new AppError("Accès refusé", 403);
  }

  // Vérifier la table
  const { rows: [tbl] } = await query(
    "SELECT id, label, capacity, status FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2",
    [table_id, resa.restaurant_id]
  );
  if (!tbl) throw new AppError("Table introuvable dans ce restaurant", 404);
  if (tbl.status === "occupe") throw new AppError("Cette table est déjà occupée", 409);

  const updated = await withTransaction(async (client) => {
    // Libérer l'ancienne table
    if (resa.table_id && resa.table_id !== table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'libre' WHERE id = $1",
        [resa.table_id]
      );
    }

    const { rows: [r] } = await client.query(
      `UPDATE reservations SET table_id = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [table_id, req.params.id]
    );

    // Marquer la nouvelle table comme réservée
    await client.query(
      "UPDATE restaurant_tables SET status = 'reserve' WHERE id = $1",
      [table_id]
    );

    return r;
  });

  logger.info("Table assignée", { resaId: resa.id, table_id, tableLabel: tbl.label });
  return ok(res, { reservation: updated, table: tbl }, `Table ${tbl.label} assignée`);
});

// ── PATCH /reservations/:id/cancel ───────────────────────────────────────────
export const cancel = asyncHandler(async (req, res) => {
  const { cancel_reason } = req.body;
  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  _assertAccess(req, resa);

  if (["annule","termine","no_show"].includes(resa.status)) {
    throw new AppError("Cette réservation ne peut plus être annulée", 400);
  }

  // Vérifier délai d'annulation (au moins 2h avant)
  const now = new Date();
  const resaTime = new Date(resa.reserved_at);
  const hoursLeft = (resaTime - now) / 3_600_000;
  if (req.user.role === "client" && hoursLeft < 2) {
    throw new AppError("Annulation impossible moins de 2h avant la réservation", 400);
  }

  const { rows: [updated] } = await query(
    `UPDATE reservations
     SET status = 'annule', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [cancel_reason || null, req.params.id]
  );

  // Libérer la table si elle était réservée
  if (resa.table_id) {
    await query(
      "UPDATE restaurant_tables SET status = 'libre' WHERE id = $1",
      [resa.table_id]
    );
  }

  logger.info("Réservation annulée", { resaId: resa.id, ref: resa.ref });
  return ok(res, { reservation: updated }, "Réservation annulée");
});

// ── PATCH /reservations/:id/no-show ─────────────────────────────────────────
export const noShow = asyncHandler(async (req, res) => {
  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  if (req.user.role === "restaurateur" && req.user.restaurant_id !== resa.restaurant_id) {
    throw new AppError("Accès refusé", 403);
  }

  const { rows: [updated] } = await query(
    `UPDATE reservations SET status = 'no_show', no_show_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id]
  );

  if (resa.table_id) {
    await query("UPDATE restaurant_tables SET status = 'libre' WHERE id = $1", [resa.table_id]);
  }

  return ok(res, { reservation: updated }, "No-show enregistré");
});

// ── PATCH /reservations/:id — mise à jour générale (restaurateur/admin) ───────
export const update = asyncHandler(async (req, res) => {
  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");
  if (req.user.role === "restaurateur" && req.user.restaurant_id !== resa.restaurant_id) {
    throw new AppError("Accès refusé", 403);
  }

  const ALLOWED = ["reserved_at","party_size","status","notes","special_request","table_id"];
  const updates = [];
  const values  = [];
  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    values.push(req.body[field]);
    updates.push(`${field} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);

  values.push(req.params.id);
  const { rows: [updated] } = await query(
    `UPDATE reservations SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING *`,
    values
  );
  return ok(res, { reservation: updated }, "Réservation mise à jour");
});

// ── Helper ─────────────────────────────────────────────────────────────────────
function _assertAccess(req, resa) {
  if (req.user.role === "admin") return;
  if (req.user.role === "restaurateur" && req.user.restaurant_id === resa.restaurant_id) return;
  if (req.user.id === resa.client_id) return;
  throw new AppError("Accès refusé", 403);
}
