/**
 * Orders Controller — TablièreCI
 * Commandes QR (clients scannent la table → commander)
 */

import { query } from "../config/db.js";
import { ok, created, notFound, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";

// ── Création automatique de la table si elle n'existe pas ──────────────────
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS qr_orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_label   VARCHAR(50),
    client_name   VARCHAR(255),
    client_phone  VARCHAR(50),
    items         JSONB NOT NULL DEFAULT '[]',
    total         INTEGER NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'en_attente'
                  CHECK (status IN ('en_attente','en_cours','servi','annule')),
    note          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS qr_orders_restaurant_id_idx ON qr_orders(restaurant_id);
  CREATE INDEX IF NOT EXISTS qr_orders_created_at_idx    ON qr_orders(created_at DESC);
`;

// Migration pour tables existantes
const MIGRATE_SQL = `
  ALTER TABLE qr_orders ADD COLUMN IF NOT EXISTS client_name  VARCHAR(255);
  ALTER TABLE qr_orders ADD COLUMN IF NOT EXISTS client_phone VARCHAR(50);
`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(INIT_SQL);
  await query(MIGRATE_SQL).catch(() => {}); // migration silencieuse si colonnes existent déjà
  tableReady = true;
}

// ── POST /orders — passer commande (client via QR) ─────────────────────────
export const createOrder = asyncHandler(async (req, res) => {
  await ensureTable();
  const { restaurant_id, table_label, items, note, client_name, client_phone } = req.body;
  if (!restaurant_id) throw new AppError("restaurant_id requis", 400);
  if (!items || !Array.isArray(items) || items.length === 0)
    throw new AppError("La commande doit contenir au moins un article", 400);

  // Vérifier que le restaurant existe et a qr_active = true
  const { rows: [resto] } = await query(
    "SELECT id, qr_active FROM restaurants WHERE id = $1 AND status = 'actif'",
    [restaurant_id]
  );
  if (!resto) throw new AppError("Restaurant introuvable", 404);
  if (!resto.qr_active) throw new AppError("Les commandes QR ne sont pas activées pour ce restaurant", 403);

  // Coercition numérique stricte : un price/qty non numérique produirait NaN,
  // rejeté par la colonne INTEGER (500). On borne à des entiers >= 0.
  const total = items.reduce((sum, it) => {
    const price = Number(it.price); const qty = Number(it.qty);
    const p = Number.isFinite(price) && price > 0 ? price : 0;
    const q = Number.isFinite(qty)   && qty   > 0 ? qty   : 1;
    return sum + p * q;
  }, 0);

  const { rows: [order] } = await query(
    `INSERT INTO qr_orders (restaurant_id, table_label, client_name, client_phone, items, total, note)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING *`,
    [restaurant_id, table_label || null, client_name || null, client_phone || null,
     JSON.stringify(items), total, note || null]
  );

  logger.info("Commande QR créée", { orderId: order.id, restoId: restaurant_id, table: table_label, client: client_name });
  return created(res, { order }, "Commande envoyée avec succès");
});

// ── GET /orders — liste des commandes du restaurant ────────────────────────
export const listOrders = asyncHandler(async (req, res) => {
  await ensureTable();
  const { page = 1, limit = 50, status, date_from, date_to } = req.query;
  const offset = (page - 1) * limit;

  // Récupérer le restaurant du restaurateur connecté
  const restoId = req.user.restaurant_id || req.query.restaurant_id;
  if (!restoId) throw new AppError("restaurant_id requis", 400);

  const params = [restoId];
  const conds  = ["restaurant_id = $1"];

  if (status) { params.push(status); conds.push(`status = $${params.length}`); }
  if (date_from) { params.push(date_from); conds.push(`created_at >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   conds.push(`created_at <= $${params.length}`); }

  const where = conds.join(" AND ");

  const { rows } = await query(
    `SELECT * FROM qr_orders WHERE ${where}
     ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM qr_orders WHERE ${where}`, params
  );

  return paginated(res, rows, +count, +page, +limit);
});

