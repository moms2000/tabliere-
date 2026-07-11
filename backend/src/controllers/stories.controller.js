/**
 * Stories Controller — « Instants » éphémères (24h) sur la page d'un restaurant.
 * Règles :
 *  - Voir : réservé aux utilisateurs connectés (incite à l'inscription).
 *  - Poster : client avec réservation CONFIRMÉE, de l'heure de résa → +24h, max 5 photos.
 *  - Modération auto à l'upload (Cloudinary add-on, si STORY_MODERATION défini).
 *  - Suppression totale après 24h (purge planifiée).
 */
import { query } from "../config/db.js";
import { ok, created, notFound, forbidden } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { uploadImage, deleteImage } from "../services/upload.service.js";

const MAX_PER_RESERVATION = 5;
const MODERATION = process.env.STORY_MODERATION || null; // ex: "aws_rek"

// Retourne la réservation éligible (confirmée, fenêtre heure_résa → +24h) pour ce resto.
async function eligibleReservation(userId, restaurantId) {
  const { rows } = await query(
    `SELECT id, reserved_at FROM reservations
     WHERE client_id = $1 AND restaurant_id = $2
       AND status IN ('confirme','confirmé')
       AND (
         reserved_at::date = CURRENT_DATE                                   -- le jour de la visite
         OR (reserved_at <= NOW() AND reserved_at + interval '24 hours' >= NOW())  -- ou dans les 24h après
       )
     ORDER BY reserved_at DESC LIMIT 1`,
    [userId, restaurantId]
  );
  return rows[0] || null;
}

async function restoBySlug(slug) {
  const { rows } = await query(
    "SELECT id, owner_id, stories_enabled FROM restaurants WHERE slug = $1", [slug]
  );
  return rows[0] || null;
}

