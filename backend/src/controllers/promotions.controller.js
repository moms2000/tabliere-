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
      draw_mode            VARCHAR(10)  NOT NULL DEFAULT 'manual',
      auto_per_batch       INT          NOT NULL DEFAULT 4,
      auto_batch_size      INT          NOT NULL DEFAULT 10,
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
  // Un seul bon par (campagne, utilisateur) : empêche qu'un tirage relancé (ou
  // deux tirages simultanés) attribue deux bons au même gagnant. (Les cadeaux
  // ciblés ont campaign_id NULL et ne sont pas concernés.)
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS uidx_vouchers_campaign_user
               ON vouchers(campaign_id, user_id) WHERE campaign_id IS NOT NULL`).catch(() => {});
  // Colonne ajoutée après coup (tables déjà créées en prod).
  await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS draw_mode VARCHAR(10) NOT NULL DEFAULT 'manual'`).catch(() => {});
  await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_per_batch INT NOT NULL DEFAULT 4`).catch(() => {});
  await query(`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auto_batch_size INT NOT NULL DEFAULT 10`).catch(() => {});
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
// Génère un code de bon unique (préfixe + 5 caractères), lisible. `seen` évite les
// collisions entre bons d'un même tirage (encore non commités, donc invisibles en DB).
async function uniqueVoucherCode(prefix, seen) {
  const pfx = (prefix || "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 3) || "TC";
  for (let i = 0; i < 30; i++) {
    const c = `${pfx}-${randCode(5)}`;
    if (seen && seen.has(c)) continue;
    const { rows } = await query("SELECT 1 FROM vouchers WHERE code = $1", [c]);
    if (!rows.length) { seen && seen.add(c); return c; }
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

// ── Tirage AUTOMATIQUE : appelé à l'inscription d'un client via un QR de campagne.
// Règle : ~40 % de chance, plafonné à 4 gagnants max par lot de 10 inscrits, et au
// total winners_count. Aléa côté SERVEUR (non influençable). Transactionnel + verrou
// sur la campagne → pas de dépassement même en inscriptions simultanées.
export async function autoAwardOnSignup(userId, refCode) {
  if (!userId || !refCode) return { played: false };
  await ensureTables();
  let res = { played: false };
  try {
    res = await withTransaction(async (client) => {
      const { rows: [c] } = await client.query(
        "SELECT * FROM campaigns WHERE ref_code = $1 AND type='lottery' AND draw_mode='auto' AND status <> 'closed' LIMIT 1 FOR UPDATE",
        [refCode]);
      if (!c) return { played: false };            // pas un jeu auto → pas de cinématique
      const { rows: [{ w }] } = await client.query("SELECT COUNT(*)::int AS w FROM vouchers WHERE campaign_id = $1", [c.id]);
      if (w >= c.winners_count) return { played: true, won: false }; // objectif total atteint
      const { rows: [{ s }] } = await client.query(
        "SELECT COUNT(*)::int AS s FROM users WHERE signup_ref = $1 AND role='client' AND status='actif'", [refCode]);
      const N = c.auto_per_batch || 4, X = c.auto_batch_size || 10;
      const maxW = N * Math.floor(s / X) + Math.min(N, s % X);       // N gagnants max par X inscrits
      if (w >= maxW) return { played: true, won: false };            // plafond du lot atteint
      if (crypto.randomInt(0, X) >= N) return { played: true, won: false }; // proba N/X, perdu
      const code = await uniqueVoucherCode(c.name);
      const expires = new Date(Date.now() + c.voucher_expires_days * 86400000).toISOString();
      try {
        await client.query(
          `INSERT INTO vouchers (campaign_id, restaurant_id, user_id, code, reward_label, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [c.id, c.restaurant_id, userId, code, c.reward_label, expires]);
      } catch (e) {
        if (e?.code === "23505") return { played: true, won: false }; // déjà gagnant / collision → perdu
        throw e;
      }
      return { played: true, won: true, reward: c.reward_label, code };
    });
  } catch (e) { logger.warn("[Promo] auto-award échoué", { error: e.message }); return { played: false }; }
  if (res?.won) {
    sendPushToUser(userId, {
      title: "🎉 Vous avez gagné !",
      body: `${res.reward} vous attend. Ouvrez « Mes cadeaux » pour votre code.`,
      data: { route: "/mes-cadeaux" },
    }).catch(() => {});
  }
  return res;
}

