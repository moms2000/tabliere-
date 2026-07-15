/**
 * Reservations Controller — TablièreCI
 * create | list | getOne | confirm | cancel
 */

import { query, withTransaction } from "../config/db.js";
import { cache }  from "../config/redis.js";
import { ok, created, notFound, forbidden, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { notificationQueue }      from "../queues/index.js";
import { logger }                 from "../utils/logger.js";
import { emitToUser }             from "../utils/sse.js";

// Valeurs valides de l'ENUM resa_status — toute autre valeur écrite en base
// déclenche une erreur 500 ("invalid input value for enum resa_status")
const RESA_STATUSES = ["en_attente", "confirme", "annule", "no_show", "termine"];

// Migration silencieuse : colonnes walk-in (une par une pour éviter les échecs silencieux)
let resaMigrated = false;
async function ensureResaColumns() {
  if (resaMigrated) return;
  const stmts = [
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_name  VARCHAR(255)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_phone VARCHAR(30)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_email VARCHAR(255)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_noshow     BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes         TEXT`,
  ];
  for (const sql of stmts) {
    try { await query(sql); } catch (_) {}
  }
  resaMigrated = true;
}

// ── POST /reservations ────────────────────────────────────────────────────────
export const create = asyncHandler(async (req, res) => {
  await ensureResaColumns();
  const { restaurant_id, table_id, reserved_at, party_size, special_request,
          walk_in_name, walk_in_phone } = req.body;

  // Interdire les réservations dans le passé (client uniquement — un
  // restaurateur peut enregistrer un walk-in en cours/passé récent)
  if (req.user.role === "client" && new Date(reserved_at) < new Date()) {
    throw new AppError("Impossible de réserver à une date ou une heure déjà passée.", 400);
  }

  // Vérifier que le restaurant est actif
  // Pour restaurateur créant une réservation walk-in :
  // utiliser son propre restaurant si restaurant_id absent
  const effectiveRestoId = restaurant_id || req.user.restaurant_id;
  if (!effectiveRestoId) throw new AppError("restaurant_id requis", 400);

  // Les restaurateurs passent en statut "actif" même si leur resto est en_attente
  const { rows: [resto] } = await query(
    "SELECT id, name, capacity, status, auto_confirm, seating_duration, is_published FROM restaurants WHERE id = $1",
    [effectiveRestoId]
  );
  if (!resto) throw new AppError("Restaurant introuvable", 404);
  // Un resto suspendu par la plateforme ne peut recevoir AUCUNE réservation (même du restaurateur).
  if (resto.status === "suspendu") throw new AppError("Restaurant suspendu", 403);
  // Un client ne peut réserver que dans un resto actif ET publié (pas « en préparation »).
  if (req.user.role === "client" && (resto.status !== "actif" || resto.is_published === false))
    throw new AppError("Restaurant indisponible", 404);
  if (resto.capacity && party_size > resto.capacity) throw new AppError(`Ce restaurant accepte au maximum ${resto.capacity} couverts`, 400);

  // Anti-double-booking : la table est libre après la durée d'assise du restaurant.
  // La vérification de conflit + l'insert se font DANS la transaction avec un
  // verrou de ligne (SELECT ... FOR UPDATE) pour éviter la course TOCTOU
  // (deux réservations simultanées sur la même table).
  const durSec = (resto.seating_duration || 120) * 60;

  // Générer un ref unique RES-XXXX
  // Réf atomique via la séquence dédiée (resa_ref_seq) : COUNT(*)+1 provoquait
  // des collisions UNIQUE sous concurrence (deux réservations simultanées →
  // même ref → 500). nextval est atomique et suit le même format que le trigger.
  const { rows: [{ nextref }] } = await query(
    "SELECT 'RES-' || LPAD(nextval('resa_ref_seq')::text, 4, '0') AS nextref"
  );

  const isResto = req.user.role === "restaurateur";
  // Statut initial :
  //  - Restaurateur walk-in → confirmé directement
  //  - Client → 'confirme' si le resto a l'auto-confirmation (défaut),
  //             'en_attente' si le resto confirme manuellement
  const autoConfirm = resto.auto_confirm !== false; // défaut = true
  const initialStatus = (isResto || autoConfirm) ? "confirme" : "en_attente";

  const resa = await withTransaction(async (client) => {
    // Verrou + re-vérification du conflit DANS la transaction (anti-course)
    if (table_id) {
      await client.query("SELECT id FROM restaurant_tables WHERE id = $1 FOR UPDATE", [table_id]);
      const { rows: [conflict] } = await client.query(
        `SELECT id FROM reservations
         WHERE table_id = $1
           AND ABS(EXTRACT(EPOCH FROM (reserved_at - $2::timestamptz))) < $3
           AND status IN ('en_attente','confirme')`,
        [table_id, reserved_at, durSec]
      );
      if (conflict) throw new AppError("Cette table est déjà réservée sur ce créneau", 409);
    }
    let newResa;
    if (isResto && (walk_in_name || walk_in_phone)) {
      // Walk-in : nécessite les colonnes migrées
      const { rows: [r] } = await client.query(
        `INSERT INTO reservations
           (ref, restaurant_id, client_id, table_id, reserved_at, party_size,
            special_request, status, walk_in_name, walk_in_phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [nextref, effectiveRestoId, req.user.id, table_id || null, reserved_at, party_size,
         special_request || null, initialStatus, walk_in_name, walk_in_phone || null]
      );
      newResa = r;
    } else {
      // Réservation standard (client ou restaurateur sans walk-in)
      const { rows: [r] } = await client.query(
        `INSERT INTO reservations
           (ref, restaurant_id, client_id, table_id, reserved_at, party_size, special_request, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [nextref, effectiveRestoId, req.user.id, table_id || null, reserved_at, party_size,
         special_request || null, initialStatus]
      );
      newResa = r;
    }

    // Marquer la table comme réservée
    if (table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'reserve' WHERE id = $1",
        [table_id]
      );
    }

    return newResa;
  });

  // SSE temps réel → restaurateur (récupérer l'owner du resto)
  // Utilise resa.restaurant_id (garanti après INSERT) et non le param brut
  try {
    const { rows: [owner] } = await query(
      "SELECT owner_id FROM restaurants WHERE id = $1", [resa.restaurant_id]
    );
    if (owner?.owner_id) {
      emitToUser(owner.owner_id, "new_reservation", {
        ref:        resa.ref,
        party_size: resa.party_size,
        reserved_at: resa.reserved_at,
        client_name: req.user.full_name || req.user.email,
      });
    }
    // Notifier les admins aussi
    emitToUser("admin", "new_reservation", { ref: resa.ref, resto: resto.name });
  } catch (_) {}

  // Email/WhatsApp asynchrone — le message dépend du statut :
  //  - 'confirme'   → "Réservation confirmée"
  //  - 'en_attente' → "Demande reçue, en attente de confirmation du restaurant"
  await notificationQueue.add("confirmation", {
    userId:         req.user.id,
    restoName:      resto.name,
    reservedAt:     reserved_at,
    partySize:      party_size,
    reservationRef: resa.ref,
    status:         resa.status,
  }).catch(() => {}); // ne pas bloquer si Redis absent

  logger.info("Réservation créée", { resaId: resa.id, ref: resa.ref, userId: req.user.id });
  return created(res, { reservation: resa }, "Réservation créée avec succès");
});

// ── GET /reservations ─────────────────────────────────────────────────────────
export const list = asyncHandler(async (req, res) => {
  const { status, date } = req.query;
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const isAdmin = req.user.role === "admin";
  const isResto = req.user.role === "restaurateur";

  const params = [];
  const conditions = [];

  if (isResto) {
    params.push(req.user.restaurant_id);
    conditions.push(`r.restaurant_id = $${params.length}`);
  } else if (!isAdmin) {
    params.push(req.user.id);
    conditions.push(`r.client_id = $${params.length}`);
  }

  // Cast ::text côté colonne : un status invalide donne 0 résultat au lieu d'un 500
  if (status) { params.push(status); conditions.push(`r.status::text = $${params.length}`); }
  if (date)   { params.push(date);   conditions.push(`r.reserved_at::date = $${params.length}::date`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT r.*,
            re.name AS resto_name, re.slug AS resto_slug,
            COALESCE(r.walk_in_name, u.full_name) AS client_name,
            COALESCE(r.walk_in_phone, u.phone)    AS client_phone,
            t.label AS table_label, t.zone AS table_zone
     FROM reservations r
     LEFT JOIN restaurants re ON re.id = r.restaurant_id
     LEFT JOIN users u ON u.id = r.client_id
     LEFT JOIN restaurant_tables t ON t.id = r.table_id
     ${where}
     ORDER BY r.reserved_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: [{ count }] } = await query(
    `SELECT COUNT(*) FROM reservations r ${where}`, params
  );

  return paginated(res, rows, +count, +page, +limit);
});

// ── GET /reservations/clients — base clients du restaurant (restaurateur) ─────
// Agrège les réservations en fiches clients : contact + historique de visites.
export const getClients = asyncHandler(async (req, res) => {
  await ensureResaColumns();
  const restoId = await resolveRestoId(req); // fiable même si users.restaurant_id est null
  if (!restoId) throw new AppError("Aucun restaurant associé", 400);

  const { rows } = await query(
    `SELECT
       COALESCE(NULLIF(TRIM(r.walk_in_name), ''), u.full_name, 'Client')  AS name,
       COALESCE(NULLIF(TRIM(r.walk_in_phone), ''), u.phone)               AS phone,
       MAX(COALESCE(NULLIF(TRIM(r.walk_in_email), ''), u.email))          AS email,
       COUNT(*)::int                                          AS visits,
       COALESCE(SUM(r.party_size), 0)::int                    AS total_covers,
       MAX(r.reserved_at)                                     AS last_visit,
       MIN(r.reserved_at)                                     AS first_visit,
       COUNT(*) FILTER (WHERE r.status = 'confirme')::int     AS confirmed,
       COUNT(*) FILTER (WHERE r.status = 'no_show')::int      AS no_shows
     FROM reservations r
     LEFT JOIN users u ON u.id = r.client_id
     WHERE r.restaurant_id = $1 AND r.archived_at IS NULL
     GROUP BY 1, 2
     ORDER BY MAX(r.reserved_at) DESC`,
    [restoId]
  );

  // Fusion des contacts importés (CRM externe). On les ajoute UNIQUEMENT s'ils
  // ne correspondent pas déjà à un client issu des réservations (dédoublonnage
  // par téléphone normalisé). Les importés sans visite affichent 0.
  const seenPhones = new Set(rows.map(r => normPhone(r.phone)).filter(Boolean));
  let contacts = [];
  try {
    ({ rows: contacts } = await query(
      `SELECT name, phone, phone_norm, email, note FROM restaurant_contacts WHERE restaurant_id = $1`, [restoId]
    ));
  } catch { contacts = []; }
  const imported = [];
  for (const c of contacts) {
    const pn = c.phone_norm || normPhone(c.phone);
    if (pn && seenPhones.has(pn)) continue; // déjà présent via une réservation
    if (pn) seenPhones.add(pn);
    const noNull = (v) => { const s = String(v ?? "").trim(); return (!s || /^(null|undefined|n\/?a)$/i.test(s)) ? null : v; };
    imported.push({
      name: c.name || "Client", phone: noNull(c.phone), email: noNull(c.email),
      visits: 0, total_covers: 0, confirmed: 0, no_shows: 0,
      first_visit: null, last_visit: null, imported: true, note: c.note || null,
    });
  }
  const all = [...rows.map(r => ({ ...r, imported: false })), ...imported];

  const totals = {
    clients: all.length,
    visits: rows.reduce((a, c) => a + c.visits, 0),
    covers: rows.reduce((a, c) => a + c.total_covers, 0),
  };
  return ok(res, { clients: all, totals });
});

// Normalise un téléphone pour le dédoublonnage : chiffres uniquement.
function normPhone(p) { return p ? String(p).replace(/\D/g, "") : ""; }

// ── POST /reservations/clients/import — importer une base clients (restaurateur) ─
export const importClients = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === "admin";
  const restoId = isAdmin ? req.body.restaurant_id : await resolveRestoId(req);
  if (!restoId) throw new AppError("Aucun restaurant associé", 400);
  // Anti-IDOR : un restaurateur ne peut importer que pour SON restaurant
  if (!isAdmin) {
    const { rows } = await query("SELECT 1 FROM restaurants WHERE id = $1 AND owner_id = $2", [restoId, req.user.id]);
    if (!rows.length) return forbidden(res, "Accès refusé à ce restaurant");
  }
  if (req.body.consent !== true) throw new AppError("Consentement requis pour importer des données personnelles", 400);

  const list = Array.isArray(req.body.contacts) ? req.body.contacts.slice(0, 5000) : [];
  if (!list.length) throw new AppError("Aucun contact à importer", 400);

  // Nettoyage + dédoublonnage interne au fichier (par téléphone normalisé)
  const seen = new Set();
  const clean = [];
  let skipped = 0;
  // Nettoyage : les exports externes mettent souvent "null"/"undefined"/"N/A" en texte
  const norm = (v) => { const s = String(v ?? "").trim(); return (!s || /^(null|undefined|n\/?a|-)$/i.test(s)) ? "" : s; };
  for (const c of list) {
    const name = norm(c.name).slice(0, 160) || null;
    const phone = norm(c.phone).slice(0, 40) || null;
    const email = norm(c.email).toLowerCase().slice(0, 200) || null;
    const note = (c.note ? String(c.note).trim() : "").slice(0, 500) || null;
    const pn = normPhone(phone);
    if (!pn && !email) { skipped++; continue; }          // fiche inexploitable
    if (pn && seen.has(pn)) { skipped++; continue; }      // doublon dans le fichier
    if (pn) seen.add(pn);
    clean.push({ name, phone, pn, email, note });
  }
  if (!clean.length) return ok(res, { imported: 0, updated: 0, skipped }, "Aucun contact exploitable");

  // Combien existent déjà (pour distinguer import vs mise à jour)
  const phones = clean.map(c => c.pn).filter(Boolean);
  let existing = new Set();
  if (phones.length) {
    const { rows } = await query(
      `SELECT phone_norm FROM restaurant_contacts WHERE restaurant_id = $1 AND phone_norm = ANY($2)`, [restoId, phones]
    );
    existing = new Set(rows.map(r => r.phone_norm));
  }

  // Upsert par lots (ON CONFLICT sur (restaurant_id, phone_norm))
  let processed = 0;
  for (let i = 0; i < clean.length; i += 500) {
    const batch = clean.slice(i, i + 500);
    const vals = [];
    const ph = batch.map((c, k) => {
      const b = k * 6;
      vals.push(restoId, c.name, c.phone, c.pn || null, c.email, c.note);
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6})`;
    });
    await query(
      `INSERT INTO restaurant_contacts (restaurant_id, name, phone, phone_norm, email, note)
       VALUES ${ph.join(",")}
       ON CONFLICT (restaurant_id, phone_norm) WHERE phone_norm IS NOT NULL AND phone_norm <> ''
       DO UPDATE SET name = COALESCE(EXCLUDED.name, restaurant_contacts.name),
                     email = COALESCE(EXCLUDED.email, restaurant_contacts.email),
                     note  = COALESCE(EXCLUDED.note, restaurant_contacts.note),
                     updated_at = NOW()`,
      vals
    );
    processed += batch.length;
  }
  const updated = clean.filter(c => c.pn && existing.has(c.pn)).length;
  const importedN = processed - updated;
  // Trace de consentement RGPD (qui, quand, combien) pour audit
  logger.info("Import clients (consentement confirmé)", {
    restoId, userId: req.user.id, consent: true, at: new Date().toISOString(),
    imported: importedN, updated, skipped,
  });
  return ok(res, { imported: importedN, updated, skipped }, "Base clients importée");
});

