import bcrypt   from "bcryptjs";
import jwt      from "jsonwebtoken";
import crypto   from "crypto";
import axios    from "axios";
import { query, withTransaction } from "../config/db.js";
import { cache }            from "../config/redis.js";
import { generateTokens, revokeToken } from "../middleware/auth.js";
import { ok, created, unauth, conflict } from "../utils/response.js";
import { asyncHandler, AppError }        from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { env }    from "../config/env.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Envoi email via SendGrid (optionnel — ne bloque jamais l'inscription) */
async function sendEmail({ to, subject, html, text }) {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) { logger.info(`[Email MOCK] → ${to} | ${subject}`); return; }

  const fromEmail = (process.env.EMAIL_FROM || "noreply@tabliereci.net")
    .replace("tabliereci.ci", "tabliereci.net");

  try {
    await axios.post("https://api.sendgrid.com/v3/mail/send", {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: "TablièreCI" },
      reply_to: { email: "contact@tabliereci.net", name: "TablièreCI" },
      subject,
      content: [
        { type: "text/plain", value: text || subject },
        { type: "text/html",  value: html },
      ],
      headers: {
        "List-Unsubscribe": "<mailto:unsubscribe@tabliereci.net>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }, {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });
    logger.info("[Email] Envoyé", { to, subject });
  } catch (e) {
    logger.warn("[Email] Échec envoi", { to, error: e.message });
  }
}

// ── POST /auth/register ────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
  const {
    full_name, email, phone, password,
    role = "client", restaurant_name,
    code_restaurateur,
  } = req.body;

  logger.info("[Register] Données reçues", {
    role,
    has_code: !!code_restaurateur,
    code_length: code_restaurateur?.length,
    body_keys: Object.keys(req.body),
  });

  // ── Validation code restaurateur ─────────────────────────────────────────
  if (role === "restaurateur") {
    const codeVal = (code_restaurateur || "").trim().toUpperCase();

    if (!codeVal) {
      throw new AppError("Le code d'accès restaurateur est obligatoire", 400);
    }

    const { rows: [codeRow] } = await query(
      "SELECT id, is_used, expires_at FROM restaurateur_codes WHERE code = $1",
      [codeVal]
    );

    if (!codeRow) {
      throw new AppError(
        `Code restaurateur invalide : "${codeVal}". Vérifiez le code fourni par l'administrateur.`,
        400
      );
    }
    if (codeRow.is_used) {
      throw new AppError("Ce code a déjà été utilisé par un autre compte.", 400);
    }
    if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
      throw new AppError("Ce code d'accès a expiré. Contactez TablièreCI pour en obtenir un nouveau.", 400);
    }
  }

  // ── Vérifier doublon email ────────────────────────────────────────────────
  const { rows: [existingEmail] } = await query(
    "SELECT id FROM users WHERE email = $1", [email]
  );
  if (existingEmail) {
    return conflict(res, "Cette adresse e-mail est déjà utilisée. Connectez-vous ou utilisez une autre adresse.");
  }

  // ── Vérifier doublon téléphone ────────────────────────────────────────────
  if (phone) {
    const { rows: [existingPhone] } = await query(
      "SELECT id FROM users WHERE phone = $1", [phone]
    );
    if (existingPhone) {
      return conflict(res, "Ce numéro de téléphone est déjà associé à un compte.");
    }
  }

  const password_hash = await bcrypt.hash(password, 12);

  // ── Créer utilisateur + restaurant (transaction) ──────────────────────────
  const user = await withTransaction(async (client) => {
    const { rows: [newUser] } = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, 'actif')
       RETURNING id, full_name, email, phone, role, status`,
      [full_name, email, phone || null, password_hash, role]
    );

    if (role === "restaurateur" && restaurant_name) {
      let slug = slugify(restaurant_name);
      const { rows: [conflict] } = await client.query(
        "SELECT id FROM restaurants WHERE slug = $1", [slug]
      );
      if (conflict) slug = `${slug}-${Date.now()}`;

      const { rows: [resto] } = await client.query(
        `INSERT INTO restaurants (owner_id, name, slug, status)
         VALUES ($1, $2, $3, 'en_attente') RETURNING id`,
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

  // ── Marquer le code comme utilisé ────────────────────────────────────────
  if (role === "restaurateur" && code_restaurateur) {
    const codeVal = code_restaurateur.trim().toUpperCase();
    await query(
      `UPDATE restaurateur_codes
       SET is_used = TRUE, used_by = $1, used_at = NOW()
       WHERE code = $2`,
      [user.id, codeVal]
    ).catch(e => logger.warn("[Register] Marquage code échoué", { error: e.message }));
  }

  // ── Email de bienvenue (asynchrone, ne bloque pas) ────────────────────────
  const firstName = full_name.split(" ")[0];
  sendEmail({
    to: email,
    subject: "Bienvenue sur TablièreCI !",
    text: `Bonjour ${firstName}, votre compte TablièreCI a bien été créé.`,
    html: `<p>Bonjour <strong>${firstName}</strong>,</p>
           <p>Votre compte TablièreCI a bien été créé. Vous pouvez maintenant vous connecter.</p>
           <p>L'équipe TablièreCI — <a href="https://tabliereci.net">tabliereci.net</a></p>`,
  }).catch(() => {});

  const { access, refresh } = generateTokens(user.id, user.role);
  logger.info("Nouveau compte créé", { userId: user.id, role });

  return created(res, {
    user,
    access_token:  access,
    refresh_token: refresh,
  }, "Compte créé avec succès");
});

