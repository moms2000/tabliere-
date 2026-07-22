/**
 * Notes de table (additions ouvertes) — TablièreCI
 *
 * Une "note de table" (table_sessions) regroupe toutes les commandes d'une table
 * jusqu'au paiement : plusieurs convives, plusieurs tournées, options par plat.
 * C'est le socle des commandes groupées par QR, de l'ajout d'articles à une table
 * déjà servie, et des reçus individuels ou total.
 *
 *  table_sessions   : une note ouverte par table (index unique partiel sur open)
 *  session_convives : les personnes de la table (Convive 1, 2… ; nom optionnel)
 *  session_items    : chaque article (plat, options, convive, tournée, statut)
 */

import { query, withTransaction } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { logger } from "../utils/logger.js";
import { emitToUser } from "../utils/sse.js";

// ── Migration paresseuse ────────────────────────────────────────────────────
let migrated = false;
async function ensureTables() {
  if (migrated) return;
  await query(`
    CREATE TABLE IF NOT EXISTS table_sessions (
      id            BIGSERIAL PRIMARY KEY,
      restaurant_id INTEGER NOT NULL,
      table_label   VARCHAR(60),
      status        VARCHAR(12) NOT NULL DEFAULT 'open',
      opened_by     VARCHAR(12) DEFAULT 'server',
      join_code     VARCHAR(8),
      opened_at     TIMESTAMPTZ DEFAULT NOW(),
      closed_at     TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
  // Une seule note OUVERTE par table
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_session_per_table
    ON table_sessions(restaurant_id, table_label) WHERE status = 'open'`);
  await query(`CREATE INDEX IF NOT EXISTS idx_sessions_resto_status
    ON table_sessions(restaurant_id, status)`);
  await query(`
    CREATE TABLE IF NOT EXISTS session_convives (
      id           BIGSERIAL PRIMARY KEY,
      session_id   BIGINT NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
      num          INTEGER NOT NULL,
      name         VARCHAR(80),
      device_token VARCHAR(64),
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_convives_session ON session_convives(session_id)`);
  await query(`
    CREATE TABLE IF NOT EXISTS session_items (
      id            BIGSERIAL PRIMARY KEY,
      session_id    BIGINT NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
      convive_id    BIGINT REFERENCES session_convives(id) ON DELETE SET NULL,
      menu_item_id  INTEGER,
      name          VARCHAR(160) NOT NULL,
      unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
      qty           INTEGER NOT NULL DEFAULT 1,
      options       JSONB,
      options_label VARCHAR(200),
      round         INTEGER NOT NULL DEFAULT 1,
      status        VARCHAR(12) NOT NULL DEFAULT 'sent',
      source        VARCHAR(12) DEFAULT 'server',
      note          VARCHAR(300),
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_session_items_session ON session_items(session_id)`);
  migrated = true;
}

// ── Résolution du restaurant du restaurateur connecté ───────────────────────
async function resolveRestoId(req) {
  if (req.user.role === "admin" && req.query.restaurant_id) return req.query.restaurant_id;
  if (req.query.restaurant_id) {
    const { rows } = await query(
      "SELECT id FROM restaurants WHERE id = $1 AND owner_id = $2", [req.query.restaurant_id, req.user.id]);
    if (rows[0]) return rows[0].id;
    throw new AppError("Accès refusé à ce restaurant", 403);
  }
  const { rows } = await query(
    "SELECT id FROM restaurants WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1", [req.user.id]);
  if (rows[0]) return rows[0].id;
  throw new AppError("Aucun restaurant associé à ce compte", 400);
}

// Charge une session appartenant au resto, ou 404/403
async function loadOwnedSession(sessionId, restoId) {
  const { rows: [s] } = await query(
    "SELECT * FROM table_sessions WHERE id = $1 AND restaurant_id = $2", [sessionId, restoId]);
  return s || null;
}

