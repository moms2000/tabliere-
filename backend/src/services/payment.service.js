/**
 * Payment Service — TablièreCI
 * Abstraction : Orange Money CI | MTN MoMo | Wave | Cash
 */

import axios  from "axios";
import crypto from "crypto";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// ── Vérification de signature des webhooks ────────────────────────────────────
// Empêche un tiers de forger un « paiement réussi ». Si le secret du fournisseur
// n'est pas configuré, on ne bloque pas (rétro-compat) mais on loggue un avert.
const WEBHOOK_SECRETS = {
  wave:         () => process.env.WAVE_WEBHOOK_SECRET,
  orange_money: () => process.env.ORANGE_MONEY_WEBHOOK_SECRET,
  mtn_momo:     () => process.env.MTN_MOMO_WEBHOOK_SECRET,
};
function verifyCallback(method, req) {
  const secret = WEBHOOK_SECRETS[method]?.();
  if (!secret) {
    // Fail-closed en production : sans secret, on ne peut pas prouver que le
    // webhook vient bien du fournisseur → on refuse (sinon n'importe qui peut
    // forger un « paiement réussi »). En dev/sandbox on laisse passer.
    if (env.isProd) { logger.error("[Webhook] Secret manquant en prod — webhook REJETÉ", { method }); return false; }
    logger.warn("[Webhook] Secret non configuré (dev) — signature non vérifiée", { method });
    return true;
  }
  const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  const provided = String(
    req.headers["wave-signature"] || req.headers["x-signature"] || req.headers["x-webhook-signature"] || ""
  ).replace(/^sha256=/i, "").trim();
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return provided.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}

// ── Orange Money CI ───────────────────────────────────────────────────────────
async function initiateOrangeMoney({ phone, amount, reference, description }) {
  logger.info("[Orange Money] Initiation", { reference, amount });

  if (!env.ORANGE_MONEY_API_KEY) {
    // Sandbox
    return { reference: `OM-${reference}`, status: "pending", checkout_url: null };
  }

  try {
    const { data } = await axios.post(
      `${env.ORANGE_MONEY_BASE_URL}/webpayment`,
      {
        merchant_key: env.ORANGE_MONEY_API_KEY,
        currency:     "OUV",
        order_id:     reference,
        amount,
        return_url:   `${env.FRONTEND_URL}/paiement/retour`,
        cancel_url:   `${env.FRONTEND_URL}/paiement/annulation`,
        notif_url:    `${env.APP_URL}/api/v1/payments/callback/orange_money`,
        lang:         "fr",
        reference,
      },
      { headers: { Authorization: `Bearer ${env.ORANGE_MONEY_API_KEY}` } }
    );
    return {
      reference:    data.pay_token || reference,
      checkout_url: data.payment_url || null,
      status:       "pending",
    };
  } catch (err) {
    logger.error("[Orange Money] Erreur API", { error: err.message });
    throw new Error("Orange Money indisponible");
  }
}

// ── MTN MoMo ─────────────────────────────────────────────────────────────────
async function initiateMtnMomo({ phone, amount, reference, description }) {
  logger.info("[MTN MoMo] Initiation", { reference, amount });

  if (!env.MTN_MOMO_API_KEY) {
    return { reference: `MTN-${reference}`, status: "pending", checkout_url: null };
  }

  try {
    const baseUrl = `${env.MTN_MOMO_BASE_URL}/collection/v1_0`;
    await axios.post(
      `${baseUrl}/requesttopay`,
      {
        amount:       String(amount),
        currency:     "XOF",
        externalId:   reference,
        payer:        { partyIdType: "MSISDN", partyId: phone.replace(/^\+/, "") },
        payerMessage: description,
        payeeNote:    `TablièreCI — ${reference}`,
      },
      {
        headers: {
          Authorization:             `Bearer ${env.MTN_MOMO_API_KEY}`,
          "X-Reference-Id":          reference,
          "X-Target-Environment":    env.MTN_MOMO_ENVIRONMENT,
          "Ocp-Apim-Subscription-Key": env.MTN_MOMO_USER_ID,
          "Content-Type":            "application/json",
        },
      }
    );
    return { reference: `MTN-${reference}`, checkout_url: null, status: "pending" };
  } catch (err) {
    logger.error("[MTN MoMo] Erreur API", { error: err.message });
    throw new Error("MTN MoMo indisponible");
  }
}

// ── Wave ──────────────────────────────────────────────────────────────────────
async function initiateWave({ phone, amount, reference, description }) {
  logger.info("[Wave] Initiation", { reference, amount });

  if (!env.WAVE_API_KEY) {
    return { reference: `WAVE-${reference}`, status: "pending", checkout_url: "https://pay.wave.com/m/test" };
  }

  try {
    const { data } = await axios.post(
      `${env.WAVE_BASE_URL}/checkout/sessions`,
      {
        amount:           String(amount),
        currency:         "XOF",
        client_reference: reference,
        success_url:      `${env.FRONTEND_URL}/paiement/retour?ref=${reference}`,
        error_url:        `${env.FRONTEND_URL}/paiement/annulation?ref=${reference}`,
      },
      { headers: { Authorization: `Bearer ${env.WAVE_API_KEY}`, "Content-Type": "application/json" } }
    );
    return {
      reference:    data.id || `WAVE-${reference}`,
      checkout_url: data.wave_launch_url || null,
      status:       "pending",
    };
  } catch (err) {
    logger.error("[Wave] Erreur API", { error: err.message });
    throw new Error("Wave indisponible");
  }
}

// ── Parse webhook callback ────────────────────────────────────────────────────
function parseCallback(method, payload) {
  let providerRef, success, amount, currency;

  switch (method) {
    case "orange_money":
      providerRef = payload.pay_token || payload.txnid;
      success     = payload.status === "SUCCESS" || payload.status === "60000";
      amount      = payload.amount;
      currency    = payload.currency;
      break;
    case "mtn_momo":
      providerRef = `MTN-${payload.externalId}`;
      success     = payload.status === "SUCCESSFUL";
      amount      = payload.amount;
      currency    = payload.currency;
      break;
    case "wave":
      providerRef = payload.id;
      success     = payload.payment_status === "succeeded";
      amount      = payload.amount;
      currency    = payload.currency;
      break;
    default:
      throw new Error(`Méthode callback inconnue: ${method}`);
  }

  // Montant fournisseur normalisé (entier XOF) quand présent
  const amountNum = amount != null && amount !== "" ? Math.round(Number(amount)) : null;
  return { providerRef, success, amount: Number.isFinite(amountNum) ? amountNum : null, currency: currency || null };
}

// ── Point d'entrée unifié ─────────────────────────────────────────────────────
async function initiate({ method, phone, amount, reference, description }) {
  switch (method) {
    case "orange_money": return initiateOrangeMoney({ phone, amount, reference, description });
    case "mtn_momo":     return initiateMtnMomo({ phone, amount, reference, description });
    case "wave":         return initiateWave({ phone, amount, reference, description });
    case "cash":         return { reference, status: "succes", checkout_url: null };
    default:             throw new Error(`Méthode non gérée: ${method}`);
  }
}

export const paymentService = { initiate, parseCallback, verifyCallback };
