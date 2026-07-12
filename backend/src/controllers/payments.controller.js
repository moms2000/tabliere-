/**
 * Payments Controller — TablièreCI
 * Initiation + callback + remboursement
 * Méthodes : Orange Money CI | MTN MoMo | Wave | Cash
 */

import { query, withTransaction } from "../config/db.js";
import { ok, created, notFound, badRequest } from "../utils/response.js";
import { asyncHandler, AppError }             from "../middleware/errorHandler.js";
import { paymentService }                     from "../services/payment.service.js";
import { notificationQueue }                  from "../queues/index.js";
import { logger }                             from "../utils/logger.js";

// ── POST /payments/initiate ────────────────────────────────────────────────────
export const initiate = asyncHandler(async (req, res) => {
  const { reservation_id, method, phone } = req.body;

  if (!reservation_id) throw new AppError("reservation_id requis", 400);
  if (!method)         throw new AppError("Méthode de paiement requise", 400);

  const VALID_METHODS = ["orange_money", "mtn_momo", "wave", "carte", "cash"];
  if (!VALID_METHODS.includes(method)) {
    throw new AppError(`Méthode invalide. Valeurs: ${VALID_METHODS.join(", ")}`, 400);
  }

  // Récupérer la réservation + restaurant
  const { rows: [resa] } = await query(
    `SELECT r.*, re.name AS resto_name, re.commission_pct
     FROM reservations r
     JOIN restaurants re ON re.id = r.restaurant_id
     WHERE r.id = $1 AND r.client_id = $2`,
    [reservation_id, req.user.id]
  );
  if (!resa) return notFound(res, "Réservation introuvable");
  if (resa.status === "annule") throw new AppError("Impossible de payer une réservation annulée", 400);

  // Montant de l'arrhes (ex: 2 000 F par couvert, configurable)
  const ARRHES_PAR_COUVERT = 2_000; // FCFA
  const amount = resa.party_size * ARRHES_PAR_COUVERT;
  const commission = Math.round(amount * (resa.commission_pct / 100));

  // Créer le paiement en base (statut en_attente)
  const { rows: [payment] } = await query(
    `INSERT INTO payments
       (reservation_id, restaurant_id, user_id, type, method, amount, commission, status)
     VALUES ($1, $2, $3, 'reservation', $4, $5, $6, 'en_attente')
     RETURNING *`,
    [reservation_id, resa.restaurant_id, req.user.id, method, amount, commission]
  );

  // Si cash → confirmer directement
  if (method === "cash") {
    await query(
      "UPDATE payments SET status = 'succes', updated_at = NOW() WHERE id = $1",
      [payment.id]
    );
    await query(
      "UPDATE reservations SET status = 'confirme', confirmed_at = NOW() WHERE id = $1",
      [reservation_id]
    );
    return ok(res, { payment: { ...payment, status: "succes" }, amount }, "Paiement cash enregistré");
  }

  // Initier le paiement mobile
  let providerResult;
  try {
    providerResult = await paymentService.initiate({
      method,
      phone:      phone || req.user.phone,
      amount,
      reference:  payment.id,
      description: `Réservation ${resa.ref} — ${resa.resto_name}`,
    });
  } catch (err) {
    await query(
      "UPDATE payments SET status = 'echec', updated_at = NOW() WHERE id = $1",
      [payment.id]
    );
    throw new AppError(`Erreur paiement: ${err.message}`, 502);
  }

  // Enregistrer la référence fournisseur
  await query(
    "UPDATE payments SET provider_ref = $1, provider_data = $2 WHERE id = $3",
    [providerResult.reference, JSON.stringify(providerResult), payment.id]
  );

  logger.info("Paiement initié", { paymentId: payment.id, method, amount });
  return created(res, {
    payment_id:  payment.id,
    amount,
    method,
    provider_ref: providerResult.reference,
    checkout_url: providerResult.checkout_url || null,
    status:       "en_attente",
  }, "Paiement initié — en attente de confirmation");
});

