/**
 * Events Controller — Espace Événements (organisateurs).
 * Un organisateur (role='organisateur') peut créer plusieurs événements.
 * Chaque événement a un plan de salle (tables simples + packs VIP) réservable.
 * Cash sur place — aucun paiement in-app. Statuts en VARCHAR (pas d'ENUM).
 */
import crypto from "crypto";
import { query } from "../config/db.js";
import { ok, created, notFound, paginated, forbidden } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { signStaffToken } from "../middleware/eventAuth.js";

const EVENT_STATUSES = ["brouillon", "publie", "annule", "termine"];
const TABLE_KINDS    = ["simple", "vip"];

// ── Helpers ──────────────────────────────────────────────────────────────────
const slugify = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

async function uniqueSlug(base) {
  let root = slugify(base) || "evenement";
  let slug = root, i = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await query("SELECT 1 FROM events WHERE slug = $1", [slug]);
    if (!rows.length) return slug;
    slug = `${root}-${++i}`;
  }
}

async function eventById(id) {
  const { rows } = await query("SELECT * FROM events WHERE id = $1", [id]);
  return rows[0] || null;
}

function assertOwner(req, event) {
  if (req.user.role === "admin") return;
  if (event && event.owner_id === req.user.id) return;
  throw new AppError("Accès refusé", 403);
}

// ── POST /events — créer un événement (organisateur) ─────────────────────────
export const createEvent = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.name || !b.starts_at) throw new AppError("Nom et date de début requis", 400);
  // Validation des dates : début valide, fin après le début
  const starts = new Date(b.starts_at);
  if (isNaN(starts.getTime())) throw new AppError("Date de début invalide", 400);
  let ends = null;
  if (b.ends_at) {
    ends = new Date(b.ends_at);
    if (isNaN(ends.getTime())) throw new AppError("Date de fin invalide", 400);
    if (ends <= starts) throw new AppError("La date de fin doit être après le début", 400);
  }
  const cap = (v, n) => v ? String(v).slice(0, n) : null;
  const slug = await uniqueSlug(b.name);
  const { rows: [event] } = await query(
    `INSERT INTO events
       (owner_id, name, slug, description, venue_name, address, ville, quartier,
        starts_at, ends_at, cover_url, theme_color, is_public, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'brouillon')
     RETURNING *`,
    [
      req.user.id, cap(b.name, 160), slug, cap(b.description, 4000), cap(b.venue_name, 160),
      cap(b.address, 240), cap(b.ville, 80), cap(b.quartier, 80),
      starts.toISOString(), ends ? ends.toISOString() : null, b.cover_url || null,
      cap(b.theme_color, 20) || "#E8A045", b.is_public !== false,
    ]
  );
  return created(res, { event }, "Événement créé");
});

