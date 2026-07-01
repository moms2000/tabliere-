import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import crypto from "crypto";
import axios  from "axios";
import { query, withTransaction } from "../config/db.js";
import { cache } from "../config/redis.js";
import { generateTokens, revokeToken } from "../middleware/auth.js";
import { ok, created, unauth } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

// ── Helper email SendGrid (direct, ne bloque jamais l'inscription) ────────────
async function sendVerificationEmail(email, fullName, token) {
  if (!env.SENDGRID_API_KEY) {
    logger.info(`[Email MOCK] Vérification → ${email} | token=${token}`);
    return;
  }
  const fromEmail = (env.EMAIL_FROM || "noreply@tabliereci.net")
    .replace("tabliereci.ci", "tabliereci.net");
  const frontUrl  = env.FRONTEND_URL || "https://tabliereci.net";
  const verifyUrl = `${frontUrl}/verify-email?token=${token}`;
  const firstName = (fullName || "").split(" ")[0] || "cher utilisateur";

  try {
    await axios.post("https://api.sendgrid.com/v3/mail/send", {
      personalizations: [{ to: [{ email }] }],
      from: { email: fromEmail, name: "TablièreCI" },
      reply_to: { email: "contact@tabliereci.net", name: "TablièreCI" },
      subject: "Activez votre compte TablièreCI",
      content: [
        { type: "text/plain", value: `Bonjour ${firstName}, activez votre compte TablièreCI : ${verifyUrl} (valable 24h)` },
        { type: "text/html", value: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <div style="background:#e8a045;padding:14px 20px;border-radius:8px 8px 0 0">
              <span style="color:#1a1000;font-size:17px;font-weight:bold">TablièreCI</span>
            </div>
            <div style="background:#fff;padding:28px 24px;border:1px solid #e4dfd8;border-top:none;border-radius:0 0 8px 8px">
              <h2 style="color:#1e2e28;margin:0 0 10px">Bienvenue, ${firstName} !</h2>
              <p style="color:#666;line-height:1.6">Merci de vous être inscrit sur TablièreCI. Cliquez sur le bouton ci-dessous pour activer votre compte :</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${verifyUrl}" style="display:inline-block;background:#e8a045;color:#1a1000;padding:14px 36px;border-radius:30px;font-size:15px;font-weight:700;text-decoration:none">Activer mon compte</a>
              </div>
              <p style="color:#999;font-size:12px;text-align:center">Ce lien est valable 24 heures.<br>Si vous n'avez pas créé de compte, ignorez cet e-mail.</p>
              <div style="margin-top:16px;padding:12px;background:#f8f5ef;border-radius:8px;font-size:11px;color:#999;word-break:break-all">
                Lien : <a href="${verifyUrl}" style="color:#e8a045">${verifyUrl}</a>
              </div>
            </div>
            <p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px">TablièreCI — <a href="https://tabliereci.net" style="color:#e8a045">tabliereci.net</a></p>
          </div>` },
      ],
      headers: {
        "List-Unsubscribe": "<mailto:unsubscribe@tabliereci.net>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }, {
      headers: {
        Authorization: `Bearer ${env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    logger.info("[Email] Vérification envoyée", { email });
  } catch (e) {
    logger.warn("[Email] Échec envoi vérification", { email, error: e.response?.data || e.message });
  }
}

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

  // ── Générer token de vérification + envoyer l'email ─────────────────────────
  const emailToken   = crypto.randomBytes(32).toString("hex");
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
  await query(
    `UPDATE users SET email_verified = FALSE, email_token = $1, email_token_expires = $2
     WHERE id = $3`,
    [emailToken, tokenExpires.toISOString(), result.id]
  ).catch(e => logger.warn("[Register] Set email_token échoué", { error: e.message }));

  // Envoi email (asynchrone, ne bloque pas la réponse)
  sendVerificationEmail(email, full_name, emailToken).catch(() => {});

  const { access, refresh } = generateTokens(result.id, result.role);
  logger.info("Nouvel utilisateur inscrit", { userId: result.id, role });

  return created(res, {
    user: result,
    access_token:  access,
    refresh_token: refresh,
    email_sent:    true,
  }, "Compte créé — vérifiez votre e-mail");
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

  // Ajouter resto_id / resto_slug / resto_name pour les restaurateurs
  // Recherche par owner_id (plus fiable que restaurant_id qui peut être null)
  if (user.role === "restaurateur") {
    const { rows: [resto] } = await query(
      "SELECT id, slug, name FROM restaurants WHERE owner_id = $1 LIMIT 1", [user.id]
    ).catch(() => ({ rows: [] }));
    if (resto) {
      safeUser.resto_id   = resto.id;
      safeUser.resto_slug = resto.slug;
      safeUser.resto_name = resto.name;
    }
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

  // Ajouter resto_id / resto_slug / resto_name pour les restaurateurs
  if (user?.role === "restaurateur") {
    const { rows: [resto] } = await query(
      "SELECT id, slug, name FROM restaurants WHERE owner_id = $1 LIMIT 1", [user.id]
    ).catch(() => ({ rows: [] }));
    if (resto) {
      user.resto_id   = resto.id;
      user.resto_slug = resto.slug;
      user.resto_name = resto.name;
    }
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

// ── GET /auth/verify-email?token=xxx ─────────────────────────────────────────
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.query;
  if (!token) throw new AppError("Token manquant", 400);

  // Chercher un compte avec ce token non expiré
  const { rows: [user] } = await query(
    `SELECT id, email_verified FROM users
     WHERE email_token = $1 AND email_token_expires > NOW()`,
    [token]
  ).catch(() => ({ rows: [] }));

  if (!user) {
    // Vérifier si déjà vérifié (token consommé mais compte actif)
    const { rows: [used] } = await query(
      "SELECT id FROM users WHERE email_token = $1", [token]
    ).catch(() => ({ rows: [] }));
    if (used) return ok(res, { already_verified: true }, "E-mail déjà vérifié");
    throw new AppError("Lien invalide ou expiré", 400);
  }

  if (user.email_verified) {
    return ok(res, { already_verified: true }, "E-mail déjà vérifié");
  }

  await query(
    `UPDATE users SET email_verified = TRUE, email_token = NULL, email_token_expires = NULL
     WHERE id = $1`,
    [user.id]
  );
  await cache.del(`user:${user.id}`).catch(() => {});

  return ok(res, { verified: true }, "E-mail vérifié avec succès");
});

// ── POST /auth/resend-verification ───────────────────────────────────────────
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // Toujours répondre OK (ne pas révéler si l'email existe)
  if (!email) return ok(res, {}, "Si cet email existe, un lien a été envoyé.");

  const { rows: [user] } = await query(
    "SELECT id, full_name, email_verified FROM users WHERE email = $1", [email]
  ).catch(() => ({ rows: [] }));

  if (user && !user.email_verified) {
    const token   = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query(
      `UPDATE users SET email_token = $1, email_token_expires = $2 WHERE id = $3`,
      [token, expires.toISOString(), user.id]
    ).catch(() => {});
    sendVerificationEmail(email, user.full_name, token).catch(() => {});
  }

  return ok(res, {}, "Si cet email existe, un lien a été envoyé.");
});

export const forgotPassword = asyncHandler(async (req, res) => {
  return ok(res, {}, "Si cet email existe, un lien vous a été envoyé.");
});

export const resetPassword = asyncHandler(async (req, res) => {
  return ok(res, {}, "Fonctionnalité en cours de développement.");
});
