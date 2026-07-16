import bcrypt from "bcryptjs";
import jwt    from "jsonwebtoken";
import crypto from "crypto";
import axios  from "axios";
import { query, withTransaction } from "../config/db.js";
import { cache } from "../config/redis.js";
import { revokeToken } from "../middleware/auth.js";
import { signAccessToken, createRefreshToken, rotateRefreshToken, revokeByToken, revokeAllForUser } from "../utils/refreshTokens.js";
import { ok, created, unauth } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { getSetting } from "../utils/platformSettings.js";
import { env } from "../config/env.js";

// ── Helper email SendGrid (direct, ne bloque jamais l'inscription) ────────────
async function sendVerificationEmail(email, fullName, token) {
  if (!env.SENDGRID_API_KEY) {
    // Ne jamais journaliser un token en clair en production (fuite de compte).
    if (!env.isProd) logger.info(`[Email MOCK] Vérification → ${email} | token=${token}`);
    else logger.error("[Email] SENDGRID_API_KEY manquant en prod — email de vérification NON envoyé", { email });
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

// ── Helper email SendGrid — réinitialisation de mot de passe ──────────────────
async function sendResetEmail(email, fullName, token) {
  if (!env.SENDGRID_API_KEY) {
    if (!env.isProd) logger.info(`[Email MOCK] Reset MDP → ${email} | token=${token}`);
    else logger.error("[Email] SENDGRID_API_KEY manquant en prod — email de reset NON envoyé", { email });
    return;
  }
  const fromEmail = (env.EMAIL_FROM || "noreply@tabliereci.net")
    .replace("tabliereci.ci", "tabliereci.net");
  const frontUrl  = env.FRONTEND_URL || "https://tabliereci.net";
  const resetUrl  = `${frontUrl}/reset-password?token=${token}`;
  const firstName = (fullName || "").split(" ")[0] || "cher utilisateur";

  try {
    await axios.post("https://api.sendgrid.com/v3/mail/send", {
      personalizations: [{ to: [{ email }] }],
      from: { email: fromEmail, name: "TablièreCI" },
      reply_to: { email: "contact@tabliereci.net", name: "TablièreCI" },
      subject: "Réinitialisez votre mot de passe TablièreCI",
      content: [
        { type: "text/plain", value: `Bonjour ${firstName}, réinitialisez votre mot de passe TablièreCI : ${resetUrl} (valable 1h). Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.` },
        { type: "text/html", value: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px">
            <div style="background:#e8a045;padding:14px 20px;border-radius:8px 8px 0 0">
              <span style="color:#1a1000;font-size:17px;font-weight:bold">TablièreCI</span>
            </div>
            <div style="background:#fff;padding:28px 24px;border:1px solid #e4dfd8;border-top:none;border-radius:0 0 8px 8px">
              <h2 style="color:#1e2e28;margin:0 0 10px">Réinitialisation du mot de passe</h2>
              <p style="color:#666;line-height:1.6">Bonjour ${firstName}, vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous :</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${resetUrl}" style="display:inline-block;background:#e8a045;color:#1a1000;padding:14px 36px;border-radius:30px;font-size:15px;font-weight:700;text-decoration:none">Réinitialiser mon mot de passe</a>
              </div>
              <p style="color:#999;font-size:12px;text-align:center">Ce lien est valable 1 heure.<br>Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.</p>
              <div style="margin-top:16px;padding:12px;background:#f8f5ef;border-radius:8px;font-size:11px;color:#999;word-break:break-all">
                Lien : <a href="${resetUrl}" style="color:#e8a045">${resetUrl}</a>
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
    logger.info("[Email] Reset MDP envoyé", { email });
  } catch (e) {
    logger.warn("[Email] Échec envoi reset MDP", { email, error: e.response?.data || e.message });
  }
}

export const register = asyncHandler(async (req, res) => {
  const { full_name, email, phone, password, role, restaurant_name, code_restaurateur, code_organisateur } = req.body;

  // Réglage plateforme : inscriptions ouvertes ? (les restaurateurs/organisateurs
  // avec code restent autorisés — inscription contrôlée par code de toute façon.)
  if ((await getSetting("inscriptions_open", "true")) === "false" && (role || "client") === "client") {
    throw new AppError("Les inscriptions sont temporairement fermées. Réessayez plus tard.", 403);
  }

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

  // ── Validation code organisateur ──────────────────────────────────────────
  if (role === "organisateur") {
    const codeVal = (code_organisateur || "").trim().toUpperCase();
    if (!codeVal) throw new AppError("Le code d'accès organisateur est obligatoire", 400);
    try {
      const { rows: [codeRow] } = await query(
        "SELECT id, is_used, expires_at FROM organisateur_codes WHERE code = $1",
        [codeVal]
      );
      if (!codeRow) throw new AppError(`Code organisateur invalide : "${codeVal}"`, 400);
      if (codeRow.is_used) throw new AppError("Ce code a déjà été utilisé.", 400);
      if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
        throw new AppError("Ce code d'accès a expiré.", 400);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      logger.warn("[Register] Vérification code organisateur échouée", { error: e.message });
    }
  }

  const { rows: existing } = await query(
    "SELECT id FROM users WHERE email = $1", [email]
  );
  if (existing.length > 0) throw new AppError("Email déjà utilisé", 409);

  const password_hash = await bcrypt.hash(password, 12);
  // Token de vérification généré AVANT l'insert → email_verified=FALSE posé
  // atomiquement (fail-closed : jamais de compte « vérifié » par défaut si un
  // UPDATE échoue).
  const emailToken   = crypto.randomBytes(32).toString("hex");
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

  const result = await withTransaction(async (client) => {
    const { rows: [user] } = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status, email_verified, email_token, email_token_expires)
       VALUES ($1, $2, $3, $4, $5, 'actif', FALSE, $6, $7)
       RETURNING id, email, full_name, role, status`,
      [full_name, email, phone || null, password_hash, role || "client", emailToken, tokenExpires]
    );

    // Consommation ATOMIQUE du code d'accès (single-use, anti-course) DANS la
    // transaction : si le code a été pris entre-temps (rowCount 0), on annule
    // toute l'inscription. Fail-closed.
    if (role === "restaurateur" && code_restaurateur) {
      const { rowCount } = await client.query(
        `UPDATE restaurateur_codes SET is_used = TRUE, used_by = $1, used_at = NOW()
         WHERE code = $2 AND is_used = FALSE`,
        [user.id, code_restaurateur.trim().toUpperCase()]
      );
      if (rowCount === 0) throw new AppError("Ce code a déjà été utilisé.", 400);
    }
    if (role === "organisateur" && code_organisateur) {
      const { rowCount } = await client.query(
        `UPDATE organisateur_codes SET is_used = TRUE, used_by = $1, used_at = NOW()
         WHERE code = $2 AND is_used = FALSE`,
        [user.id, code_organisateur.trim().toUpperCase()]
      );
      if (rowCount === 0) throw new AppError("Ce code a déjà été utilisé.", 400);
    }

    if (role === "restaurateur" && restaurant_name) {
      let slug = restaurant_name.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";

      // Slug UNIQUE : suffixe si déjà pris (resto existant OU masqué) → plus jamais
      // d'erreur « nom déjà pris » due à un ancien restaurant. L'URL reste propre.
      const base = slug;
      for (let i = 2; i <= 60; i++) {
        const { rows: taken } = await client.query("SELECT 1 FROM restaurants WHERE slug = $1", [slug]);
        if (!taken.length) break;
        slug = `${base}-${i}`;
      }

      const { rows: [resto] } = await client.query(
        `INSERT INTO restaurants (owner_id, name, slug, status)
         VALUES ($1, $2, $3, 'actif') RETURNING id`,  // resto actif → menu QR + liste publique immédiats
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

  // Rattacher les réservations faites en tant qu'INVITÉ au compte fraîchement créé.
  // SÉCURITÉ : on exige l'e-mail EXACT (identifiant fourni à l'inscription). Un
  // simple numéro de téléphone partagé ne suffit plus (évitait qu'un inscrit hérite
  // des réservations d'un inconnu ayant le même numéro). Hors transaction.
  if ((role || "client") === "client") {
    await query(
      `UPDATE reservations
       SET client_id = $1
       WHERE client_id = (SELECT id FROM users WHERE email = 'guest@tabliereci.net' LIMIT 1)
         AND walk_in_email IS NOT NULL AND lower(walk_in_email) = lower($2)
         AND ($3 = '' OR walk_in_phone IS NULL
              OR regexp_replace(walk_in_phone, '[^0-9]', '', 'g') = regexp_replace($3, '[^0-9]', '', 'g'))`,
      [result.id, email, phone || ""]
    ).catch((e) => logger.warn("Rattachement réservations invité échoué", { error: e?.message }));
  }

  // (Le code d'accès a été consommé atomiquement dans la transaction ci-dessus.)

  // Envoi email de vérification (le token a été posé dans l'INSERT, fail-closed)
  sendVerificationEmail(email, full_name, emailToken).catch(() => {});

  // PAS d'auto-connexion : aucun token tant que l'e-mail n'est pas vérifié.
  // L'utilisateur doit cliquer le lien reçu par e-mail puis se connecter.
  logger.info("Nouvel utilisateur inscrit (en attente de vérification e-mail)", { userId: result.id, role });

  return created(res, {
    user:               { id: result.id, email: result.email, full_name: result.full_name, role: result.role },
    email_sent:         true,
    needs_verification: true,
  }, "Compte créé — vérifiez votre e-mail pour vous connecter.");
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT id, email, full_name, role, status, password_hash, restaurant_id, avatar_url, email_verified
     FROM users WHERE email = $1`, [email]
  );
  const user = rows[0];
  if (!user) return unauth(res, "Email ou mot de passe incorrect");

  // On vérifie le mot de passe AVANT de révéler quoi que ce soit sur le compte.
  // Sinon un message « Compte suspendu » servi avant la vérif du mot de passe
  // permet d'énumérer les emails existants.
  const valid = await bcrypt.compare(password, user.password_hash || "");
  if (!valid) return unauth(res, "Email ou mot de passe incorrect");
  if (["suspendu", "bloque"].includes(user.status)) throw new AppError("Compte suspendu. Contactez le support.", 403);
  // Vérification d'e-mail OBLIGATOIRE avant toute connexion.
  if (user.email_verified === false) {
    return res.status(403).json({
      success: false, code: "EMAIL_NOT_VERIFIED", email: user.email,
      message: "Vérifiez votre adresse e-mail avant de vous connecter. Consultez votre boîte mail (et les spams).",
    });
  }

  await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]).catch(() => {});
  await cache.del(`user:${user.id}`).catch(() => {});

  const access = signAccessToken(user.id, user.role);
  const { token: refresh } = await createRefreshToken(user.id, user.role);
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
  await revokeToken(req.token);                       // blackliste l'access token en cours
  await revokeByToken(req.body?.refresh_token);       // révoque la session (refresh) côté serveur
  await cache.del(`user:${req.user.id}`).catch(() => {});
  return ok(res, {}, "Déconnecté avec succès");
});

export const refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return unauth(res, "Token de rafraîchissement manquant");

  // Rotation : valide, révoque l'ancien, émet un nouveau. Détecte la réutilisation
  // d'un jeton déjà consommé (vol probable) → coupe toute la session.
  const result = await rotateRefreshToken(refresh_token);
  if (result.error) {
    if (result.error === "reuse") logger.warn("Refresh token réutilisé — session révoquée (vol probable)");
    const msg = {
      invalid:    "Token invalide ou expiré",
      no_user:    "Compte introuvable",
      suspended:  "Compte suspendu",
      unverified: "E-mail non vérifié",
      reuse:      "Session expirée, veuillez vous reconnecter",
    }[result.error] || "Token invalide";
    return unauth(res, msg);
  }
  const access = signAccessToken(result.user.id, result.user.role);
  return ok(res, { access_token: access, refresh_token: result.token });
});

export const me = asyncHandler(async (req, res) => {
  const { rows: [user] } = await query(
    `SELECT id, email, full_name, phone, role, status, avatar_url,
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
    `SELECT id, email, full_name, role, status, restaurant_id, avatar_url, email_verified FROM users
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

  // Auto-connexion après vérification (sauf compte suspendu) : clic sur le lien →
  // vérifié → connecté, sans re-saisir ses identifiants.
  if (["suspendu", "bloque"].includes(user.status)) {
    return ok(res, { verified: true }, "E-mail vérifié avec succès");
  }
  const access = signAccessToken(user.id, user.role);
  const { token: refresh } = await createRefreshToken(user.id, user.role);
  const { email_verified: _ev, status: _st, ...safeUser } = user;
  return ok(res, { verified: true, user: safeUser, access_token: access, refresh_token: refresh }, "E-mail vérifié avec succès");
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

// ── POST /auth/forgot-password ───────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  // Toujours répondre OK (ne jamais révéler si l'email existe → anti-énumération)
  const genericMsg = "Si cet email existe, un lien de réinitialisation vous a été envoyé.";
  if (!email) return ok(res, {}, genericMsg);

  const { rows: [user] } = await query(
    "SELECT id, full_name, status FROM users WHERE email = $1", [email]
  ).catch(() => ({ rows: [] }));

  // Ne pas envoyer aux comptes inexistants ou suspendus/supprimés
  if (user && !["suspendu", "bloque"].includes(user.status)) {
    const token   = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await query(
      `UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3`,
      [token, expires.toISOString(), user.id]
    ).catch((e) => logger.warn("forgotPassword: échec stockage token", { error: e?.message }));
    await sendResetEmail(email, user.full_name, token);
  }

  return ok(res, {}, genericMsg);
});

// ── POST /auth/reset-password ────────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError("Token et nouveau mot de passe requis", 400);
  if (password.length < 8) throw new AppError("Le mot de passe doit contenir au moins 8 caractères", 400);

  const { rows: [user] } = await query(
    `SELECT id FROM users
     WHERE password_reset_token = $1
       AND password_reset_expires IS NOT NULL
       AND password_reset_expires > NOW()`,
    [token]
  ).catch(() => ({ rows: [] }));

  if (!user) throw new AppError("Lien invalide ou expiré. Veuillez refaire une demande.", 400);

  const password_hash = await bcrypt.hash(password, 12);
  await query(
    `UPDATE users
     SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, updated_at = NOW()
     WHERE id = $2`,
    [password_hash, user.id]
  );
  await cache.del(`user:${user.id}`).catch(() => {});
  // Sécurité : un changement de mot de passe invalide toutes les sessions existantes
  // (refresh tokens) → un jeton volé avant le reset ne fonctionne plus.
  await revokeAllForUser(user.id);

  logger.info("Mot de passe réinitialisé", { userId: user.id });
  return ok(res, { reset: true }, "Mot de passe réinitialisé avec succès. Vous pouvez vous connecter.");
});