// Re-tarifie les articles depuis la carte (jamais le prix envoyé par le client),
// en conservant options, libellé, convive, note.
async function repriceSessionItems(restoId, items) {
  const ids = [...new Set(items.map(it => it.id || it.menu_item_id).filter(Boolean))];
  const { rows: menuRows } = ids.length
    ? await query("SELECT id, name, price FROM menu_items WHERE restaurant_id = $1 AND id = ANY($2)", [restoId, ids])
    : { rows: [] };
  const map = new Map(menuRows.map(m => [String(m.id), m]));
  return items.map(it => {
    const mid = it.id || it.menu_item_id;
    const m = map.get(String(mid));
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    return {
      menu_item_id:  m ? m.id : (Number.isInteger(mid) ? mid : null),
      name:          m ? m.name : String(it.name || "Article").slice(0, 160),
      unit_price:    m ? (Number(m.price) || 0) : 0,
      qty,
      options:       it.options || null,
      options_label: it.options_label ? String(it.options_label).slice(0, 200) : null,
      convive_id:    it.convive_id || null,
      note:          it.note ? String(it.note).slice(0, 300) : null,
    };
  });
}

// Construit la réponse complète d'une note : convives + articles + totaux
async function sessionDetail(sessionId) {
  const { rows: [session] } = await query("SELECT * FROM table_sessions WHERE id = $1", [sessionId]);
  if (!session) return null;
  const { rows: convives } = await query(
    "SELECT id, num, name, device_token FROM session_convives WHERE session_id = $1 ORDER BY num", [sessionId]);
  const { rows: items } = await query(
    `SELECT id, convive_id, menu_item_id, name, unit_price::float AS unit_price, qty,
            options, options_label, round, status, source, note, created_at
     FROM session_items WHERE session_id = $1 ORDER BY round, id`, [sessionId]);
  const live = items.filter(i => i.status !== "cancelled");
  const total = live.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const perConvive = {};
  for (const i of live) {
    const k = i.convive_id || "shared";
    perConvive[k] = (perConvive[k] || 0) + i.unit_price * i.qty;
  }
  return { session, convives, items, total, per_convive: perConvive };
}

async function ownerId(restoId) {
  const { rows: [r] } = await query("SELECT owner_id FROM restaurants WHERE id = $1", [restoId]);
  return r?.owner_id || null;
}

// Libellé lisible des options : "À point · Frites, Salade"
function labelFromOptions(options) {
  let o = options;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  if (!o) return null;
  const parts = [];
  if (o.cuisson) parts.push(String(o.cuisson));
  const acc = Array.isArray(o.accompagnements) ? o.accompagnements : (o.accompagnement ? [o.accompagnement] : []);
  if (acc.length) parts.push(acc.join(", "));
  return parts.length ? parts.join(" · ").slice(0, 200) : null;
}

/**
 * Attache une commande à la NOTE de sa table (get-or-create), quelle que soit la
 * plateforme d'origine (QR client, terminal serveur, page Commandes). Chaque appel
 * = une tournée. Optionnellement rattache les articles à un convive (identité
 * téléphone via deviceToken, ou nom). Sans table_label : ne fait rien.
 * `items` = articles DÉJÀ re-tarifés serveur ({ id, name, price, qty, options }).
 * N'échoue jamais bruyamment : renvoie l'id de note ou null.
 */
export async function attachOrderToSession({ restoId, tableLabel, items, source = "server", conviveName = null, deviceToken = null }) {
  if (!tableLabel || !Array.isArray(items) || items.length === 0) return null;
  try {
    await ensureTables();
    const findOpen = async () => {
      const { rows: [s] } = await query(
        `SELECT * FROM table_sessions WHERE restaurant_id = $1 AND status = 'open'
           AND table_label IS NOT DISTINCT FROM $2 LIMIT 1`, [restoId, tableLabel]);
      return s || null;
    };
    let s = await findOpen();
    if (!s) {
      try {
        ({ rows: [s] } = await query(
          `INSERT INTO table_sessions (restaurant_id, table_label, opened_by) VALUES ($1, $2, $3) RETURNING *`,
          [restoId, tableLabel, source]));
      } catch (e) { if (e.code === "23505") s = await findOpen(); else throw e; }
    }
    if (!s) return null;

    // Convive (identité téléphone ou nom) — pour les additions séparées
    let conviveId = null;
    if (deviceToken || conviveName) {
      const { rows: [c] } = await query(
        `SELECT id FROM session_convives WHERE session_id = $1
           AND ( ($2::text IS NOT NULL AND device_token = $2) OR ($3::text IS NOT NULL AND name = $3) ) LIMIT 1`,
        [s.id, deviceToken, conviveName]);
      if (c) conviveId = c.id;
      else {
        const { rows: [{ nextnum }] } = await query(
          "SELECT COALESCE(MAX(num),0)+1 AS nextnum FROM session_convives WHERE session_id = $1", [s.id]);
        const { rows: [nc] } = await query(
          "INSERT INTO session_convives (session_id, num, name, device_token) VALUES ($1,$2,$3,$4) RETURNING id",
          [s.id, nextnum, conviveName, deviceToken]);
        conviveId = nc.id;
      }
    }

    const { rows: [{ nextround }] } = await query(
      "SELECT COALESCE(MAX(round),0)+1 AS nextround FROM session_items WHERE session_id = $1", [s.id]);
    for (const it of items) {
      const optLabel = it.options_label || labelFromOptions(it.options);
      await query(
        `INSERT INTO session_items
           (session_id, convive_id, menu_item_id, name, unit_price, qty, options, options_label, round, source, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11)`,
        [s.id, conviveId, Number.isInteger(it.id) ? it.id : (it.menu_item_id || null),
         it.name, it.price || 0, it.qty, it.options ? JSON.stringify(it.options) : null,
         optLabel, nextround, source, it.note || null]);
    }
    // Temps réel → restaurateur
    try { const oid = await ownerId(restoId); if (oid) emitToUser(oid, "session_updated", { session_id: s.id, table_label: tableLabel }); } catch (_) {}
    return s.id;
  } catch (e) {
    logger.warn("attachOrderToSession a échoué (commande enregistrée quand même)", { error: e.message });
    return null;
  }
}

