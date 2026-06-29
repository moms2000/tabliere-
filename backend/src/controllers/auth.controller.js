/**
 * Auth Controller — TablièreCI
 * register | login | logout | refresh | me
 */

import bcrypt   from "bcryptjs";
import jwt      from "jsonwebtoken";
import crypto   from "crypto";
import { query, withTransaction } from "../config/db.js";
import { cache } from "../config/redis.js";
import { env }   from "../config/env.js";
import { emailService, send as sendEmail } from "../services/email.service.js";
import { ok, created, badRequest, unauthorized, conflict } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { revokeToken }            from "../middleware/auth.js";
import { logger }                 from "../utils/logger.js";

// ── Helpers tokens ────────────────────────────────────────────────────────────
function generateTokens(userId, role) {
  const access = jwt.sign(
    { sub: userId, role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
  const refresh = jwt.sign(
    { sub: userId, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_IN }
  );
  return { access_token: access, refresh_token: refresh };
}

// slugify simple
function slugify(str) {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── POST /auth/register ────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role, restaurant_name } = req.body;

  // Vérifier doublon email
  const { rows: [existing] } = await query(
    "SELECT id FROM users WHERE email = $1", [email]
  );
  if (existing) return conflict(res, "Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse.");

  // Vérifier doublon téléphone (si fourni)
  if (phone) {
    const { rows: [existingPhone] } = await query(
      "SELECT id FROM users WHERE phone = $1", [phone]
    );
    if (existingPhone) return conflict(res, "Ce numéro de téléphone est déjà associé à un compte. Utilisez un autre numéro ou laissez le champ vide.");
  }

  const password_hash = await bcrypt.hash(password, 12);

  const user = await withTransaction(async (client) => {
    // Créer l'utilisateur
    const { rows: [newUser] } = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'actif')
       RETURNING id, full_name, email, phone, role, status`,
      [full_name, email, phone || null, password_hash, role || "client"]
    );

    // Si restaurateur, créer le restaurant vide
    if (role === "restaurateur" && restaurant_name) {
      let slug = slugify(restaurant_name);
      // Unicité du slug
      const { rows: [slugConflict] } = await client.query(
        "SELECT id FROM restaurants WHERE slug = $1", [slug]
      );
      if (slugConflict) slug = `${slug}-${Date.now()}`;

      const { rows: [resto] } = await client.query(
        `INSERT INTO restaurants (owner_id, name, slug, status)
         VALUES ($1, $2, $3, 'en_attente')
         RETURNING id`,
        [newUser.id, restaurant_name, slug]
      );

      await client.query(
        "UPDATE users SET restaurant_id = $1 WHERE id = $2",
        [resto.id, newUser.id]
      );
      newUser.restaurant_id = resto.id;
    }

    return newUser;
  });

  // Générer et envoyer un token de vérification d'email
  const emailToken = crypto.randomBytes(32).toString("hex");
  const emailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  await query(
    `UPDATE users SET email_verified = FALSE, email_token = $1, email_token_expires = $2
     WHERE id = $3`,
    [emailToken, emailTokenExpires.toISOString(), user.id]
  ).catch(() => {}); // ne pas bloquer si la colonne n'existe pas encore

  // Envoyer l'email de vérification
  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${emailToken}`;
  emailService.sendVerificationEmail({ email: user.email, name: user.full_name, verifyUrl })
    .catch(() => {}); // asynchrone, ne pas bloquer

  const tokens = generateTokens(user.id, user.role);
  logger.info("Nouveau compte créé", { userId: user.id, role: user.role });
  return created(res, { user, ...tokens, email_sent: true }, "Compte créé — vérifiez votre e-mail");
});

// ── POST /auth/login ───────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows: [user] } = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status, u.password_hash,
            r.id AS resto_id, r.name AS resto_name, r.slug AS resto_slug,
            r.status AS resto_status, r.plan
     FROM users u
     LEFT JOIN restaurants r ON r.id = u.restaurant_id
     WHERE u.email = $1`,
    [email]
  );

  if (!user) return unauthorized(res, "Email ou mot de passe incorrect");
  if (user.status === "suspendu") throw new AppError("Votre compte est suspendu. Contactez le support.", 403);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return unauthorized(res, "Email ou mot de passe incorrect");

  // Mettre à jour last_login_at
  await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

  const { password_hash: _, ...safeUser } = user;
  const tokens = generateTokens(user.id, user.role);

  logger.info("Connexion réussie", { userId: user.id });
  return ok(res, { user: safeUser, ...tokens }, "Connexion réussie");
});

// ── POST /auth/logout ──────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) await revokeToken(token);

  // Invalider le refresh token en cache si fourni
  const { refresh_token } = req.body;
  if (refresh_token) {
    await cache.del(`refresh:${req.user.id}`);
  }

  logger.info("Déconnexion", { userId: req.user.id });
  return ok(res, null, "Déconnecté avec succès");
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────────
export const refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return badRequest(res, "refresh_token manquant");

  let payload;
  try {
    payload = jwt.verify(refresh_token, env.JWT_REFRESH_SECRET);
  } catch {
    return unauthorized(res, "Refresh token invalide ou expiré");
  }

  if (payload.type !== "refresh") return unauthorized(res, "Token invalide");

  const { rows: [user] } = await query(
    "SELECT id, role, status FROM users WHERE id = $1",
    [payload.sub]
  );
  if (!user || user.status === "suspendu") return unauthorized(res, "Compte inaccessible");

  const tokens = generateTokens(user.id, user.role);
  return ok(res, tokens, "Tokens renouvelés");
});

// ── GET /auth/me ───────────────────────────────────────────────────────────────
export const me = asyncHandler(async (req, res) => {
  const cacheKey = `user:${req.user.id}`;
  const cached = await cache.get(cacheKey).catch(() => null);
  if (cached) return ok(res, { user: cached });

  const { rows: [user] } = await query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status,
            u.avatar_url, u.created_at,
            r.id AS resto_id, r.name AS resto_name, r.slug AS resto_slug, r.status AS resto_status, r.plan
     FROM users u
     LEFT JOIN restaurants r ON r.id = u.restaurant_id
     WHERE u.id = $1`,
    [req.user.id]
  );

  await cache.set(cacheKey, user, 300).catch(() => {});
  return ok(res, { user });
});

