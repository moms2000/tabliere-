/**
 * Cadeaux & Jeux — TablièreCI
 *
 * Deux usages :
 *  1. Tirage au sort (lottery) : les gens s'inscrivent via le QR d'une campagne
 *     (signup_ref = ref_code). L'admin lance le tirage, le système choisit N
 *     gagnants au hasard et crée un BON à code pour chacun.
 *  2. Cadeau ciblé (targeted) : l'admin offre un article précis à un client donné.
 *
 * Le gagnant présente son code au restaurant ; le restaurateur le valide (le bon
 * passe « utilisé »). Réservé à l'admin pour la gestion ; validation par le resto.
 */
import crypto from "crypto";
import { query, withTransaction } from "../config/db.js";
import { ok, created, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { sendPushToUser } from "../services/push.service.js";
import { normalizePhone } from "../utils/phone.js";

const CAMPAIGN_TYPES = ["lottery", "targeted"];
// Alphabet sans caractères ambigus (0/O, 1/I/L) pour des codes lisibles à l'oral.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randCode(len) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
  return s;
}

let migrated = false;
async function ensureTables() {
  if (migrated) return;
  await query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id                   BIGSERIAL PRIMARY KEY,
      restaurant_id        UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      name                 VARCHAR(120) NOT NULL,
      type                 VARCHAR(20)  NOT NULL DEFAULT 'lottery',
      reward_label         VARCHAR(160) NOT NULL,
      ref_code             VARCHAR(40)  UNIQUE,
      winners_count        INT          NOT NULL DEFAULT 0,
      voucher_expires_days INT          NOT NULL DEFAULT 30,
      status               VARCHAR(20)  NOT NULL DEFAULT 'open',
      created_by           UUID,
      created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      drawn_at             TIMESTAMPTZ
    )`).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id            BIGSERIAL PRIMARY KEY,
      campaign_id   BIGINT REFERENCES campaigns(id) ON DELETE CASCADE,
      restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
      user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code          VARCHAR(16) NOT NULL UNIQUE,
      reward_label  VARCHAR(160) NOT NULL,
      status        VARCHAR(20)  NOT NULL DEFAULT 'active',
      expires_at    TIMESTAMPTZ,
      used_at       TIMESTAMPTZ,
      used_by       UUID,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_vouchers_user  ON vouchers(user_id, status)`).catch(() => {});
  await query(`CREATE INDEX IF NOT EXISTS idx_vouchers_resto ON vouchers(restaurant_id)`).catch(() => {});
  migrated = true;
}