// ── POST /payments/callback/:method — Webhook fournisseur ─────────────────────
export const callback = asyncHandler(async (req, res) => {
  const { method } = req.params;
  const payload    = req.body;

  // Sécurité : vérifier la signature du fournisseur (anti-forge de paiement)
  if (!paymentService.verifyCallback(method, req)) {
    logger.warn("[Callback] Signature invalide — rejeté", { method });
    return res.status(401).json({ error: "invalid signature" });
  }

  logger.info(`[Callback] ${method}`, { payload });

  let providerRef, success;
  try {
    ({ providerRef, success } = await paymentService.parseCallback(method, payload));
  } catch (err) {
    logger.warn(`[Callback] Parse error: ${err.message}`);
    return res.status(200).json({ received: true }); // toujours 200 pour les webhooks
  }

  const { rows: [payment] } = await query(
    "SELECT * FROM payments WHERE provider_ref = $1",
    [providerRef]
  );
  if (!payment) {
    logger.warn("[Callback] Paiement non trouvé", { providerRef });
    return res.status(200).json({ received: true });
  }

  if (success) {
    await withTransaction(async (client) => {
      await client.query(
        "UPDATE payments SET status = 'succes', updated_at = NOW() WHERE id = $1",
        [payment.id]
      );
      if (payment.reservation_id) {
        await client.query(
          "UPDATE reservations SET status = 'confirme', confirmed_at = NOW() WHERE id = $1",
          [payment.reservation_id]
        );
      }
    });

    // Notification client
    await notificationQueue.add("payment_success", {
      userId: payment.user_id,
      amount: payment.amount,
      method: payment.method,
    }).catch(() => {});

    logger.info("Paiement confirmé via callback", { paymentId: payment.id });
  } else {
    await query(
      "UPDATE payments SET status = 'echec', updated_at = NOW() WHERE id = $1",
      [payment.id]
    );
    logger.warn("Paiement échoué via callback", { paymentId: payment.id });
  }

  return res.status(200).json({ received: true });
});

// ── GET /payments/status/:id ──────────────────────────────────────────────────
export const getStatus = asyncHandler(async (req, res) => {
  const { rows: [payment] } = await query(
    `SELECT p.*, r.ref AS resa_ref, r.status AS resa_status
     FROM payments p
     LEFT JOIN reservations r ON r.id = p.reservation_id
     WHERE p.id = $1 AND p.user_id = $2`,
    [req.params.id, req.user.id]
  );
  if (!payment) return notFound(res, "Paiement introuvable");
  return ok(res, { payment });
});

// ── POST /payments/:id/refund — Admin ou restaurateur ────────────────────────
export const refund = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const { rows: [payment] } = await query(
    "SELECT * FROM payments WHERE id = $1", [req.params.id]
  );
  if (!payment) return notFound(res, "Paiement introuvable");

  // Anti-IDOR : un restaurateur ne peut rembourser que les paiements de SON
  // restaurant. L'admin peut tout rembourser.
  if (req.user.role !== "admin") {
    const { rows: [own] } = await query(
      "SELECT 1 FROM restaurants WHERE id = $1 AND owner_id = $2",
      [payment.restaurant_id, req.user.id]
    );
    if (!own) throw new AppError("Accès refusé à ce paiement", 403);
  }

  if (payment.status !== "succes") throw new AppError("Seuls les paiements réussis peuvent être remboursés", 400);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE payments
       SET status = 'rembourse', refund_reason = $1, refunded_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [reason || null, payment.id]
    );
    if (payment.reservation_id) {
      await client.query(
        "UPDATE reservations SET status = 'annule', cancel_reason = $1, cancelled_at = NOW() WHERE id = $2",
        [`Remboursement: ${reason || "demande client"}`, payment.reservation_id]
      );
    }
  });

  logger.info("Paiement remboursé", { paymentId: payment.id, reason });
  return ok(res, null, "Remboursement enregistré");
});