// ── POST /auth/forgot-password ────────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError("E-mail requis", 400);

  const { rows: [user] } = await query(
    "SELECT id, full_name, email FROM users WHERE email = $1 AND status != 'suspendu'",
    [email.toLowerCase()]
  );

  // Toujours répondre "ok" même si l'email n'existe pas (sécurité)
  if (!user) return ok(res, null, "Si ce compte existe, un e-mail a été envoyé");

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await query(
    "UPDATE users SET email_token = $1, email_token_expires = $2 WHERE id = $3",
    [token, expires.toISOString(), user.id]
  );

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  const html = `
    <div style="font-family:'Helvetica Neue',sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f8f5ef;">
      <div style="background:white;border-radius:12px;padding:32px;border:1px solid #e4dfd8;">
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#e8a045;color:#1a1000;padding:7px 20px;border-radius:20px;font-size:13px;font-weight:700;">TablièreCI</div>
        </div>
        <h1 style="font-size:20px;font-weight:300;color:#1e2e28;margin-bottom:8px;">Réinitialisation du mot de passe</h1>
        <p style="color:#9ba89f;font-size:14px;margin-bottom:24px;">Bonjour ${user.full_name?.split(" ")[0]}, vous avez demandé à réinitialiser votre mot de passe.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#e8a045;color:#1a1000;padding:14px 32px;border-radius:30px;font-size:15px;font-weight:700;text-decoration:none;">
            Réinitialiser mon mot de passe
          </a>
        </div>
        <p style="color:#9ba89f;font-size:12px;text-align:center;">Ce lien expire dans <strong>1 heure</strong>. Si vous n'avez pas fait cette demande, ignorez cet e-mail.</p>
      </div>
    </div>
  `;

  await sendEmail({ to: user.email, subject: "Réinitialisation de votre mot de passe — TablièreCI", html,
    text: `Réinitialisez votre mot de passe : ${resetUrl}` }).catch(() => {});

  logger.info("Email reset envoyé", { userId: user.id });
  return ok(res, null, "E-mail de réinitialisation envoyé");
});

// ── POST /auth/reset-password ─────────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError("Token et mot de passe requis", 400);
  if (password.length < 8) throw new AppError("Le mot de passe doit contenir au moins 8 caractères", 400);

  const { rows: [user] } = await query(
    "SELECT id FROM users WHERE email_token = $1 AND email_token_expires > NOW()",
    [token]
  );
  if (!user) throw new AppError("Lien invalide ou expiré. Refaites la demande.", 400);

  const bcrypt = await import("bcryptjs");
  const hash = await bcrypt.default.hash(password, 12);
  await query(
    "UPDATE users SET password_hash = $1, email_token = NULL, email_token_expires = NULL, updated_at = NOW() WHERE id = $2",
    [hash, user.id]
  );

  await cache.del(`user:${user.id}`).catch(() => {});
  logger.info("Mot de passe réinitialisé", { userId: user.id });
  return ok(res, null, "Mot de passe mis à jour avec succès");
});

// ── GET /auth/verify-email?token=xxx ──────────────────────────────────────────
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) throw new AppError("Token manquant", 400);

  const { rows: [user] } = await query(
    `SELECT id, full_name, email FROM users
     WHERE email_token = $1 AND email_token_expires > NOW() AND email_verified = FALSE`,
    [token]
  );

  if (!user) {
    // Peut-être déjà vérifié ou token expiré
    const { rows: [existing] } = await query(
      "SELECT id, email_verified FROM users WHERE email_token = $1", [token]
    );
    if (existing?.email_verified) {
      return ok(res, { already_verified: true }, "E-mail déjà vérifié");
    }
    throw new AppError("Lien de vérification invalide ou expiré", 400);
  }

  await query(
    `UPDATE users SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL
     WHERE id = $1`,
    [user.id]
  );
  await cache.del(`user:${user.id}`).catch(() => {});

  logger.info("E-mail vérifié", { userId: user.id });
  return ok(res, { verified: true, email: user.email }, "E-mail vérifié avec succès");
});

// ── POST /auth/resend-verification ────────────────────────────────────────────
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError("E-mail requis", 400);

  const { rows: [user] } = await query(
    "SELECT id, full_name, email, email_verified FROM users WHERE email = $1",
    [email]
  );

  if (!user) return ok(res, null, "Si ce compte existe, un email a été envoyé");
  if (user.email_verified) return ok(res, null, "E-mail déjà vérifié");

  const emailToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await query(
    "UPDATE users SET email_token = $1, email_token_expires = $2 WHERE id = $3",
    [emailToken, expires.toISOString(), user.id]
  );

  const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${emailToken}`;
  await emailService.sendVerificationEmail({ email: user.email, name: user.full_name, verifyUrl });

  return ok(res, null, "Email de vérification envoyé");
});