// Génère un ref_code de campagne unique (6 caractères).
async function uniqueRefCode() {
  for (let i = 0; i < 20; i++) {
    const c = randCode(6);
    const { rows } = await query("SELECT 1 FROM campaigns WHERE ref_code = $1", [c]);
    if (!rows.length) return c;
  }
  throw new AppError("Impossible de générer un code de campagne.", 500);
}
// Génère un code de bon unique (préfixe + 5 caractères), lisible.
async function uniqueVoucherCode(prefix) {
  const pfx = (prefix || "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 3) || "TC";
  for (let i = 0; i < 25; i++) {
    const c = `${pfx}-${randCode(5)}`;
    const { rows } = await query("SELECT 1 FROM vouchers WHERE code = $1", [c]);
    if (!rows.length) return c;
  }
  throw new AppError("Impossible de générer un code de bon.", 500);
}

// Restaurant du restaurateur connecté (staff → son resto ; owner → son resto).
async function resolveRestoId(req) {
  if (req.user.is_staff && req.user.restaurant_id) return req.user.restaurant_id;
  const { rows } = await query(
    "SELECT id FROM restaurants WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1", [req.user.id]);
  if (rows[0]) return rows[0].id;
  throw new AppError("Aucun restaurant associé à ce compte", 400);
}

// ── ADMIN : créer une campagne ───────────────────────────────────────────────
export const createCampaign = asyncHandler(async (req, res) => {
  await ensureTables();
  const b = req.body || {};
  const type = CAMPAIGN_TYPES.includes(b.type) ? b.type : "lottery";
  const name = String(b.name || "").trim();
  const reward = String(b.reward_label || "").trim();
  const restaurant_id = String(b.restaurant_id || "").trim();
  const winners = Math.max(0, Math.min(100000, parseInt(b.winners_count) || 0));
  const expDays = Math.max(1, Math.min(365, parseInt(b.voucher_expires_days) || 30));

  if (name.length < 2)   throw new AppError("Nom de campagne requis.", 400);
  if (reward.length < 2) throw new AppError("Décrivez la récompense (ex : 1 café offert).", 400);
  if (!restaurant_id)    throw new AppError("Restaurant requis.", 400);
  if (type === "lottery" && winners < 1) throw new AppError("Indiquez le nombre de gagnants.", 400);

  const { rows: [resto] } = await query("SELECT id, name FROM restaurants WHERE id = $1", [restaurant_id]);
  if (!resto) throw new AppError("Restaurant introuvable.", 404);

  const ref_code = type === "lottery" ? await uniqueRefCode() : null;
  const { rows: [c] } = await query(
    `INSERT INTO campaigns (restaurant_id, name, type, reward_label, ref_code, winners_count, voucher_expires_days, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [restaurant_id, name, type, reward, ref_code, winners, expDays, req.user.id]);
  logger.info("[Promo] Campagne créée", { id: c.id, type, restaurant_id, by: req.user.id });
  return created(res, { campaign: c }, "Campagne créée.");
});

// ── ADMIN : lister les campagnes (avec compteurs) ────────────────────────────
export const listCampaigns = asyncHandler(async (_req, res) => {
  await ensureTables();
  const { rows } = await query(
    `SELECT c.*, r.name AS restaurant_name,
       (SELECT COUNT(*) FROM users u WHERE u.signup_ref = c.ref_code AND u.role='client' AND u.status='actif')::int AS eligible_count,
       (SELECT COUNT(*) FROM vouchers v WHERE v.campaign_id = c.id)::int AS winners_issued,
       (SELECT COUNT(*) FROM vouchers v WHERE v.campaign_id = c.id AND v.status='used')::int AS used_count
     FROM campaigns c JOIN restaurants r ON r.id = c.restaurant_id
     ORDER BY c.created_at DESC`);
  return ok(res, { campaigns: rows });
});

// ── ADMIN : lancer le tirage au sort ─────────────────────────────────────────
export const drawCampaign = asyncHandler(async (req, res) => {
  await ensureTables();
  const id = parseInt(req.params.id);
  const { rows: [c] } = await query("SELECT * FROM campaigns WHERE id = $1", [id]);
  if (!c) throw new AppError("Campagne introuvable.", 404);
  if (c.type !== "lottery") throw new AppError("Cette campagne n'est pas un tirage au sort.", 400);
  if (c.status === "closed") throw new AppError("Cette campagne est clôturée.", 400);

  // Combien de gagnants manque-t-il pour atteindre l'objectif ?
  const { rows: [{ n: already }] } = await query(
    "SELECT COUNT(*)::int AS n FROM vouchers WHERE campaign_id = $1", [id]);
  const need = c.winners_count - already;
  if (need <= 0) throw new AppError("Le nombre de gagnants est déjà atteint.", 400);

  // Vivier : inscrits via le QR de la campagne, clients actifs, pas déjà gagnants.
  const { rows: winners } = await query(
    `SELECT id, full_name FROM users
      WHERE signup_ref = $1 AND role = 'client' AND status = 'actif'
        AND id NOT IN (SELECT user_id FROM vouchers WHERE campaign_id = $2)
      ORDER BY random() LIMIT $3`,
    [c.ref_code, id, need]);

  if (!winners.length) throw new AppError("Aucun inscrit éligible pour ce tirage (personne ne s'est inscrit via ce QR, ou tous ont déjà gagné).", 400);

  const expires = new Date(Date.now() + c.voucher_expires_days * 86400000).toISOString();
  const issued = [];
  for (const w of winners) {
    const code = await uniqueVoucherCode(c.name);
    await query(
      `INSERT INTO vouchers (campaign_id, restaurant_id, user_id, code, reward_label, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, c.restaurant_id, w.id, code, c.reward_label, expires]);
    issued.push({ user_id: w.id, code });
    // Notification push (silencieuse si l'utilisateur n'a pas l'app).
    sendPushToUser(w.id, {
      title: "🎉 Vous avez gagné !",
      body: `${c.reward_label} vous attend. Ouvrez « Mes cadeaux » pour votre code.`,
      data: { route: "/mes-cadeaux" },
    }).catch(() => {});
  }
  await query("UPDATE campaigns SET status = 'drawn', drawn_at = NOW() WHERE id = $1", [id]);
  logger.info("[Promo] Tirage effectué", { campaign: id, issued: issued.length });
  return ok(res, { issued: issued.length, total_winners: already + issued.length }, `${issued.length} gagnant(s) tiré(s).`);
});

// ── ADMIN : lister les gagnants d'une campagne ───────────────────────────────
export const listWinners = asyncHandler(async (req, res) => {
  await ensureTables();
  const id = parseInt(req.params.id);
  const { rows } = await query(
    `SELECT v.code, v.reward_label, v.status, v.expires_at, v.used_at, v.created_at,
            u.full_name, u.phone
       FROM vouchers v JOIN users u ON u.id = v.user_id
      WHERE v.campaign_id = $1 ORDER BY v.created_at DESC`, [id]);
  return ok(res, { winners: rows });
});