// ── ADMIN : créer une campagne ───────────────────────────────────────────────
export const createCampaign = asyncHandler(async (req, res) => {
  await ensureTables();
  const b = req.body || {};
  const type = CAMPAIGN_TYPES.includes(b.type) ? b.type : "lottery";
  const name = String(b.name || "").trim().slice(0, 120);
  const reward = String(b.reward_label || "").trim().slice(0, 160);
  const restaurant_id = String(b.restaurant_id || "").trim();
  const winners = Math.max(0, Math.min(5000, parseInt(b.winners_count) || 0));
  const expDays = Math.max(1, Math.min(365, parseInt(b.voucher_expires_days) || 30));
  const drawMode = b.draw_mode === "auto" ? "auto" : "manual";
  // Ratio du tirage automatique : « perBatch gagnants max par batchSize inscrits ».
  const batchSize = Math.max(1, Math.min(1000, parseInt(b.auto_batch_size) || 10));
  const perBatch  = Math.max(1, Math.min(batchSize, parseInt(b.auto_per_batch) || 4));

  if (name.length < 2)   throw new AppError("Nom de campagne requis.", 400);
  if (reward.length < 2) throw new AppError("Décrivez la récompense (ex : 1 café offert).", 400);
  if (!restaurant_id)    throw new AppError("Restaurant requis.", 400);
  if (type === "lottery" && winners < 1) throw new AppError("Indiquez le nombre de gagnants.", 400);

  const { rows: [resto] } = await query("SELECT id, name FROM restaurants WHERE id = $1", [restaurant_id]);
  if (!resto) throw new AppError("Restaurant introuvable.", 404);

  const ref_code = type === "lottery" ? await uniqueRefCode() : null;
  const { rows: [c] } = await query(
    `INSERT INTO campaigns (restaurant_id, name, type, reward_label, ref_code, winners_count, voucher_expires_days, draw_mode, auto_per_batch, auto_batch_size, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [restaurant_id, name, type, reward, ref_code, winners, expDays, drawMode, perBatch, batchSize, req.user.id]);
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
  if (!Number.isInteger(id)) throw new AppError("Campagne invalide.", 400);

  // Tout le tirage dans UNE transaction avec verrou sur la campagne (FOR UPDATE) :
  // deux tirages simultanés (double-clic, deux admins) sont sérialisés → jamais de
  // sur-attribution ni de gagnant en double. L'index unique (campaign_id,user_id)
  // est un dernier filet.
  const result = await withTransaction(async (client) => {
    const { rows: [c] } = await client.query("SELECT * FROM campaigns WHERE id = $1 FOR UPDATE", [id]);
    if (!c) throw new AppError("Campagne introuvable.", 404);
    if (c.type !== "lottery") throw new AppError("Cette campagne n'est pas un tirage au sort.", 400);
    if (c.draw_mode === "auto") throw new AppError("Cette campagne est en tirage automatique (gagnants tirés à l'inscription).", 400);
    if (c.status === "closed") throw new AppError("Cette campagne est clôturée.", 400);

    const { rows: [{ n: already }] } = await client.query(
      "SELECT COUNT(*)::int AS n FROM vouchers WHERE campaign_id = $1", [id]);
    const need = c.winners_count - already;
    if (need <= 0) throw new AppError("Le nombre de gagnants est déjà atteint.", 400);

    const { rows: winners } = await client.query(
      `SELECT id FROM users
        WHERE signup_ref = $1 AND role = 'client' AND status = 'actif'
          AND id NOT IN (SELECT user_id FROM vouchers WHERE campaign_id = $2)
        ORDER BY random() LIMIT $3`,
      [c.ref_code, id, need]);
    if (!winners.length) throw new AppError("Aucun inscrit éligible pour ce tirage (personne ne s'est inscrit via ce QR, ou tous ont déjà gagné).", 400);

    const expires = new Date(Date.now() + c.voucher_expires_days * 86400000).toISOString();
    const seen = new Set();
    const issued = [];
    for (const w of winners) {
      const code = await uniqueVoucherCode(c.name, seen);
      await client.query(
        `INSERT INTO vouchers (campaign_id, restaurant_id, user_id, code, reward_label, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, c.restaurant_id, w.id, code, c.reward_label, expires]);
      issued.push({ user_id: w.id });
    }
    await client.query("UPDATE campaigns SET status = 'drawn', drawn_at = NOW() WHERE id = $1", [id]);
    return { reward: c.reward_label, issued, already };
  });

  // Notifications APRÈS le commit (une par gagnant ; silencieuse sans app).
  for (const w of result.issued) {
    sendPushToUser(w.user_id, {
      title: "🎉 Vous avez gagné !",
      body: `${result.reward} vous attend. Ouvrez « Mes cadeaux » pour votre code.`,
      data: { route: "/mes-cadeaux" },
    }).catch(() => {});
  }
  logger.info("[Promo] Tirage effectué", { campaign: id, issued: result.issued.length });
  return ok(res, { issued: result.issued.length, total_winners: result.already + result.issued.length }, `${result.issued.length} gagnant(s) tiré(s).`);
});