// ── GET /events — liste publique des événements publiés ──────────────────────
export const listPublic = asyncHandler(async (req, res) => {
  const { ville } = req.query;
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  const params = [];
  const conds = ["e.status = 'publie'", "e.is_public = TRUE"];
  // À venir ou en cours (on masque les événements terminés depuis > 12h)
  conds.push("(e.ends_at IS NULL OR e.ends_at >= NOW() - interval '12 hours') AND e.starts_at >= NOW() - interval '12 hours'");
  if (ville) { params.push(ville); conds.push(`e.ville = $${params.length}`); }
  const where = `WHERE ${conds.join(" AND ")}`;

  const { rows } = await query(
    `SELECT e.id, e.name, e.slug, e.description, e.venue_name, e.ville, e.quartier,
            e.starts_at, e.ends_at, e.cover_url, e.theme_color
     FROM events e ${where}
     ORDER BY e.starts_at ASC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  const { rows: [{ count }] } = await query(`SELECT COUNT(*) FROM events e ${where}`, params);
  return paginated(res, rows, +count, +page, +limit);
});

// ── GET /events/:slug — détail public + plan (tables réservables) ────────────
export const getBySlug = asyncHandler(async (req, res) => {
  const { rows: [event] } = await query(
    `SELECT e.*, u.full_name AS organizer_name
     FROM events e JOIN users u ON u.id = e.owner_id
     WHERE e.slug = $1`, [req.params.slug]
  );
  if (!event) return notFound(res, "Événement introuvable");
  // Non publié : visible seulement par le propriétaire / admin
  const isOwner = req.user && (req.user.role === "admin" || req.user.id === event.owner_id);
  if (event.status !== "publie" && !isOwner) return notFound(res, "Événement introuvable");

  const { rows: tables } = await query(
    `SELECT id, label, kind, capacity, price, description, zone, pos_x, pos_y, status, min_order
     FROM event_tables
     WHERE event_id = $1 AND is_active = TRUE
     ORDER BY kind DESC, label ASC`, [event.id]
  );
  // Endpoint PUBLIC : on retire l'UUID interne du propriétaire ET la config de
  // paiement (numéros mobile money, titulaires, message d'acompte) — ces données
  // sont transmises en privé au client par email/WhatsApp APRÈS réservation,
  // jamais exposées à un visiteur anonyme (anti-scraping / arnaque au numéro).
  const { owner_id, payment_methods, deposit_message, deposit_percent, ...publicEvent } = event;
  return ok(res, { event: publicEvent, tables });
});

// ── GET /events/mine — événements de l'organisateur connecté ─────────────────
export const listMine = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT e.*,
            (SELECT COUNT(*) FROM event_tables t WHERE t.event_id = e.id AND t.is_active) AS tables_count,
            (SELECT COUNT(*) FROM event_reservations r WHERE r.event_id = e.id AND r.status <> 'annule') AS resa_count
     FROM events e
     WHERE e.owner_id = $1
     ORDER BY e.starts_at DESC`, [req.user.id]
  );
  return ok(res, { events: rows });
});

// ── GET /events/:id/manage — détail complet pour édition (propriétaire) ──────
export const getManage = asyncHandler(async (req, res) => {
  const event = await eventById(req.params.id);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);
  const { rows: tables } = await query(
    `SELECT * FROM event_tables WHERE event_id = $1 AND is_active = TRUE ORDER BY label ASC`,
    [event.id]
  );
  return ok(res, { event, tables });
});

// ── PATCH /events/:id — mise à jour (propriétaire) ───────────────────────────
export const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventById(req.params.id);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);

  const ALLOWED = [
    "name", "description", "venue_name", "address", "ville", "quartier",
    "starts_at", "ends_at", "cover_url", "theme_color", "is_public", "status",
    "bottles_enabled", "ordering_mode", "capacity", "entry_price", "photos",
    // Phase 5 : config paiement / acomptes
    "payment_methods", "deposit_percent", "deposit_message",
  ];
  const updates = [], values = [];
  for (const f of ALLOWED) {
    if (req.body[f] === undefined) continue;
    let val = req.body[f];
    if (f === "is_public" || f === "bottles_enabled") val = (val === true || val === "true" || val === 1);
    if (f === "ordering_mode" && !["per_order", "tab"].includes(val)) throw new AppError("Mode de commande invalide", 400);
    if (f === "status" && !EVENT_STATUSES.includes(val)) throw new AppError("Statut invalide", 400);
    if (f === "capacity") val = (val === null || val === "" ) ? null : (parseInt(val, 10) || null);
    if (f === "entry_price") val = Math.max(0, parseInt(val, 10) || 0);
    if (f === "deposit_percent") val = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
    if (f === "payment_methods") {
      // Liste [{operator, number, holder}] — nettoyée et bornée
      const arr = Array.isArray(val) ? val : [];
      val = JSON.stringify(arr.slice(0, 6).map(m => ({
        operator: String(m.operator || "").slice(0, 20),
        number: String(m.number || "").slice(0, 30),
        holder: String(m.holder || "").slice(0, 60),
      })).filter(m => m.operator && m.number));
    }
    if (f === "photos") val = JSON.stringify(Array.isArray(val) ? val.slice(0, 5) : []);
    // Dates : une chaîne vide n'est pas un TIMESTAMPTZ valide → NULL (ou on ignore
    // starts_at qui est obligatoire, pour ne pas le vider par erreur).
    if (f === "starts_at" || f === "ends_at") {
      if (val === "" || val === null) {
        if (f === "starts_at") continue; // requis : ne jamais écraser avec vide
        val = null;
      }
    }
    values.push(val);
    updates.push(`${f} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);
  values.push(event.id);
  const { rows: [updated] } = await query(
    `UPDATE events SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values
  );
  return ok(res, { event: updated }, "Événement mis à jour");
});