// ── POST /sessions — ouvrir (ou récupérer) la note ouverte d'une table ───────
export const openSession = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const table_label = req.body.table_label ? String(req.body.table_label).slice(0, 60) : null;

  // Récupérer la note ouverte existante pour cette table (get-or-create)
  const { rows: [existing] } = await query(
    `SELECT * FROM table_sessions
     WHERE restaurant_id = $1 AND status = 'open'
       AND table_label IS NOT DISTINCT FROM $2
     LIMIT 1`,
    [restoId, table_label]);
  if (existing) return ok(res, await sessionDetail(existing.id), "Note existante");

  try {
    const { rows: [s] } = await query(
      `INSERT INTO table_sessions (restaurant_id, table_label, opened_by) VALUES ($1, $2, 'server') RETURNING *`,
      [restoId, table_label]);
    logger.info("Note de table ouverte", { sessionId: s.id, restoId, table_label });
    return created(res, await sessionDetail(s.id), "Note ouverte");
  } catch (e) {
    // Course : une note vient d'être ouverte en parallèle pour la même table → la récupérer
    if (e.code === "23505") {
      const { rows: [s2] } = await query(
        `SELECT * FROM table_sessions WHERE restaurant_id = $1 AND status = 'open'
           AND table_label IS NOT DISTINCT FROM $2 LIMIT 1`, [restoId, table_label]);
      if (s2) return ok(res, await sessionDetail(s2.id), "Note existante");
    }
    throw e;
  }
});

// ── GET /sessions — notes ouvertes du restaurant ────────────────────────────
export const listSessions = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const status = req.query.status === "closed" ? "closed" : "open";
  const { rows: sessions } = await query(
    "SELECT * FROM table_sessions WHERE restaurant_id = $1 AND status = $2 ORDER BY opened_at DESC LIMIT 100",
    [restoId, status]);
  const detailed = await Promise.all(sessions.map(s => sessionDetail(s.id)));
  return ok(res, { sessions: detailed.filter(Boolean) });
});

// ── GET /sessions/:id ───────────────────────────────────────────────────────
export const getSession = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const s = await loadOwnedSession(req.params.id, restoId);
  if (!s) return notFound(res, "Note introuvable");
  return ok(res, await sessionDetail(s.id));
});

