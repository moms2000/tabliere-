import { query, withTransaction }  from "../config/db.js";
import { cache }   from "../config/redis.js";
import { ok, created, paginated, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger }  from "../utils/logger.js";

// ---------------------------------------------------------------------------
// GET /admin/stats
// ---------------------------------------------------------------------------
export const getStats = asyncHandler(async (_req, res) => {
  const cacheKey = "admin:stats";
  const cached = await cache.get(cacheKey);
  if (cached) return ok(res, cached);

  const [
    { rows: [global] },
    { rows: byPlan },
    { rows: revenue },
    { rows: recentActivity },
  ] = await Promise.all([
    query(`SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'client')                          AS total_clients,
      (SELECT COUNT(*) FROM restaurants WHERE status = 'actif')                   AS total_restos,
      (SELECT COUNT(*) FROM reservations WHERE DATE(created_at) = CURRENT_DATE)   AS resa_today,
      (SELECT COUNT(*) FROM reservations WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) AS resa_month,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'succes' AND DATE(created_at) = CURRENT_DATE) AS revenue_today,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status = 'succes' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)) AS revenue_month`),

    query(`SELECT plan, COUNT(*) AS count FROM restaurants WHERE deleted_at IS NULL GROUP BY plan`),

    query(`SELECT
        DATE_TRUNC('day', created_at)::date AS day,
        SUM(amount) AS total
      FROM payments
      WHERE status = 'succes' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1`),

    query(`SELECT r.ref, r.status, r.created_at, re.name AS resto_name, u.full_name AS client_name
      FROM reservations r
      JOIN restaurants re ON re.id = r.restaurant_id
      JOIN users u ON u.id = r.client_id
      WHERE r.archived_at IS NULL
      ORDER BY r.created_at DESC LIMIT 10`),
  ]);

  const data = { global: global, byPlan, revenue, recentActivity };
  await cache.set(cacheKey, data, 300); // 5 min
  return ok(res, data);
});

