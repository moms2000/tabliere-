/**
 * Event Reservations Controller — réservations de tables / packs VIP d'un événement.
 *
 * Modèle « confirmation par acompte » (mobile money) :
 *  - La réservation (en ligne OU manuelle) NE BLOQUE PAS la table.
 *  - Statut `en_attente` = en attente d'acompte (aucun QR émis).
 *  - `confirme` = l'organisateur a validé la réception de l'acompte → QR émis + envoyé.
 *    Premier acompte confirmé = table attribuée (verrou transactionnel).
 *  - `annule` = refusée / annulée.
 * Notifications : email + WhatsApp à la création (instructions d'acompte) et à la
 * confirmation (QR). Le QR n'existe QUE pour une réservation `confirme`.
 */
import { query, withTransaction } from "../config/db.js";
import { ok, created, notFound } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";
import { notificationQueue } from "../queues/index.js";
import { ticketToken, verifyTicketToken } from "../utils/ticketToken.js";

async function resaById(id) {
  const { rows } = await query(
    `SELECT r.*, e.owner_id, e.name AS event_name, e.slug AS event_slug
     FROM event_reservations r JOIN events e ON e.id = r.event_id
     WHERE r.id = $1`, [id]
  );
  return rows[0] || null;
}

function assertOwner(req, resa) {
  if (req.user.role === "admin") return;
  if (resa && resa.owner_id === req.user.id) return;
  throw new AppError("Accès refusé", 403);
}
function assertOwnerOrClient(req, resa) {
  if (req.user.role === "admin") return;
  if (resa && (resa.owner_id === req.user.id || resa.client_id === req.user.id)) return;
  throw new AppError("Accès refusé", 403);
}

// Acompte attendu : montant fixe de la table s'il est défini, sinon % du prix.
function depositFor(event, table) {
  if (!table) return 0;
  if (table.deposit_amount && table.deposit_amount > 0) return table.deposit_amount;
  const pct = event.deposit_percent || 0;
  return pct > 0 ? Math.round(((table.price || 0) * pct) / 100) : 0;
}

// Vérifie la table (existe, active, capacité) SANS la bloquer. Renvoie la ligne.
async function loadTableForReservation(client, tableId, eventId, partySize) {
  const { rows: [t] } = await client.query(
    "SELECT id, is_active, capacity, price, deposit_amount FROM event_tables WHERE id = $1 AND event_id = $2",
    [tableId, eventId]
  );
  if (!t || !t.is_active) throw new AppError("Table introuvable", 404);
  if (t.capacity && partySize > t.capacity)
    throw new AppError(`Cette table accueille au maximum ${t.capacity} personnes`, 400);
  return t;
}

// ── POST /event-reservations — réserver (client connecté) ────────────────────
export const createEventReservation = asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!b.slug && !b.event_id) throw new AppError("Événement requis", 400);
  const { rows: [event] } = await query(
    `SELECT * FROM events WHERE ${b.slug ? "slug = $1" : "id = $1"}`, [b.slug || b.event_id]
  );
  if (!event) return notFound(res, "Événement introuvable");
  if (event.status !== "publie") throw new AppError("Cet événement n'accepte pas encore de réservations", 400);

  const partySize = Math.min(100, Math.max(1, parseInt(b.party_size, 10) || 1));
  const promoter = b.promoter_code ? String(b.promoter_code).trim().toUpperCase().slice(0, 30) : null;
  // Bornage des champs invité (mêmes limites que la réservation manuelle)
  const gName  = b.guest_name  ? String(b.guest_name).trim().slice(0, 120) : null;
  const gPhone = b.guest_phone ? String(b.guest_phone).trim().slice(0, 30) : null;
  const gEmail = (b.guest_email && String(b.guest_email).trim().toLowerCase().slice(0, 200)) || null;
  const sReq   = b.special_request ? String(b.special_request).slice(0, 500) : null;

  const resa = await withTransaction(async (client) => {
    let tableId = null, deposit = 0;
    if (b.table_id) {
      const t = await loadTableForReservation(client, b.table_id, event.id, partySize);
      tableId = t.id; deposit = depositFor(event, t);
    }
    // AUCUN blocage de table : plusieurs réservations 'en_attente' peuvent viser la
    // même table. L'attribution se fait à la confirmation de l'acompte.
    const { rows: [r] } = await client.query(
      `INSERT INTO event_reservations
         (ref, event_id, client_id, table_id, party_size, guest_name, guest_phone, guest_email,
          special_request, promoter_code, deposit_amount, status, is_manual)
       VALUES ('EVT-' || LPAD(nextval('event_resa_ref_seq')::text, 4, '0'),
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en_attente', FALSE)
       RETURNING *`,
      [event.id, req.user.id, tableId, partySize, gName, gPhone, gEmail, sReq, promoter, deposit]
    );
    return r;
  });

  notificationQueue.add("event_resa_pending", { reservationId: resa.id });
  return created(res, { reservation: resa }, "Demande envoyée — en attente de votre acompte");
});