// ── ADMIN : cadeau ciblé à un client précis ──────────────────────────────────
export const createGift = asyncHandler(async (req, res) => {
  await ensureTables();
  const b = req.body || {};
  const restaurant_id = String(b.restaurant_id || "").trim();
  const reward = String(b.reward_label || "").trim();
  const identifier = String(b.user_identifier || "").trim();
  const expDays = Math.max(1, Math.min(365, parseInt(b.voucher_expires_days) || 30));
  if (!restaurant_id) throw new AppError("Restaurant requis.", 400);
  if (reward.length < 2) throw new AppError("Décrivez le cadeau.", 400);
  if (!identifier) throw new AppError("Indiquez le client (numéro ou e-mail).", 400);

  const { rows: [resto] } = await query("SELECT id FROM restaurants WHERE id = $1", [restaurant_id]);
  if (!resto) throw new AppError("Restaurant introuvable.", 404);

  // Retrouver le client par e-mail ou par numéro. Le numéro est normalisé comme au
  // login (défaut CI 225) pour matcher les numéros stockés au format normalisé.
  const isEmail = identifier.includes("@");
  const normPhone = normalizePhone(identifier);
  const { rows: [user] } = isEmail
    ? await query("SELECT id, full_name FROM users WHERE email = $1 LIMIT 1", [identifier.toLowerCase()])
    : await query("SELECT id, full_name FROM users WHERE regexp_replace(phone,'[^0-9]','','g') = $1 LIMIT 1", [normPhone]);
  if (!user) throw new AppError("Client introuvable avec cet identifiant.", 404);

  const code = await uniqueVoucherCode("CAD");
  const expires = new Date(Date.now() + expDays * 86400000).toISOString();
  const { rows: [v] } = await query(
    `INSERT INTO vouchers (campaign_id, restaurant_id, user_id, code, reward_label, expires_at)
     VALUES (NULL,$1,$2,$3,$4,$5) RETURNING code, reward_label, expires_at`,
    [restaurant_id, user.id, code, reward, expires]);
  sendPushToUser(user.id, {
    title: "🎁 Un cadeau pour vous !",
    body: `${reward}. Ouvrez « Mes cadeaux » pour votre code.`,
    data: { route: "/mes-cadeaux" },
  }).catch(() => {});
  logger.info("[Promo] Cadeau ciblé", { user: user.id, restaurant_id });
  return created(res, { voucher: v, user: { full_name: user.full_name } }, "Cadeau envoyé.");
});

// ── RESTAURATEUR : valider un bon (code présenté par le client) ───────────────
export const validateVoucher = asyncHandler(async (req, res) => {
  await ensureTables();
  const code = String(req.body?.code || "").trim().toUpperCase();
  if (!code) throw new AppError("Code requis.", 400);
  const restoId = await resolveRestoId(req);

  const { rows: [v] } = await query(
    `SELECT v.*, u.full_name FROM vouchers v JOIN users u ON u.id = v.user_id
      WHERE v.code = $1 AND v.restaurant_id = $2 LIMIT 1`, [code, restoId]);
  if (!v) throw new AppError("Bon introuvable pour ce restaurant.", 404);
  if (v.status === "used") throw new AppError(`Bon déjà utilisé le ${new Date(v.used_at).toLocaleString("fr-FR")}.`, 409);
  if (v.expires_at && new Date(v.expires_at) < new Date()) {
    await query("UPDATE vouchers SET status='expired' WHERE id=$1 AND status='active'", [v.id]).catch(() => {});
    throw new AppError("Ce bon a expiré.", 400);
  }

  // Marquage atomique : seul le premier à valider gagne (anti double-validation).
  const { rowCount } = await query(
    "UPDATE vouchers SET status='used', used_at=NOW(), used_by=$1 WHERE id=$2 AND status='active'",
    [req.user.id, v.id]);
  if (!rowCount) throw new AppError("Ce bon vient d'être utilisé.", 409);

  logger.info("[Promo] Bon validé", { code, restaurant: restoId, by: req.user.id });
  return ok(res, { valid: true, reward_label: v.reward_label, client: v.full_name }, "Bon validé — offrez la récompense.");
});

// ── CLIENT : mes cadeaux (bons actifs) ───────────────────────────────────────
export const myVouchers = asyncHandler(async (req, res) => {
  await ensureTables();
  const { rows } = await query(
    `SELECT v.code, v.reward_label, v.status, v.expires_at, v.created_at, r.name AS restaurant_name
       FROM vouchers v JOIN restaurants r ON r.id = v.restaurant_id
      WHERE v.user_id = $1
        AND (v.status = 'active' OR (v.status='used' AND v.used_at > NOW() - INTERVAL '7 days'))
        AND (v.expires_at IS NULL OR v.expires_at > NOW() OR v.status='used')
      ORDER BY (v.status='active') DESC, v.created_at DESC`, [req.user.id]);
  return ok(res, { vouchers: rows });
});
