/**
 * Authentification par NUMÉRO DE TÉLÉPHONE + OTP WhatsApp — TablièreCI
 *
 * Flux voulu :
 *  1. Inscription : numéro -> OTP WhatsApp (vérifie le numéro) -> l'utilisateur
 *     choisit SON mot de passe. Ensuite il se connecte avec numéro + mot de passe.
 *  2. Connexion : numéro (ou email) + mot de passe. PAS d'OTP à chaque fois.
 *  3. Mot de passe oublié : OTP WhatsApp -> nouveau mot de passe.
 *
 * Sécurité (priorité n°1 anti-fuite) :
 *  - Code hashé (bcrypt), jamais stocké en clair, à usage unique, TTL court.
 *  - Comparaison à temps constant, nombre d'essais limité, anti-énumération.
 *  - Le passage « OTP vérifié -> création/reset » se fait via un ticket JWT court
 *    signé (typ:"otp"), impossible à falsifier côté client.
 *  - Aucun mot de passe n'est envoyé par message : l'utilisateur définit le sien.
 */
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { query, withTransaction } from "../config/db.js";
import { cache } from "../config/redis.js";
import { signAccessToken, createRefreshToken, revokeAllForUser } from "../utils/refreshTokens.js";
import { ok, created } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";
import { getSetting } from "../utils/platformSettings.js";
import { whatsappService } from "../services/whatsapp.service.js";
import { normalizePhone, isValidPhone } from "../utils/phone.js";

const DUMMY_HASH = bcrypt.hashSync("tabliere_dummy_otp_00", 10);
const OTP_TTL_MS = 10 * 60 * 1000;     // 10 minutes
const OTP_MAX_ATTEMPTS = 5;            // essais par code
const OTP_MAX_SENDS = 5;               // envois / 15 min / numéro (garde-fou DB)
const TICKET_TTL = "10m";
const PURPOSES = ["register", "reset"];