// ── POST /sessions/:id/items — ajouter une tournée d'articles ───────────────
export const addItems = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const s = await loadOwnedSession(req.params.id, restoId);
  if (!s) return notFound(res, "Note introuvable");
  if (s.status !== "open") throw new AppError("Cette note est déjà fermée", 400);

  const items = req.body.items;
  if (!Array.isArray(items) || items.length === 0)
    throw new AppError("Aucun article à ajouter", 400);
  if (items.length > 100) throw new AppError("Trop d'articles", 400);

  const priced = await repriceSessionItems(restoId, items);

  const added = await withTransaction(async (client) => {
    // Numéro de tournée = max existant + 1 (chaque envoi en cuisine = une tournée)
    const { rows: [{ nextround }] } = await client.query(
      "SELECT COALESCE(MAX(round), 0) + 1 AS nextround FROM session_items WHERE session_id = $1", [s.id]);
    const out = [];
    for (const it of priced) {
      const { rows: [row] } = await client.query(
        `INSERT INTO session_items
           (session_id, convive_id, menu_item_id, name, unit_price, qty, options, options_label, round, source, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,'server',$10) RETURNING id`,
        [s.id, it.convive_id, it.menu_item_id, it.name, it.unit_price, it.qty,
         it.options ? JSON.stringify(it.options) : null, it.options_label, nextround, it.note]);
      out.push(row.id);
    }
    return out;
  });

  // Temps réel → restaurateur (nouvelle tournée en cuisine)
  try {
    const oid = await ownerId(restoId);
    if (oid) emitToUser(oid, "session_updated", { session_id: s.id, table_label: s.table_label, added: added.length });
  } catch (_) {}

  logger.info("Tournée ajoutée à la note", { sessionId: s.id, count: added.length });
  return created(res, await sessionDetail(s.id), "Articles ajoutés");
});

// ── PATCH /sessions/:id/items/:itemId — modifier un article ─────────────────
// qty, convive_id (réassigner à un convive), status (served/cancelled)
export const updateItem = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const s = await loadOwnedSession(req.params.id, restoId);
  if (!s) return notFound(res, "Note introuvable");

  const { qty, convive_id, status } = req.body;
  const sets = [], vals = [];
  if (qty !== undefined)        { vals.push(Math.max(1, Math.min(99, parseInt(qty, 10) || 1))); sets.push(`qty = $${vals.length}`); }
  if (convive_id !== undefined) { vals.push(convive_id || null); sets.push(`convive_id = $${vals.length}`); }
  if (status !== undefined) {
    if (!["sent", "served", "cancelled"].includes(status)) throw new AppError("Statut invalide", 400);
    vals.push(status); sets.push(`status = $${vals.length}`);
  }
  if (sets.length === 0) throw new AppError("Rien à modifier", 400);
  vals.push(req.params.itemId, s.id);
  const { rowCount } = await query(
    `UPDATE session_items SET ${sets.join(", ")} WHERE id = $${vals.length - 1} AND session_id = $${vals.length}`, vals);
  if (!rowCount) return notFound(res, "Article introuvable");
  return ok(res, await sessionDetail(s.id), "Article modifié");
});

// ── POST /sessions/:id/convives — ajouter un convive ────────────────────────
export const addConvive = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const s = await loadOwnedSession(req.params.id, restoId);
  if (!s) return notFound(res, "Note introuvable");
  const name = req.body.name ? String(req.body.name).slice(0, 80) : null;
  const { rows: [{ nextnum }] } = await query(
    "SELECT COALESCE(MAX(num), 0) + 1 AS nextnum FROM session_convives WHERE session_id = $1", [s.id]);
  await query("INSERT INTO session_convives (session_id, num, name) VALUES ($1, $2, $3)", [s.id, nextnum, name]);
  return created(res, await sessionDetail(s.id), "Convive ajouté");
});

// ── PATCH /sessions/:id/convives/:cid — renommer un convive ─────────────────
export const updateConvive = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const s = await loadOwnedSession(req.params.id, restoId);
  if (!s) return notFound(res, "Note introuvable");
  const name = req.body.name != null ? String(req.body.name).slice(0, 80) : null;
  const { rowCount } = await query(
    "UPDATE session_convives SET name = $1 WHERE id = $2 AND session_id = $3", [name, req.params.cid, s.id]);
  if (!rowCount) return notFound(res, "Convive introuvable");
  return ok(res, await sessionDetail(s.id), "Convive modifié");
});

// ── POST /sessions/:id/close — clôturer la note ─────────────────────────────
export const closeSession = asyncHandler(async (req, res) => {
  await ensureTables();
  const restoId = await resolveRestoId(req);
  const s = await loadOwnedSession(req.params.id, restoId);
  if (!s) return notFound(res, "Note introuvable");
  await query("UPDATE table_sessions SET status = 'closed', closed_at = NOW() WHERE id = $1", [s.id]);
  logger.info("Note de table fermée", { sessionId: s.id });
  return ok(res, { closed: true }, "Note fermée");
});