// ---------------------------------------------------------------------------
// GET /admin/restaurants
// ---------------------------------------------------------------------------
export const listRestaurants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, plan, search, deleted } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  // Par défaut on masque les restaurants supprimés ; ?deleted=true affiche la « corbeille »
  const conditions = [deleted === "true" ? "r.deleted_at IS NOT NULL" : "r.deleted_at IS NULL"];

  // Cast ::text : un filtre ENUM invalide (status/plan) donne 0 résultat, pas un 500
  if (status) { params.push(status); conditions.push(`r.status::text = $${params.length}`); }
  if (plan)   { params.push(plan);   conditions.push(`r.plan::text = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`r.name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT r.*, u.full_name AS owner_name, u.email AS owner_email,
       (SELECT COUNT(*) FROM reservations WHERE restaurant_id = r.id) AS resa_count
     FROM restaurants r
     JOIN users u ON u.id = r.owner_id
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM restaurants r ${where}`, params
  );
  return paginated(res, rows, +count, +page, +limit);
});

// ---------------------------------------------------------------------------
// PATCH /admin/restaurants/:id/status
// ---------------------------------------------------------------------------
export const setRestaurantStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["actif","suspendu","en_attente"];
  if (!allowed.includes(status)) throw new AppError(`Statut invalide. Valeurs: ${allowed.join(", ")}`, 400);

  // Réactiver (status='actif') = restaurer un restaurant masqué → on efface deleted_at.
  const { rows: [resto] } = await query(
    `UPDATE restaurants
       SET status = $1, updated_at = NOW(),
           deleted_at = CASE WHEN $1 = 'actif' THEN NULL ELSE deleted_at END
     WHERE id = $2 RETURNING id, name, status`,
    [status, req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  await cache.delPattern(`restaurant:*`);
  await cache.del("admin:stats");
  logger.info("Statut restaurant mis à jour", { restoId: resto.id, status });
  return ok(res, { restaurant: resto }, "Statut mis à jour");
});

// ---------------------------------------------------------------------------
// PATCH /admin/restaurants/:id/plan
// ---------------------------------------------------------------------------
export const setRestaurantPlan = asyncHandler(async (req, res) => {
  const { plan } = req.body;
  const allowed = ["gratuit","standard","premium"];
  if (!allowed.includes(plan)) throw new AppError(`Plan invalide. Valeurs: ${allowed.join(", ")}`, 400);

  // Si downgrade vers gratuit, désactiver QR automatiquement
  const qrEnabled = plan === "gratuit" ? false : undefined;

  const updateClause = qrEnabled !== undefined
    ? "plan = $1, qr_active = $2, updated_at = NOW()"
    : "plan = $1, updated_at = NOW()";
  const updateParams = qrEnabled !== undefined
    ? [plan, qrEnabled, req.params.id]
    : [plan, req.params.id];

  const { rows: [resto] } = await query(
    `UPDATE restaurants SET ${updateClause} WHERE id = $${updateParams.length} RETURNING id, name, plan, qr_active`,
    updateParams
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  // Enregistrer la subscription (colonnes réelles : starts_at, price, is_active)
  // Pas d'ON CONFLICT car aucune contrainte unique sur restaurant_id → DELETE+INSERT
  const priceMap = { gratuit: 0, standard: 25000, premium: 60000 };
  try {
    await query("DELETE FROM subscriptions WHERE restaurant_id = $1", [resto.id]);
    await query(
      `INSERT INTO subscriptions (restaurant_id, plan, price, starts_at, is_active)
       VALUES ($1, $2, $3, NOW(), TRUE)`,
      [resto.id, plan, priceMap[plan] ?? 0]
    );
  } catch (e) {
    logger.warn("Subscription non enregistrée (plan mis à jour quand même)", { error: e.message });
  }

  await cache.delPattern(`restaurant:*`);
  await cache.del("admin:stats");
  logger.info("Plan restaurant mis à jour", { restoId: resto.id, plan });
  return ok(res, { restaurant: resto }, "Plan mis à jour");
});

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------
export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, role, status, search, sort = "name" } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  // Exclure les comptes anonymisés (supprimés)
  conditions.push(`full_name != 'Compte supprimé'`);

  if (role)   { params.push(role);          conditions.push(`role = $${params.length}`); }
  if (status) {
    // "bloque" → chercher suspendu en DB
    const dbStatus = status === "bloque" ? "suspendu" : status;
    params.push(dbStatus); conditions.push(`status = $${params.length}`);
  }
  if (search) { params.push(`%${search}%`); conditions.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`); }

  const where = `WHERE ${conditions.join(" AND ")}`;
  const ORDER_MAP = { name: "full_name ASC", recent: "created_at DESC", old: "created_at ASC" };
  const orderBy = ORDER_MAP[sort] || "full_name ASC";

  const { rows } = await query(
    `SELECT DISTINCT ON (u.id) u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at,
       (SELECT COUNT(*) FROM reservations WHERE client_id = u.id) AS resa_count,
       (SELECT name   FROM restaurants WHERE owner_id = u.id LIMIT 1) AS resto_name,
       (SELECT slug   FROM restaurants WHERE owner_id = u.id LIMIT 1) AS resto_slug,
       (SELECT status FROM restaurants WHERE owner_id = u.id LIMIT 1) AS resto_status,
       (SELECT code   FROM restaurateur_codes WHERE used_by = u.id LIMIT 1) AS access_code
     FROM users u
     ${where}
     ORDER BY u.id, ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM users ${where}`, params
  );
  return paginated(res, rows, +count, +page, +limit);
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id/status
// ---------------------------------------------------------------------------
export const setUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ["actif","bloque","suspendu"];
  if (!allowed.includes(status)) throw new AppError(`Statut invalide. Valeurs: ${allowed.join(", ")}`, 400);

  // "bloque" → "suspendu" (même effet DB, même restriction de connexion)
  const dbStatus = status === "bloque" ? "suspendu" : status;

  const { rows: [user] } = await query(
    "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, status",
    [dbStatus, req.params.id]
  );
  if (!user) return notFound(res, "Utilisateur introuvable");

  await cache.del(`user:${req.params.id}`);
  logger.info("Statut utilisateur mis à jour", { userId: user.id, status: dbStatus });
  return ok(res, { user: { ...user, status: status === "bloque" ? "bloque" : user.status } }, "Statut utilisateur mis à jour");
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/:id — modifier email/nom/rôle/mot de passe
// ---------------------------------------------------------------------------
export const updateUser = asyncHandler(async (req, res) => {
  const { full_name, email, role, new_password } = req.body;
  const ALLOWED_ROLES = ["client", "restaurateur", "admin"];
  if (role && !ALLOWED_ROLES.includes(role)) throw new AppError("Rôle invalide", 400);

  const updates = [];
  const values  = [];

  if (full_name) { values.push(full_name); updates.push(`full_name = $${values.length}`); }
  if (email) {
    // Vérifier l'unicité du nouvel email
    const { rows: [conflict] } = await query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [email.toLowerCase(), req.params.id]
    );
    if (conflict) throw new AppError("Cet email est déjà utilisé par un autre compte", 409);
    values.push(email.toLowerCase()); updates.push(`email = $${values.length}`);
  }
  if (role) { values.push(role); updates.push(`role = $${values.length}`); }
  if (new_password) {
    if (new_password.length < 8) throw new AppError("Mot de passe minimum 8 caractères", 400);
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.default.hash(new_password, 12);
    values.push(hash); updates.push(`password_hash = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);

  values.push(req.params.id);
  const { rows: [user] } = await query(
    `UPDATE users SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING id, full_name, email, role, status`,
    values
  );
  if (!user) return notFound(res, "Utilisateur introuvable");

  await cache.del(`user:${req.params.id}`);
  logger.info("Utilisateur mis à jour par admin", { userId: user.id });
  return ok(res, { user }, "Utilisateur mis à jour");
});

// ---------------------------------------------------------------------------
// DELETE /admin/users/:id
// ---------------------------------------------------------------------------
export const deleteUser = asyncHandler(async (req, res) => {
  const { rows: [user] } = await query(
    "SELECT id, full_name, role FROM users WHERE id = $1", [req.params.id]
  );
  if (!user) return notFound(res, "Utilisateur introuvable");
  if (user.role === "admin") throw new AppError("Impossible de supprimer un administrateur", 403);
  const uid = req.params.id;

  // Suppression = soft-delete RÉVERSIBLE + cascade complète (atomique).
  //  - Restaurants du compte → masqués (status suspendu + deleted_at) : disparaissent
  //    côté client, dans l'admin et dans QR & Thèmes (filtrés par deleted_at IS NULL).
  //  - Réservations de ces restaurants → archivées (archived_at) : cachées de l'admin,
  //    mais conservées (aucune donnée perdue).
  //  - Événements de l'organisateur → annulés (disparaissent du public).
  //  - Codes d'accès (restaurateur + organisateur) utilisés par ce compte → LIBÉRÉS
  //    (redeviennent disponibles pour une nouvelle inscription).
  //  - Le compte lui-même → anonymisé + suspendu.
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE restaurants SET status = 'suspendu', deleted_at = NOW(), updated_at = NOW() WHERE owner_id = $1`,
      [uid]
    );
    await client.query(
      `UPDATE reservations SET archived_at = NOW(), updated_at = NOW()
       WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = $1)`,
      [uid]
    );
    await client.query(`UPDATE events SET status = 'annule', updated_at = NOW() WHERE owner_id = $1`, [uid]);
    await client.query(`UPDATE restaurateur_codes SET is_used = FALSE, used_by = NULL, used_at = NULL WHERE used_by = $1`, [uid]);
    await client.query(`UPDATE organisateur_codes SET is_used = FALSE, used_by = NULL, used_at = NULL WHERE used_by = $1`, [uid]);
    await client.query(
      `UPDATE users SET
         email         = 'deleted_' || id || '@tabliereci.ci',
         full_name     = 'Compte supprimé',
         phone         = NULL,
         password_hash = 'DELETED',
         status        = 'suspendu',
         updated_at    = NOW()
       WHERE id = $1`,
      [uid]
    );
  });

  await cache.del(`user:${uid}`);
  logger.info("Compte supprimé + cascade (resto masqué, résa archivées, code libéré)", { userId: uid });
  return ok(res, null, "Compte supprimé");
});

