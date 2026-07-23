/**
 * Opérations Événement — commandes de bouteilles (scan QR par les invités) et
 * check-in à l'entrée. Accès organisateur propriétaire OU staff (via ownerOrStaff),
 * sauf la création de commande qui est publique (invité qui scanne une table).
 */
import crypto from "crypto";
import { query } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { signOrderToken, verifyOrderToken } from "../middleware/eventAuth.js";

// Code à 4 chiffres UNIQUE pour l'événement (anti-collision : deux salons ne
// doivent jamais partager le même code → sinon commande imputée au mauvais salon).
async function genUniqueOrderPin(eventId) {
  for (let i = 0; i < 60; i++) {
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    const { rows } = await query(
      "SELECT 1 FROM event_reservations WHERE event_id = $1 AND order_pin = $2 LIMIT 1", [eventId, pin]
    );
    if (!rows.length) return pin;
  }
  throw new AppError("Impossible de générer un code unique (trop de salons). Contactez le support.", 500);
}

const ORDER_STATUSES = ["en_attente", "servi", "paye", "annule"];

// Recalcule le panier avec les prix SERVEUR (jamais confiance au client).
// Retourne { items, total }. Lève si panier vide.
async function priceItems(eventId, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new AppError("Panier vide", 400);
  if (rawItems.length > 100) throw new AppError("Trop d'articles", 400);
  const ids = [...new Set(rawItems.map(it => it.id).filter(Boolean))];
  const { rows: bRows } = ids.length
    ? await query("SELECT id, name, price FROM event_bottles WHERE event_id = $1 AND id = ANY($2) AND is_active = TRUE", [eventId, ids])
    : { rows: [] };
  const bMap = new Map(bRows.map(x => [String(x.id), x]));
  const items = rawItems.map(it => {
    const m = bMap.get(String(it.id));
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    return m
      ? { id: m.id, name: m.name, price: Number(m.price) || 0, qty }
      : { name: String(it.name || "Article").slice(0, 120), price: 0, qty };
  });
  const total = items.reduce((s, it) => s + it.price * it.qty, 0);
  return { items, total };
}

// Le propriétaire (req.user, pas de req.staff) a tous les droits.
// Un staff est limité à son rôle : 'all' partout, 'bar' = commandes, 'checkin' = entrées.
function assertStaffRole(req, allowed) {
  if (!req.staff) return; // organisateur / admin
  if (req.staff.role === "all" || allowed.includes(req.staff.role)) return;
  throw new AppError("Action non autorisée pour ce rôle staff", 403);
}

// Certaines opérations (check-in, changement de statut de commande) ne doivent
// pas être possibles sur un événement annulé ou terminé.
async function assertEventActive(eventId) {
  const { rows: [e] } = await query("SELECT status FROM events WHERE id = $1", [eventId]);
  if (!e) throw new AppError("Événement introuvable", 404);
  if (e.status !== "publie") throw new AppError("Événement inactif (annulé ou terminé).", 409);
}

// Garde-fou absolu contre une saisie aberrante d'arrivées (ex. « 500 » par erreur)
const ABS_MAX_ARRIVED = 500;

