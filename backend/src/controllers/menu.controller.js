/**
 * Menu Controller — TablièreCI
 * Menu public (QR) + gestion restaurateur
 */

import { query } from "../config/db.js";
import { cache } from "../config/redis.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger }  from "../utils/logger.js";

// Migration automatique : ajouter la colonne options si elle n'existe pas
let menuMigrated = false;
async function ensureMenuColumns() {
  if (menuMigrated) return;
  try {
    await query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS options JSONB`);
    menuMigrated = true;
  } catch (e) {
    logger.warn("ensureMenuColumns", { error: e?.message });
  }
}

// ── GET /menu/:slug — Public, après scan QR ───────────────────────────────────
export const getPublicMenu = asyncHandler(async (req, res) => {
  const cacheKey = `menu:public:${req.params.slug}`;
  const cached = await cache.get(cacheKey).catch(() => null);
  if (cached) return ok(res, cached);

  const { rows: [resto] } = await query(
    `SELECT id, name, slug, description, cuisine_type, address, quartier,
            opening_hours, phone, theme_color, qr_active
     FROM restaurants WHERE slug = $1 AND status = 'actif'`,
    [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  const { rows: categories } = await query(
    `SELECT mc.id, mc.name, mc.position,
            COALESCE(json_agg(
              json_build_object(
                'id',           mi.id,
                'name',         mi.name,
                'description',  mi.description,
                'price',        mi.price,
                'image_url',    mi.image_url,
                'is_available', mi.is_available,
                'position',     mi.position
              ) ORDER BY mi.position
            ) FILTER (WHERE mi.id IS NOT NULL), '[]') AS items
     FROM menu_categories mc
     LEFT JOIN menu_items mi ON mi.category_id = mc.id AND mi.is_active = TRUE
     WHERE mc.restaurant_id = $1 AND mc.is_active = TRUE
     GROUP BY mc.id
     ORDER BY mc.position`,
    [resto.id]
  );

  const data = { restaurant: resto, categories };
  await cache.set(cacheKey, data, 180).catch(() => {});
  return ok(res, data);
});

// ── GET /menu/:slug/manage — Restaurateur : menu complet avec inactifs ────────
export const getFullMenu = asyncHandler(async (req, res) => {
  const { rows: [resto] } = await query(
    "SELECT id FROM restaurants WHERE slug = $1", [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");
  _assertOwnerOrAdmin(req, resto);

  const { rows: categories } = await query(
    `SELECT mc.id, mc.name, mc.position, mc.is_active,
            COALESCE(json_agg(
              json_build_object(
                'id',           mi.id,
                'name',         mi.name,
                'description',  mi.description,
                'price',        mi.price,
                'image_url',    mi.image_url,
                'is_active',    mi.is_active,
                'is_available', mi.is_available,
                'position',     mi.position
              ) ORDER BY mi.position
            ) FILTER (WHERE mi.id IS NOT NULL), '[]') AS items
     FROM menu_categories mc
     LEFT JOIN menu_items mi ON mi.category_id = mc.id
     WHERE mc.restaurant_id = $1
     GROUP BY mc.id
     ORDER BY mc.position`,
    [resto.id]
  );

  return ok(res, { categories });
});

// ── POST /menu/categories ─────────────────────────────────────────────────────
export const createCategory = asyncHandler(async (req, res) => {
  const { name, position = 0 } = req.body;
  if (!name) throw new AppError("Nom de catégorie requis", 400);

  const restoId = req.user.restaurant_id;
  if (!restoId) throw new AppError("Aucun restaurant associé à ce compte", 400);

  const { rows: [cat] } = await query(
    `INSERT INTO menu_categories (restaurant_id, name, position)
     VALUES ($1, $2, $3) RETURNING *`,
    [restoId, name, position]
  );

  await cache.delPattern(`menu:public:*`).catch(() => {});
  return created(res, { category: cat }, "Catégorie créée");
});

// ── PATCH /menu/categories/:id ────────────────────────────────────────────────
export const updateCategory = asyncHandler(async (req, res) => {
  const ALLOWED = ["name", "position", "is_active"];
  const updates = [];
  const values  = [];

  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    values.push(req.body[field]);
    updates.push(`${field} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);

  values.push(req.params.id);
  const { rows: [cat] } = await query(
    `UPDATE menu_categories SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
    values
  );
  if (!cat) return notFound(res, "Catégorie introuvable");

  await cache.delPattern(`menu:public:*`).catch(() => {});
  return ok(res, { category: cat }, "Catégorie mise à jour");
});

// ── DELETE /menu/categories/:id ───────────────────────────────────────────────
export const deleteCategory = asyncHandler(async (req, res) => {
  const { rows: [cat] } = await query(
    "SELECT restaurant_id FROM menu_categories WHERE id = $1", [req.params.id]
  );
  if (!cat) return notFound(res, "Catégorie introuvable");
  _assertOwnerOrAdmin(req, { id: cat.restaurant_id });

  await query(
    "UPDATE menu_categories SET is_active = FALSE WHERE id = $1",
    [req.params.id]
  );

  await cache.delPattern(`menu:public:*`).catch(() => {});
  return ok(res, null, "Catégorie supprimée");
});

// ── POST /menu/items ──────────────────────────────────────────────────────────
export const createItem = asyncHandler(async (req, res) => {
  await ensureMenuColumns();
  const { category_id, name, description, price, image_url, is_active = true, position = 0, options } = req.body;

  // Vérifier que la catégorie appartient au restaurant
  const { rows: [cat] } = await query(
    "SELECT mc.id, mc.restaurant_id FROM menu_categories mc WHERE mc.id = $1",
    [category_id]
  );
  if (!cat) return notFound(res, "Catégorie introuvable");
  _assertOwnerOrAdmin(req, { id: cat.restaurant_id });

  // Sérialiser options (JSONB) si nécessaire
  let optionsVal = null;
  if (options !== undefined && options !== null && options !== "") {
    optionsVal = typeof options === "object" ? JSON.stringify(options) : options;
  }

  const { rows: [item] } = await query(
    `INSERT INTO menu_items
       (category_id, restaurant_id, name, description, price, image_url, is_active, position, options)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [category_id, cat.restaurant_id, name, description || null, price, image_url || null, is_active, position, optionsVal]
  );

  await cache.delPattern(`menu:public:*`).catch(() => {});
  logger.info("Item menu créé", { itemId: item.id, restoId: cat.restaurant_id });
  return created(res, { item }, "Plat ajouté au menu");
});