// ---------------------------------------------------------------------------
// GET /admin/payments
// ---------------------------------------------------------------------------
export const listPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, method, status } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  // Cast ::text : filtre ENUM invalide (method/status) → 0 résultat, pas un 500
  if (method) { params.push(method); conditions.push(`p.method::text = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`p.status::text = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT p.*, u.full_name AS client_name, re.name AS resto_name, r.ref AS resa_ref
     FROM payments p
     JOIN reservations r ON r.id = p.reservation_id
     JOIN users u ON u.id = r.client_id
     JOIN restaurants re ON re.id = r.restaurant_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM payments p ${where}`, params
  );
  return paginated(res, rows, +count, +page, +limit);
});

// ---------------------------------------------------------------------------
// GET /admin/reservations
// ---------------------------------------------------------------------------
export const listReservations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ["r.archived_at IS NULL"]; // masquer les réservations archivées (comptes supprimés)
  if (status) { params.push(status); conditions.push(`r.status::text = $${params.length}`); }
  const where = `WHERE ${conditions.join(" AND ")}`;

  const { rows } = await query(
    `SELECT r.*, re.name AS resto_name, u.full_name AS client_name
     FROM reservations r
     JOIN restaurants re ON re.id = r.restaurant_id
     JOIN users u ON u.id = r.client_id
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

// ---------------------------------------------------------------------------
// PATCH /admin/restaurants/batch — statut en masse
// ---------------------------------------------------------------------------
export const batchRestaurantStatus = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  const allowed = ["actif", "suspendu", "en_attente"];
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError("ids[] requis", 400);
  if (!allowed.includes(status)) throw new AppError(`Statut invalide : ${allowed.join(", ")}`, 400);

  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
  const { rowCount } = await query(
    `UPDATE restaurants SET status = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
    [status, ...ids]
  );

  await cache.delPattern("restaurant:*");
  await cache.del("admin:stats");
  logger.info("Batch statut restaurants", { count: rowCount, status });
  return ok(res, { updated: rowCount }, `${rowCount} restaurant(s) mis à jour`);
});

// ---------------------------------------------------------------------------
// PATCH /admin/users/batch — statut en masse
// ---------------------------------------------------------------------------
export const batchUserStatus = asyncHandler(async (req, res) => {
  const { ids, status } = req.body;
  const allowed = ["actif", "bloque", "suspendu"];
  if (!Array.isArray(ids) || ids.length === 0) throw new AppError("ids[] requis", 400);
  if (!allowed.includes(status)) throw new AppError(`Statut invalide : ${allowed.join(", ")}`, 400);

  const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
  const { rowCount } = await query(
    `UPDATE users SET status = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
    [status, ...ids]
  );

  // Invalider le cache de session pour chaque utilisateur modifié
  await Promise.all(ids.map(id => cache.del(`user:${id}`)));
  logger.info("Batch statut utilisateurs", { count: rowCount, status });
  return ok(res, { updated: rowCount }, `${rowCount} utilisateur(s) mis à jour`);
});