// ── POST /auth/login ───────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    `SELECT id, email, full_name, role, status, password_hash, restaurant_id, phone
     FROM users WHERE email = $1`, [email]
  );
  const user = rows[0];
  if (!user) return unauth(res, "Email ou mot de passe incorrect");

  const isBlocked = ["bloque", "suspendu"].includes(user.status);
  if (isBlocked) throw new AppError("Votre compte a été suspendu. Contactez le support.", 403);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return unauth(res, "Email ou mot de passe incorrect");

  await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]).catch(() => {});
  await cache.del(`user:${user.id}`).catch(() => {});

  const { access, refresh } = generateTokens(user.id, user.role);
  const { password_hash: _, ...safeUser } = user;

  logger.info("Connexion réussie", { userId: user.id, role: user.role });
  return ok(res, {
    user: safeUser,
    access_token:  access,
    refresh_token: refresh,
  }, "Connexion réussie");
});

// ── POST /auth/logout ──────────────────────────────────────────────────────────
export const logout = asyncHandler(async (req, res) => {
  if (req.token) await revokeToken(req.token).catch(() => {});
  if (req.user?.id) await cache.del(`user:${req.user.id}`).catch(() => {});
  return ok(res, {}, "Déconnecté avec succès");
});

// ── POST /auth/refresh ─────────────────────────────────────────────────────────
export const refresh = asyncHandler(async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return unauth(res, "Token de rafraîchissement manquant");

  let decoded;
  try {
    decoded = jwt.verify(refresh_token, env.jwt.secret);
  } catch {
    return unauth(res, "Token invalide ou expiré");
  }
  if (decoded.type !== "refresh") return unauth(res, "Token invalide");

  const { access, refresh: newRefresh } = generateTokens(decoded.id, decoded.role);
  return ok(res, { access_token: access, refresh_token: newRefresh });
});

// ── GET /auth/me ───────────────────────────────────────────────────────────────
export const me = asyncHandler(async (req, res) => {
  const cacheKey = `user:${req.user.id}`;
  const cached   = await cache.get(cacheKey).catch(() => null);
  if (cached) return ok(res, { user: cached });

  const { rows: [user] } = await query(
    `SELECT id, email, full_name, phone, role, status,
            restaurant_id, avatar_url, last_login_at, created_at
     FROM users WHERE id = $1`, [req.user.id]
  );

  // Récupérer le slug du restaurant si restaurateur
  if (user?.role === "restaurateur" && user.restaurant_id) {
    const { rows: [resto] } = await query(
      "SELECT slug, name FROM restaurants WHERE id = $1", [user.restaurant_id]
    );
    if (resto) { user.resto_slug = resto.slug; user.resto_name = resto.name; }
  }

  await cache.set(cacheKey, user, 300).catch(() => {});
  return ok(res, { user });
});

// ── POST /auth/verify-code — vérifier un code restaurateur ────────────────────
export const verifyRestaurateurCode = asyncHandler(async (req, res) => {
  const { code } = req.body;
  if (!code) throw new AppError("Code requis", 400);

  const codeVal = code.trim().toUpperCase();

  const { rows: [codeRow] } = await query(
    `SELECT id, is_used, expires_at FROM restaurateur_codes WHERE code = $1`,
    [codeVal]
  );

  if (!codeRow) return ok(res, { valid: false }, "Code invalide");
  if (codeRow.is_used) return ok(res, { valid: false }, "Ce code a déjà été utilisé");
  if (codeRow.expires_at && new Date(codeRow.expires_at) < new Date()) {
    return ok(res, { valid: false }, "Ce code a expiré");
  }

  return ok(res, { valid: true }, "Code valide");
});

// ── POST /auth/forgot-password ─────────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) throw new AppError("Email requis", 400);

  const { rows: [user] } = await query(
    "SELECT id, full_name FROM users WHERE email = $1", [email]
  );
  // Toujours retourner OK (ne pas révéler si l'email existe)
  if (!user) return ok(res, {}, "Si cet email existe, un lien vous a été envoyé.");

  const token   = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

  await query(
    `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
    [token, expires.toISOString(), user.id]
  ).catch(() => {});

  const resetUrl = `${process.env.FRONTEND_URL || "https://tabliereci.net"}/reset-password?token=${token}`;
  await sendEmail({
    to:      email,
    subject: "Réinitialisation de votre mot de passe TablièreCI",
    text:    `Cliquez sur ce lien pour réinitialiser votre mot de passe (valable 1h) : ${resetUrl}`,
    html:    `<p>Bonjour ${user.full_name},</p>
              <p>Cliquez sur le bouton ci-dessous pour réinitialiser votre mot de passe :</p>
              <p><a href="${resetUrl}" style="background:#e8a045;color:#1a1000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Réinitialiser</a></p>
              <p><small>Ce lien est valable 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.</small></p>`,
  }).catch(() => {});

  return ok(res, {}, "Si cet email existe, un lien vous a été envoyé.");
});

// ── POST /auth/reset-password ──────────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) throw new AppError("Token et mot de passe requis", 400);

  const { rows: [user] } = await query(
    `SELECT id FROM users
     WHERE reset_token = $1 AND reset_token_expires > NOW()`,
    [token]
  );
  if (!user) throw new AppError("Lien invalide ou expiré", 400);

  const hash = await bcrypt.hash(password, 12);
  await query(
    `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
     WHERE id = $2`,
    [hash, user.id]
  );

  await cache.del(`user:${user.id}`).catch(() => {});
  return ok(res, {}, "Mot de passe mis à jour avec succès");
});