// ── GET /reservations/:id ─────────────────────────────────────────────────────
export const getOne = asyncHandler(async (req, res) => {
  const { rows: [resa] } = await query(
    `SELECT r.*, re.name AS resto_name, re.slug AS resto_slug, re.address, re.phone AS resto_phone,
            u.full_name AS client_name, u.phone AS client_phone,
            t.label AS table_label, t.zone AS table_zone,
            p.status AS payment_status, p.method AS payment_method, p.amount AS payment_amount
     FROM reservations r
     JOIN restaurants re ON re.id = r.restaurant_id
     JOIN users u ON u.id = r.client_id
     LEFT JOIN restaurant_tables t ON t.id = r.table_id
     LEFT JOIN payments p ON p.reservation_id = r.id
     WHERE r.id = $1`,
    [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  // Vérifier droits d'accès
  _assertAccess(req, resa);

  return ok(res, { reservation: resa });
});

// ── PATCH /reservations/:id/confirm ──────────────────────────────────────────
// Accepte un table_id optionnel dans le body pour assigner la table au moment de la confirmation
export const confirm = asyncHandler(async (req, res) => {
  const { table_id } = req.body; // optionnel

  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  await assertOwnsReservation(req, resa);
  if (resa.status !== "en_attente") throw new AppError("Seules les réservations en attente peuvent être confirmées", 400);

  // Vérifier que la table appartient bien au restaurant et est libre
  if (table_id) {
    const { rows: [tbl] } = await query(
      "SELECT id, status FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2",
      [table_id, resa.restaurant_id]
    );
    if (!tbl) throw new AppError("Table introuvable dans ce restaurant", 404);
    if (tbl.status === "occupe") throw new AppError("Cette table est déjà occupée", 409);
  }

  const updated = await withTransaction(async (client) => {
    // Si on change de table, libérer l'ancienne
    if (resa.table_id && resa.table_id !== table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'libre' WHERE id = $1",
        [resa.table_id]
      );
    }

    const { rows: [r] } = await client.query(
      `UPDATE reservations
       SET status = 'confirme', confirmed_at = NOW(), updated_at = NOW(),
           table_id = COALESCE($2, table_id)
       WHERE id = $1 RETURNING *`,
      [req.params.id, table_id || null]
    );

    // Marquer la nouvelle table comme réservée
    if (table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'reserve' WHERE id = $1",
        [table_id]
      );
    }

    return r;
  });

  await notificationQueue.add("confirmation_client", { reservationId: resa.id }).catch(() => {});

  // SSE temps réel → client
  try {
    emitToUser(resa.client_id, "reservation_confirmed", {
      ref:        resa.ref,
      reserved_at: resa.reserved_at,
    });
  } catch (_) {}

  logger.info("Réservation confirmée", { resaId: resa.id, ref: resa.ref, table_id });
  return ok(res, { reservation: updated }, "Réservation confirmée");
});