// ── PATCH /menu/items/:id ─────────────────────────────────────────────────────
export const updateItem = asyncHandler(async (req, res) => {
  await ensureMenuColumns();
  const { rows: [item] } = await query(
    "SELECT * FROM menu_items WHERE id = $1", [req.params.id]
  );
  if (!item) return notFound(res, "Plat introuvable");
  _assertOwnerOrAdmin(req, { id: item.restaurant_id });

  const ALLOWED = ["name","description","price","image_url","is_active","is_available","position","category_id","options"];
  const updates = [];
  const values  = [];

  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    let val = req.body[field];
    // options est JSONB — sérialiser si c'est un objet
    if (field === "options") {
      if (val === null || val === "") { val = null; }
      else if (typeof val === "object") { val = JSON.stringify(val); }
      else if (typeof val === "string") { try { JSON.parse(val); } catch(_) { val = null; } }
    }
    values.push(val);
    updates.push(`${field} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);

  values.push(req.params.id);
  const { rows: [updated] } = await query(
    `UPDATE menu_items SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING *`,
    values
  );

  await cache.delPattern(`menu:public:*`).catch(() => {});
  return ok(res, { item: updated }, "Plat mis à jour");
});

// ── DELETE /menu/items/:id ────────────────────────────────────────────────────
export const deleteItem = asyncHandler(async (req, res) => {
  const { rows: [item] } = await query(
    "SELECT restaurant_id FROM menu_items WHERE id = $1", [req.params.id]
  );
  if (!item) return notFound(res, "Plat introuvable");
  _assertOwnerOrAdmin(req, { id: item.restaurant_id });

  await query(
    "UPDATE menu_items SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
    [req.params.id]
  );

  await cache.delPattern(`menu:public:*`).catch(() => {});
  return ok(res, null, "Plat retiré du menu");
});

// ── Helper ─────────────────────────────────────────────────────────────────────
function _assertOwnerOrAdmin(req, resto) {
  if (req.user.role === "admin") return;
  if (req.user.role === "restaurateur" && req.user.restaurant_id === resto.id) return;
  throw new AppError("Accès refusé", 403);
}
