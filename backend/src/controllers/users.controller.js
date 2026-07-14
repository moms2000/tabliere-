import bcrypt              from "bcryptjs";
import { query, withTransaction } from "../config/db.js";
import { cache }            from "../config/redis.js";
import { ok, paginated, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { revokeToken }      from "../middleware/auth.js";
import { logger }           from "../utils/logger.js";
import { sendPushToUser }   from "../services/push.service.js";

// ---------------------------------------------------------------------------
// POST /users/me/test-push — envoie une notification test à l'utilisateur
// (permet de vérifier que les push fonctionnent sur son appareil)
// ---------------------------------------------------------------------------
export const testPush = asyncHandler(async (req, res) => {
  const uid = req.user.id;
  // Envoi différé de 5 s : laisse le temps de mettre l'app en arrière-plan
  // (sur Android, une notif reçue app au premier plan ne s'affiche pas dans la barre).
  setTimeout(() => {
    sendPushToUser(uid, {
      title: "TablièreCI",
      body: "🎉 Vos notifications sont bien activées !",
      data: { route: "/profil" },
    }).catch(() => {});
  }, 5000);
  return ok(res, {}, "Notification envoyée dans 5 s. Mettez l'app en arrière-plan pour la voir.");
});

// ---------------------------------------------------------------------------
// GET /users/me/reservations
// ---------------------------------------------------------------------------
export const myReservations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 100, status } = req.query;
  const offset = (page - 1) * limit;
  const params = [req.user.id];
  let where = "WHERE r.client_id = $1";

  // Cast ::text : un status invalide renvoie 0 résultat au lieu d'un 500 ENUM
  if (status) { params.push(status); where += ` AND r.status::text = $${params.length}`; }

  // LEFT JOIN pour ne JAMAIS perdre une réservation même si le restaurant
  // a été supprimé/désactivé → l'historique du client reste complet
  const { rows } = await query(
    `SELECT r.id, r.ref, r.status, r.reserved_at, r.party_size,
            r.special_request, r.cancel_reason,
            re.name AS resto_name, re.slug AS resto_slug,
            re.address, re.phone AS resto_phone,
            p.status AS payment_status, p.method AS payment_method
     FROM reservations r
     LEFT JOIN restaurants re ON re.id = r.restaurant_id
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

  // Suppression = anonymisation + cascade RÉVERSIBLE atomique (identique à l'admin) :
  // restaurants masqués, réservations archivées, événements annulés, codes d'accès
  // libérés. Sans ça, un resto d'un compte supprimé resterait listé/QR actif et son
  // code d'accès resterait consommé à vie.
  const uid = req.user.id;
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE restaurants SET status = 'suspendu', deleted_at = NOW(), updated_at = NOW() WHERE owner_id = $1`, [uid]
    );
    await client.query(
      `UPDATE reservations SET archived_at = NOW(), updated_at = NOW()
       WHERE restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = $1)`, [uid]
    );
    await client.query(`UPDATE events SET status = 'annule', updated_at = NOW() WHERE owner_id = $1`, [uid]);
    await client.query(`UPDATE restaurateur_codes SET is_used = FALSE, used_by = NULL, used_at = NULL WHERE used_by = $1`, [uid]);
    await client.query(`UPDATE organisateur_codes SET is_used = FALSE, used_by = NULL, used_at = NULL WHERE used_by = $1`, [uid]);
    await client.query(
      `UPDATE users SET
         full_name     = 'Compte supprimé',
         email         = 'deleted_' || id || '@tabliereci.ci',
         phone         = NULL,
         password_hash = 'DELETED',
         status        = 'suspendu',
         updated_at    = NOW()
       WHERE id = $1`,
      [uid]
    );
  });

  // Invalider token JWT en cours
  const token = req.headers.authorization?.split(" ")[1];
  if (token) await revokeToken(token);

  await cache.del(`user:${req.user.id}`);
  logger.info("Compte supprimé (anonymisé)", { userId: req.user.id });
  return ok(res, null, "Votre compte a été supprimé");
});

// ---------------------------------------------------------------------------
// GET /users/me/favorites — liste des restaurants favoris (synchro compte)
// ---------------------------------------------------------------------------
export const listFavorites = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT f.restaurant_id, f.created_at,
            r.name, r.slug, r.cuisine_type, r.ville, r.quartier,
            r.rating, r.review_count, r.price_range, r.logo_url, r.photos
     FROM favorites f
     JOIN restaurants r ON r.id = f.restaurant_id
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  return ok(res, { favorites: rows });
});

// ---------------------------------------------------------------------------
// POST /users/me/favorites { restaurant_id | slug } — ajouter un favori
// ---------------------------------------------------------------------------
export const addFavorite = asyncHandler(async (req, res) => {
  const { restaurant_id, slug } = req.body;
  if (!restaurant_id && !slug) throw new AppError("restaurant_id ou slug requis", 400);

  const { rows: [resto] } = await query(
    restaurant_id
      ? "SELECT id FROM restaurants WHERE id = $1"
      : "SELECT id FROM restaurants WHERE slug = $1",
    [restaurant_id || slug]
  );
  if (!resto) return notFound(res, "Restaurant introuvable");

  // ON CONFLICT : idempotent, pas d'erreur si déjà favori
  await query(
    `INSERT INTO favorites (user_id, restaurant_id) VALUES ($1, $2)
     ON CONFLICT (user_id, restaurant_id) DO NOTHING`,
    [req.user.id, resto.id]
  );
  return ok(res, { restaurant_id: resto.id }, "Ajouté aux favoris");
});

// ---------------------------------------------------------------------------
// DELETE /users/me/favorites/:restaurantId — retirer un favori
// ---------------------------------------------------------------------------
export const removeFavorite = asyncHandler(async (req, res) => {
  await query(
    "DELETE FROM favorites WHERE user_id = $1 AND restaurant_id = $2",
    [req.user.id, req.params.restaurantId]
  );
  return ok(res, null, "Retiré des favoris");
});

// ---------------------------------------------------------------------------
// GET /users/me/loyalty — solde de points de fidélité (calcul serveur)
// Règle : 50 points par réservation honorée (confirmée/terminée et passée).
// Source unique de vérité, cohérente sur tous les appareils.
// ---------------------------------------------------------------------------
export const getLoyalty = asyncHandler(async (req, res) => {
  const POINTS_PER_VISIT = 50;
  const { rows: [row] } = await query(
    `SELECT COUNT(*)::int AS honored
     FROM reservations
     WHERE client_id = $1
       AND status IN ('confirme','termine')
       AND reserved_at < NOW()`,
    [req.user.id]
  );
  const honored = row?.honored || 0;
  return ok(res, {
    points:          honored * POINTS_PER_VISIT,
    honored_visits:  honored,
    points_per_visit: POINTS_PER_VISIT,
  });
});

// ---------------------------------------------------------------------------
// POST /users/me/device-token — enregistrer un token push natif (iOS/Android)
// ---------------------------------------------------------------------------
export const registerDeviceToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  if (!token) throw new AppError("token requis", 400);
  await query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = $1, platform = $3`,
    [req.user.id, token, (platform || "").slice(0, 10) || null]
  ).catch(() => {}); // table créée au boot ; ne jamais bloquer l'app
  return ok(res, null, "Appareil enregistré pour les notifications");
});