// ── POST /events/:id/tables — ajouter table simple / pack VIP (propriétaire) ─
export const createTable = asyncHandler(async (req, res) => {
  const event = await eventById(req.params.id);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);

  const b = req.body || {};
  if (!b.label) throw new AppError("Libellé requis", 400);
  const kind = TABLE_KINDS.includes(b.kind) ? b.kind : "simple";
  const nn = (v, d = 0) => Math.max(0, parseInt(v, 10) || d); // entier >= 0
  const { rows: [table] } = await query(
    `INSERT INTO event_tables (event_id, label, kind, capacity, price, description, zone, pos_x, pos_y, min_order, deposit_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      event.id, String(b.label).slice(0, 40), kind, Math.max(1, nn(b.capacity, 2)), nn(b.price),
      b.description || null, b.zone || "general", b.pos_x ?? 20, b.pos_y ?? 20, nn(b.min_order), nn(b.deposit_amount),
    ]
  );
  return created(res, { table }, "Table ajoutée");
});

// ── PATCH /events/:id/tables/:tableId — modifier (propriétaire) ──────────────
export const updateTable = asyncHandler(async (req, res) => {
  const event = await eventById(req.params.id);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);

  // Assignation d'un serveur : on vérifie qu'il appartient bien à CET événement.
  // "none"/"" = désassignation (retirer le serveur) → pas de vérification UUID.
  if (req.body.server_id && req.body.server_id !== "none" && req.body.server_id !== "") {
    const { rows } = await query(
      "SELECT 1 FROM event_staff WHERE id = $1 AND event_id = $2 AND is_active = TRUE", [req.body.server_id, event.id]
    );
    if (!rows.length) throw new AppError("Serveur introuvable pour cet événement", 400);
  }

  const ALLOWED = ["label", "kind", "capacity", "price", "description", "zone", "pos_x", "pos_y", "status", "is_active", "min_order", "server_id", "deposit_amount"];
  const updates = [], values = [];
  for (const f of ALLOWED) {
    if (req.body[f] === undefined) continue;
    let val = req.body[f];
    if (f === "kind" && !TABLE_KINDS.includes(val)) throw new AppError("Type de table invalide", 400);
    if (f === "is_active") val = (val === true || val === "true" || val === 1);
    if (f === "price" || f === "min_order" || f === "deposit_amount") val = Math.max(0, parseInt(val, 10) || 0);
    if (f === "capacity") val = Math.max(1, parseInt(val, 10) || 1);
    if (f === "server_id" && (val === "" || val === "none")) val = null;
    values.push(val);
    updates.push(`${f} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ à mettre à jour", 400);
  values.push(req.params.tableId, event.id);
  const { rows: [table] } = await query(
    `UPDATE event_tables SET ${updates.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length - 1} AND event_id = $${values.length} RETURNING *`,
    values
  );
  if (!table) return notFound(res, "Table introuvable");
  return ok(res, { table }, "Table mise à jour");
});

// ── DELETE /events/:id/tables/:tableId — retirer (soft) (propriétaire) ───────
export const deleteTable = asyncHandler(async (req, res) => {
  const event = await eventById(req.params.id);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);
  // Refuser si la table est référencée par une réservation active — requête
  // scellée à l'événement (event_id) pour ne pas sonder les tables d'un autre événement.
  const { rows: [busy] } = await query(
    "SELECT 1 FROM event_reservations WHERE table_id = $1 AND event_id = $2 AND status IN ('en_attente','confirme') LIMIT 1",
    [req.params.tableId, event.id]
  );
  if (busy) throw new AppError("Table réservée : annulez d'abord les réservations liées.", 409);
  const { rowCount } = await query(
    "UPDATE event_tables SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND event_id = $2",
    [req.params.tableId, event.id]
  );
  if (!rowCount) return notFound(res, "Table introuvable");
  return ok(res, {}, "Table retirée");
});

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 2 — Bouteilles (QR), Staff, Promoteurs, Dashboard
// ═══════════════════════════════════════════════════════════════════════════

async function ownedEvent(req) {
  const event = await eventById(req.params.id);
  if (!event) return { error: "notfound" };
  if (req.user.role !== "admin" && event.owner_id !== req.user.id) return { error: "forbidden" };
  return { event };
}

