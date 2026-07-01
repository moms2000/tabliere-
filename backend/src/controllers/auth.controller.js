import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import { query, withTransaction } from "../config/db.js";
import { cache } from "../config/redis.js";
import { generateTokens, revokeToken } from "../middleware/auth.js";
import { ok, created, unauth } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

export const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role, restaurant_name, code_restaurateur } = req.body;

  // ── Validation code restaurateur ──────────────────────────────────────────
  if (role === "restaurateur") {
    const codeVal = (code_restaurateur || "").trim().toUpperCase();
    if (!codeVal) throw new AppError("Le code d'accès restaurateur est obligatoire", 400);

    try {
      const { rows: [codeRow] } = await query(
        "SELECT id, is_used, expires_at FROM restaurateur_codes WHERE code = $1",
        [codeVal]
      );
      if (!codeRow) throw new AppError(`Code restaurateur invalide : "${codeVal}"`, 400);
      if (codeRow.is_used) throw new AppError("Ce code a déjà été utilisé.", 400);
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        throw new AppError("Ce code d'accès a expiré.", 400);
      }
    } catch (e) {
      if (e instanceof AppError) throw e; // re-throw AppErrors
      logger.warn("[Register] Vérification code échouée", { error: e.message });
      // Si la table n'existe pas encore, on laisse passer (sera recréée)
    }
  }

  const { rows: existing } = await query(
    "SELECT id FROM users WHERE email = $1", [email]
  );
  if (existing.length > 0) throw new AppError("Email déjà utilisé", 409);

  const password_hash = await bcrypt.hash(password, 12);

  const result = await withTransaction(async (client) => {
    const { rows: [user] } = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, status`,
      [full_name, email, phone || null, password_hash, role || "client",
       role === "restaurateur" ? "en_attente" : "actif"]
    );

    if (role === "restaurateur" && restaurant_name) {
      const slug = restaurant_name.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const { rows: [resto] } = await client.query(
        `INSERT INTO restaurants (owner_id, name, slug, status)
         VALUES ($1, $2, $3, 'en_attente') RETURNING id`,
        [user.id, restaurant_name, slug]
      );
      await client.query(
        "UPDATE users SET restaurant_id = $1 WHERE id = $2",
        [resto.id, user.id]
      );
      user.restaurant_id = resto.id;
    }
    return user;
  });

  // Marquer le code comme utilisé
  if (role === "restaurateur" && code_restaurateur) {
    await query(
      `UPDATE restaurateur_codes SET is_used = TRUE, used_by = $1, used_at = NOW()
       WHERE code = $2`,
      [result.id, code_restaurateur.trim().toUpperCase()]
    ).catch(e => logger.warn("Marquage code échoué", { error: e.message }));
  }

  const { access, refresh } = generateTokens(result.id, result.role);
  logger.info("Nouvel utilisateur inscrit", { userId: result.id, role });

  return created(res, {
    user: result,
    access_token:  access,
    refresh_token: refresh,
  }, "Compte créé avec succès");
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT id, email, full_name, role, status, password_hash, restaurant_id
     FROM users WHERE email = $1`, [email]
  );
  const user = rows[0];
  if (!user) return unauth(res, "Email ou mot de passe incorrect");
  if (user.status === "bloque") throw new AppError("Compte bloqué", 403);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return unauth(res, "Email ou mot de passe incorrect");

  await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]).catch(() => {});
  await cache.del(`user:${user.id}`).catch(() => {});

  const { access, refresh } = generateTokens(user.id, user.role);
  const { password_hash: _, ...safeUser } = user;

  // Ajouter le slug du restaurant pour les restaurateurs
  if (user.role === "restaurateur" && user.restaurant_id) {
    const { rows: [resto] } = await query(
      "SELECT slug, name FROM restaurants WHERE id = $1", [user.restaurant_id]
    ).catch(() => ({ rows: [] }));
    if (resto) { safeUser.resto_slug = resto.slug; safeUser.resto_name = resto.name; }
  }

  logger.info("Connexion réussie", { userId: user.id, role: user.role });
  return ok(res, {
    user: safeUser,
    access_token:  access,
    refresh_token: refresh,
  }, "Connexion réussie");
});

export const logout = asyncHandler(async (req, res) => {
  await revokeToken(req.token);
  await cache.del(`user:${req.user.id}`).catch(() => {});
  return ok(res, {}, "Déconnecté avec succès");
});

export const refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return unauth(res, "Token de rafraîchissement manquant");

  let decoded;
  try {
    decoded = jwt.verify(refresh_token, env.JWT_SECRET);
  } catch {
    return unauth(res, "Token invalide ou expiré");
  }
  if (decoded.type !== "refresh") return unauth(res, "Token invalide");

  const { access, refresh: newRefresh } = generateTokens(decoded.id, decoded.role);
  return ok(res, { access_token: access, refresh_token: newRefresh });
});

export const me = asyncHandler(async (req, res) => {
  const { rows: [user] } = await query(
    `SELECT id, email, full_name, phone, role, status,
            restaurant_id, last_login_at, created_at
     FROM users WHERE id = $1`, [req.user.id]
  );

  // Ajouter le slug/nom du restaurant pour les restaurateurs
  if (user?.role === "restaurateur" && user.restaurant_id) {
    const { rows: [resto] } = await query(
      "SELECT slug, name FROM restaurants WHERE id = $1", [user.restaurant_id]
    ).catch(() => ({ rows: [] }));
    if (resto) { user.resto_slug = resto.slug; user.resto_name = resto.name; }
  }

  return ok(res, { user });
});

// ── POST /auth/verify-code ─────────────────────────────────────────────────────
export const verifyRestaurateurCode = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) throw new AppError("Code requis", 400);

  const codeVal = code.trim().toUpperCase();
  const { rows: [codeRow] } = await query(
    "SELECT id, is_used, expires_at FROM restaurateur_codes WHERE code = $1",
    [codeVal]
  ).catch(() => ({ rows: [null] }));

  if (!codeRow) return ok(res, { valid: false }, "Code invalide");
  if (codeRow.is_used) return ok(res, { valid: false }, "Code déjà utilisé");
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return ok(res, { valid: false }, "Code expiré");
  }
  return ok(res, { valid: true }, "Code valide");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  return ok(res, {}, "Si cet email existe, un lien vous a été envoyé.");
});

export const resetPassword = asyncHandler(async (req, res) => {
  return ok(res, {}, "Fonctionnalité en cours de développement.");
});
