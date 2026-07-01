import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import { query, withTransaction } from "../config/db.js";
import { cache } from "../config/redis.js";
import { ok, created, unauth } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { env }    from "../config/env.js";

// ── Helpers tokens (inline pour éviter dépendances circulaires) ───────────────
function makeTokens(userId, role) {
  const access = jwt.sign(
    { id: userId, role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
  const refresh = jwt.sign(
    { id: userId, role, type: "refresh" },
    env.jwt.secret,
    { expiresIn: env.jwt.refreshExpires }
  );
  return { access, refresh };
}

// ── POST /auth/register ────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
  const {
    full_name, email, phone, password,
    role = "client", restaurant_name,
    code_restaurateur,
  } = req.body;

  logger.info("[Register] tentative", { email, role, has_code: !!code_restaurateur });

  // Validation code restaurateur
  if (role === "restaurateur") {
    const codeVal = (code_restaurateur || "").trim().toUpperCase();

    if (!codeVal) {
      throw new AppError("Le code d'accès restaurateur est obligatoire", 400);
    }

    const { rows: [codeRow] } = await query(
      "SELECT id, is_used, expires_at FROM restaurateur_codes WHERE code = $1",
      [codeVal]
    ).catch(() => ({ rows: [] }));

    if (!codeRow) {
      throw new AppError(`Code restaurateur invalide : "${codeVal}"`, 400);
    }
    if (codeRow.is_used) {
      throw new AppError("Ce code a déjà été utilisé.", 400);
    }
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      throw new AppError("Ce code d'accès a expiré.", 400);
    }
  }

  // Vérifier doublon email
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
      [full_name, email, phone || null, password_hash, role,
       role === "restaurateur" ? "actif" : "actif"]
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

  const { access, refresh } = makeTokens(result.id, result.role);
  logger.info("Nouveau compte créé", { userId: result.id, role });

  return created(res, {
    user: result,
    access_token:  access,
    refresh_token: refresh,
  }, "Compte créé avec succès");
});

// ── POST /auth/login ───────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT id, email, full_name, role, status, password_hash, restaurant_id
     FROM users WHERE email = $1`, [email]
  );
  const user = rows[0];
  if (!user) return unauth(res, "Email ou mot de passe incorrect");
  if (user.status === "suspendu" || user.status === "bloque") {
    throw new AppError("Compte suspendu. Contactez le support.", 403);
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return unauth(res, "Email ou mot de passe incorrect");

  // Récupérer le slug du restaurant si restaurateur
  if (user.role === "restaurateur" && user.restaurant_id) {
    const { rows: [resto] } = await query(
      "SELECT slug, name FROM restaurants WHERE id = $1", [user.restaurant_id]
    ).catch(() => ({ rows: [] }));
    if (resto) { user.resto_slug = resto.slug; user.resto_name = resto.name; }
  }

  const { access, refresh } = makeTokens(user.id, user.role);
  const { password_hash: _, ...safeUser } = user;

  logger.info("Connexion", { userId: user.id, role: user.role });
  return ok(res, {
    user:           safeUser,
    access_token:   access,
    refresh_token:  refresh,
  }, "Connexion réussie");
});

// ── POST /auth/logout ──────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  await cache.del(`user:${req.user?.id}`).catch(() => {});
  return ok(res, {}, "Déconnecté");
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────────
export const refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return unauth(res, "Token manquant");

  let decoded;
  try {
    decoded = jwt.verify(refresh_token, env.jwt.secret);
  } catch {
    return unauth(res, "Token invalide ou expiré");
  }
  if (decoded.type !== "refresh") return unauth(res, "Token invalide");

  const { access, refresh: newRefresh } = makeTokens(decoded.id, decoded.role);
  return ok(res, { access_token: access, refresh_token: newRefresh });
});

// ── GET /auth/me ───────────────────────────────────────────────────────────────
export const me = asyncHandler(async (req, res) => {
  const { rows: [user] } = await query(
    `SELECT id, email, full_name, phone, role, status,
            restaurant_id, created_at
     FROM users WHERE id = $1`, [req.user.id]
  );
  if (!user) return unauth(res, "Utilisateur introuvable");

  if (user.role === "restaurateur" && user.restaurant_id) {
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
  ).catch(() => ({ rows: [] }));

  if (!codeRow) return ok(res, { valid: false }, "Code invalide");
  if (codeRow.is_used) return ok(res, { valid: false }, "Code déjà utilisé");
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return ok(res, { valid: false }, "Code expiré");
  }

  return ok(res, { valid: true }, "Code valide");
});

// ── POST /auth/forgot-password ─────────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  // Endpoint basique — toujours retourner OK (sécurité)
  return ok(res, {}, "Si cet email existe, un lien vous a été envoyé.");
});

// ── POST /auth/reset-password ──────────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
  return ok(res, {}, "Fonctionnalité bientôt disponible.");
});
