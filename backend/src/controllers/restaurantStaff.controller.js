/**
 * Staff restaurant — TablièreCI
 * Le restaurateur crée des membres du staff (nom de rôle libre), leur donne un
 * identifiant + un PIN à 4 chiffres, et coche les onglets auxquels ils ont accès.
 * Le staff se connecte avec identifiant + PIN et agit dans le resto avec ses
 * seuls onglets. La gestion (créer/modifier/supprimer) est réservée au propriétaire.
 */

import { query } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { signRestaurantStaffToken } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

// Onglets attribuables (clés = segments de route de l'espace restaurant)
export const STAFF_TABS = ["dashboard", "reservations", "clients", "plan", "menu", "instants", "pos", "commandes", "recus", "profil"];

let migrated = false;
async function ensureTable() {
  if (migrated) return;
  await query(`
    CREATE TABLE IF NOT EXISTS restaurant_staff (
      id            BIGSERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL,
      name          VARCHAR(60) NOT NULL,
      login_id      VARCHAR(24) NOT NULL,
      pin           VARCHAR(4)  NOT NULL,
      permissions   JSONB NOT NULL DEFAULT '[]',
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_staff_login ON restaurant_staff(LOWER(login_id))`);
  await query(`CREATE INDEX IF NOT EXISTS idx_staff_resto ON restaurant_staff(restaurant_id)`);
  migrated = true;
}

// Restaurant du restaurateur PROPRIÉTAIRE connecté (jamais un staff)
async function ownerRestoId(req) {
  if (req.user.is_staff) throw new AppError("Réservé au restaurateur", 403);
  if (req.user.role === "admin" && req.query.restaurant_id) return req.query.restaurant_id;
  const { rows } = await query(
    "SELECT id FROM restaurants WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1", [req.user.id]);
  if (rows[0]) return rows[0].id;
  throw new AppError("Aucun restaurant associé à ce compte", 400);
}

function cleanPermissions(perms) {
  if (!Array.isArray(perms)) return [];
  return [...new Set(perms.filter(p => STAFF_TABS.includes(p)))];
}
function validLoginId(v) { return /^[A-Za-z0-9]{2,24}$/.test(v || ""); }

// ── POST /restaurant-staff/login — connexion staff (public) ─────────────────
export const login = asyncHandler(async (req, res) => {
  await ensureTable();
  const login_id = String(req.body.login_id || "").trim();
  const pin = String(req.body.pin || "").trim();
  if (!login_id || !pin) throw new AppError("Identifiant et code requis", 400);

  const { rows: [staff] } = await query(
    `SELECT rs.id, rs.name, rs.permissions, rs.restaurant_id, r.name AS resto_name, r.slug AS resto_slug
     FROM restaurant_staff rs JOIN restaurants r ON r.id = rs.restaurant_id
     WHERE LOWER(rs.login_id) = LOWER($1) AND rs.pin = $2 AND rs.is_active = TRUE`,
    [login_id, pin]);
  if (!staff) throw new AppError("Identifiant ou code incorrect", 401);

  const token = signRestaurantStaffToken({ id: staff.id, restaurant_id: staff.restaurant_id });
  return ok(res, {
    token,
    staff: { name: staff.name, permissions: Array.isArray(staff.permissions) ? staff.permissions : [] },
    restaurant: { id: staff.restaurant_id, name: staff.resto_name, slug: staff.resto_slug },
  }, "Connecté");
});

// ── GET /restaurant-staff — liste (propriétaire) ────────────────────────────
export const list = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = await ownerRestoId(req);
  const { rows } = await query(
    `SELECT id, name, login_id, pin, permissions, is_active, created_at
     FROM restaurant_staff WHERE restaurant_id = $1 ORDER BY created_at DESC`, [restoId]);
  return ok(res, { staff: rows, tabs: STAFF_TABS });
});

// ── POST /restaurant-staff — créer (propriétaire) ───────────────────────────
export const create = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = await ownerRestoId(req);
  const name = String(req.body.name || "").trim().slice(0, 60);
  const login_id = String(req.body.login_id || "").trim();
  const pin = String(req.body.pin || "").trim();
  if (!name) throw new AppError("Nom du rôle requis", 400);
  if (!validLoginId(login_id)) throw new AppError("Identifiant invalide (2 à 24 lettres/chiffres)", 400);
  if (!/^\d{4}$/.test(pin)) throw new AppError("Le code doit faire 4 chiffres", 400);
  const permissions = cleanPermissions(req.body.permissions);

  try {
    const { rows: [staff] } = await query(
      `INSERT INTO restaurant_staff (restaurant_id, name, login_id, pin, permissions)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id, name, login_id, pin, permissions, is_active, created_at`,
      [restoId, name, login_id, pin, JSON.stringify(permissions)]);
    logger.info("Staff resto créé", { restoId, staffId: staff.id, login_id });
    return created(res, { staff }, "Staff ajouté");
  } catch (e) {
    if (e.code === "23505") throw new AppError(`L'identifiant « ${login_id} » est déjà pris. Choisissez-en un autre.`, 409);
    throw e;
  }
});

// ── PATCH /restaurant-staff/:id — modifier (propriétaire) ───────────────────
export const update = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = await ownerRestoId(req);
  const sets = [], vals = [];
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim().slice(0, 60);
    if (!name) throw new AppError("Nom du rôle requis", 400);
    vals.push(name); sets.push(`name = $${vals.length}`);
  }
  if (req.body.login_id !== undefined) {
    const lid = String(req.body.login_id).trim();
    if (!validLoginId(lid)) throw new AppError("Identifiant invalide (2 à 24 lettres/chiffres)", 400);
    vals.push(lid); sets.push(`login_id = $${vals.length}`);
  }
  if (req.body.pin !== undefined) {
    const pin = String(req.body.pin).trim();
    if (!/^\d{4}$/.test(pin)) throw new AppError("Le code doit faire 4 chiffres", 400);
    vals.push(pin); sets.push(`pin = $${vals.length}`);
  }
  if (req.body.permissions !== undefined) {
    vals.push(JSON.stringify(cleanPermissions(req.body.permissions))); sets.push(`permissions = $${vals.length}::jsonb`);
  }
  if (req.body.is_active !== undefined) {
    vals.push(!!req.body.is_active); sets.push(`is_active = $${vals.length}`);
  }
  if (sets.length === 0) throw new AppError("Rien à modifier", 400);
  vals.push(req.params.id, restoId);
  try {
    const { rows: [staff] } = await query(
      `UPDATE restaurant_staff SET ${sets.join(", ")}
       WHERE id = $${vals.length - 1} AND restaurant_id = $${vals.length}
       RETURNING id, name, login_id, pin, permissions, is_active, created_at`, vals);
    if (!staff) return notFound(res, "Staff introuvable");
    return ok(res, { staff }, "Staff modifié");
  } catch (e) {
    if (e.code === "23505") throw new AppError("Cet identifiant est déjà pris.", 409);
    throw e;
  }
});

// ── DELETE /restaurant-staff/:id — supprimer (propriétaire) ─────────────────
export const remove = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = await ownerRestoId(req);
  const { rowCount } = await query(
    "DELETE FROM restaurant_staff WHERE id = $1 AND restaurant_id = $2", [req.params.id, restoId]);
  if (!rowCount) return notFound(res, "Staff introuvable");
  return ok(res, {}, "Staff retiré");
});