// ── PATCH /reservations/:id/assign-table ─────────────────────────────────────
// Assigner ou changer la table d'une réservation déjà confirmée
export const assignTable = asyncHandler(async (req, res) => {
  const { table_id } = req.body;
  if (!table_id) throw new AppError("table_id requis", 400);

  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  await assertOwnsReservation(req, resa);
  // On n'assigne une table qu'à une réservation active (pas annulée/no-show/terminée).
  if (!["en_attente", "confirme"].includes(resa.status)) {
    throw new AppError("Réservation inactive — table non assignable.", 400);
  }

  // Vérifier la table
  const { rows: [tbl] } = await query(
    "SELECT id, label, capacity, status FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2",
    [table_id, resa.restaurant_id]
  );
  if (!tbl) throw new AppError("Table introuvable dans ce restaurant", 404);
  if (tbl.status === "occupe") throw new AppError("Cette table est déjà occupée", 409);

  const updated = await withTransaction(async (client) => {
    // Libérer l'ancienne table
    if (resa.table_id && resa.table_id !== table_id) {
      await client.query(
        "UPDATE restaurant_tables SET status = 'libre' WHERE id = $1",
        [resa.table_id]
      );
    }

    const { rows: [r] } = await client.query(
      `UPDATE reservations SET table_id = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [table_id, req.params.id]
    );

    // Marquer la nouvelle table comme réservée
    await client.query(
      "UPDATE restaurant_tables SET status = 'reserve' WHERE id = $1",
      [table_id]
    );

    return r;
  });

  logger.info("Table assignée", { resaId: resa.id, table_id, tableLabel: tbl.label });
  return ok(res, { reservation: updated, table: tbl }, `Table ${tbl.label} assignée`);
});

// ── PATCH /reservations/:id/cancel ───────────────────────────────────────────
export const cancel = asyncHandler(async (req, res) => {
  const { cancel_reason } = req.body;
  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  _assertAccess(req, resa);

  if (["annule","termine","no_show"].includes(resa.status)) {
    throw new AppError("Cette réservation ne peut plus être annulée", 400);
  }

  // Vérifier délai d'annulation (au moins 2h avant)
  const now = new Date();
  const resaTime = new Date(resa.reserved_at);
  const hoursLeft = (resaTime - now) / 3_600_000;
  if (req.user.role === "client" && hoursLeft < 2) {
    throw new AppError("Annulation impossible moins de 2h avant la réservation", 400);
  }

  const { rows: [updated] } = await query(
    `UPDATE reservations
     SET status = 'annule', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [cancel_reason || null, req.params.id]
  );

  // Libérer la table si elle était réservée
  if (resa.table_id) {
    await query(
      "UPDATE restaurant_tables SET status = 'libre' WHERE id = $1",
      [resa.table_id]
    );
  }

  await notificationQueue.add("cancellation", { reservationId: resa.id }).catch(() => {});

  logger.info("Réservation annulée", { resaId: resa.id, ref: resa.ref });
  return ok(res, { reservation: updated }, "Réservation annulée");
});

// ── PATCH /reservations/:id/no-show ─────────────────────────────────────────
export const noShow = asyncHandler(async (req, res) => {
  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");

  if (req.user.role === "restaurateur" && req.user.restaurant_id !== resa.restaurant_id) {
    throw new AppError("Accès refusé", 403);
  }
  // Seules les réservations en attente ou confirmées peuvent devenir no-show
  // (pas une annulée / terminée / déjà no-show).
  if (!["en_attente", "confirme"].includes(resa.status)) {
    throw new AppError("Cette réservation ne peut pas être marquée no-show.", 400);
  }

  await ensureResaColumns();
  const { rows: [updated] } = await query(
    `UPDATE reservations SET status = 'no_show', is_noshow = TRUE, no_show_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [req.params.id]
  );

  if (resa.table_id) {
    // Ne libérer que si aucune autre réservation active ne détient la table
    await query(
      `UPDATE restaurant_tables SET status = 'libre' WHERE id = $1 AND NOT EXISTS (
         SELECT 1 FROM reservations WHERE table_id = $1 AND status IN ('en_attente','confirme') AND id <> $2
       )`,
      [resa.table_id, req.params.id]
    );
  }

  return ok(res, { reservation: updated }, "No-show enregistré");
});

// ── PATCH /reservations/:id — mise à jour générale (restaurateur/admin) ───────
export const update = asyncHandler(async (req, res) => {
  const { rows: [resa] } = await query(
    "SELECT * FROM reservations WHERE id = $1", [req.params.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");
  if (req.user.role === "restaurateur" && req.user.restaurant_id !== resa.restaurant_id) {
    throw new AppError("Accès refusé", 403);
  }

  // Le changement de STATUT passe par les endpoints dédiés (confirm/cancel/no-show)
  // qui gèrent les transitions + effets de bord (table, notifications). On l'exclut
  // ici pour éviter les sauts d'état arbitraires (ex. annule → confirme).
  if (req.body.party_size !== undefined) {
    const n = parseInt(req.body.party_size, 10);
    if (!Number.isFinite(n) || n <= 0) throw new AppError("Nombre de couverts invalide", 400);
    req.body.party_size = Math.min(50, n);
  }
  // Si une table est fournie, elle doit appartenir à CE restaurant
  if (req.body.table_id) {
    const { rows: [t] } = await query(
      "SELECT 1 FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2", [req.body.table_id, resa.restaurant_id]
    );
    if (!t) throw new AppError("Table introuvable dans ce restaurant", 400);
  }

  const ALLOWED = ["reserved_at","party_size","notes","special_request","table_id"];
  const updates = [];
  const values  = [];
  for (const field of ALLOWED) {
    if (req.body[field] === undefined) continue;
    values.push(req.body[field]);
    updates.push(`${field} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);

  values.push(req.params.id);
  const { rows: [updated] } = await query(
    `UPDATE reservations SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length} RETURNING *`,
    values
  );
  return ok(res, { reservation: updated }, "Réservation mise à jour");
});

// ── POST /reservations/guest — réservation sans compte ───────────────────────
export const createGuest = asyncHandler(async (req, res) => {
  await ensureResaColumns();
  const { restaurant_id, table_id, reserved_at, party_size,
          special_request, walk_in_name, walk_in_phone, walk_in_email, notes } = req.body;

  // Téléphone obligatoire pour les réservations invité
  if (!walk_in_phone?.trim()) throw new AppError("Le numéro de téléphone est requis pour une réservation sans compte", 400);

  // Interdire les réservations dans le passé
  if (new Date(reserved_at) < new Date()) {
    throw new AppError("Impossible de réserver à une date ou une heure déjà passée.", 400);
  }

  const { rows: [resto] } = await query(
    `SELECT id, name, capacity, status, auto_confirm FROM restaurants
     WHERE id = $1 AND status IN ('actif','en_attente') AND COALESCE(is_published, TRUE) = TRUE`,
    [restaurant_id]
  );
  if (!resto) throw new AppError("Restaurant introuvable ou indisponible", 404);
  if (party_size > resto.capacity)
    throw new AppError(`Ce restaurant accepte au maximum ${resto.capacity} couverts`, 400);

  // Statut selon le réglage du restaurant (auto-confirmation ou manuel)
  const guestStatus = (resto.auto_confirm !== false) ? "confirme" : "en_attente";

  // Utiliser un compte "invité" générique ou le premier admin comme placeholder
  const { rows: [guestUser] } = await query(
    "SELECT id FROM users WHERE email = 'guest@tabliereci.net' LIMIT 1"
  );

  let clientId = guestUser?.id;
  if (!clientId) {
    // Créer un utilisateur invité système si inexistant
    const bcrypt = await import("bcryptjs");
    const hash = await bcrypt.default.hash("guest_system_" + Date.now(), 8);
    const { rows: [gu] } = await query(
      `INSERT INTO users (full_name, email, phone, password_hash, role, status)
       VALUES ('Invité TablièreCI', 'guest@tabliereci.net', NULL, $1, 'client', 'actif')
       ON CONFLICT (email) DO UPDATE SET full_name = 'Invité TablièreCI'
       RETURNING id`,
      [hash]
    );
    clientId = gu.id;
  }

  // Réf atomique via la séquence dédiée (resa_ref_seq) : COUNT(*)+1 provoquait
  // des collisions UNIQUE sous concurrence (deux réservations simultanées →
  // même ref → 500). nextval est atomique et suit le même format que le trigger.
  const { rows: [{ nextref }] } = await query(
    "SELECT 'RES-' || LPAD(nextval('resa_ref_seq')::text, 4, '0') AS nextref"
  );

  const { rows: [resa] } = await query(
    `INSERT INTO reservations
       (ref, restaurant_id, client_id, table_id, reserved_at, party_size,
        special_request, status, walk_in_name, walk_in_phone)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [nextref, restaurant_id, clientId, table_id || null, reserved_at, party_size,
     special_request || null, guestStatus, walk_in_name, walk_in_phone || null]
  );

  // Marquer la table comme réservée (si une table a été assignée)
  if (table_id) {
    await query(
      "UPDATE restaurant_tables SET status = 'reserve' WHERE id = $1 AND restaurant_id = $2",
      [table_id, restaurant_id]
    ).catch(() => {});
  }

  // SSE → restaurateur
  try {
    const { rows: [owner] } = await query(
      "SELECT owner_id FROM restaurants WHERE id = $1", [restaurant_id]
    );
    if (owner?.owner_id) {
      emitToUser(owner.owner_id, "new_reservation", {
        ref: resa.ref, party_size: resa.party_size,
        reserved_at: resa.reserved_at, client_name: walk_in_name,
      });
    }
  } catch (_) {}

  // Stocker comme prospect pour le marketing
  query(
    `INSERT INTO prospects (full_name, phone, email, restaurant_id, reservation_ref, source, notes)
     VALUES ($1, $2, $3, $4, $5, 'guest_reservation', $6)
     ON CONFLICT DO NOTHING`,
    [walk_in_name, walk_in_phone, walk_in_email || null, restaurant_id, resa.ref, notes || null]
  ).catch(() => {}); // asynchrone, ne pas bloquer

  logger.info("Réservation invité créée + prospect enregistré", { ref: resa.ref, walk_in_name, walk_in_phone });
  return created(res, { reservation: resa }, "Réservation créée avec succès");
});

// ── Helper ─────────────────────────────────────────────────────────────────────
function _assertAccess(req, resa) {
  if (req.user.role === "admin") return;
  if (req.user.role === "restaurateur" && req.user.restaurant_id === resa.restaurant_id) return;
  if (req.user.id === resa.client_id) return;
  throw new AppError("Accès refusé", 403);
}

/**
 * Vérification d'accès ROBUSTE via owner_id (async).
 * Fiable même si req.user.restaurant_id est NULL ou périmé en cache Redis.
 * Utilisée pour les actions restaurateur sur les réservations.
 */
async function assertOwnsReservation(req, resa) {
  if (req.user.role === "admin") return;
  if (req.user.id === resa.client_id) return;
  if (req.user.role === "restaurateur") {
    if (req.user.restaurant_id && req.user.restaurant_id === resa.restaurant_id) return;
    // Fallback fiable : le resto de la résa appartient-il au user ?
    const { rows: [own] } = await query(
      "SELECT 1 FROM restaurants WHERE id = $1 AND owner_id = $2",
      [resa.restaurant_id, req.user.id]
    );
    if (own) return;
  }
  throw new AppError("Accès refusé", 403);
}

// ── Liste d'attente (waitlist) — restaurateur ────────────────────────────────
// Résout de façon fiable le restaurant du restaurateur connecté.
async function resolveRestoId(req) {
  if (req.user.role === "admin" && req.query.restaurant_id) return req.query.restaurant_id;
  if (req.user.restaurant_id) return req.user.restaurant_id;
  const { rows: [r] } = await query(
    "SELECT id FROM restaurants WHERE owner_id = $1 LIMIT 1", [req.user.id]
  );
  return r?.id || null;
}

const WAITLIST_STATUSES = ["waiting", "notified", "seated", "cancelled"];

// GET /reservations/waitlist
export const listWaitlist = asyncHandler(async (req, res) => {
  const restoId = await resolveRestoId(req);
  if (!restoId) return ok(res, { waitlist: [] });
  const { rows } = await query(
    `SELECT id, client_name, client_phone, party_size, preferred_at,
            status, notified_at, created_at
     FROM waitlist WHERE restaurant_id = $1
     ORDER BY created_at DESC LIMIT 200`,
    [restoId]
  );
  return ok(res, { waitlist: rows });
});

// POST /reservations/waitlist
export const addWaitlist = asyncHandler(async (req, res) => {
  const restoId = await resolveRestoId(req);
  if (!restoId) throw new AppError("Aucun restaurant associé à ce compte", 400);
  const { client_name, client_phone, party_size, preferred_at } = req.body;
  if (!client_name?.trim()) throw new AppError("Nom du client requis", 400);
  const size = Math.max(1, parseInt(party_size, 10) || 2);
  const { rows: [entry] } = await query(
    `INSERT INTO waitlist (restaurant_id, client_name, client_phone, party_size, preferred_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [restoId, client_name.trim(), client_phone || null, size, preferred_at || null]
  );
  return created(res, { entry }, "Ajouté à la liste d'attente");
});

// PATCH /reservations/waitlist/:id
export const updateWaitlist = asyncHandler(async (req, res) => {
  const restoId = await resolveRestoId(req);
  if (!restoId) throw new AppError("Aucun restaurant associé à ce compte", 400);
  const { status } = req.body;
  if (!WAITLIST_STATUSES.includes(status)) throw new AppError("Statut invalide", 400);
  const notifiedAt = status === "notified" ? "NOW()" : "notified_at";
  const { rows: [entry] } = await query(
    `UPDATE waitlist SET status = $1, notified_at = ${notifiedAt}
     WHERE id = $2 AND restaurant_id = $3 RETURNING *`,
    [status, req.params.id, restoId]
  );
  if (!entry) return notFound(res, "Entrée introuvable");
  return ok(res, { entry }, "Liste d'attente mise à jour");
});

// DELETE /reservations/waitlist/:id
export const deleteWaitlist = asyncHandler(async (req, res) => {
  const restoId = await resolveRestoId(req);
  if (!restoId) throw new AppError("Aucun restaurant associé à ce compte", 400);
  const { rows: [entry] } = await query(
    "DELETE FROM waitlist WHERE id = $1 AND restaurant_id = $2 RETURNING id",
    [req.params.id, restoId]
  );
  if (!entry) return notFound(res, "Entrée introuvable");
  return ok(res, null, "Retiré de la liste d'attente");
});