// ── POST /event-orders — commande d'un invité (public, scan QR) ────────────────
export const createOrder = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.slug && !b.event_id) throw new AppError("Événement requis", 400);
  const { rows: [event] } = await query(
    `SELECT id, status, bottles_enabled,
            NOW() > COALESCE(ends_at + interval '6 hours', starts_at + interval '12 hours') AS order_closed
     FROM events WHERE ${b.slug ? "slug = $1" : "id = $1"}`,
    [b.slug || b.event_id]
  );
  if (!event) return notFound(res, "Événement introuvable");
  if (event.status !== "publie" || !event.bottles_enabled) throw new AppError("Les commandes ne sont pas ouvertes", 400);
  if (event.order_closed) throw new AppError("Événement terminé — les commandes sont clôturées.", 410);

  const { items, total } = await priceItems(event.id, b.items);

  let tableLabel = null, tableId = null, guestName = b.guest_name || null;

  // Rattachement à un salon UNIQUEMENT via le jeton responsable (émis après
  // vérification du code à l'entrée). On n'accepte plus un table_id arbitraire
  // du client → un invité ne peut pas imputer une commande à un salon tiers.
  if (b.order_token) {
    const d = verifyOrderToken(b.order_token);
    if (!d || d.event_id !== event.id) throw new AppError("Session responsable expirée. Ressaisissez le code.", 401);
    tableId = d.table_id || null; tableLabel = d.table_label || null; guestName = guestName || d.guest_name || null;
    // Anti-jeton périmé : la table doit TOUJOURS être occupée par une réservation
    // confirmée et pointée à l'entrée. Sinon (résa annulée, table libérée, table
    // désactivée), le jeton — valide 10 h — ne doit plus permettre de commander.
    if (tableId) {
      const { rows: live } = await query(
        `SELECT 1 FROM event_reservations
         WHERE event_id = $1 AND table_id = $2 AND status = 'confirme' AND checked_in_at IS NOT NULL LIMIT 1`,
        [event.id, tableId]
      );
      if (!live.length) throw new AppError("Session responsable expirée (salon parti ou réservation annulée). Ressaisissez le code.", 401);
    }
  }

  const { rows: [order] } = await query(
    `INSERT INTO event_orders (ref, event_id, table_id, table_label, guest_name, items, total, note)
     VALUES ('EVO-' || LPAD(nextval('event_order_ref_seq')::text, 4, '0'), $1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [event.id, tableId, tableLabel, guestName, JSON.stringify(items), total, b.note || null]
  );
  return created(res, { order }, "Commande envoyée");
});

// ── POST /event-orders/verify-pin — le responsable déverrouille la commande ───
export const verifyOrderPin = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const pin = String(b.pin || "").trim();
  if (!/^\d{4}$/.test(pin)) throw new AppError("Code à 4 chiffres requis", 400);
  if (!b.slug && !b.event_id) throw new AppError("Événement requis", 400);
  const { rows: [event] } = await query(
    `SELECT id, status,
            COALESCE(ends_at + interval '6 hours', starts_at + interval '12 hours') AS order_deadline,
            NOW() > COALESCE(ends_at + interval '6 hours', starts_at + interval '12 hours') AS order_closed
     FROM events WHERE ${b.slug ? "slug = $1" : "id = $1"}`, [b.slug || b.event_id]
  );
  if (!event || event.status !== "publie") return notFound(res, "Événement indisponible");
  if (event.order_closed) throw new AppError("Événement terminé — les commandes sont clôturées.", 410);

  // Sécurité : si le QR scanné précise le salon (table_id), le code DOIT correspondre
  // à CE salon. Ainsi le code du salon A ne déverrouille pas le QR du salon B.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const tableId = b.table_id && uuidRe.test(b.table_id) ? b.table_id : null;
  const params = tableId ? [event.id, pin, tableId] : [event.id, pin];
  const { rows } = await query(
    `SELECT r.table_id, t.label AS table_label, COALESCE(r.guest_name, u.full_name) AS guest_name
     FROM event_reservations r
     LEFT JOIN event_tables t ON t.id = r.table_id
     LEFT JOIN users u ON u.id = r.client_id
     WHERE r.event_id = $1 AND r.order_pin = $2 ${tableId ? "AND r.table_id = $3" : ""}
       AND r.checked_in_at IS NOT NULL AND r.status = 'confirme'`,
    params
  );
  // Rejet strict : 0 ou (théoriquement) plusieurs correspondances → invalide
  if (rows.length !== 1) throw new AppError(
    tableId ? "Ce code ne correspond pas à ce salon." : "Code invalide ou salon pas encore arrivé à l'entrée.",
    401
  );
  const r = rows[0];
  // Jeton court à la place du PIN pour les commandes suivantes ; on ne renvoie
  // que le libellé du salon (pas le nom du client — anti-fuite de données tiers).
  // Le jeton responsable expire à la CLÔTURE des commandes de CET événement :
  // inutilisable après la soirée, et jamais sur un autre événement (event_id scellé).
  const expSec = Math.floor((new Date(event.order_deadline).getTime() - Date.now()) / 1000);
  const token = signOrderToken({ event_id: event.id, table_id: r.table_id, table_label: r.table_label, guest_name: r.guest_name }, expSec);
  return ok(res, { token, table_label: r.table_label }, "Accès responsable validé");
});

// ── GET /event-orders?event_id= — tableau des commandes (organisateur/staff) ──
export const listOrders = asyncHandler(async (req, res) => {
  // Lecture des commandes : bar/caisse (gestion) + serveur (pour tirer les reçus).
  assertStaffRole(req, ["bar", "caisse", "serveur"]);
  const { rows } = await query(
    `SELECT o.*, t.kind AS table_kind, srv.name AS server_name FROM event_orders o
     LEFT JOIN event_tables t ON t.id = o.table_id
     LEFT JOIN event_staff srv ON srv.id = t.server_id
     WHERE o.event_id = $1 ORDER BY o.created_at DESC LIMIT 300`,
    [req.eventScope]
  );
  return ok(res, { orders: rows });
});

// ── GET /event-orders/mine?order_token= — commandes du salon (invité, public) ──
// Scellé au jeton responsable : ne renvoie QUE les commandes de la table du jeton.
// Permet à l'invité de suivre le statut de ses commandes et de revoir son historique
// après un re-scan (tant que le jeton de 10 h est valide).
export const listMyOrders = asyncHandler(async (req, res) => {
  const token = req.query?.order_token || req.body?.order_token;
  const d = token ? verifyOrderToken(token) : null;
  if (!d) throw new AppError("Session responsable expirée. Ressaisissez le code.", 401);
  if (!d.table_id) return ok(res, { orders: [], table_label: d.table_label || null });
  const { rows } = await query(
    `SELECT id, ref, items, total, status, note, created_at, updated_at
     FROM event_orders
     WHERE event_id = $1 AND table_id = $2
     ORDER BY created_at DESC LIMIT 100`,
    [d.event_id, d.table_id]
  );
  return ok(res, { orders: rows, table_label: d.table_label || null });
});

// ── GET /event-server/tables — les tables assignées au serveur connecté ───────
// Chaque serveur (rôle 'serveur') ne voit QUE ses tables + leurs commandes.
export const listServerTables = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["serveur"]);
  // L'organisateur (pas de req.staff) voit toutes les tables assignées ; un
  // serveur ne voit que les siennes.
  const staffId = req.staff?.staff_id || null;
  const scoped = staffId ? "AND t.server_id = $2" : "";
  const params = staffId ? [req.eventScope, staffId] : [req.eventScope];
  const { rows: tables } = await query(
    `SELECT t.id, t.label, t.kind, t.capacity, t.price, t.min_order, t.zone, t.status,
            t.server_id, srv.name AS server_name,
            r.id AS resa_id, r.ref AS resa_ref, r.party_size, r.arrived_size, r.checked_in_at,
            COALESCE(r.guest_name, u.full_name) AS client_name
     FROM event_tables t
     LEFT JOIN event_staff srv ON srv.id = t.server_id
     LEFT JOIN event_reservations r ON r.table_id = t.id AND r.status = 'confirme'
     LEFT JOIN users u ON u.id = r.client_id
     WHERE t.event_id = $1 AND t.is_active = TRUE ${scoped}
     ORDER BY t.zone, t.label`,
    params
  );
  // Commandes récentes des tables concernées
  const tableIds = tables.map(t => t.id);
  let ordersByTable = {};
  if (tableIds.length) {
    const { rows: ords } = await query(
      `SELECT id, ref, table_id, items, total, status, note, created_at
       FROM event_orders WHERE event_id = $1 AND table_id = ANY($2)
       ORDER BY created_at DESC LIMIT 200`,
      [req.eventScope, tableIds]
    );
    for (const o of ords) (ordersByTable[o.table_id] ||= []).push(o);
  }
  const enriched = tables.map(t => ({ ...t, orders: ordersByTable[t.id] || [] }));
  // Carte des bouteilles (pour composer une commande côté serveur)
  const { rows: bottles } = await query(
    "SELECT id, name, category, price FROM event_bottles WHERE event_id = $1 AND is_active = TRUE ORDER BY category, position, name",
    [req.eventScope]
  );
  return ok(res, { tables: enriched, bottles });
});

// ── POST /event-server/orders — le serveur passe une commande pour SA table ───
export const createServerOrder = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["serveur"]);
  const b = req.body || {};
  if (!b.table_id) throw new AppError("Table requise", 400);
  const { rows: [event] } = await query(
    `SELECT id, status, bottles_enabled,
            NOW() > COALESCE(ends_at + interval '6 hours', starts_at + interval '12 hours') AS order_closed
     FROM events WHERE id = $1`, [req.eventScope]
  );
  if (!event) return notFound(res, "Événement introuvable");
  if (event.status !== "publie" || !event.bottles_enabled) throw new AppError("Les commandes ne sont pas ouvertes", 400);
  if (event.order_closed) throw new AppError("Événement terminé — les commandes sont clôturées.", 410);

  // La table doit exister dans l'événement ET, pour un serveur, lui être assignée.
  const staffId = req.staff?.staff_id || null;
  const { rows: [table] } = await query(
    `SELECT id, label, server_id FROM event_tables WHERE id = $1 AND event_id = $2 AND is_active = TRUE`,
    [b.table_id, event.id]
  );
  if (!table) return notFound(res, "Table introuvable");
  if (staffId && String(table.server_id) !== String(staffId)) {
    throw new AppError("Cette table ne vous est pas assignée", 403);
  }

  const { items, total } = await priceItems(event.id, b.items);
  const guestName = req.staff?.name ? `Serveur ${req.staff.name}` : (b.guest_name || null);
  const { rows: [order] } = await query(
    `INSERT INTO event_orders (ref, event_id, table_id, table_label, guest_name, items, total, note)
     VALUES ('EVO-' || LPAD(nextval('event_order_ref_seq')::text, 4, '0'), $1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [event.id, table.id, table.label, guestName, JSON.stringify(items), total, b.note || null]
  );
  return created(res, { order }, "Commande envoyée");
});