// ── POST /stories — créer un instant ─────────────────────────────────────────
export const createStory = asyncHandler(async (req, res) => {
  const { slug, photo } = req.body || {};
  if (!slug || !photo) throw new AppError("Restaurant et photo requis", 400);
  if (!/^data:image\//.test(photo)) throw new AppError("Format de photo invalide", 400);

  const resto = await restoBySlug(slug);
  if (!resto) throw new AppError("Restaurant introuvable", 404);
  if (resto.stories_enabled === false) throw new AppError("Les Instants sont désactivés pour ce restaurant", 403);

  const resa = await eligibleReservation(req.user.id, resto.id);
  if (!resa) throw new AppError("Vous devez avoir une réservation confirmée ici (le jour de votre visite) pour partager un Instant.", 403);

  // Limite par réservation
  const { rows: [{ count }] } = await query(
    "SELECT COUNT(*)::int AS count FROM stories WHERE reservation_id = $1", [resa.id]
  );
  if (count >= MAX_PER_RESERVATION) {
    throw new AppError(`Limite de ${MAX_PER_RESERVATION} photos atteinte pour cette réservation.`, 400);
  }

  // Upload + modération auto
  let up;
  try {
    up = await uploadImage(photo, { folder: "tabliereci/stories", moderation: MODERATION, tags: ["story"] });
  } catch (e) {
    throw new AppError("Échec du téléversement de la photo", 502);
  }
  // Rejet par la modération
  const modArr = Array.isArray(up.moderation) ? up.moderation : [];
  if (modArr.some(m => m.status === "rejected")) {
    await deleteImage(up.public_id);
    throw new AppError("Cette photo a été refusée par la modération.", 422);
  }

  const { rows: [story] } = await query(
    `INSERT INTO stories (restaurant_id, client_id, reservation_id, photo_url, public_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + interval '24 hours')
     RETURNING id, photo_url, created_at, expires_at`,
    [resto.id, req.user.id, resa.id, up.url, up.public_id]
  );
  return created(res, { story }, "Instant partagé !");
});

// ── GET /stories/:slug — liste (connecté uniquement) ─────────────────────────
export const listStories = asyncHandler(async (req, res) => {
  const resto = await restoBySlug(req.params.slug);
  if (!resto) return notFound(res, "Restaurant introuvable");

  const { rows } = await query(
    `SELECT s.id, s.photo_url, s.created_at, s.expires_at, s.client_id,
            u.full_name AS author_name, u.avatar_url AS author_avatar,
            COALESCE(r.cnt, 0)::int AS reactions,
            mine.emoji AS my_reaction
     FROM stories s
     JOIN users u ON u.id = s.client_id
     LEFT JOIN (SELECT story_id, COUNT(*) cnt FROM story_reactions GROUP BY story_id) r ON r.story_id = s.id
     LEFT JOIN story_reactions mine ON mine.story_id = s.id AND mine.user_id = $2
     WHERE s.restaurant_id = $1 AND s.status = 'active' AND s.hidden_by_resto = FALSE
       AND s.expires_at > NOW()
     ORDER BY s.created_at DESC`,
    [resto.id, req.user.id]
  );

  // Peut-il poster ?
  const resa = await eligibleReservation(req.user.id, resto.id);
  let remaining = 0;
  if (resa) {
    const { rows: [{ count }] } = await query(
      "SELECT COUNT(*)::int AS count FROM stories WHERE reservation_id = $1", [resa.id]
    );
    remaining = Math.max(0, MAX_PER_RESERVATION - count);
  }

  return ok(res, {
    stories: rows.map(s => ({ ...s, is_mine: s.client_id === req.user.id })),
    can_post: !!resa && remaining > 0,
    remaining,
    enabled: resto.stories_enabled !== false,
  });
});

// ── DELETE /stories/:id — supprimer son propre instant ───────────────────────
export const deleteStory = asyncHandler(async (req, res) => {
  const { rows: [s] } = await query(
    "SELECT id, client_id, public_id FROM stories WHERE id = $1", [req.params.id]
  );
  if (!s) return notFound(res, "Instant introuvable");
  if (s.client_id !== req.user.id) return forbidden(res, "Action non autorisée");
  await deleteImage(s.public_id);
  await query("DELETE FROM stories WHERE id = $1", [s.id]);
  return ok(res, {}, "Instant supprimé");
});

// ── POST /stories/:id/react — réagir (upsert) ────────────────────────────────
export const reactStory = asyncHandler(async (req, res) => {
  const emoji = String(req.body?.emoji || "").slice(0, 8);
  const ALLOWED = ["❤️", "🔥", "😍", "👏", "😮"];
  if (!ALLOWED.includes(emoji)) throw new AppError("Réaction invalide", 400);
  await query(
    `INSERT INTO story_reactions (story_id, user_id, emoji) VALUES ($1, $2, $3)
     ON CONFLICT (story_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji, created_at = NOW()`,
    [req.params.id, req.user.id, emoji]
  );
  return ok(res, { emoji }, "Réaction enregistrée");
});

// ── DELETE /stories/:id/react — retirer sa réaction ──────────────────────────
export const unreactStory = asyncHandler(async (req, res) => {
  await query("DELETE FROM story_reactions WHERE story_id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  return ok(res, {}, "Réaction retirée");
});

// ── POST /stories/:id/hide — le restaurateur masque un instant ───────────────
export const hideStory = asyncHandler(async (req, res) => {
  const { rows: [s] } = await query(
    `SELECT s.id, r.owner_id FROM stories s JOIN restaurants r ON r.id = s.restaurant_id WHERE s.id = $1`,
    [req.params.id]
  );
  if (!s) return notFound(res, "Instant introuvable");
  if (s.owner_id !== req.user.id && req.user.role !== "admin") return forbidden(res, "Action non autorisée");
  await query("UPDATE stories SET hidden_by_resto = TRUE WHERE id = $1", [s.id]);
  return ok(res, {}, "Instant masqué");
});

// ── Purge des instants expirés (fichier Cloudinary + enregistrement) ─────────
export async function purgeExpiredStories() {
  try {
    const { rows } = await query(
      "SELECT id, public_id FROM stories WHERE expires_at <= NOW() LIMIT 200"
    );
    for (const s of rows) await deleteImage(s.public_id);
    if (rows.length) {
      await query("DELETE FROM stories WHERE id = ANY($1)", [rows.map(s => s.id)]);
    }
    return rows.length;
  } catch (_) { return 0; }
}