// ── Bouteilles ───────────────────────────────────────────────────────────────
export const listBottles = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error === "notfound") return notFound(res, "Événement introuvable");
  if (error === "forbidden") return forbidden(res, "Accès refusé");
  const { rows } = await query(
    "SELECT * FROM event_bottles WHERE event_id = $1 AND is_active = TRUE ORDER BY category, position, name",
    [event.id]
  );
  return ok(res, { bottles: rows });
});

export const listBottlesPublic = asyncHandler(async (req, res) => {
  const { rows: [event] } = await query(
    "SELECT id, name, slug, status, bottles_enabled, ordering_mode FROM events WHERE slug = $1", [req.params.slug]
  );
  if (!event || event.status !== "publie" || !event.bottles_enabled) return notFound(res, "Carte indisponible");
  const { rows } = await query(
    "SELECT id, name, category, price, description FROM event_bottles WHERE event_id = $1 AND is_active = TRUE ORDER BY category, position, name",
    [event.id]
  );
  return ok(res, { event: { name: event.name, slug: event.slug, ordering_mode: event.ordering_mode }, bottles: rows });
});

// Aligne la casse d'une catégorie sur celle DÉJÀ utilisée dans l'événement pour
// éviter les doublons (« softs » et « Softs » deviennent une seule catégorie).
async function canonicalCategory(eventId, raw) {
  const cat = (String(raw || "").trim() || "Bouteilles").slice(0, 60);
  const { rows } = await query(
    "SELECT category FROM event_bottles WHERE event_id = $1 AND LOWER(category) = LOWER($2) LIMIT 1",
    [eventId, cat]
  );
  return rows[0]?.category || cat;
}