// ── PATCH /event-orders/:id/status ────────────────────────────────────────────
export const updateOrderStatus = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["bar", "caisse"]);
  await assertEventActive(req.eventScope);
  const status = req.body?.status;
  if (!ORDER_STATUSES.includes(status)) throw new AppError("Statut invalide", 400);
  // Annuler une commande = réservé à l'organisateur (req.staff absent). Le staff
  // bar/caisse peut servir/encaisser mais pas annuler (protection serveur).
  if (status === "annule" && req.staff) throw new AppError("Seul l'organisateur peut annuler une commande.", 403);
  const { rows: [order] } = await query(
    "UPDATE event_orders SET status = $1, updated_at = NOW() WHERE id = $2 AND event_id = $3 RETURNING *",
    [status, req.params.id, req.eventScope]
  );
  if (!order) return notFound(res, "Commande introuvable");
  return ok(res, { order }, "Commande mise à jour");
});

// ── GET /event-checkin?event_id= — liste des arrivées (organisateur/staff) ────
export const listCheckin = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["checkin"]);
  const { rows } = await query(
    `SELECT r.id, r.ref, r.party_size, r.arrived_size, r.status, r.checked_in_at, r.order_pin, r.promoter_code,
            r.special_request, r.created_at,
            COALESCE(r.guest_name, u.full_name) AS client_name,
            COALESCE(r.guest_phone, u.phone)    AS client_phone,
            r.table_id,
            t.label AS table_label, t.kind AS table_kind, t.price AS table_price, t.capacity AS table_capacity,
            t.zone AS table_zone, t.pos_x AS table_pos_x, t.pos_y AS table_pos_y
     FROM event_reservations r
     LEFT JOIN users u ON u.id = r.client_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.event_id = $1 AND r.status = 'confirme'
     ORDER BY r.checked_in_at NULLS FIRST, r.created_at DESC`,
    [req.eventScope]
  );
  // Plan complet (pour situer la table du salon lors du check-in)
  const { rows: tables } = await query(
    `SELECT id, label, kind, capacity, zone, pos_x, pos_y, status
     FROM event_tables WHERE event_id = $1 AND is_active = TRUE ORDER BY zone, label`,
    [req.eventScope]
  );
  const arrivedRows = rows.filter(r => r.checked_in_at);
  // Personnes réellement arrivées = arrived_size si saisi, sinon party_size
  const arrivedPax = (r) => (r.arrived_size != null ? r.arrived_size : (r.party_size || 0));
  const { rows: [ev] } = await query("SELECT capacity, slug, name FROM events WHERE id = $1", [req.eventScope]);
  const arrivedCovers = arrivedRows.reduce((a, c) => a + arrivedPax(c), 0);
  const capacity = ev?.capacity ?? null;
  // Anti-fuite PII : le téléphone client et le code de commande ne sont exposés
  // qu'à l'organisateur (req.staff absent) et au staff d'accueil (rôle checkin/all)
  // — jamais au bar ni aux serveurs. L'accueil en a besoin pour renvoyer le code
  // (affichage / WhatsApp) au responsable du salon qui l'aurait perdu.
  const reception = !req.staff || req.staff.role === "checkin" || req.staff.role === "all";
  if (!reception) rows.forEach(r => { delete r.client_phone; delete r.order_pin; });
  return ok(res, {
    reservations: rows,
    tables,
    event: { slug: ev?.slug || null, name: ev?.name || null },
    totals: {
      total: rows.length,
      arrived: arrivedRows.length,
      arrived_covers: arrivedCovers,
      covers: rows.reduce((a, c) => a + (c.party_size || 0), 0),
      capacity,
      remaining: capacity != null ? Math.max(0, capacity - arrivedCovers) : null,
    },
  });
});