// ── ADMIN : lister les gagnants d'une campagne ───────────────────────────────
export const listWinners = asyncHandler(async (req, res) => {
  await ensureTables();
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Campagne invalide.", 400);
  const { rows } = await query(
    `SELECT v.code, v.reward_label, v.status, v.expires_at, v.used_at, v.created_at,
            u.full_name, u.phone
       FROM vouchers v JOIN users u ON u.id = v.user_id
      WHERE v.campaign_id = $1 ORDER BY v.created_at DESC`, [id]);
  return ok(res, { winners: rows });
});

// ── ADMIN : liste des clients (pour choisir un destinataire de cadeau) ────────
// Triés par nombre de réservations décroissant (les plus fidèles d'abord), avec
// recherche par nom/numéro/e-mail. Sert au sélecteur du cadeau ciblé.
export const listClients = asyncHandler(async (req, res) => {
  const search = String(req.query.search || "").trim();
  const params = [];
  let where = "role = 'client' AND status = 'actif' AND full_name <> 'Compte supprimé'";
  if (search) {
    params.push(`%${search}%`);
    where += ` AND (full_name ILIKE $${params.length} OR phone ILIKE $${params.length} OR email ILIKE $${params.length})`;
  }
  const { rows } = await query(
    `SELECT id, full_name, phone, email,
            (SELECT COUNT(*) FROM reservations WHERE client_id = users.id)::int AS resa_count
       FROM users WHERE ${where}
      ORDER BY resa_count DESC, full_name ASC LIMIT 100`, params);
  return ok(res, { clients: rows });
});

// ── ADMIN : supprimer une campagne (et ses bons, en cascade) ─────────────────
export const deleteCampaign = asyncHandler(async (req, res) => {
  await ensureTables();
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) throw new AppError("Campagne invalide.", 400);
  const { rowCount } = await query("DELETE FROM campaigns WHERE id = $1", [id]);
  if (!rowCount) throw new AppError("Campagne introuvable.", 404);
  logger.info("[Promo] Campagne supprimée", { id, by: req.user.id });
  return ok(res, {}, "Jeu supprimé.");
});

// ── ADMIN : cadeau ciblé à un client précis ──────────────────────────────────
export const createGift = asyncHandler(async (req, res) => {
  await ensureTables();
  const b = req.body || {};
  const restaurant_id = String(b.restaurant_id || "").trim();
  const reward = String(b.reward_label || "").trim().slice(0, 160);
  const userId = String(b.user_id || "").trim();
  const identifier = String(b.user_identifier || "").trim();
  const expDays = Math.max(1, Math.min(365, parseInt(b.voucher_expires_days) || 30));
  if (!restaurant_id) throw new AppError("Restaurant requis.", 400);
  if (reward.length < 2) throw new AppError("Décrivez le cadeau.", 400);
  if (!userId && !identifier) throw new AppError("Choisissez un client.", 400);

  const { rows: [resto] } = await query("SELECT id FROM restaurants WHERE id = $1", [restaurant_id]);
  if (!resto) throw new AppError("Restaurant introuvable.", 404);

  // Client choisi dans la liste (user_id) — chemin normal ; sinon repli par
  // e-mail/numéro (numéro normalisé comme au login, + variante brute legacy).
  let user;
  if (userId) {
    ({ rows: [user] } = await query("SELECT id, full_name FROM users WHERE id = $1 AND role = 'client' LIMIT 1", [userId]));
  } else {
    const isEmail = identifier.includes("@");
    const normPhone = normalizePhone(identifier);
    const rawDigits = identifier.replace(/[^0-9]/g, "");
    ({ rows: [user] } = isEmail
      ? await query("SELECT id, full_name FROM users WHERE email = $1 LIMIT 1", [identifier.toLowerCase()])
      : await query("SELECT id, full_name FROM users WHERE regexp_replace(phone,'[^0-9]','','g') IN ($1,$2) LIMIT 1", [normPhone, rawDigits]));
  }
  if (!user) throw new AppError("Client introuvable.", 404);

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

  // Le bon doit appartenir à un restaurant du restaurateur : le staff est limité à
  // SON resto ; le propriétaire peut valider pour N'IMPORTE LEQUEL de ses restaurants
  // (corrige le cas multi-restaurants où le 1er resto seul était pris en compte).
  const { rows: [v] } = req.user.is_staff
    ? await query(
        `SELECT v.*, u.full_name FROM vouchers v JOIN users u ON u.id = v.user_id
          WHERE v.code = $1 AND v.restaurant_id = $2 LIMIT 1`, [code, req.user.restaurant_id])
    : await query(
        `SELECT v.*, u.full_name FROM vouchers v JOIN users u ON u.id = v.user_id
          WHERE v.code = $1 AND v.restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = $2) LIMIT 1`,
        [code, req.user.id]);
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

  logger.info("[Promo] Bon validé", { code, restaurant: v.restaurant_id, by: req.user.id });
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
