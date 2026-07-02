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
  const where   = `WHERE ${conditions.join(" AND ")}`;

  // ── Cache Redis/mémoire — clé unique par combinaison de filtres ────────────
  // TTL 2 min pour la liste (données peu critiques, mise à jour fréquente)
  const cacheKey = `restaurants:list:${sort}:${page}:${limit}:${ville||""}:${quartier||""}:${cuisine_type||""}:${search||""}`;
  const cached = await cache.get(cacheKey).catch(() => null);
  if (cached) return res.status(200).json(cached);

  const [{ rows }, { rows: [{ count }] }] = await Promise.all([
    query(
      `SELECT r.id, r.name, r.slug, r.cuisine_type, r.address, r.ville, r.quartier,
              r.price_range, r.rating, r.review_count, r.capacity,
              r.opening_hours, r.phone, r.theme_color, r.qr_active,
              r.logo_url, r.photos, r.options
       FROM restaurants r
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(`SELECT COUNT(*) FROM restaurants r ${where}`, params),
  ]);

  const result = {
    success: true,
    data: rows,
    pagination: {
      total: +count,
      page: +page,
      limit: +limit,
      pages: Math.ceil(+count / +limit),
    },
  };

  // Mettre en cache 2 minutes (invalidé à chaque update restaurant)
  await cache.set(cacheKey, result, 120).catch(() => {});

  return res.status(200).json(result);
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
     WHERE r.slug = $1 AND r.status IN ('actif', 'en_attente')`,
    [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  // Tables
  const { rows: tables } = await query(
    "SELECT id, label, capacity, zone, status FROM restaurant_tables WHERE restaurant_id = $1 AND is_active = TRUE ORDER BY label",
    [resto.id]
  );
  resto.tables = tables;

  await cache.set(cacheKey, resto, 600).catch(() => {}); // 10 min
  return ok(res, { restaurant: resto });
});

// ── GET /restaurants/:id/manage — restaurateur ────────────────────────────────
export const getManage = asyncHandler(async (req, res) => {
  await ensureRestaurantColumns();
  await ensureTableColumns();
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
  await ensureRestaurantColumns();
  const { rows: [resto] } = await query(
    "SELECT * FROM restaurants WHERE id = $1", [req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);

  const ALLOWED = [
    "name","description","cuisine_type","address","quartier","ville",
    "phone","email","website","opening_hours","price_range","capacity","theme_color","logo_url","photos",
    // Activation/désactivation QR par le restaurateur
    "qr_active",
    // Créneaux de service + nombre de tables par taille de groupe
    "lunch_hours","dinner_hours","tables_2","tables_4","tables_6","tables_8",
  ];
  const updates = [];
  const values  = [];

  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    let val = req.body[field];
    // photos est JSONB (array d'URLs/base64)
    if (field === "photos") {
      if (val === null) { val = "[]"; }
      else if (Array.isArray(val)) { val = JSON.stringify(val.slice(0, 4)); }
      else if (typeof val === "string") {
        try { const parsed = JSON.parse(val); val = JSON.stringify(parsed.slice(0, 4)); } catch(_) { val = "[]"; }
      }
    }
    // opening_hours est JSONB — s'assurer d'envoyer une valeur JSON valide
    if (field === "opening_hours") {
      if (val === null || val === "") {
        val = null;
      } else if (typeof val === "string") {
        try { JSON.parse(val); } catch (_) { val = JSON.stringify(val); }
      } else if (typeof val === "object") {
        val = JSON.stringify(val);
      }
    }
    // Champs INTEGER (nombre de tables) : "" → 0, sinon cast numérique
    if (["tables_2","tables_4","tables_6","tables_8","capacity"].includes(field)) {
      val = (val === "" || val === null) ? 0 : (parseInt(val, 10) || 0);
    }
    // qr_active : booléen strict
    if (field === "qr_active") {
      val = (val === true || val === "true" || val === 1);
    }
    values.push(val);
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

  await Promise.all([
    cache.delPattern("restaurant:*").catch(() => {}),
    cache.delPattern("restaurants:list:*").catch(() => {}),
  ]);
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

  const frontendUrl = process.env.FRONTEND_URL || "https://tabliere.vercel.app";
  const menuUrl = `${frontendUrl}/menu/${resto.slug}`;

  // Tentative de génération QR graphique — non bloquante si le service échoue
  let qrDataUrl = null;
  try {
    const theme = { primary: resto.theme_color || "#E8A045" };
    const result = await qrService.generateMenuQR(resto.slug, theme);
    qrDataUrl = result.dataUrl;
  } catch (e) {
    logger.warn("qrService indisponible, activation sans data URL", { error: e?.message });
  }

  await query(
    "UPDATE restaurants SET qr_active = TRUE, qr_code_url = $1, updated_at = NOW() WHERE id = $2",
    [menuUrl, resto.id]
  );

  await Promise.all([
    cache.delPattern("restaurant:*").catch(() => {}),
    cache.delPattern("restaurants:list:*").catch(() => {}),
  ]);
  logger.info("QR activé", { restoId: resto.id });
  return ok(res, { qr_data_url: qrDataUrl, qr_url: menuUrl });
});

// ── Tables ────────────────────────────────────────────────────────────────────

// Migration silencieuse : colonnes manquantes restaurants
let restaurantMigrated = false;
async function ensureRestaurantColumns() {
  if (restaurantMigrated) return;
  try {
    await query(`
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS qr_active     BOOLEAN DEFAULT FALSE;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS lunch_hours   VARCHAR(100);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS dinner_hours  VARCHAR(100);
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tables_2      INTEGER DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tables_4      INTEGER DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tables_6      INTEGER DEFAULT 0;
      ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tables_8      INTEGER DEFAULT 0;
    `);
  } catch (_) {}
  restaurantMigrated = true;
}

// Migration silencieuse : ajouter pos_x / pos_y / qr_url sur les tables
let tablesMigrated = false;
async function ensureTableColumns() {
  if (tablesMigrated) return;
  try {
    await query(`
      ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_x INTEGER DEFAULT 20;
      ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_y INTEGER DEFAULT 20;
      ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS qr_url TEXT;
    `);
  } catch (_) {}
  tablesMigrated = true;
}

export const createTable = asyncHandler(async (req, res) => {
  await ensureTableColumns();
  const { label, capacity, zone, pos_x, pos_y } = req.body;
  const { rows: [resto] } = await query(
    "SELECT id, owner_id FROM restaurants WHERE id = $1", [req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);

  const { rows: [table] } = await query(
    `INSERT INTO restaurant_tables (restaurant_id, label, capacity, zone, pos_x, pos_y)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [resto.id, label, capacity || 2, zone || "interieur", pos_x ?? 20, pos_y ?? 20]
  );

  await cache.delPattern(`restaurant:*`).catch(() => {});
  return created(res, { table }, "Table créée");
});

// Normalise un statut de table vers l'ENUM valide (libre/occupe/reserve)
// Accepte accents, anglais, majuscules → évite les erreurs SQL 500
function normalizeTableStatus(s) {
  const v = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (["reserve","reserved","reservee"].includes(v)) return "reserve";
  if (["occupe","occupied","occupied"].includes(v))  return "occupe";
  return "libre";
}

// Normalise une zone vers une valeur acceptée
function normalizeZone(z) {
  const v = String(z || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const allowed = ["interieur","terrasse","bar","vip","salon_prive"];
  return allowed.includes(v) ? v : "interieur";
}

export const updateTable = asyncHandler(async (req, res) => {
  await ensureTableColumns();
  const ALLOWED = ["label","capacity","zone","status","is_active","pos_x","pos_y"];
  const updates = [];
  const values  = [];

  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    let val = req.body[field];
    // Normaliser status et zone pour éviter les valeurs ENUM invalides (500)
    if (field === "status") val = normalizeTableStatus(val);
    if (field === "zone")   val = normalizeZone(val);
    if (["capacity","pos_x","pos_y"].includes(field)) val = parseInt(val, 10) || 0;
    values.push(val);
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

// ── POST /restaurants/:id/tables/:tableId/qr — QR par table ──────────────────
export const generateTableQR = asyncHandler(async (req, res) => {
  await ensureTableColumns();
  const { rows: [resto] } = await query(
    "SELECT id, slug, theme_color FROM restaurants WHERE id = $1", [req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);

  const { rows: [table] } = await query(
    "SELECT id, label FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2",
    [req.params.tableId, req.params.id]
  );
  if (!table) return notFound(res, "Table introuvable");

  const frontendUrl = process.env.FRONTEND_URL || "https://tabliere.vercel.app";
  const qrUrl = `${frontendUrl}/menu/${resto.slug}?table=${encodeURIComponent(table.label)}`;

  await query(
    "UPDATE restaurant_tables SET qr_url = $1 WHERE id = $2",
    [qrUrl, table.id]
  );

  await Promise.all([
    cache.delPattern("restaurant:*").catch(() => {}),
    cache.delPattern("restaurants:list:*").catch(() => {}),
  ]);
  logger.info("QR table généré", { tableId: table.id, label: table.label });
  return ok(res, { qr_url: qrUrl, table_label: table.label });
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