// Marque (ou libère) la table d'une réservation à l'arrivée
async function syncTableStatus(resaId, occupied) {
  await query(
    `UPDATE event_tables SET status = $1, updated_at = NOW()
     WHERE id = (SELECT table_id FROM event_reservations WHERE id = $2) AND status <> $1`,
    [occupied ? "occupe" : "reserve", resaId]
  ).catch(() => {});
}
// Nombre de personnes arrivées (saisi au check-in). Doit être >= 1 (pointer 0
// personne n'a pas de sens) et borné par un plafond absolu anti-typo.
const arrivedFromBody = (body, fallback) => {
  const n = parseInt(body?.arrived_size, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, ABS_MAX_ARRIVED) : (fallback ?? null);
};

// Limite d'arrivées d'une réservation = le nombre RÉSERVÉ (party_size), borné par
// la capacité physique du salon si celle-ci est plus petite. On ne peut donc PAS
// pointer plus de personnes que ce qui a été réservé pour ce salon.
async function maxArrivedForResa(resaId) {
  const { rows: [r] } = await query(
    `SELECT er.party_size, t.capacity
     FROM event_reservations er
     LEFT JOIN event_tables t ON t.id = er.table_id
     WHERE er.id = $1`, [resaId]
  );
  if (!r) return ABS_MAX_ARRIVED;
  const party = r.party_size || 1;
  const cap = r.capacity || null;
  return cap ? Math.min(party, cap) : party;
}
async function assertArrivedFits(resaId, arrived) {
  if (arrived == null) return;
  const limit = await maxArrivedForResa(resaId);
  if (arrived > limit) {
    throw new AppError(
      `Cette réservation est prévue pour ${limit} personne${limit > 1 ? "s" : ""} maximum (vous avez saisi ${arrived}). Modifiez la réservation si le groupe est plus grand.`,
      400
    );
  }
}