export const createBottle = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  const b = req.body || {};
  if (!b.name) throw new AppError("Nom requis", 400);
  const category = await canonicalCategory(event.id, b.category);
  const { rows: [bottle] } = await query(
    `INSERT INTO event_bottles (event_id, name, category, price, description, position)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [event.id, String(b.name).slice(0, 80), category, Math.max(0, parseInt(b.price, 10) || 0), b.description || null, Math.max(0, parseInt(b.position, 10) || 0)]
  );
  return created(res, { bottle }, "Bouteille ajoutée");
});

export const updateBottle = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  // Aligne la casse de la catégorie sur l'existant (anti-doublon)
  if (req.body.category !== undefined) req.body.category = await canonicalCategory(event.id, req.body.category);
  const ALLOWED = ["name", "category", "price", "description", "is_active", "position"];
  const updates = [], values = [];
  for (const f of ALLOWED) {
    if (req.body[f] === undefined) continue;
    let val = req.body[f];
    if (f === "is_active") val = (val === true || val === "true" || val === 1);
    if (f === "price" || f === "position") val = Math.max(0, parseInt(val, 10) || 0);
    values.push(val); updates.push(`${f} = $${values.length}`);
  }
  if (!updates.length) throw new AppError("Aucun champ", 400);
  values.push(req.params.bottleId, event.id);
  const { rows: [bottle] } = await query(
    `UPDATE event_bottles SET ${updates.join(", ")} WHERE id = $${values.length - 1} AND event_id = $${values.length} RETURNING *`,
    values
  );
  if (!bottle) return notFound(res, "Bouteille introuvable");
  return ok(res, { bottle }, "Bouteille mise à jour");
});

export const deleteBottle = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  await query("UPDATE event_bottles SET is_active = FALSE WHERE id = $1 AND event_id = $2", [req.params.bottleId, event.id]);
  return ok(res, {}, "Bouteille retirée");
});

// ── Staff (comptes temporaires par PIN) ───────────────────────────────────────
const genPin = () => String(crypto.randomInt(100000, 1000000)); // 6 chiffres aléatoires (crypto)

export const listStaff = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  const { rows } = await query(
    "SELECT id, name, role, pin, is_active, created_at FROM event_staff WHERE event_id = $1 ORDER BY created_at DESC",
    [event.id]
  );
  return ok(res, { staff: rows });
});

export const createStaff = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  const b = req.body || {};
  if (!b.name) throw new AppError("Nom requis", 400);
  const role = ["all", "checkin", "bar", "serveur", "caisse"].includes(b.role) ? b.role : "all";
  // PIN aléatoire (crypto), unique dans l'événement
  let pin = b.pin && /^\d{6}$/.test(b.pin) ? b.pin : genPin();
  for (let k = 0; k < 20; k++) {
    const { rows } = await query("SELECT 1 FROM event_staff WHERE event_id = $1 AND pin = $2", [event.id, pin]);
    if (!rows.length) break;
    pin = genPin();
  }
  const { rows: [staff] } = await query(
    `INSERT INTO event_staff (event_id, name, role, pin) VALUES ($1,$2,$3,$4) RETURNING id, name, role, pin, is_active, created_at`,
    [event.id, b.name, role, pin]
  );
  return created(res, { staff }, "Staff ajouté");
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  await query("DELETE FROM event_staff WHERE id = $1 AND event_id = $2", [req.params.staffId, event.id]);
  return ok(res, {}, "Staff retiré");
});

// POST /event-staff/login — connexion staff via slug + PIN (public)
export const staffLogin = asyncHandler(async (req, res) => {
  const { slug, pin } = req.body || {};
  if (!slug || !pin) throw new AppError("Événement et PIN requis", 400);
  const { rows: [event] } = await query("SELECT id, name, slug, status FROM events WHERE slug = $1", [slug]);
  if (!event) return notFound(res, "Événement introuvable");
  if (event.status !== "publie") throw new AppError("Cet événement n'est pas actif", 403);
  const { rows: [staff] } = await query(
    "SELECT id, name, role, event_id FROM event_staff WHERE event_id = $1 AND pin = $2 AND is_active = TRUE",
    [event.id, String(pin)]
  );
  if (!staff) throw new AppError("PIN invalide", 401);
  const token = signStaffToken(staff);
  return ok(res, { token, staff: { name: staff.name, role: staff.role }, event: { id: event.id, name: event.name, slug: event.slug } }, "Connecté");
});

// ── Promoteurs ────────────────────────────────────────────────────────────────
export const listPromoters = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  const { rows } = await query(
    `SELECT p.*,
        (SELECT COUNT(*) FROM event_reservations r WHERE r.event_id = p.event_id AND UPPER(r.promoter_code) = UPPER(p.code) AND r.status <> 'annule')::int AS reservations,
        (SELECT COALESCE(SUM(r.party_size),0) FROM event_reservations r WHERE r.event_id = p.event_id AND UPPER(r.promoter_code) = UPPER(p.code) AND r.status <> 'annule')::int AS covers
     FROM event_promoters p WHERE p.event_id = $1 ORDER BY reservations DESC, p.created_at DESC`,
    [event.id]
  );
  return ok(res, { promoters: rows });
});

export const createPromoter = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  const b = req.body || {};
  if (!b.name) throw new AppError("Nom requis", 400);
  const code = (b.code || b.name).trim().toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 20) || "PROMO";
  try {
    const { rows: [promoter] } = await query(
      `INSERT INTO event_promoters (event_id, name, code) VALUES ($1,$2,$3) RETURNING *`,
      [event.id, b.name, code]
    );
    return created(res, { promoter }, "Promoteur ajouté");
  } catch (e) {
    if (e.code === "23505") throw new AppError("Ce code promoteur existe déjà", 409);
    throw e;
  }
});

export const deletePromoter = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  await query("DELETE FROM event_promoters WHERE id = $1 AND event_id = $2", [req.params.promoterId, event.id]);
  return ok(res, {}, "Promoteur retiré");
});

// ── Dashboard organisateur ─────────────────────────────────────────────────────
export const getDashboard = asyncHandler(async (req, res) => {
  const { event, error } = await ownedEvent(req);
  if (error) return error === "notfound" ? notFound(res, "Événement introuvable") : forbidden(res, "Accès refusé");
  const id = event.id;
  const [{ rows: [resa] }, { rows: [vip] }, { rows: [orders] }, { rows: topBottles }, { rows: promoters }, { rows: servers }] = await Promise.all([
    query(`SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status='confirme')::int AS confirmed,
              COUNT(*) FILTER (WHERE checked_in_at IS NOT NULL)::int AS checked_in,
              COALESCE(SUM(party_size),0)::int AS covers,
              COALESCE(SUM(COALESCE(arrived_size, party_size)) FILTER (WHERE checked_in_at IS NOT NULL AND status='confirme'),0)::int AS arrived_covers
           FROM event_reservations WHERE event_id = $1 AND status <> 'annule'`, [id]),
    query(`SELECT COALESCE(SUM(t.price),0)::int AS vip_revenue, COUNT(*)::int AS vip_sold
           FROM event_reservations r JOIN event_tables t ON t.id = r.table_id
           WHERE r.event_id = $1 AND r.status = 'confirme' AND t.kind = 'vip'`, [id]),
    query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(total),0)::int AS total,
              COALESCE(SUM(total) FILTER (WHERE status='paye'),0)::int AS paid,
              COALESCE(SUM(total) FILTER (WHERE status IN ('en_attente','servi')),0)::int AS pending,
              COUNT(*) FILTER (WHERE status='en_attente')::int AS n_pending,
              COUNT(*) FILTER (WHERE status='servi')::int AS n_served,
              COUNT(*) FILTER (WHERE status='paye')::int AS n_paid
           FROM event_orders WHERE event_id = $1 AND status <> 'annule'`, [id]),
    query(`SELECT item->>'name' AS name, SUM(COALESCE(NULLIF(item->>'qty','')::int,1))::int AS qty
           FROM event_orders o, jsonb_array_elements(o.items) AS item
           WHERE o.event_id = $1 AND o.status <> 'annule' AND item->>'name' IS NOT NULL
           GROUP BY item->>'name' ORDER BY qty DESC LIMIT 10`, [id]).catch(() => ({ rows: [] })),
    query(`SELECT p.name, p.code,
              (SELECT COUNT(*) FROM event_reservations r WHERE r.event_id = p.event_id AND UPPER(r.promoter_code)=UPPER(p.code) AND r.status<>'annule')::int AS reservations
           FROM event_promoters p WHERE p.event_id = $1 ORDER BY reservations DESC`, [id]),
    // Performance par serveur (Phase 3/4)
    query(`SELECT s.id, s.name,
              COUNT(o.id)::int AS orders_count,
              COALESCE(SUM(o.total),0)::int AS revenue,
              COALESCE(SUM(o.total) FILTER (WHERE o.status='paye'),0)::int AS cashed,
              COUNT(DISTINCT t.id)::int AS tables_count
           FROM event_staff s
           JOIN event_tables t ON t.server_id = s.id AND t.event_id = $1
           LEFT JOIN event_orders o ON o.table_id = t.id AND o.status <> 'annule'
           WHERE s.event_id = $1 AND s.role IN ('serveur','all')
           GROUP BY s.id, s.name ORDER BY revenue DESC`, [id]).catch(() => ({ rows: [] })),
  ]);

  // ── Réconciliation caisse ────────────────────────────────────────────────
  const capacity = event.capacity ?? null;
  const entryPrice = event.entry_price || 0;
  const arrived = resa.arrived_covers || 0;
  // Entrées gratuites consommées vs entrées payantes (surplus au-delà de la jauge)
  const freeUsed = capacity != null ? Math.min(arrived, capacity) : arrived;
  const paidEntries = capacity != null ? Math.max(0, arrived - capacity) : 0;
  const entryCashDue = paidEntries * entryPrice;
  const cash = {
    capacity,
    entry_price: entryPrice,
    arrived_covers: arrived,
    free_used: freeUsed,
    free_remaining: capacity != null ? Math.max(0, capacity - arrived) : null,
    paid_entries: paidEntries,      // nb de personnes payantes (espèces à l'entrée)
    entry_cash_due: entryCashDue,   // espèces attendues à la caisse d'entrée
    bar_cashed: orders.paid || 0,   // bouteilles déjà encaissées
    bar_pending: orders.pending || 0, // bouteilles servies/en attente, pas encore payées
    vip_revenue: vip.vip_revenue || 0,
    // Total espèces attendu = entrées payantes + bar encaissé (le VIP est souvent prépayé)
    total_expected: entryCashDue + (orders.paid || 0),
  };

  return ok(res, {
    event: { id: event.id, name: event.name, slug: event.slug, starts_at: event.starts_at, capacity, entry_price: entryPrice },
    reservations: resa, vip, orders, top_bottles: topBottles, promoters, servers, cash,
  });
});
