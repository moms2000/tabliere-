/**
 * Intégration caisse tierce — TablièreCI
 *
 * Permet à un restaurant de brancher son propre logiciel de caisse :
 *  - une CLÉ API propre au restaurant (pour récupérer commandes + encaissements),
 *  - des WEBHOOKS signés (HMAC) envoyés en temps réel à SON adresse pour chaque
 *    nouvelle commande et chaque encaissement, avec un identifiant unique par
 *    événement (idempotence → jamais de double comptage côté caisse).
 *
 * La facture officielle reste éditée par LEUR caisse : TablièreCI ne fait que
 * lui transmettre l'information.
 */
import crypto from "crypto";
import axios from "axios";
import { query } from "../config/db.js";
import { ok, created } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";

let migrated = false;
async function ensureTable() {
  if (migrated) return;
  await query(`
    CREATE TABLE IF NOT EXISTS restaurant_integrations (
      restaurant_id   UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
      api_key_hash    TEXT,
      api_key_prefix  VARCHAR(16),
      webhook_url     TEXT,
      webhook_secret  VARCHAR(64),
      is_active       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at    TIMESTAMPTZ,
      last_delivery_at TIMESTAMPTZ,
      last_delivery_status VARCHAR(40)
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_integ_apikey ON restaurant_integrations(api_key_hash)`);
  migrated = true;
}

// Restaurant du propriétaire connecté (jamais un staff — géré par denyStaff en amont).
async function ownerRestoId(req) {
  if (req.user.role === "admin" && req.query.restaurant_id) return req.query.restaurant_id;
  const { rows } = await query(
    "SELECT id FROM restaurants WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1", [req.user.id]);
  if (rows[0]) return rows[0].id;
  throw new AppError("Aucun restaurant associé à ce compte", 400);
}

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// ── Envoi d'un webhook signé (fire-and-forget, ne bloque jamais l'action) ────
// Appelé sans await depuis les commandes/encaissements. `data.ref` sert d'ID
// d'idempotence côté caisse (ne jamais réenregistrer deux fois le même).
export async function deliverWebhook(restoId, event, data) {
  try {
    await ensureTable();
    const { rows: [cfg] } = await query(
      "SELECT webhook_url, webhook_secret, is_active FROM restaurant_integrations WHERE restaurant_id = $1", [restoId]);
    if (!cfg || !cfg.is_active || !cfg.webhook_url) return;
    const id = crypto.randomUUID();
    const body = JSON.stringify({ id, event, sent_at: new Date().toISOString(), data });
    const sig = crypto.createHmac("sha256", cfg.webhook_secret || "").update(body).digest("hex");
    const resp = await axios.post(cfg.webhook_url, body, {
      timeout: 5000,
      headers: {
        "Content-Type": "application/json",
        "X-Tabliere-Event": event,
        "X-Tabliere-Id": id,
        "X-Tabliere-Signature": `sha256=${sig}`,
      },
    });
    query("UPDATE restaurant_integrations SET last_delivery_at = NOW(), last_delivery_status = $2 WHERE restaurant_id = $1",
      [restoId, `ok ${resp.status}`]).catch(() => {});
  } catch (e) {
    const st = e.response?.status ? `http ${e.response.status}` : (e.code || "echec");
    query("UPDATE restaurant_integrations SET last_delivery_at = NOW(), last_delivery_status = $2 WHERE restaurant_id = $1",
      [restoId, st.slice(0, 40)]).catch(() => {});
    logger.warn("[Integration] webhook échoué", { restoId, event, error: e.message });
  }
}

// ── GET /integration — configuration actuelle (propriétaire) ─────────────────
export const getConfig = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = await ownerRestoId(req);
  const { rows: [c] } = await query(
    `SELECT api_key_prefix, webhook_url, webhook_secret, is_active,
            last_used_at, last_delivery_at, last_delivery_status
     FROM restaurant_integrations WHERE restaurant_id = $1`, [restoId]);
  return ok(res, {
    configured: !!c,
    has_key: !!(c && c.api_key_prefix),
    api_key_prefix: c?.api_key_prefix || null,
    webhook_url: c?.webhook_url || null,
    webhook_secret: c?.webhook_secret || null, // secret propre au resto (pour vérifier nos signatures)
    is_active: c?.is_active ?? true,
    last_used_at: c?.last_used_at || null,
    last_delivery_at: c?.last_delivery_at || null,
    last_delivery_status: c?.last_delivery_status || null,
  });
});