// Applique le check-in (ou un complément d'arrivées) avec un code UNIQUE. Sous
// forte concurrence à l'entrée (deux salons différents pointés à la même
// milliseconde), l'index unique (event_id, order_pin) lève 23505 → on régénère
// le code et on réessaie. Le même salon repointé garde son code (COALESCE).
async function applyCheckin(resaId, eventId, arrived) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const pin = await genUniqueOrderPin(eventId);
    try {
      const { rows: [resa] } = await query(
        `UPDATE event_reservations
           SET checked_in_at = COALESCE(checked_in_at, NOW()),
               arrived_size  = COALESCE($3, arrived_size, party_size),
               order_pin     = COALESCE(order_pin, $4),
               updated_at = NOW()
         WHERE id = $1 AND event_id = $2
         RETURNING id, ref, party_size, arrived_size, order_pin, checked_in_at, table_id`,
        [resaId, eventId, arrived, pin]
      );
      return resa || null;
    } catch (e) {
      if (e?.code === "23505") continue; // collision de code → nouvel essai
      throw e;
    }
  }
  throw new AppError("Impossible de générer un code unique, réessayez.", 500);
}

// ── POST /event-checkin/:resaId — pointer une arrivée (organisateur/staff) ────
export const doCheckin = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["checkin"]);
  await assertEventActive(req.eventScope);
  const undo = req.body?.undo === true;

  // Annuler un pointage = réservé à l'organisateur (req.staff absent). Le staff
  // d'accueil peut pointer les arrivées mais pas les annuler (protection serveur).
  if (undo && req.staff) throw new AppError("Seul l'organisateur peut annuler un pointage.", 403);

  if (undo) {
    const { rows: [resa] } = await query(
      `UPDATE event_reservations
         SET checked_in_at = NULL, arrived_size = NULL, order_pin = NULL, updated_at = NOW()
       WHERE id = $1 AND event_id = $2
       RETURNING id, ref, party_size, arrived_size, order_pin, checked_in_at, table_id`,
      [req.params.resaId, req.eventScope]
    );
    if (!resa) return notFound(res, "Réservation introuvable");
    if (resa.table_id) await syncTableStatus(resa.id, false);
    return ok(res, { reservation: resa }, "Check-in annulé");
  }

  // On ne pointe à l'entrée qu'une réservation CONFIRMÉE (acompte reçu).
  const { rows: [chk] } = await query(
    "SELECT status FROM event_reservations WHERE id = $1 AND event_id = $2", [req.params.resaId, req.eventScope]
  );
  if (!chk) return notFound(res, "Réservation introuvable");
  if (chk.status !== "confirme") throw new AppError("Réservation non confirmée — l'organisateur doit valider l'acompte avant le check-in.", 400);

  const arrived = arrivedFromBody(req.body);
  await assertArrivedFits(req.params.resaId, arrived);
  const resa = await applyCheckin(req.params.resaId, req.eventScope, arrived);
  if (!resa) return notFound(res, "Réservation introuvable");
  if (resa.table_id) await syncTableStatus(resa.id, true);
  return ok(res, { reservation: resa }, "Arrivée confirmée");
});

