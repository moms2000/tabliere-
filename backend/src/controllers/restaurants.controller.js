/**
 * Restaurants Controller — TablièreCI
 * CRUD restaurants + tables + QR
 */

import { query, withTransaction } from "../config/db.js";
import { cache }  from "../config/redis.js";
import { ok, created, notFound, forbidden, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { qrService }  from "../services/qr.service.js";
import { logger }     from "../utils/logger.js";

// ── GET /restaurants — liste publique ─────────────────────────────────────────
export const list = asyncHandler(async (req, res) => {
  const {
    page = 1, limit = 12,
    ville, quartier, cuisine_type,
    search, sort = "rating",
  } = req.query;
  const offset = (page - 1) * limit;
  const params = ["actif"];
  const conditions = ["r.status = $1"];

  if (ville)         { params.push(ville);          conditions.push(`r.ville ILIKE $${params.length}`); }
  if (quartier)      { params.push(quartier);        conditions.push(`r.quartier ILIKE $${params.length}`); }
  if (cuisine_type)  { params.push(cuisine_type);    conditions.push(`r.cuisine_type ILIKE $${params.length}`); }
  if (search)        { params.push(`%${search}%`);   conditions.push(`r.name ILIKE $${params.length}`); }

  const ORDER_MAP = {
    rating:       "r.rating DESC",
    reviews:      "r.review_count DESC",
    recent:       "r.created_at DESC",
  };
  const orderBy = ORDER_MAP[sort] || "r.rating DESC";

  const where = `WHERE ${conditions.join(" AND ")}`;

  const { rows } = await query(
    `SELECT r.id, r.name, r.slug, r.cuisine_type, r.address, r.ville, r.quartier,
            r.price_range, r.rating, r.review_count, r.capacity,
            r.opening_hours, r.phone, r.theme_color, r.qr_active
     FROM restaurants r
     ${where}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM restaurants r ${where}`, params
  );

  return paginated(res, rows, +count, +page, +limit);
});

// ── GET /restaurants/:slug — détail public ───────────────────────────────────
export const getOne = asyncHandler(async (req, res) => {
  const cacheKey = `restaurant:${req.params.slug}`;
  const cached = await cache.get(cacheKey).catch(() => null);
  if (cached) return ok(res, { restaurant: cached });

  const { rows: [resto] } = await query(
    `SELECT r.*,
            u.full_name AS owner_name,
            u.email     AS owner_email
     FROM restaurants r
     JOIN users u ON u.id = r.owner_id
     WHERE r.slug = $1 AND r.status = 'actif'`,
    [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  // Tables
  const { rows: tables } = await query(
    "SELECT id, label, capacity, zone, status FROM restaurant_tables WHERE restaurant_id = $1 AND is_active = TRUE ORDER BY label",
    [resto.id]
  );
  resto.tables = tables;

  await cache.set(cacheKey, resto, 120).catch(() => {});
  return ok(res, { restaurant: resto });
});

// ── GET /restaurants/:id/manage — restaurateur ────────────────────────────────
export const getManage = asyncHandler(async (req, res) => {
  const { rows: [resto] } = await query(
    "SELECT * FROM restaurants WHERE id = $1",
    [req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);

  const { rows: tables } = await query(
    "SELECT * FROM restaurant_tables WHERE restaurant_id = $1 ORDER BY label",
    [resto.id]
  );
  return ok(res, { restaurant: { ...resto, tables } });
});

// ── PATCH /restaurants/:id ─────────────────────────────────────────────────────
export const update = asyncHandler(async (req, res) => {
  const { rows: [resto] } = await query(
    "SELECT * FROM restaurants WHERE id = $1", [req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);

  const ALLOWED = [
    "name","description","cuisine_type","address","quartier","ville",
    "phone","email","website","opening_hours","price_range","capacity","theme_color",
  ];
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
    `UPDATE restaurants SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );

  await cache.delPattern("restaurant:*").catch(() => {});
  logger.info("Restaurant mis à jour", { restoId: updated.id });
  return ok(res, { restaurant: updated }, "Restaurant mis à jour");
});

// ── POST /restaurants/:id/qr — générer QR ────────────────────────────────────
export const generateQR = asyncHandler(async (req, res) => {
  const { rows: [resto] } = await query(
    "SELECT id, slug, plan, theme_color FROM restaurants WHERE id = $1", [req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);
  if (resto.plan === "gratuit") throw new AppError("Le plan gratuit ne permet pas le QR menu", 403);

  const theme = { primary: resto.theme_color || "#1D9E75" };
  const { dataUrl, url } = await qrService.generateMenuQR(resto.slug, theme);

  await query(
    "UPDATE restaurants SET qr_active = TRUE, qr_code_url = $1, updated_at = NOW() WHERE id = $2",
    [url, resto.id]
  );

  await cache.delPattern("restaurant:*").catch(() => {});
  logger.info("QR généré", { restoId: resto.id });
  return ok(res, { qr_data_url: dataUrl, qr_url: url });
});

// ── Tables ────────────────────────────────────────────────────────────────────

export const createTable = asyncHandler(async (req, res) => {
  const { label, capacity, zone } = req.body;
  const { rows: [resto] } = await query(
    "SELECT id, owner_id FROM restaurants WHERE id = $1", [req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);

  const { rows: [table] } = await query(
    `INSERT INTO restaurant_tables (restaurant_id, label, capacity, zone)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [resto.id, label, capacity || 2, zone || "interieur"]
  );

  await cache.delPattern(`restaurant:*`).catch(() => {});
  return created(res, { table }, "Table créée");
});

export const updateTable = asyncHandler(async (req, res) => {
  const ALLOWED = ["label","capacity","zone","status","is_active"];
  const updates = [];
  const values  = [];

  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    values.push(req.body[field]);
    updates.push(`${field} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);

  values.push(req.params.tableId);
  const { rows: [table] } = await query(
    `UPDATE restaurant_tables SET ${updates.join(", ")}
     WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!table) return notFound(res, "Table introuvable");

  await cache.delPattern(`restaurant:*`).catch(() => {});
  return ok(res, { table }, "Table mise à jour");
});

export const deleteTable = asyncHandler(async (req, res) => {
  const { rows: [table] } = await query(
    "UPDATE restaurant_tables SET is_active = FALSE WHERE id = $1 RETURNING id",
    [req.params.tableId]
  );
  if (!table) return notFound(res, "Table introuvable");
  return ok(res, null, "Table désactivée");
});

// ── Disponibilités ─────────────────────────────────────────────────────────────
export const getAvailability = asyncHandler(async (req, res) => {
  const { date, party_size = 2 } = req.query;
  if (!date) throw new AppError("Paramètre 'date' requis (ex: 2025-08-15)", 400);

  const { rows: [resto] } = await query(
    "SELECT id FROM restaurants WHERE slug = $1 AND status = 'actif'",
    [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  // Tables disponibles pour le créneau
  const { rows: tables } = await query(
    `SELECT t.id, t.label, t.capacity, t.zone
     FROM restaurant_tables t
     WHERE t.restaurant_id = $1
       AND t.is_active = TRUE
       AND t.capacity >= $2
       AND t.id NOT IN (
         SELECT table_id FROM reservations
         WHERE restaurant_id = $1
           AND reserved_at::date = $3::date
           AND status IN ('en_attente','confirme')
       )
     ORDER BY t.capacity`,
    [resto.id, party_size, date]
  );

  return ok(res, { available_tables: tables, date });
});

// ── Helper interne ─────────────────────────────────────────────────────────────
function _assertOwnerOrAdmin(req, resto) {
  if (req.user.role === "admin") return;
  if (req.user.role === "restaurateur" && req.user.restaurant_id === resto.id) return;
  throw new AppError("Accès refusé", 403);
}
