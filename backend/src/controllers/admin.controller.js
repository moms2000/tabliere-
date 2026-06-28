import { query }  from "../config/db.js";
import { cache }   from "../config/redis.js";
import { ok, paginated, notFound } from "../utils/response.js";
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

    query(`SELECT plan, COUNT(*) AS count FROM restaurants GROUP BY plan`),

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
      ORDER BY r.created_at DESC LIMIT 10`),
  ]);

  const data = { global: global, byPlan, revenue, recentActivity };
  await cache.set(cacheKey, data, 60); // 60s
  return ok(res, data);
});

// ---------------------------------------------------------------------------
// GET /admin/restaurants
// ---------------------------------------------------------------------------
export const listRestaurants = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, plan, search } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }
  if (plan)   { params.push(plan);   conditions.push(`r.plan = $${params.length}`); }
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

  const { rows: [resto] } = await query(
    "UPDATE restaurants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, status",
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

  // Upsert subscription
  await query(
    `INSERT INTO subscriptions (restaurant_id, plan, started_at, status)
     VALUES ($1, $2, NOW(), TRUE)
     ON CONFLICT (restaurant_id) DO UPDATE SET plan = $2, starts_at = NOW(), is_active = TRUE`,
    [resto.id, plan]
  );

  await cache.delPattern(`restaurant:*`);
  await cache.del("admin:stats");
  logger.info("Plan restaurant mis à jour", { restoId: resto.id, plan });
  return ok(res, { restaurant: resto }, "Plan mis à jour");
});

// ---------------------------------------------------------------------------
// GET /admin/users
// ---------------------------------------------------------------------------
export const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, status, search } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (role)   { params.push(role);         conditions.push(`role = $${params.length}`); }
  if (status) { params.push(status);       conditions.push(`status = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT id, full_name, email, phone, role, status, created_at,
       (SELECT COUNT(*) FROM reservations WHERE client_id = users.id) AS resa_count
     FROM users ${where}
     ORDER BY created_at DESC
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

  const { rows: [user] } = await query(
    "UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, full_name, email, status",
    [status, req.params.id]
  );
  if (!user) return notFound(res, "Utilisateur introuvable");

  // Invalider le cache de session de cet utilisateur
  await cache.del(`user:${req.params.id}`);
  logger.info("Statut utilisateur mis à jour", { userId: user.id, status });
  return ok(res, { user }, "Statut utilisateur mis à jour");
});

// ---------------------------------------------------------------------------
// GET /admin/payments
// ---------------------------------------------------------------------------
export const listPayments = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, method, status } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (method) { params.push(method); conditions.push(`p.method = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }

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
  const where = status ? (params.push(status), `WHERE r.status = $1`) : "";

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
