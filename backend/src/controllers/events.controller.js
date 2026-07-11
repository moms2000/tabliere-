/**
 * Events Controller — Espace Événements (organisateurs).
 * Un organisateur (role='organisateur') peut créer plusieurs événements.
 * Chaque événement a un plan de salle (tables simples + packs VIP) réservable.
 * Cash sur place — aucun paiement in-app. Statuts en VARCHAR (pas d'ENUM).
 */
import { query } from "../config/db.js";
import { ok, created, notFound, paginated } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";

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
  const slug = await uniqueSlug(b.name);
  const { rows: [event] } = await query(
    `INSERT INTO events
       (owner_id, name, slug, description, venue_name, address, ville, quartier,
        starts_at, ends_at, cover_url, theme_color, is_public, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'brouillon')
     RETURNING *`,
    [
      req.user.id, b.name, slug, b.description || null, b.venue_name || null,
      b.address || null, b.ville || null, b.quartier || null,
      b.starts_at, b.ends_at || null, b.cover_url || null,
      b.theme_color || "#E8A045", b.is_public !== false,
    ]
  );
  return created(res, { event }, "Événement créé");
});

// ── GET /events — liste publique des événements publiés ──────────────────────
export const listPublic = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, ville } = req.query;
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
    `SELECT id, label, kind, capacity, price, description, zone, pos_x, pos_y, status
     FROM event_tables
     WHERE event_id = $1 AND is_active = TRUE
     ORDER BY kind DESC, label ASC`, [event.id]
  );
  return ok(res, { event, tables });
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
  ];
  const updates = [], values = [];
  for (const f of ALLOWED) {
    if (req.body[f] === undefined) continue;
    let val = req.body[f];
    if (f === "is_public") val = (val === true || val === "true" || val === 1);
    if (f === "status" && !EVENT_STATUSES.includes(val)) throw new AppError("Statut invalide", 400);
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
  const { rows: [table] } = await query(
    `INSERT INTO event_tables (event_id, label, kind, capacity, price, description, zone, pos_x, pos_y)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      event.id, b.label, kind, b.capacity || 2, b.price || 0,
      b.description || null, b.zone || "general", b.pos_x ?? 20, b.pos_y ?? 20,
    ]
  );
  return created(res, { table }, "Table ajoutée");
});

// ── PATCH /events/:id/tables/:tableId — modifier (propriétaire) ──────────────
export const updateTable = asyncHandler(async (req, res) => {
  const event = await eventById(req.params.id);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);

  const ALLOWED = ["label", "kind", "capacity", "price", "description", "zone", "pos_x", "pos_y", "status", "is_active"];
  const updates = [], values = [];
  for (const f of ALLOWED) {
    if (req.body[f] === undefined) continue;
    let val = req.body[f];
    if (f === "kind" && !TABLE_KINDS.includes(val)) throw new AppError("Type de table invalide", 400);
    if (f === "is_active") val = (val === true || val === "true" || val === 1);
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
  await query(
    "UPDATE event_tables SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND event_id = $2",
    [req.params.tableId, event.id]
  );
  return ok(res, {}, "Table retirée");
});