// ── POST /event-reservations/manual — réservation créée par l'organisateur ───
export const createManualReservation = asyncHandler(async (req, res) => {
  const b = req.body || {};
  const eventId = b.event_id;
  if (!eventId) throw new AppError("event_id requis", 400);
  const { rows: [event] } = await query("SELECT * FROM events WHERE id = $1", [eventId]);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, { owner_id: event.owner_id });

  const name = b.guest_name ? String(b.guest_name).trim().slice(0, 120) : "";
  if (!name) throw new AppError("Nom du client requis", 400);
  const phone = b.guest_phone ? String(b.guest_phone).trim().slice(0, 30) : null;
  const email = (b.guest_email && String(b.guest_email).trim().toLowerCase()) || null;
  if (!phone && !email) throw new AppError("Téléphone ou e-mail requis pour joindre le client", 400);
  const partySize = Math.min(100, Math.max(1, parseInt(b.party_size, 10) || 1));

  const resa = await withTransaction(async (client) => {
    let tableId = null, deposit = 0;
    if (b.table_id) {
      const t = await loadTableForReservation(client, b.table_id, event.id, partySize);
      tableId = t.id; deposit = depositFor(event, t);
    }
    const { rows: [r] } = await client.query(
      `INSERT INTO event_reservations
         (ref, event_id, client_id, table_id, party_size, guest_name, guest_phone, guest_email,
          special_request, deposit_amount, status, is_manual)
       VALUES ('EVT-' || LPAD(nextval('event_resa_ref_seq')::text, 4, '0'),
               $1, NULL, $2, $3, $4, $5, $6, $7, $8, 'en_attente', TRUE)
       RETURNING *`,
      [event.id, tableId, partySize, name, phone, email, b.special_request || null, deposit]
    );
    return r;
  });

  notificationQueue.add("event_resa_pending", { reservationId: resa.id });
  return created(res, { reservation: resa }, "Réservation manuelle créée — client notifié pour l'acompte");
});

// ── GET /event-reservations?event_id= — liste pour l'organisateur ────────────
export const listForEvent = asyncHandler(async (req, res) => {
  const eventId = req.query.event_id;
  if (!eventId) throw new AppError("event_id requis", 400);
  const { rows: [event] } = await query("SELECT id, owner_id FROM events WHERE id = $1", [eventId]);
  if (!event) return notFound(res, "Événement introuvable");
  assertOwner(req, event);

  // LEFT JOIN users : les réservations manuelles (invité) n'ont pas de client_id.
  const { rows } = await query(
    `SELECT r.*,
            COALESCE(r.guest_name, u.full_name) AS client_name,
            COALESCE(r.guest_phone, u.phone)    AS client_phone,
            COALESCE(r.guest_email, u.email)    AS client_email,
            t.label AS table_label, t.kind AS table_kind, t.price AS table_price
     FROM event_reservations r
     LEFT JOIN users u ON u.id = r.client_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.event_id = $1
     ORDER BY r.created_at DESC`, [eventId]
  );
  // Jeton d'e-billet (pour construire les liens organisateur/WhatsApp) — confirmées uniquement
  const withTokens = rows.map(r => r.status === "confirme" ? { ...r, ticket_token: ticketToken(r.ref) } : r);
  return ok(res, { reservations: withTokens });
});

// ── GET /event-reservations/mine — réservations du client connecté ───────────
export const listMine = asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT r.*, e.name AS event_name, e.slug AS event_slug, e.starts_at, e.venue_name,
            t.label AS table_label, t.kind AS table_kind
     FROM event_reservations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.client_id = $1
     ORDER BY e.starts_at DESC`, [req.user.id]
  );
  return ok(res, { reservations: rows });
});

// ── PATCH /event-reservations/:id/confirm — CONFIRMER L'ACOMPTE ──────────────
// Attribue définitivement la table (1er acompte confirmé gagne), génère le QR,
// notifie le client + notifie les autres en attente sur la même table.
export const confirmEventReservation = asyncHandler(async (req, res) => {
  const resa = await resaById(req.params.id);
  if (!resa) return notFound(res, "Réservation introuvable");
  assertOwner(req, resa);
  if (resa.status === "annule") throw new AppError("Cette réservation est annulée", 400);
  if (resa.status === "confirme") return ok(res, { reservation: resa }, "Déjà confirmée");

  const b = req.body || {};
  const method = b.deposit_method ? String(b.deposit_method).slice(0, 30) : null;
  const depRef = b.deposit_ref ? String(b.deposit_ref).slice(0, 80) : null;

  const updated = await withTransaction(async (client) => {
    if (resa.table_id) {
      // Verrou sur la table → sérialise les confirmations concurrentes.
      await client.query("SELECT id FROM event_tables WHERE id = $1 FOR UPDATE", [resa.table_id]);
      const { rows: taken } = await client.query(
        "SELECT 1 FROM event_reservations WHERE table_id = $1 AND status = 'confirme' AND id <> $2 LIMIT 1",
        [resa.table_id, resa.id]
      );
      if (taken.length) throw new AppError("Cette table est déjà attribuée à un autre client (acompte déjà confirmé).", 409);
    }
    const { rows: [u] } = await client.query(
      `UPDATE event_reservations
         SET status = 'confirme', confirmed_at = NOW(), deposit_confirmed_at = NOW(),
             deposit_method = COALESCE($2, deposit_method), deposit_ref = COALESCE($3, deposit_ref), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [resa.id, method, depRef]
    );
    if (resa.table_id) {
      await client.query("UPDATE event_tables SET status = 'occupe', updated_at = NOW() WHERE id = $1", [resa.table_id]);
    }
    return u;
  });

  // QR + confirmation au client
  notificationQueue.add("event_resa_confirmed", { reservationId: resa.id });
  // Les autres en attente sur cette table : notifiés « plus disponible »
  if (resa.table_id) {
    const { rows: others } = await query(
      "SELECT id FROM event_reservations WHERE table_id = $1 AND status = 'en_attente' AND id <> $2",
      [resa.table_id, resa.id]
    );
    for (const o of others) notificationQueue.add("event_resa_declined", { reservationId: o.id });
  }
  return ok(res, { reservation: updated }, "Acompte confirmé — réservation confirmée, QR envoyé");
});

