/**
 * Orders Controller — TablièreCI
 * Commandes QR (clients scannent la table → commander)
 */

import { query } from "../config/db.js";
import { ok, created, notFound, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { attachOrderToSession } from "./sessions.controller.js";

// ── Création automatique de la table si elle n'existe pas ──────────────────
const INIT_SQL = `
  CREATE TABLE IF NOT EXISTS qr_orders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    table_label   VARCHAR(50),
    client_name   VARCHAR(255),
    client_phone  VARCHAR(50),
    client_email  VARCHAR(255),
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
  ALTER TABLE qr_orders ADD COLUMN IF NOT EXISTS client_email VARCHAR(255);
`;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(INIT_SQL);
  await query(MIGRATE_SQL).catch(() => {}); // migration silencieuse si colonnes existent déjà
  tableReady = true;
}

// Résout le restaurant du user SANS IDOR : un non-admin ne peut agir que sur SON
// restaurant (résolu par owner_id) ; le query param n'est accepté que pour un admin,
// ou pour un restaurateur si le resto lui appartient réellement.
async function resolveRestoId(req) {
  if (req.user.role === "admin" && req.query.restaurant_id) return req.query.restaurant_id;
  if (req.query.restaurant_id) {
    const { rows } = await query(
      "SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2", [req.query.restaurant_id, req.user.id]
    );
    if (rows[0]) return rows[0].id;
    throw new AppError("Accès refusé à ce restaurant", 403);
  }
  const { rows } = await query(
    "SELECT id FROM restaurants WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1", [req.user.id]
  );
  if (rows[0]) return rows[0].id;
  throw new AppError("Aucun restaurant associé à ce compte", 400);
}

// Re-tarification SERVEUR (jamais confiance au prix envoyé par le client, même
// restaurateur : évite la falsification des chiffres de CA).
async function repriceItems(restoId, items) {
  const ids = [...new Set(items.map(it => it.id).filter(Boolean))];
  const { rows: menuRows } = ids.length
    ? await query("SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 AND id = ANY($2)", [restoId, ids])
    : { rows: [] };
  const priceMap = new Map(menuRows.map(m => [String(m.id), m]));
  const safeItems = items.map(it => {
    const m = priceMap.get(String(it.id));
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    return m
      ? { id: m.id, name: m.name, price: Number(m.price) || 0, qty, options: it.options || undefined }
      : { id: it.id || null, name: String(it.name || "Article").slice(0, 120), price: 0, qty };
  });
  const total = safeItems.reduce((s, it) => s + it.price * it.qty, 0);
  return { safeItems, total };
}

// ── POST /orders — passer commande (client via QR) ─────────────────────────
export const createOrder = asyncHandler(async (req, res) => {
  await ensureTable();
  const { restaurant_id, table_label, items, note, client_name, client_phone, client_email } = req.body;
  if (!restaurant_id) throw new AppError("restaurant_id requis", 400);
  if (!items || !Array.isArray(items) || items.length === 0)
    throw new AppError("La commande doit contenir au moins un article", 400);
  if (items.length > 100) throw new AppError("Trop d'articles dans la commande", 400);

  // Vérifier que le restaurant existe et a qr_active = true
  const { rows: [resto] } = await query(
    "SELECT id, qr_active FROM restaurants WHERE id = $1 AND status = 'actif'",
    [restaurant_id]
  );
  if (!resto) throw new AppError("Restaurant introuvable", 404);
  if (!resto.qr_active) throw new AppError("Les commandes QR ne sont pas activées pour ce restaurant", 403);

  // SÉCURITÉ : ne JAMAIS faire confiance au prix envoyé par le client (route publique).
  // On récupère le prix réel des plats depuis la carte du restaurant.
  const ids = [...new Set(items.map(it => it.id).filter(Boolean))];
  const { rows: menuRows } = ids.length
    ? await query("SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 AND id = ANY($2)", [restaurant_id, ids])
    : { rows: [] };
  const priceMap = new Map(menuRows.map(m => [String(m.id), m]));
  const safeItems = items.map(it => {
    const m = priceMap.get(String(it.id));
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    return m
      ? { id: m.id, name: m.name, price: Number(m.price) || 0, qty, options: it.options || undefined }
      : { id: it.id || null, name: String(it.name || "Article").slice(0, 120), price: 0, qty }; // inconnu → 0 (jamais le prix client)
  });
  const total = safeItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  const { rows: [order] } = await query(
    `INSERT INTO qr_orders (restaurant_id, table_label, client_name, client_phone, client_email, items, total, note)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) RETURNING *`,
    [restaurant_id, table_label || null, client_name || null, client_phone || null,
     (client_email && String(client_email).trim().toLowerCase()) || null,
     JSON.stringify(safeItems), total, note || null]
  );

  // Alimente la NOTE de la table (identique sur toutes les plateformes). Chaque
  // téléphone = un convive (device_token), pour les additions séparées.
  await attachOrderToSession({
    restoId: restaurant_id, tableLabel: table_label, items: safeItems, source: "qr",
    conviveName: client_name || null, deviceToken: req.body.device_token || null,
  });

  logger.info("Commande QR créée", { orderId: order.id, restoId: restaurant_id, table: table_label, client: client_name });
  return created(res, { order }, "Commande envoyée avec succès");
});

