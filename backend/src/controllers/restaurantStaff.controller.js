/**
 * Staff restaurant — TablièreCI
 * Le restaurateur crée des membres du staff (nom de rôle libre), leur donne un
 * identifiant + un PIN à 4 chiffres, et coche les onglets auxquels ils ont accès.
 * Le staff se connecte avec identifiant + PIN et agit dans le resto avec ses
 * seuls onglets. La gestion (créer/modifier/supprimer) est réservée au propriétaire.
 */

import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { signRestaurantStaffToken } from "../middleware/auth.js";
import { logger } from "../utils/logger.js";

// Un hash bcrypt commence par $2a/$2b/$2y. Permet de distinguer un PIN déjà haché
// d'un ancien PIN en clair (migration à la volée au login).
const isHashed = (v) => /^\$2[aby]\$/.test(String(v || ""));

// Onglets attribuables (clés = segments de route de l'espace restaurant)
export const STAFF_TABS = ["dashboard", "reservations", "clients", "plan", "menu", "instants", "pos", "commandes", "recus", "profil"];

let migrated = false;
async function ensureTable() {
  if (migrated) return;
  // Correctif : restaurants.id est un UUID. Une 1re version avait cree la table
  // avec restaurant_id INTEGER (insertions en echec). On recree si le type est faux
  // (la table est vide dans ce cas, aucune donnee perdue).
  await query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name='restaurant_staff' AND column_name='restaurant_id' AND data_type <> 'uuid') THEN
      DROP TABLE restaurant_staff CASCADE;
    END IF;
  END $$;`);
  await query(`
    CREATE TABLE IF NOT EXISTS restaurant_staff (
      id            BIGSERIAL PRIMARY KEY,
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name          VARCHAR(60) NOT NULL,
      login_id      VARCHAR(24) NOT NULL,
      pin           VARCHAR(72) NOT NULL,
      permissions   JSONB NOT NULL DEFAULT '[]',
      is_active     BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
  // Le PIN est désormais HACHÉ (bcrypt, 60 car.) — élargir la colonne des anciennes bases.
  await query(`ALTER TABLE restaurant_staff ALTER COLUMN pin TYPE VARCHAR(72)`).catch(() => {});
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

  // On charge par identifiant SEUL (jamais le PIN dans le WHERE) puis on compare
  // le hash en Node → comparaison à temps constant, PIN jamais en clair en base.
  const { rows: [staff] } = await query(
    `SELECT rs.id, rs.name, rs.pin, rs.permissions, rs.restaurant_id,
            r.name AS resto_name, r.slug AS resto_slug, r.status AS resto_status
     FROM restaurant_staff rs JOIN restaurants r ON r.id = rs.restaurant_id
     WHERE LOWER(rs.login_id) = LOWER($1) AND rs.is_active = TRUE`,
    [login_id]);
  // Message et coût identiques que le staff existe ou non (anti-énumération + anti-timing).
  const stored = staff?.pin || "$2b$10$0000000000000000000000000000000000000000000000000000";
  let okPin;
  if (isHashed(stored)) {
    okPin = await bcrypt.compare(pin, stored);
  } else {
    // Ancien PIN en clair : comparaison directe puis migration immédiate vers un hash.
    okPin = staff ? stored === pin : false;
    if (okPin) await query("UPDATE restaurant_staff SET pin = $1 WHERE id = $2", [await bcrypt.hash(pin, 10), staff.id]).catch(() => {});
  }
  if (!staff || !okPin) throw new AppError("Identifiant ou code incorrect", 401);
  if (["suspendu", "bloque"].includes(staff.resto_status)) throw new AppError("Compte restaurant indisponible", 403);

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
  // Le PIN (haché) n'est JAMAIS renvoyé. Pour le changer, le propriétaire en
  // définit un nouveau (pas de récupération de l'ancien).
  const { rows } = await query(
    `SELECT id, name, login_id, permissions, is_active, created_at
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
    const pinHash = await bcrypt.hash(pin, 10);
    const { rows: [staff] } = await query(
      `INSERT INTO restaurant_staff (restaurant_id, name, login_id, pin, permissions)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id, name, login_id, permissions, is_active, created_at`,
      [restoId, name, login_id, pinHash, JSON.stringify(permissions)]);
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
    vals.push(await bcrypt.hash(pin, 10)); sets.push(`pin = $${vals.length}`); // PIN toujours haché
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
       RETURNING id, name, login_id, permissions, is_active, created_at`, vals);
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