// ── POST /event-reservations/:id/resend-qr — renvoyer le QR (confirmées) ─────
export const resendQr = asyncHandler(async (req, res) => {
  const resa = await resaById(req.params.id);
  if (!resa) return notFound(res, "Réservation introuvable");
  assertOwner(req, resa);
  if (resa.status !== "confirme") throw new AppError("Le QR code n'existe que pour une réservation confirmée", 400);
  notificationQueue.add("event_resa_confirmed", { reservationId: resa.id });
  return ok(res, {}, "QR code renvoyé au client (e-mail + WhatsApp)");
});

// ── GET /event-reservations/ticket/:ref — e-billet public (QR si confirmé) ───
export const getTicket = asyncHandler(async (req, res) => {
  const ref = String(req.params.ref || "").trim().toUpperCase();
  const { rows: [r] } = await query(
    `SELECT r.ref, r.status, r.party_size,
            COALESCE(r.guest_name, u.full_name) AS name,
            e.name AS event_name, e.starts_at, e.venue_name, e.address, e.ville,
            t.label AS table_label, t.kind AS table_kind
     FROM event_reservations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN users u ON u.id = r.client_id
     LEFT JOIN event_tables t ON t.id = r.table_id
     WHERE r.ref = $1`, [ref]
  );
  if (!r) return notFound(res, "Billet introuvable");
  // Anti-énumération : on ne dévoile le billet qu'avec un jeton valide (fourni dans
  // les liens email/WhatsApp). Sans jeton valide → réponse minimale, indistinguable
  // d'une réservation non confirmée.
  const tokenOk = verifyTicketToken(ref, req.query.t);
  if (r.status !== "confirme" || !tokenOk) {
    return ok(res, { confirmed: false, ref: r.ref, event_name: tokenOk ? r.event_name : null }, "Billet non disponible");
  }
  return ok(res, {
    confirmed: true, qr: r.ref, ref: r.ref, name: r.name, party_size: r.party_size,
    event_name: r.event_name, starts_at: r.starts_at, venue_name: r.venue_name, address: r.address, ville: r.ville,
    table_label: r.table_label, table_kind: r.table_kind,
  }, "Billet");
});

// ── PATCH /event-reservations/:id/cancel — refuser / annuler ─────────────────
export const cancelEventReservation = asyncHandler(async (req, res) => {
  const resa = await resaById(req.params.id);
  if (!resa) return notFound(res, "Réservation introuvable");
  assertOwnerOrClient(req, resa);
  if (resa.status === "annule") return ok(res, { reservation: resa }, "Déjà annulée"); // pas de re-notification
  const byOwner = req.user.role === "admin" || resa.owner_id === req.user.id;
  const reason = byOwner && req.body?.reason ? String(req.body.reason).slice(0, 200) : null;

  const { rows: [updated] } = await query(
    "UPDATE event_reservations SET status = 'annule', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *",
    [resa.id]
  );
  // Libérer la table si plus aucune réservation active ne la détient
  if (resa.table_id) {
    await query(
      `UPDATE event_tables SET status = 'libre', updated_at = NOW()
       WHERE id = $1 AND NOT EXISTS (
         SELECT 1 FROM event_reservations WHERE table_id = $1 AND status IN ('en_attente','confirme') AND id <> $2
       )`,
      [resa.table_id, resa.id]
    );
  }
  // L'organisateur refuse → notifier le client
  if (byOwner) notificationQueue.add("event_resa_declined", { reservationId: resa.id, reason: reason || "Votre réservation a été annulée par l'organisateur." });
  return ok(res, { reservation: updated }, "Réservation annulée");
});