// ── GET /orders — liste des commandes du restaurant ────────────────────────
export const listOrders = asyncHandler(async (req, res) => {
  await ensureTable();
  const { status, date_from, date_to } = req.query;
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  // Récupérer le restaurant du restaurateur connecté (anti-IDOR)
  const restoId = await resolveRestoId(req);

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
  const restoId = await resolveRestoId(req); // anti-IDOR

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
  const restoId = await resolveRestoId(req);
  if (!items || !Array.isArray(items) || items.length === 0)
    throw new AppError("La commande doit contenir au moins un article", 400);
  if (items.length > 100) throw new AppError("Trop d'articles dans la commande", 400);

  // Prix recalculés côté serveur depuis la carte (jamais le prix envoyé par le client)
  const { safeItems, total } = await repriceItems(restoId, items);

  const { rows: [order] } = await query(
    `INSERT INTO qr_orders (restaurant_id, table_label, client_name, client_phone, items, total, note, status)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, 'en_cours') RETURNING *`,
    [restoId, table_label || null, client_name || null, client_phone || null,
     JSON.stringify(safeItems), total, note || null]
  );

  // Alimente la NOTE de la table (même logique que le QR client)
  await attachOrderToSession({ restoId, tableLabel: table_label, items: safeItems, source: "server" });

  logger.info("Commande manuelle créée", { orderId: order.id, restoId, table: table_label });
  return created(res, { order }, "Commande créée");
});

// ── PATCH /orders/:id/items — modifier les articles d'une commande ─────────
export const updateOrderItems = asyncHandler(async (req, res) => {
  await ensureTable();
  const { items, note } = req.body;
  const restoId = await resolveRestoId(req);

  const { rows: [existing] } = await query(
    "SELECT * FROM qr_orders WHERE id = $1 AND restaurant_id = $2",
    [req.params.id, restoId]
  );
  if (!existing) return notFound(res, "Commande introuvable");
  if (existing.status === "servi") throw new AppError("Impossible de modifier une commande servie", 400);

  // Re-tarification serveur si de nouveaux articles sont fournis
  let safeItems = existing.items, total = existing.total;
  if (items && Array.isArray(items)) ({ safeItems, total } = await repriceItems(restoId, items));

  const { rows: [order] } = await query(
    `UPDATE qr_orders SET items = $1::jsonb, total = $2, note = COALESCE($3, note), updated_at = NOW()
     WHERE id = $4 AND restaurant_id = $5 RETURNING *`,
    [JSON.stringify(safeItems), total, note || null, req.params.id, restoId]
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
    : [status, req.params.id, await resolveRestoId(req)];

  const { rows: [order] } = await query(sql, params);
  if (!order) return notFound(res, "Commande introuvable");

  return ok(res, { order }, "Commande mise à jour");
});