let migrated = false;
async function ensureOtp() {
  if (migrated) return;
  await query(`
    CREATE TABLE IF NOT EXISTS otp_codes (
      id          BIGSERIAL PRIMARY KEY,
      phone       VARCHAR(20)  NOT NULL,
      purpose     VARCHAR(20)  NOT NULL,
      code_hash   VARCHAR(72)  NOT NULL,
      expires_at  TIMESTAMPTZ  NOT NULL,
      attempts    INT          NOT NULL DEFAULT 0,
      consumed_at TIMESTAMPTZ,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, purpose, created_at DESC)`).catch(() => {});
  // Le numéro devient identifiant principal : l'email peut être NULL désormais.
  await query(`ALTER TABLE users ALTER COLUMN email DROP NOT NULL`).catch(() => {});
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE`).catch(() => {});
  migrated = true;
}

const sixDigits = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

const signTicket = (phone, purpose) =>
  jwt.sign({ typ: "otp", phone, purpose }, env.JWT_SECRET, { expiresIn: TICKET_TTL });

function readTicket(ticket, purpose) {
  try {
    const d = jwt.verify(String(ticket || ""), env.JWT_SECRET);
    if (d.typ !== "otp" || d.purpose !== purpose || !d.phone) throw new Error("bad");
    return d.phone;
  } catch {
    throw new AppError("Vérification expirée. Recommencez la vérification du numéro.", 401);
  }
}

// ── POST /auth/otp/send — envoie un code WhatsApp ────────────────────────────
export const sendOtp = asyncHandler(async (req, res) => {
  await ensureOtp();
  const purpose = PURPOSES.includes(req.body?.purpose) ? req.body.purpose : "register";
  const phone = normalizePhone(req.body?.phone);
  if (!isValidPhone(phone)) throw new AppError("Numéro de téléphone invalide.", 400);

  // Garde-fou anti-abus au niveau base (en plus du rate limiter par IP/numéro).
  const { rows: [{ c }] } = await query(
    "SELECT COUNT(*)::int AS c FROM otp_codes WHERE phone = $1 AND created_at > NOW() - INTERVAL '15 minutes'", [phone]);
  if (c >= OTP_MAX_SENDS) throw new AppError("Trop de demandes de code. Patientez quelques minutes.", 429);

  const { rows: [existing] } = await query(
    "SELECT id, phone_verified FROM users WHERE phone = $1 LIMIT 1", [phone]);

  if (purpose === "register") {
    if (existing && existing.phone_verified) throw new AppError("Ce numéro a déjà un compte. Connectez-vous.", 409);
  } else if (purpose === "reset") {
    // Anti-énumération : si le numéro n'existe pas, on répond OK sans rien envoyer.
    // On exécute quand même un bcrypt.hash factice pour que le temps de réponse
    // soit indiscernable du cas « compte existant » (sinon le délai révèle l'existence).
    if (!existing) {
      await bcrypt.hash(sixDigits(), 10).catch(() => {});
      return ok(res, { sent: true }, "Si un compte existe, un code a été envoyé.");
    }
  }

  const code = sixDigits();
  const codeHash = await bcrypt.hash(code, 10);
  const expires = new Date(Date.now() + OTP_TTL_MS).toISOString();
  // Un seul code actif : on invalide les précédents non consommés.
  await query("UPDATE otp_codes SET consumed_at = NOW() WHERE phone = $1 AND purpose = $2 AND consumed_at IS NULL", [phone, purpose]).catch(() => {});
  await query("INSERT INTO otp_codes (phone, purpose, code_hash, expires_at) VALUES ($1,$2,$3,$4)", [phone, purpose, codeHash, expires]);

  await whatsappService.sendOtpCode(phone, code).catch((e) => logger.warn("[OTP] envoi WhatsApp échoué", { error: e.message }));
  logger.info("[OTP] code envoyé", { phone, purpose });

  const payload = { sent: true };
  // On ne renvoie le code en clair QUE en développement local (NODE_ENV dev/test
  // ET base de données locale). Se fier au seul isProd est dangereux : un déploiement
  // distant qui oublie NODE_ENV=production retomberait sur "development" et exposerait
  // le code à quiconque le demande → prise de compte de n'importe quel numéro.
  if (!env.WHATSAPP_TOKEN && env.isDevLocal) payload.dev_code = code;
  return ok(res, payload, "Code envoyé par WhatsApp.");
});

// ── POST /auth/otp/verify — vérifie le code, renvoie un ticket ───────────────
export const verifyOtp = asyncHandler(async (req, res) => {
  await ensureOtp();
  const purpose = PURPOSES.includes(req.body?.purpose) ? req.body.purpose : "register";
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || "").replace(/[^\d]/g, "");
  if (!isValidPhone(phone) || code.length !== 6) throw new AppError("Numéro ou code invalide.", 400);

  const { rows: [row] } = await query(
    `SELECT id, code_hash, attempts FROM otp_codes
     WHERE phone = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`, [phone, purpose]);

  // Pas de code actif : bcrypt.compare factice (temps constant) puis rejet.
  if (!row) {
    await bcrypt.compare(code, DUMMY_HASH).catch(() => {});
    throw new AppError("Code invalide ou expiré. Redemandez un code.", 400);
  }
  // Incrément ATOMIQUE de la tentative (anti-course) : si le plafond est déjà
  // atteint, rowCount = 0 → trop d'essais. Empêche des /verify concurrents de
  // dépasser la limite en lisant tous la même valeur avant l'incrément.
  const { rows: [bumped] } = await query(
    `UPDATE otp_codes SET attempts = attempts + 1
     WHERE id = $1 AND attempts < $2 AND consumed_at IS NULL RETURNING id`,
    [row.id, OTP_MAX_ATTEMPTS]);
  if (!bumped) {
    await query("UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1", [row.id]).catch(() => {});
    throw new AppError("Trop d'essais. Redemandez un nouveau code.", 429);
  }
  const okCode = await bcrypt.compare(code, row.code_hash);
  if (!okCode) throw new AppError("Code incorrect.", 400);
  await query("UPDATE otp_codes SET consumed_at = NOW() WHERE id = $1", [row.id]);
  return ok(res, { ticket: signTicket(phone, purpose) }, "Numéro vérifié.");
});

// Valide + consomme un code d'accès restaurateur/organisateur (dans la transaction).
async function consumeRoleCode(client, role, body, userId) {
  if (role === "restaurateur") {
    const codeVal = (body.code_restaurateur || "").trim().toUpperCase();
    if (!codeVal) throw new AppError("Le code d'accès restaurateur est obligatoire", 400);
    const { rowCount } = await client.query(
      `UPDATE restaurateur_codes SET is_used = TRUE, used_by = $1, used_at = NOW()
       WHERE code = $2 AND is_used = FALSE AND (expires_at IS NULL OR expires_at > NOW())`, [userId, codeVal]);
    if (!rowCount) throw new AppError("Code restaurateur invalide, expiré ou déjà utilisé.", 400);
  } else if (role === "organisateur") {
    const codeVal = (body.code_organisateur || "").trim().toUpperCase();
    if (!codeVal) throw new AppError("Le code d'accès organisateur est obligatoire", 400);
    const { rowCount } = await client.query(
      `UPDATE organisateur_codes SET is_used = TRUE, used_by = $1, used_at = NOW()
       WHERE code = $2 AND is_used = FALSE AND (expires_at IS NULL OR expires_at > NOW())`, [userId, codeVal]);
    if (!rowCount) throw new AppError("Code organisateur invalide, expiré ou déjà utilisé.", 400);
  }
}

// ── POST /auth/otp/register — crée le compte après vérif + choix du mot de passe ─
export const registerPhone = asyncHandler(async (req, res) => {
  await ensureOtp();
  const b = req.body || {};
  const phone = readTicket(b.otp_ticket, "register");
  const role = ["client", "restaurateur", "organisateur"].includes(b.role) ? b.role : "client";

  if ((await getSetting("inscriptions_open", "true")) === "false" && role === "client") {
    throw new AppError("Les inscriptions sont temporairement fermées. Réessayez plus tard.", 403);
  }
  const full_name = String(b.full_name || "").trim();
  if (full_name.length < 2) throw new AppError("Nom complet requis.", 400);
  const password = String(b.password || "");
  if (password.length < 8) throw new AppError("Le mot de passe doit faire au moins 8 caractères.", 400);
  const email = (b.email && String(b.email).trim().toLowerCase()) || null;

  const { rows: [taken] } = await query("SELECT id, phone_verified FROM users WHERE phone = $1 LIMIT 1", [phone]);
  if (taken && taken.phone_verified) throw new AppError("Ce numéro a déjà un compte. Connectez-vous.", 409);
  if (email) {
    const { rows: emailTaken } = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (emailTaken.length) throw new AppError("Cet e-mail est déjà utilisé.", 409);
  }

  const password_hash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await withTransaction(async (client) => {
    const { rows: [u] } = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status, phone_verified, email_verified, last_login_at)
       VALUES ($1,$2,$3,$4,$5,'actif',TRUE,$6,NOW())
       RETURNING id, email, phone, full_name, role, status`,
      [full_name, email, phone, password_hash, role, email ? false : true]);
    await consumeRoleCode(client, role, b, u.id);

    // Restaurateur : créer le restaurant (slug unique) et le rattacher — même
    // logique que l'inscription e-mail, sinon un restaurateur inscrit par
    // téléphone n'aurait aucun établissement.
    if (role === "restaurateur") {
      const restoName = String(b.restaurant_name || "").trim();
      if (restoName.length < 2) throw new AppError("Le nom du restaurant est obligatoire.", 400);
      let slug = restoName.toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "restaurant";
      const base = slug;
      for (let i = 2; i <= 60; i++) {
        const { rows: taken } = await client.query("SELECT 1 FROM restaurants WHERE slug = $1", [slug]);
        if (!taken.length) break;
        slug = `${base}-${i}`;
      }
      const { rows: [resto] } = await client.query(
        `INSERT INTO restaurants (owner_id, name, slug, status)
         VALUES ($1, $2, $3, 'actif') RETURNING id, slug, name`,
        [u.id, restoName, slug]);
      await client.query("UPDATE users SET restaurant_id = $1 WHERE id = $2", [resto.id, u.id]);
      u.resto_id = resto.id; u.resto_slug = resto.slug; u.resto_name = resto.name;
    }
    return u;
    });
  } catch (e) {
    // Course sur le numéro/e-mail (deux inscriptions simultanées) → la contrainte
    // UNIQUE lève 23505 : message clair plutôt qu'une erreur 500.
    if (e?.code === "23505") throw new AppError("Ce numéro (ou cet e-mail) a déjà un compte. Connectez-vous.", 409);
    throw e;
  }

  // Rattacher les réservations faites en INVITÉ à ce compte. UNIQUEMENT pour les
  // clients (un restaurateur/organisateur ne doit jamais hériter de réservations
  // clients), et en excluant les numéros « poubelle » (chiffre unique répété, trop
  // courts) — un resto qui saisit un numéro générique pour ses walk-in ne doit pas
  // transférer les réservations d'autrui. Le numéro du compte est vérifié par OTP.
  const digits = String(phone).replace(/[^0-9]/g, "");
  const isPlaceholder = digits.length < 8 || /^(\d)\1+$/.test(digits);
  if (role === "client" && !isPlaceholder) {
    await query(
      `UPDATE reservations SET client_id = $1
       WHERE client_id = (SELECT id FROM users WHERE email = 'guest@tabliereci.net' LIMIT 1)
         AND walk_in_phone IS NOT NULL
         AND regexp_replace(walk_in_phone, '[^0-9]', '', 'g') = $2`,
      [user.id, digits]
    ).catch((e) => logger.warn("Rattachement réservations invité (téléphone) échoué", { error: e?.message }));
  }

  const access = signAccessToken(user.id, user.role);
  const { token: refresh } = await createRefreshToken(user.id, user.role);
  logger.info("Inscription par téléphone", { userId: user.id, role: user.role });
  return created(res, { user, access_token: access, refresh_token: refresh }, "Compte créé.");
});

// ── POST /auth/otp/reset — nouveau mot de passe après vérif OTP ──────────────
export const resetPasswordPhone = asyncHandler(async (req, res) => {
  await ensureOtp();
  const b = req.body || {};
  const phone = readTicket(b.otp_ticket, "reset");
  const password = String(b.password || "");
  if (password.length < 8) throw new AppError("Le mot de passe doit faire au moins 8 caractères.", 400);

  const { rows: [user] } = await query("SELECT id FROM users WHERE phone = $1 LIMIT 1", [phone]);
  if (!user) throw new AppError("Aucun compte pour ce numéro.", 404);

  const password_hash = await bcrypt.hash(password, 12);
  await query(
    `UPDATE users SET password_hash = $1, phone_verified = TRUE,
        sessions_valid_from = NOW(), updated_at = NOW() WHERE id = $2`, [password_hash, user.id]);
  await revokeAllForUser(user.id).catch(() => {});   // déconnecte toutes les sessions
  await cache.del(`user:${user.id}`).catch(() => {});
  logger.info("Mot de passe réinitialisé (téléphone)", { userId: user.id });
  return ok(res, {}, "Mot de passe mis à jour. Connectez-vous.");
});
