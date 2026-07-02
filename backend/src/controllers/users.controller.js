import bcrypt              from "bcryptjs";
import { query }            from "../config/db.js";
import { cache }            from "../config/redis.js";
import { ok, paginated, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { revokeToken }      from "../middleware/auth.js";
import { logger }           from "../utils/logger.js";

// ---------------------------------------------------------------------------
// GET /users/me/reservations
// ---------------------------------------------------------------------------
export const myReservations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const offset = (page - 1) * limit;
  const params = [req.user.id];
  let where = "WHERE r.client_id = $1";

  if (status) { params.push(status); where += ` AND r.status = $${params.length}`; }

  const { rows } = await query(
    `SELECT r.id, r.ref, r.status, r.reserved_at, r.party_size,
            r.special_request, r.cancel_reason,
            re.name AS resto_name, re.slug AS resto_slug,
            re.address, re.phone AS resto_phone,
            p.status AS payment_status, p.method AS payment_method
     FROM reservations r
     JOIN restaurants re ON re.id = r.restaurant_id
     LEFT JOIN payments p ON p.reservation_id = r.id
     ${where}
     ORDER BY r.reserved_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM reservations r ${where}`, params
  );
  return paginated(res, rows, { page: +page, limit: +limit, total: +count });
});

// ---------------------------------------------------------------------------
// PATCH /users/me
// ---------------------------------------------------------------------------
export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ["full_name", "phone", "password", "avatar_url"];
  const updates = [];
  const values  = [];

  for (const field of allowed) {
    if (req.body[field] === undefined) continue;

    if (field === "password") {
      if (req.body[field].length < 8) throw new AppError("Le mot de passe doit contenir au moins 8 caractères", 400);
      const hashed = await bcrypt.hash(req.body[field], 12);
      values.push(hashed);
      updates.push(`password_hash = $${values.length}`);
    } else {
      values.push(req.body[field]);
      updates.push(`${field} = $${values.length}`);
    }
  }

  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);

  values.push(req.user.id);
  const { rows: [user] } = await query(
    `UPDATE users SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING id, full_name, email, phone, role, status, avatar_url`,
    values
  );

  // Invalider le cache
  await cache.del(`user:${req.user.id}`);
  logger.info("Profil utilisateur mis à jour", { userId: req.user.id });
  return ok(res, { user }, "Profil mis à jour");
});

// ---------------------------------------------------------------------------
// DELETE /users/me — Soft delete (anonymisation RGPD)
// ---------------------------------------------------------------------------
export const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) throw new AppError("Mot de passe requis pour confirmer la suppression", 400);

  const { rows: [user] } = await query(
    "SELECT password_hash FROM users WHERE id = $1", [req.user.id]
  );
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError("Mot de passe incorrect", 401);

  // Anonymisation : on ne supprime pas les réservations passées pour des raisons légales
  await query(
    `UPDATE users SET
       full_name     = 'Compte supprimé',
       email         = $1,
       phone         = NULL,
       password_hash = '',
       status        = 'suspendu',
       updated_at    = NOW()
     WHERE id = $2`,
    [`deleted_${req.user.id}@tabliereci.ci`, req.user.id]
  );

  // Invalider token JWT en cours
  const token = req.headers.authorization?.split(" ")[1];
  if (token) await revokeToken(token);

  await cache.del(`user:${req.user.id}`);
  logger.info("Compte supprimé (anonymisé)", { userId: req.user.id });
  return ok(res, null, "Votre compte a été supprimé");
});