// ── POST /integration/key — (re)générer la clé API. Renvoyée UNE SEULE FOIS ──
export const generateKey = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = await ownerRestoId(req);
  const key = "tci_" + crypto.randomBytes(24).toString("hex");
  const prefix = key.slice(0, 12);
  // On (re)génère aussi le secret de webhook s'il n'existe pas encore.
  const { rows: [cur] } = await query("SELECT webhook_secret FROM restaurant_integrations WHERE restaurant_id = $1", [restoId]);
  const secret = cur?.webhook_secret || crypto.randomBytes(24).toString("hex");
  await query(
    `INSERT INTO restaurant_integrations (restaurant_id, api_key_hash, api_key_prefix, webhook_secret, is_active)
     VALUES ($1,$2,$3,$4,TRUE)
     ON CONFLICT (restaurant_id) DO UPDATE SET api_key_hash = $2, api_key_prefix = $3,
       webhook_secret = COALESCE(restaurant_integrations.webhook_secret, $4), is_active = TRUE`,
    [restoId, sha256(key), prefix, secret]);
  logger.info("Clé API intégration générée", { restoId });
  // La clé complète n'est JAMAIS restockée ni réaffichée : à copier maintenant.
  return created(res, { api_key: key, api_key_prefix: prefix, webhook_secret: secret }, "Clé générée. Copiez-la, elle ne sera plus affichée.");
});

// ── PATCH /integration — régler l'URL de webhook / activer-désactiver ────────
// Bloque les hôtes internes (anti-SSRF) sur un URL de webhook.
function webhookHostBlocked(url) {
  let h;
  try { h = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, ""); } catch { return true; }
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true; // loopback / link-local / ULA IPv6
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 0 || a === 127 || a === 10 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)) return true; // 169.254.169.254 = métadonnées cloud
  }
  return false;
}

export const updateConfig = asyncHandler(async (req, res) => {
  await ensureTable();
  const restoId = await ownerRestoId(req);
  const b = req.body || {};
  const sets = [], vals = [];
  if (b.webhook_url !== undefined) {
    const url = b.webhook_url ? String(b.webhook_url).trim() : null;
    if (url && !/^https:\/\/.+/i.test(url)) throw new AppError("L'URL du webhook doit commencer par https://", 400);
    // Anti-SSRF : refuser une URL qui pointe vers une adresse interne (localhost,
    // plages privées, link-local, métadonnées cloud). Sans ça, un restaurateur
    // pouvait faire appeler des services internes par le serveur.
    if (url && webhookHostBlocked(url)) throw new AppError("URL de webhook non autorisée (adresse interne).", 400);
    vals.push(url); sets.push(`webhook_url = $${vals.length}`);
  }
  if (b.is_active !== undefined) { vals.push(!!b.is_active); sets.push(`is_active = $${vals.length}`); }
  if (!sets.length) throw new AppError("Rien à modifier", 400);
  // Crée la ligne si elle n'existe pas encore.
  await query(`INSERT INTO restaurant_integrations (restaurant_id) VALUES ($1) ON CONFLICT (restaurant_id) DO NOTHING`, [restoId]);
  vals.push(restoId);
  await query(`UPDATE restaurant_integrations SET ${sets.join(", ")} WHERE restaurant_id = $${vals.length}`, vals);
  return ok(res, {}, "Configuration mise à jour");
});

// ── GET /integration/admin/all — supervision de TOUTES les intégrations (admin) ──
// Ne renvoie JAMAIS de clé (même hashée) : seulement l'état pour piloter/dépanner.
export const listAll = asyncHandler(async (_req, res) => {
  await ensureTable();
  const { rows } = await query(`
    SELECT r.id AS restaurant_id, r.name,
           (i.api_key_hash IS NOT NULL) AS has_key,
           i.api_key_prefix, i.webhook_url,
           COALESCE(i.is_active, FALSE) AS is_active,
           (i.restaurant_id IS NOT NULL) AS configured,
           i.last_used_at, i.last_delivery_at, i.last_delivery_status
    FROM restaurants r
    LEFT JOIN restaurant_integrations i ON i.restaurant_id = r.id
    ORDER BY (i.restaurant_id IS NOT NULL) DESC, r.name ASC`);
  return ok(res, { integrations: rows });
});

// ── GET /integration/orders — récupération par la caisse (clé API) ──────────
export const pullOrders = asyncHandler(async (req, res) => {
  const restoId = req.integrationResto;
  const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 3600 * 1000);
  const { rows } = await query(
    `SELECT id, ref, table_label, items, total, status, note, created_at, updated_at
     FROM qr_orders WHERE restaurant_id = $1 AND created_at >= $2
     ORDER BY created_at ASC LIMIT 200`,
    [restoId, isNaN(since) ? new Date(Date.now() - 24 * 3600 * 1000) : since]);
  return ok(res, { orders: rows });
});

// ── GET /integration/payments — encaissements (clé API). ref = idempotence ──
export const pullPayments = asyncHandler(async (req, res) => {
  const restoId = req.integrationResto;
  const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 24 * 3600 * 1000);
  const { rows } = await query(
    `SELECT p.id, p.ref, p.amount, p.method, p.convive_id, p.created_at,
            s.table_label, s.id AS session_id
     FROM session_payments p
     JOIN table_sessions s ON s.id = p.session_id
     WHERE p.restaurant_id = $1 AND p.created_at >= $2
     ORDER BY p.created_at ASC LIMIT 200`,
    [restoId, isNaN(since) ? new Date(Date.now() - 24 * 3600 * 1000) : since]);
  return ok(res, { payments: rows });
});