// ── POST /event-checkin/by-ref — pointer via QR (ref scannée) ─────────────────
export const checkinByRef = asyncHandler(async (req, res) => {
  assertStaffRole(req, ["checkin"]);
  await assertEventActive(req.eventScope);
  const ref = String(req.body?.ref || "").trim().toUpperCase();
  if (!ref) throw new AppError("Référence requise", 400);
  const arrived = arrivedFromBody(req.body);
  // On vérifie d'abord l'existence + le statut pour un message clair
  const { rows: [found] } = await query(
    "SELECT id, status FROM event_reservations WHERE ref = $1 AND event_id = $2", [ref, req.eventScope]
  );
  if (!found) return notFound(res, "Réservation introuvable pour cet événement");
  if (found.status !== "confirme") {
    throw new AppError(
      found.status === "annule"
        ? "Cette réservation est annulée."
        : "Réservation non confirmée — l'organisateur doit la valider avant le check-in.",
      400
    );
  }
  await assertArrivedFits(found.id, arrived);
  const resa = await applyCheckin(found.id, req.eventScope, arrived);
  if (!resa) return notFound(res, "Réservation introuvable");
  if (resa.table_id) await syncTableStatus(resa.id, true);
  return ok(res, { reservation: resa }, "Arrivée confirmée");
});