// ---------------------------------------------------------------------------
// GET /admin/export?type=restaurants|users|reservations — CSV download
// ---------------------------------------------------------------------------
export const exportCSV = asyncHandler(async (req, res) => {
  const { type = "restaurants" } = req.query;

  let rows, headers, filename;

  if (type === "restaurants") {
    ({ rows } = await query(
      `SELECT r.name, r.ville, r.quartier, r.cuisine_type, r.plan, r.status,
              r.rating, r.review_count, r.commission_pct,
              u.full_name AS owner_name, u.email AS owner_email,
              (SELECT COUNT(*) FROM reservations WHERE restaurant_id = r.id) AS resa_count,
              r.created_at
       FROM restaurants r JOIN users u ON u.id = r.owner_id
       ORDER BY r.created_at DESC`
    ));
    headers = ["Nom", "Ville", "Quartier", "Cuisine", "Plan", "Statut", "Note", "Avis",
               "Commission %", "Gérant", "Email gérant", "Réservations", "Inscrit le"];
    filename = "restaurants.csv";

  } else if (type === "users") {
    ({ rows } = await query(
      `SELECT full_name, email, phone, role, status, created_at,
              (SELECT COUNT(*) FROM reservations WHERE client_id = users.id) AS resa_count
       FROM users ORDER BY created_at DESC`
    ));
    headers = ["Nom", "Email", "Téléphone", "Rôle", "Statut", "Inscrit le", "Réservations"];
    filename = "utilisateurs.csv";

  } else if (type === "reservations") {
    ({ rows } = await query(
      `SELECT r.ref, r.status, r.reserved_at, r.party_size, r.special_request,
              re.name AS restaurant, u.full_name AS client, u.email AS email_client,
              r.created_at
       FROM reservations r
       JOIN restaurants re ON re.id = r.restaurant_id
       JOIN users u ON u.id = r.client_id
       ORDER BY r.reserved_at DESC`
    ));
    headers = ["Référence", "Statut", "Date réservation", "Couverts", "Demande spéciale",
               "Restaurant", "Client", "Email client", "Créé le"];
    filename = "reservations.csv";

  } else {
    throw new AppError("type invalide : restaurants | users | reservations", 400);
  }

  const escape = (v) => {
    if (v == null) return "";
    const s = String(v instanceof Date ? v.toISOString() : v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    headers.join(","),
    ...rows.map(row => Object.values(row).map(escape).join(",")),
  ].join("\r\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("﻿" + csv); // BOM UTF-8 pour Excel
});

// ---------------------------------------------------------------------------
// PATCH /admin/reservations/:id
// ---------------------------------------------------------------------------
export const updateReservation = asyncHandler(async (req, res) => {
  const { rows: [resa] } = await query(
    "SELECT id FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  // Validation avant écriture (évite les 500 ENUM/CHECK)
  const RESA_STATUSES = ["en_attente", "confirme", "annule", "no_show", "termine"];
  if (req.body.status !== undefined && !RESA_STATUSES.includes(req.body.status)) {
    throw new AppError("Statut de réservation invalide", 400);
  }
  if (req.body.party_size !== undefined) {
    const n = parseInt(req.body.party_size, 10);
    if (!Number.isFinite(n) || n <= 0) throw new AppError("Nombre de couverts invalide", 400);
  }

  const ALLOWED = ["reserved_at","party_size","status","notes","special_request","table_id"];
  const updates = [];
  const values  = [];
  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    values.push(req.body[field]);
    updates.push(`${field} = $${values.length}`);
  }
  if (!updates.length) { return ok(res, null, "Aucun champ à mettre à jour"); }

  values.push(req.params.id);
  const { rows: [updated] } = await query(
    `UPDATE reservations SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING *`,
    values
  );
  return ok(res, { reservation: updated }, "Réservation mise à jour");
});

// ---------------------------------------------------------------------------
// PATCH /admin/restaurants/:id/qr — activer/désactiver QR
// ---------------------------------------------------------------------------
export const toggleRestaurantQR = asyncHandler(async (req, res) => {
  const { active } = req.body;
  if (typeof active !== "boolean") throw new AppError("active (boolean) requis", 400);

  const { rows: [resto] } = await query(
    "UPDATE restaurants SET qr_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, qr_active",
    [active, req.params.id]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  await cache.delPattern("restaurant:*");
  logger.info("QR restaurant mis à jour", { restoId: resto.id, qr_active: active });
  return ok(res, { restaurant: resto }, active ? "QR Menu activé" : "QR Menu désactivé");
});

// ---------------------------------------------------------------------------
// POST /admin/codes/generate — générer des codes restaurateurs
// ---------------------------------------------------------------------------
export const generateCodes = asyncHandler(async (req, res) => {
  const { count = 1, notes, expires_days } = req.body;

  // S'assurer que la table existe
  await query(`
    CREATE TABLE IF NOT EXISTS restaurateur_codes (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code        VARCHAR(20) UNIQUE NOT NULL,
      is_used     BOOLEAN NOT NULL DEFAULT FALSE,
      used_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      used_at     TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      expires_at  TIMESTAMPTZ,
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  if (count < 1 || count > 50) throw new AppError("count doit être entre 1 et 50", 400);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "REST-";
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    c += "-";
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  };

  const expires_at = expires_days
    ? new Date(Date.now() + expires_days * 86400000).toISOString()
    : null;

  const codes = [];
  for (let i = 0; i < count; i++) {
    let code, exists = true;
    while (exists) {
      code = generateCode();
      const { rows: [r] } = await query("SELECT id FROM restaurateur_codes WHERE code = $1", [code]);
      exists = !!r;
    }
    const { rows: [row] } = await query(
      `INSERT INTO restaurateur_codes (code, notes, expires_at, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, notes || null, expires_at, req.user.id]
    );
    codes.push(row);
  }

  logger.info("Codes restaurateurs générés", { count: codes.length, adminId: req.user.id });
  return created(res, { codes }, `${codes.length} code(s) généré(s)`);
});

// ---------------------------------------------------------------------------
// GET /admin/codes — liste tous les codes
// ---------------------------------------------------------------------------
export const listCodes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, used } = req.query;
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (used === "true")  { conditions.push("c.is_used = TRUE"); }
  if (used === "false") { conditions.push("c.is_used = FALSE"); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT c.*, u.full_name AS used_by_name, u.email AS used_by_email
     FROM restaurateur_codes c
     LEFT JOIN users u ON u.id = c.used_by
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM restaurateur_codes c ${where}`, params
  );
  return paginated(res, rows, +count, +page, +limit);
});

// ---------------------------------------------------------------------------
// DELETE /admin/codes/:id — supprimer un code non utilisé
// ---------------------------------------------------------------------------
export const deleteCode = asyncHandler(async (req, res) => {
  const { rows: [code] } = await query(
    "SELECT id, is_used FROM restaurateur_codes WHERE id = $1", [req.params.id]
  );
  if (!code) return notFound(res, "Code introuvable");
  if (code.is_used) throw new AppError("Ce code a déjà été utilisé", 400);

  await query("DELETE FROM restaurateur_codes WHERE id = $1", [req.params.id]);
  return ok(res, null, "Code supprimé");
});

// ---------------------------------------------------------------------------
// Codes ORGANISATEURS (espace Événements) — mêmes règles que restaurateurs
// ---------------------------------------------------------------------------
export const generateOrganisateurCodes = asyncHandler(async (req, res) => {
  const { count = 1, notes, expires_days } = req.body;
  await query(`
    CREATE TABLE IF NOT EXISTS organisateur_codes (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      code        VARCHAR(20) UNIQUE NOT NULL,
      is_used     BOOLEAN NOT NULL DEFAULT FALSE,
      used_by     UUID REFERENCES users(id) ON DELETE SET NULL,
      used_at     TIMESTAMPTZ,
      created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
      expires_at  TIMESTAMPTZ,
      notes       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
  if (count < 1 || count > 50) throw new AppError("count doit être entre 1 et 50", 400);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let c = "ORG-";
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    c += "-";
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
  };

  const expires_at = expires_days
    ? new Date(Date.now() + expires_days * 86400000).toISOString()
    : null;

  const codes = [];
  for (let i = 0; i < count; i++) {
    let code, exists = true;
    while (exists) {
      code = generateCode();
      const { rows: [r] } = await query("SELECT id FROM organisateur_codes WHERE code = $1", [code]);
      exists = !!r;
    }
    const { rows: [row] } = await query(
      `INSERT INTO organisateur_codes (code, notes, expires_at, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code, notes || null, expires_at, req.user.id]
    );
    codes.push(row);
  }
  logger.info("Codes organisateurs générés", { count: codes.length, adminId: req.user.id });
  return created(res, { codes }, `${codes.length} code(s) généré(s)`);
});

export const listOrganisateurCodes = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, used } = req.query;
  const offset = (page - 1) * limit;
  const conditions = [];
  if (used === "true")  conditions.push("c.is_used = TRUE");
  if (used === "false") conditions.push("c.is_used = FALSE");
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT c.*, u.full_name AS used_by_name, u.email AS used_by_email
     FROM organisateur_codes c
     LEFT JOIN users u ON u.id = c.used_by
     ${where}
     ORDER BY c.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  ).catch(() => ({ rows: [] }));
  const { rows: [{ count } = { count: 0 }] } = await query(
    `SELECT COUNT(*) FROM organisateur_codes c ${where}`
  ).catch(() => ({ rows: [{ count: 0 }] }));
  return paginated(res, rows, +count, +page, +limit);
});

export const deleteOrganisateurCode = asyncHandler(async (req, res) => {
  const { rows: [code] } = await query(
    "SELECT id, is_used FROM organisateur_codes WHERE id = $1", [req.params.id]
  );
  if (!code) return notFound(res, "Code introuvable");
  if (code.is_used) throw new AppError("Ce code a déjà été utilisé", 400);
  await query("DELETE FROM organisateur_codes WHERE id = $1", [req.params.id]);
  return ok(res, null, "Code supprimé");
});

// ---------------------------------------------------------------------------
// GET /admin/prospects — liste des prospects (invités sans compte)
// ---------------------------------------------------------------------------
export const listProspects = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, restaurant_id } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (restaurant_id) { params.push(restaurant_id); conditions.push(`p.restaurant_id = $${params.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT p.*, r.name AS resto_name
     FROM prospects p
     LEFT JOIN restaurants r ON r.id = p.restaurant_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: [{ count }] } = await query(`SELECT COUNT(*) FROM prospects p ${where}`, params);
  return paginated(res, rows, +count, +page, +limit);
});

// ---------------------------------------------------------------------------
// GET  /admin/settings — paramètres de la plateforme
// PATCH /admin/settings — mettre à jour les paramètres
// ---------------------------------------------------------------------------
const SETTINGS_DEFAULTS = {
  // Notifications
  notif_reservations: "true",
  notif_abonnements:  "true",
  notif_paiements:    "false",
  notif_whatsapp:     "true",
  // Système
  maintenance_mode:   "false",
  inscriptions_open:  "true",
  commission_pct:     "5",
  price_gratuit:      "0",
  price_standard:     "25000",
  price_premium:      "60000",
  session_duration_h: "4",
  // Informations de contact
  site_name:          "TablièreCI",
  contact_email:      "contact@tabliereci.net",
  contact_phone:      "+225 07 00 00 00 00",
  contact_address:    "Abidjan, Côte d'Ivoire",
  contact_whatsapp:   "+225 07 00 00 00 00",
  // Réseaux sociaux
  facebook_url:       "",
  instagram_url:      "",
  // Textes légaux
  cgu_text:           "",
  privacy_text:       "",
  // Branding
  logo_url:           "",
  banner_url:         "",
  primary_color:      "#E8A045",
};

let settingsMigrated = false;
async function ensureSettingsTable() {
  if (settingsMigrated) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Insérer les valeurs par défaut si la table vient d'être créée
    for (const [k, v] of Object.entries(SETTINGS_DEFAULTS)) {
      await query(
        `INSERT INTO platform_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO NOTHING`,
        [k, v]
      );
    }
  } catch (_) {}
  settingsMigrated = true;
}

export const getSettings = asyncHandler(async (req, res) => {
  await ensureSettingsTable();
  const { rows } = await query("SELECT key, value FROM platform_settings ORDER BY key");
  const settings = { ...SETTINGS_DEFAULTS };
  rows.forEach(r => { settings[r.key] = r.value; });
  return ok(res, { settings });
});

export const updateSettings = asyncHandler(async (req, res) => {
  await ensureSettingsTable();
  const updates = req.body; // { key: value, ... }
  if (!updates || typeof updates !== "object") throw new AppError("Body invalide", 400);

  for (const [k, v] of Object.entries(updates)) {
    if (!(k in SETTINGS_DEFAULTS)) continue; // ignorer les clés inconnues
    await query(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [k, String(v)]
    );
  }

  // Si maintenance_mode change, loguer
  if ("maintenance_mode" in updates) {
    logger.info("Mode maintenance mis à jour", { active: updates.maintenance_mode });
  }

  return ok(res, null, "Paramètres enregistrés");
});

// ---------------------------------------------------------------------------
// POST /admin/users/:id/reset-password — envoyer email de réinitialisation
// ---------------------------------------------------------------------------
export const changeAdminPassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) throw new AppError("Mot de passe actuel et nouveau requis", 400);
  if (new_password.length < 8) throw new AppError("Le nouveau mot de passe doit faire au moins 8 caractères", 400);

  const bcrypt = await import("bcryptjs");
  const { rows: [admin] } = await query(
    "SELECT id, password_hash FROM users WHERE id = $1 AND role = 'admin'",
    [req.user.id]
  );
  if (!admin) return notFound(res, "Administrateur introuvable");

  const valid = await bcrypt.default.compare(current_password, admin.password_hash);
  if (!valid) throw new AppError("Mot de passe actuel incorrect", 401);

  const hash = await bcrypt.default.hash(new_password, 12);
  await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [hash, req.user.id]);

  logger.info("Mot de passe admin changé", { userId: req.user.id });
  return ok(res, null, "Mot de passe mis à jour avec succès");
});
