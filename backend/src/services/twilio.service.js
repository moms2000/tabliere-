/**
 * Twilio — envoi WhatsApp (TablièreCI)
 *
 * Fournisseur WhatsApp basé sur l'API REST Twilio (Programmable Messaging).
 * Comme Infobip, ce service ne fait que LIVRER un message : toute la sécurité
 * OTP (génération, hachage bcrypt, TTL, essais limités, anti-énumération) reste
 * dans otpAuth.controller.js, indépendamment du fournisseur.
 *
 * Deux modes d'envoi WhatsApp chez Twilio :
 *   1) Texte libre  (Body) — fonctionne dans le Sandbox et dans la fenêtre de
 *      session 24h ouverte par le client. Idéal pour TESTER tout de suite.
 *   2) Template      (ContentSid + ContentVariables) — requis pour un message
 *      business-initié en PRODUCTION (OTP, confirmations). Le template doit être
 *      créé dans Twilio et approuvé par Meta.
 *
 * Configuration (variables d'environnement, jamais commitées) :
 *   TWILIO_ACCOUNT_SID     identifiant du compte (AC...)
 *   TWILIO_AUTH_TOKEN      jeton secret du compte
 *   TWILIO_WA_FROM         expéditeur WhatsApp, ex "whatsapp:+14155238886"
 *                          (numéro Sandbox) ou "whatsapp:+2250700000000" (prod)
 *   TWILIO_OTP_CONTENT_SID (option, prod) ContentSid du template OTP approuvé.
 *                          Si absent → OTP envoyé en texte libre (Sandbox/test).
 */

import axios from "axios";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Twilio est « configuré » seulement si les 3 éléments indispensables sont là.
export function isTwilioConfigured() {
  return Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WA_FROM);
}

// Normalise un numéro en adresse WhatsApp Twilio : "whatsapp:+<E164>".
// Accepte déjà "whatsapp:...", un "+225..." ou des chiffres bruts.
function waAddress(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (s.toLowerCase().startsWith("whatsapp:")) return "whatsapp:" + s.slice(9).replace(/[^\d+]/g, "");
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return "";
  return "whatsapp:+" + digits;
}

function endpoint() {
  return `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
}

// Envoi bas niveau. `payload` = champs supplémentaires (Body OU ContentSid/…)
// L'API Twilio est en x-www-form-urlencoded, auth Basic (AccountSid:AuthToken).
async function post(to, payload) {
  const toAddr = waAddress(to);
  if (!toAddr) return { skipped: true };

  const form = new URLSearchParams({
    From: waAddress(env.TWILIO_WA_FROM),
    To: toAddr,
    ...payload,
  });

  try {
    const { data } = await axios.post(endpoint(), form.toString(), {
      auth: { username: env.TWILIO_ACCOUNT_SID, password: env.TWILIO_AUTH_TOKEN },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 12_000,
    });
    return { messageId: data?.sid, status: data?.status };
  } catch (err) {
    // On ne loggue jamais le code, le token ni l'auth. Seul le message Twilio.
    logger.warn("[Twilio][WA] échec envoi", {
      to: toAddr,
      code: err.response?.data?.code,
      error: err.response?.data?.message || err.message,
    });
    return { failed: true };
  }
}

/** Message WhatsApp en texte libre (Sandbox / fenêtre de session 24h). */
export async function sendWhatsAppText(to, body) {
  const text = String(body || "").slice(0, 1600);
  if (!text) return { skipped: true };
  const res = await post(to, { Body: text });
  if (res.messageId) logger.info("[Twilio][WA] texte envoyé", { messageId: res.messageId, status: res.status });
  return res;
}

/**
 * Message WhatsApp via template approuvé.
 * @param contentSid ContentSid du template (HX...)
 * @param variables  objet { "1": "...", "2": "..." } → JSON ContentVariables
 */
export async function sendWhatsAppTemplate(to, contentSid, variables = {}) {
  if (!contentSid) return { failed: true };
  const payload = { ContentSid: contentSid };
  if (variables && Object.keys(variables).length) {
    payload.ContentVariables = JSON.stringify(variables);
  }
  const res = await post(to, payload);
  if (res.messageId) logger.info("[Twilio][WA] template envoyé", { contentSid, messageId: res.messageId, status: res.status });
  return res;
}

/**
 * Envoie le code OTP par WhatsApp.
 * Prod : template d'authentification (TWILIO_OTP_CONTENT_SID) — code en {{1}}.
 * Test/Sandbox : pas de template → texte libre lisible.
 * Ne lève JAMAIS : le flux OTP ne doit pas casser sur un incident fournisseur.
 */
export async function sendOtpWhatsApp(to, code) {
  const c = String(code);
  if (env.TWILIO_OTP_CONTENT_SID) {
    return sendWhatsAppTemplate(to, env.TWILIO_OTP_CONTENT_SID, { 1: c });
  }
  return sendWhatsAppText(
    to,
    `Votre code de vérification TablièreCI est : ${c}\nIl expire dans 5 minutes. Ne le partagez avec personne.`
  );
}

export const twilioService = {
  isTwilioConfigured,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  sendOtpWhatsApp,
};
