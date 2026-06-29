/**
 * Reviews Controller — TablièreCI
 * Avis clients sur les restaurants
 */
import { query }  from "../config/db.js";
import { cache }  from "../config/redis.js";
import { ok, created, notFound, forbidden, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";

// ── GET /restaurants/:slug/reviews ───────────────────────────────────────────
export const listReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const { rows: [resto] } = await query(
    "SELECT id FROM restaurants WHERE slug = $1",
    [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  const { rows } = await query(
    `SELECT rv.id, rv.rating, rv.comment, rv.created_at,
            u.full_name AS client_name, u.avatar_url AS client_avatar
     FROM reviews rv
     JOIN users u ON u.id = rv.client_id
     WHERE rv.restaurant_id = $1
     ORDER BY rv.created_at DESC
     LIMIT $2 OFFSET $3`,
    [resto.id, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    "SELECT COUNT(*) FROM reviews WHERE restaurant_id = $1", [resto.id]
  );

  const { rows: [agg] } = await query(
    "SELECT AVG(rating)::numeric(3,2) AS avg_rating, COUNT(*) AS total FROM reviews WHERE restaurant_id = $1",
    [resto.id]
  );

  return paginated(res, rows, +count, +page, +limit, {
    avg_rating: parseFloat(agg?.avg_rating || 0),
    total_reviews: +count,
  });
});

// ── POST /restaurants/:slug/reviews ──────────────────────────────────────────
export const createReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5)
    throw new AppError("La note doit être entre 1 et 5", 400);

  const { rows: [resto] } = await query(
    "SELECT id FROM restaurants WHERE slug = $1 AND status = 'actif'",
    [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  // Vérifier que le client a au moins visité ou réservé (critère assoupli pour la démo)
  // En production: restreindre aux réservations confirmées passées
  // const { rows: [eligibleResa] } = await query(...);

  // Insérer ou mettre à jour (ON CONFLICT = mise à jour de l'avis)
  const { rows: [review] } = await query(
    `INSERT INTO reviews (restaurant_id, client_id, rating, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (restaurant_id, client_id) DO UPDATE
       SET rating = $3, comment = $4, created_at = NOW()
     RETURNING *`,
    [resto.id, req.user.id, rating, comment || null]
  );

  // Mettre à jour la note moyenne du restaurant
  await query(
    `UPDATE restaurants
     SET rating       = (SELECT AVG(rating)::numeric(3,2) FROM reviews WHERE restaurant_id = $1),
         review_count = (SELECT COUNT(*) FROM reviews WHERE restaurant_id = $1),
         updated_at   = NOW()
     WHERE id = $1`,
    [resto.id]
  );

  // Invalider le cache
  await cache.delPattern(`restaurant:*`).catch(() => {});
  await cache.del("admin:stats").catch(() => {});

  logger.info("Avis créé/mis à jour", { restoId: resto.id, userId: req.user.id, rating });
  return created(res, { review }, "Avis publié avec succès");
});

// ── GET /reviews/can-review/:slug ─────────────────────────────────────────────
// Vérifie si l'utilisateur connecté peut laisser un avis
export const canReview = asyncHandler(async (req, res) => {
  const { rows: [resto] } = await query(
    "SELECT id FROM restaurants WHERE slug = $1", [req.params.slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  // Tout utilisateur connecté peut laisser un avis
  const { rows: [existing] } = await query(
    "SELECT id, rating, comment FROM reviews WHERE restaurant_id = $1 AND client_id = $2",
    [resto.id, req.user.id]
  );

  return ok(res, {
    can_review:      true, // ouvert à tous les utilisateurs connectés
    has_review:      !!existing,
    existing_review: existing || null,
  });
});