// ── GET /orders/stats — statistiques pour le restaurateur ──────────────────
export const getStats = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = req.user.restaurant_id || req.query.restaurant_id;
  if (!restoId) throw new AppError("restaurant_id requis", 400);

  const { period = "month" } = req.query;

  const PERIOD_SQL = {
    day:   "created_at >= NOW() - INTERVAL '1 day'",
    week:  "created_at >= NOW() - INTERVAL '7 days'",
    month: "created_at >= NOW() - INTERVAL '30 days'",
    year:  "created_at >= NOW() - INTERVAL '365 days'",
  };
  const periodCond = PERIOD_SQL[period] || PERIOD_SQL.month;

  // Totaux
  const { rows: [totals] } = await query(
    `SELECT
       COUNT(*)                                   AS total_orders,
       COALESCE(SUM(total), 0)                   AS total_revenue,
       COALESCE(AVG(total), 0)                   AS avg_order,
       COUNT(*) FILTER (WHERE status='servi')    AS served,
       COUNT(*) FILTER (WHERE status='annule')   AS cancelled
     FROM qr_orders
     WHERE restaurant_id = $1 AND ${periodCond}`,
    [restoId]
  );

  // Plats les plus commandés — agrégat JSONB
  const { rows: topItems } = await query(
    `SELECT
       item->>'name'            AS name,
       SUM((item->>'qty')::int) AS total_qty,
       SUM((item->>'price')::int * (item->>'qty')::int) AS revenue
     FROM qr_orders,
          jsonb_array_elements(items) AS item
     WHERE restaurant_id = $1 AND ${periodCond} AND status != 'annule'
     GROUP BY item->>'name'
     ORDER BY total_qty DESC
     LIMIT 10`,
    [restoId]
  );

  // Évolution journalière
  const { rows: dailyRevenue } = await query(
    `SELECT
       DATE(created_at)            AS day,
       COUNT(*)                    AS orders,
       COALESCE(SUM(total), 0)    AS revenue
     FROM qr_orders
     WHERE restaurant_id = $1 AND ${periodCond} AND status != 'annule'
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    [restoId]
  );

  return ok(res, {
    totals,
    top_items:     topItems,
    bottom_items:  [...topItems].reverse().slice(0, 5),
    daily_revenue: dailyRevenue,
  });
});

// ── POST /orders/manual — commande manuelle par restaurateur ────────────────
export const createManualOrder = asyncHandler(async (req, res) => {
  await ensureTable();
  const { table_label, items, note, client_name, client_phone } = req.body;
  const restoId = req.user.restaurant_id;
  if (!restoId) throw new AppError("Aucun restaurant associé à ce compte", 400);
  if (!items || !Array.isArray(items) || items.length === 0)
    throw new AppError("La commande doit contenir au moins un article", 400);

  // Coercition numérique stricte : un price/qty non numérique produirait NaN,
  // rejeté par la colonne INTEGER (500). On borne à des entiers >= 0.
  const total = items.reduce((sum, it) => {
    const price = Number(it.price); const qty = Number(it.qty);
    const p = Number.isFinite(price) && price > 0 ? price : 0;
    const q = Number.isFinite(qty)   && qty   > 0 ? qty   : 1;
    return sum + p * q;
  }, 0);

  const { rows: [order] } = await query(
    `INSERT INTO qr_orders (restaurant_id, table_label, client_name, client_phone, items, total, note, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'en_cours') RETURNING *`,
    [restoId, table_label || null, client_name || null, client_phone || null,
     JSON.stringify(items), total, note || null]
  );

  logger.info("Commande manuelle créée", { orderId: order.id, restoId, table: table_label });
  return created(res, { order }, "Commande créée");
});

// ── PATCH /orders/:id/items — modifier les articles d'une commande ─────────
export const updateOrderItems = asyncHandler(async (req, res) => {
  await ensureTable();
  const { items, note } = req.body;
  const restoId = req.user.restaurant_id;

  const { rows: [existing] } = await query(
    "SELECT * FROM qr_orders WHERE id = $1 AND restaurant_id = $2",
    [req.params.id, restoId]
  );
  if (!existing) return notFound(res, "Commande introuvable");
  if (existing.status === "servi") throw new AppError("Impossible de modifier une commande servie", 400);

  const total = (items || existing.items).reduce((sum, it) => sum + (it.price || 0) * (it.qty || 1), 0);

  const { rows: [order] } = await query(
    `UPDATE qr_orders SET items = $1::jsonb, total = $2, note = COALESCE($3, note), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [JSON.stringify(items || existing.items), total, note || null, req.params.id]
  );

  return ok(res, { order }, "Commande modifiée");
});

// ── PATCH /orders/:id — changer statut ─────────────────────────────────────
export const updateOrder = asyncHandler(async (req, res) => {
  await ensureTable();
  const { status } = req.body;
  if (!status) throw new AppError("status requis", 400);

  // Valider le statut contre la CHECK constraint (évite un 500 SQL)
  const VALID = ["en_attente", "en_cours", "servi", "annule"];
  if (!VALID.includes(status)) {
    throw new AppError(`Statut invalide. Valeurs acceptées : ${VALID.join(", ")}`, 400);
  }

  // Scope au restaurant du user (sécurité : ne pas modifier la commande d'un autre resto)
  const isAdmin = req.user.role === "admin";
  const sql = isAdmin
    ? `UPDATE qr_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`
    : `UPDATE qr_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND restaurant_id = $3 RETURNING *`;
  const params = isAdmin
    ? [status, req.params.id]
    : [status, req.params.id, req.user.restaurant_id];

  const { rows: [order] } = await query(sql, params);
  if (!order) return notFound(res, "Commande introuvable");

  return ok(res, { order }, "Commande mise à jour");
});
