/**
 * WhatsApp Business API Service — TablièreCI
 * Envoi de messages de notification via l'API officielle Meta.
 *
 * Les templates doivent être pré-approuvés dans le Business Manager Meta.
 * En mode sandbox (WHATSAPP_TOKEN vide), on log les messages sans les envoyer.
 */

import axios  from "axios";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const BASE_URL = `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_ID}/messages`;

async function send(to, templateName, components = []) {
  const phone = to.replace(/[^\d]/g, ""); // normaliser : +225 07 ... → 22507...

  if (!env.WHATSAPP_TOKEN) {
    // Mode dev : log uniquement
    logger.info(`[WhatsApp MOCK] → ${phone} | template: ${templateName}`, { components });
    return { messageId: `mock-${Date.now()}` };
  }

  try {
    const { data } = await axios.post(
      BASE_URL,
      {
        messaging_product: "whatsapp",
        to:                phone,
        type:              "template",
        template: {
          name:     templateName,
          language: { code: "fr" },
          components,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const messageId = data.messages?.[0]?.id;
    logger.info("[WhatsApp] Message envoyé", { phone, templateName, messageId });
    return { messageId };
  } catch (err) {
    logger.error("[WhatsApp] Erreur envoi", {
      phone,
      templateName,
      error: err.response?.data || err.message,
    });
    throw err;
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────

/**
 * Confirmation de réservation au client (juste après création)
 * Template: tabliereci_resa_confirmation
 * Params: {{1}} prénom | {{2}} resto | {{3}} date | {{4}} couverts | {{5}} réf
 */
async function sendReservationConfirmation({ phone, name, restoName, reservedAt, partySize, ref }) {
  const date = new Date(reservedAt).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  return send(phone, "tabliereci_resa_confirmation", [
    {
      type: "body",
      parameters: [
        { type: "text", text: name.split(" ")[0] },
        { type: "text", text: restoName },
        { type: "text", text: date },
        { type: "text", text: String(partySize) },
        { type: "text", text: ref },
      ],
    },
  ]);
}

/**
 * Confirmation côté restaurant (restaurateur confirme la résa)
 * Template: tabliereci_resa_confirmed
 * Params: {{1}} prénom | {{2}} resto | {{3}} date | {{4}} réf
 */
async function sendConfirmedByResto({ phone, name, restoName, reservedAt, partySize, ref }) {
  const date = new Date(reservedAt).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  return send(phone, "tabliereci_resa_confirmed", [
    {
      type: "body",
      parameters: [
        { type: "text", text: name.split(" ")[0] },
        { type: "text", text: restoName },
        { type: "text", text: date },
        { type: "text", text: ref },
      ],
    },
  ]);
}

/**
 * Rappel automatique J-1
 * Template: tabliereci_resa_rappel
 */
async function sendReminder({ phone, name, restoName, reservedAt, ref }) {
  const date = new Date(reservedAt).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  return send(phone, "tabliereci_resa_rappel", [
    {
      type: "body",
      parameters: [
        { type: "text", text: name.split(" ")[0] },
        { type: "text", text: restoName },
        { type: "text", text: date },
        { type: "text", text: ref },
      ],
    },
  ]);
}

/**
 * Confirmation paiement réussi
 * Template: tabliereci_payment_success
 * Params: {{1}} prénom | {{2}} montant | {{3}} méthode
 */
async function sendPaymentSuccess({ phone, name, amount, method }) {
  const methodLabel = {
    orange_money: "Orange Money",
    mtn_momo:     "MTN MoMo",
    wave:         "Wave",
    carte:        "Carte bancaire",
    cash:         "Espèces",
  }[method] || method;

  return send(phone, "tabliereci_payment_success", [
    {
      type: "body",
      parameters: [
        { type: "text", text: name.split(" ")[0] },
        { type: "text", text: `${amount.toLocaleString("fr-CI")} F CFA` },
        { type: "text", text: methodLabel },
      ],
    },
  ]);
}

// ── Message texte libre (hors template) ─────────────────────────────────────
// Fonctionne dans la fenêtre de session 24h (message client-initié) OU en mock.
// Pour un envoi business-initié fiable, un template approuvé reste requis — d'où
// le fallback lien wa.me côté organisateur. Échoue silencieusement sinon.
async function sendText(to, body) {
  const phone = String(to || "").replace(/[^\d]/g, "");
  if (!phone) return { skipped: true };
  if (!env.WHATSAPP_TOKEN) {
    logger.info(`[WhatsApp MOCK] → ${phone} | texte`, { body: String(body).slice(0, 120) });
    return { messageId: `mock-${Date.now()}` };
  }
  try {
    const { data } = await axios.post(
      BASE_URL,
      { messaging_product: "whatsapp", to: phone, type: "text", text: { body: String(body).slice(0, 4096) } },
      { headers: { Authorization: `Bearer ${env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" } }
    );
    return { messageId: data.messages?.[0]?.id };
  } catch (err) {
    logger.warn("[WhatsApp] Échec texte libre (template requis hors session 24h ?)", { phone, error: err.response?.data?.error?.message || err.message });
    return { failed: true };
  }
}

export const whatsappService = {
  sendReservationConfirmation,
  sendConfirmedByResto,
  sendReminder,
  sendPaymentSuccess,
  sendText,
};
