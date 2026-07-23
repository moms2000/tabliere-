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

  -- Cumul quotidien : conserve les statistiques À VIE même après la purge des
  -- commandes détaillées (>15 j). Disjoint des lignes vives (une commande est
  -- soit encore dans qr_orders, soit purgée et cumulée ici) → simple addition.
  CREATE TABLE IF NOT EXISTS qr_order_daily (
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    day           DATE NOT NULL,
    orders        INTEGER NOT NULL DEFAULT 0,   -- commandes purgées (servies + annulées)
    revenue       BIGINT  NOT NULL DEFAULT 0,   -- CA net (hors annulées)
    served        INTEGER NOT NULL DEFAULT 0,
    cancelled     INTEGER NOT NULL DEFAULT 0,
    items         JSONB   NOT NULL DEFAULT '{}',-- { "Plat": { qty, revenue } } (hors annulées)
    PRIMARY KEY (restaurant_id, day)
  );
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
  if (req.user.is_staff && req.user.restaurant_id) return req.user.restaurant_id; // staff → son resto
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

// Purge des commandes servies/annulées de plus de 15 jours, APRÈS avoir cumulé
// leurs stats dans qr_order_daily (rétention à vie des chiffres). DELETE … RETURNING
// puis agrégation en mémoire = atomique, aucun double comptage possible.
// Throttlé à 1×/6 h par restaurant pour ne pas peser sur chaque requête.
const RETENTION_DAYS = 15;
const lastPurge = new Map();
async function purgeAndRollup(restoId) {
  const now = Date.now();
  if (now - (lastPurge.get(restoId) || 0) < 6 * 3600 * 1000) return;
  lastPurge.set(restoId, now);
  try {
    const { rows } = await query(
      `DELETE FROM qr_orders
         WHERE restaurant_id = $1 AND status IN ('servi','annule')
           AND created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
       RETURNING to_char(created_at, 'YYYY-MM-DD') AS day, total, status`,
      [restoId]
    );
    if (!rows.length) return;
    const byDay = new Map();
    for (const r of rows) {
      const d = byDay.get(r.day) || { orders: 0, revenue: 0, served: 0, cancelled: 0 };
      d.orders++;
      if (r.status === "annule") d.cancelled++;
      else { d.served++; d.revenue += Number(r.total) || 0; }
      byDay.set(r.day, d);
    }
    for (const [day, d] of byDay) {
      await query(
        `INSERT INTO qr_order_daily (restaurant_id, day, orders, revenue, served, cancelled)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (restaurant_id, day) DO UPDATE SET
           orders    = qr_order_daily.orders    + EXCLUDED.orders,
           revenue   = qr_order_daily.revenue   + EXCLUDED.revenue,
           served    = qr_order_daily.served    + EXCLUDED.served,
           cancelled = qr_order_daily.cancelled + EXCLUDED.cancelled`,
        [restoId, day, d.orders, d.revenue, d.served, d.cancelled]
      );
    }
    logger.info("Purge commandes >15j + cumul stats", { restoId, purged: rows.length, days: byDay.size });
  } catch (e) {
    logger.warn("purgeAndRollup a échoué", { error: e.message });
  }
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
    // Tag personne par ligne (Personne 1, 2… d'une commande groupée), borné 1..50.
    const pn = parseInt(it.convive_num, 10);
    const convive_num = (Number.isInteger(pn) && pn > 0 && pn <= 50) ? pn : undefined;
    return m
      ? { id: m.id, name: m.name, price: Number(m.price) || 0, qty, options: it.options || undefined, options_label: it.options_label || undefined, convive_num }
      : { id: it.id || null, name: String(it.name || "Article").slice(0, 120), price: 0, qty, convive_num };
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
  purgeAndRollup(restoId); // purge paresseuse (non bloquante)

  const params = [restoId];
  const conds  = ["restaurant_id = $1"];

  // scope : "active" = en attente + en cours (liste de service) ;
  //         "archive" = servies + annulées (onglet Archives). Défaut : tout.
  const { scope } = req.query;
  if (scope === "active") conds.push(`status IN ('en_attente','en_cours')`);
  else if (scope === "archive") conds.push(`status IN ('servi','annule')`);

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
  const DAYS = { day: 1, week: 7, month: 30, year: 365 };
  const nDays = DAYS[period] || 30;

  // On ATTEND la purge ici (throttlée → quasi toujours un no-op) : garantit que
  // live et cumul sont lus après purge, donc jamais de double comptage transitoire.
  await purgeAndRollup(restoId);

  // Totaux LIVE (lignes encore présentes). CA net = hors annulées.
  const { rows: [live] } = await query(
    `SELECT
       COUNT(*)                                                   AS total_orders,
       COALESCE(SUM(total) FILTER (WHERE status <> 'annule'), 0) AS total_revenue,
       COUNT(*) FILTER (WHERE status='servi')                    AS served,
       COUNT(*) FILTER (WHERE status='annule')                   AS cancelled
     FROM qr_orders
     WHERE restaurant_id = $1 AND ${periodCond}`,
    [restoId]
  );
  // Cumul des jours déjà purgés (disjoint des lignes vives → simple addition).
  const { rows: [roll] } = await query(
    `SELECT COALESCE(SUM(orders),0) AS orders, COALESCE(SUM(revenue),0) AS revenue,
            COALESCE(SUM(served),0) AS served, COALESCE(SUM(cancelled),0) AS cancelled
     FROM qr_order_daily
     WHERE restaurant_id = $1 AND day >= (CURRENT_DATE - make_interval(days => $2::int))`,
    [restoId, nDays]
  );
  const total_orders  = Number(live.total_orders) + Number(roll.orders);
  const total_revenue = Number(live.total_revenue) + Number(roll.revenue);
  const served        = Number(live.served) + Number(roll.served);
  const cancelled     = Number(live.cancelled) + Number(roll.cancelled);
  const nonCancelled  = Math.max(1, total_orders - cancelled);
  const totals = {
    total_orders, total_revenue,
    avg_order: Math.round(total_revenue / nonCancelled),
    served, cancelled,
  };

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

  // Évolution journalière — lignes vives (net) + jours cumulés, fusionnées par date.
  const { rows: liveDaily } = await query(
    `SELECT to_char(DATE(created_at),'YYYY-MM-DD') AS day,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total),0)::int AS revenue
     FROM qr_orders
     WHERE restaurant_id = $1 AND ${periodCond} AND status != 'annule'
     GROUP BY DATE(created_at)`,
    [restoId]
  );
  const { rows: rollDaily } = await query(
    `SELECT to_char(day,'YYYY-MM-DD') AS day, orders::int AS orders, revenue::int AS revenue
     FROM qr_order_daily
     WHERE restaurant_id = $1 AND day >= (CURRENT_DATE - make_interval(days => $2::int))`,
    [restoId, nDays]
  );
  const dayMap = new Map();
  for (const d of [...liveDaily, ...rollDaily]) {
    const cur = dayMap.get(d.day) || { day: d.day, orders: 0, revenue: 0 };
    cur.orders += Number(d.orders) || 0;
    cur.revenue += Number(d.revenue) || 0;
    dayMap.set(d.day, cur);
  }
  const dailyRevenue = [...dayMap.values()].sort((a, b) => a.day.localeCompare(b.day));

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

  // Alimente la NOTE de la table (même logique que le QR client). Le terminal peut
  // preciser le numero de la personne (Personne 1, 2…) pour les additions separees.
  await attachOrderToSession({ restoId, tableLabel: table_label, items: safeItems, source: "server", conviveNum: req.body.convive_num || null });

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
