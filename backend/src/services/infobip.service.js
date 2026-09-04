/**
 * Infobip — envoi d'OTP par WhatsApp (TablièreCI)
 *
 * Ce service ne fait que LIVRER un code déjà généré/haché/vérifié côté serveur
 * (voir otpAuth.controller.js). Aucune génération ni vérification de code ici :
 * toute la sécurité (code haché bcrypt, TTL, essais limités, anti-énumération)
 * reste dans le contrôleur, indépendamment du fournisseur.
 *
 * Configuration (variables d'environnement, jamais commitées) :
 *   INFOBIP_BASE_URL     https://xxxxx.api.infobip.com  (propre au compte)
 *   INFOBIP_API_KEY      clé API secrète
 *   INFOBIP_WA_SENDER    numéro WhatsApp expéditeur enregistré sur Infobip
 *   INFOBIP_OTP_TEMPLATE nom du template d'authentification approuvé
 *   INFOBIP_WA_LANG      langue du template (défaut "fr")
 *   INFOBIP_OTP_BUTTON   "true" si le template a un bouton « copier le code »
 */

import axios from "axios";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Infobip est « configuré » seulement si les 3 éléments indispensables sont là.
export function isInfobipConfigured() {
  return Boolean(env.INFOBIP_BASE_URL && env.INFOBIP_API_KEY && env.INFOBIP_WA_SENDER);
}

// Normalise la base URL : force https://, retire un éventuel slash final.
function baseUrl() {
  let u = String(env.INFOBIP_BASE_URL || "").trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

/**
 * Envoie le code OTP via un template WhatsApp d'authentification Infobip.
 * Renvoie { messageId } en cas de succès, { failed: true } sinon.
 * N'exception JAMAIS vers l'appelant (le flux OTP ne doit pas casser sur un
 * incident fournisseur) — l'échec est journalisé et remonté comme { failed }.
 */
export async function sendOtpWhatsApp(to, code) {
  const phone = String(to || "").replace(/[^\d]/g, "");
  if (!phone) return { skipped: true };

  const withButton = String(env.INFOBIP_OTP_BUTTON ?? "true").toLowerCase() !== "false";
  const templateData = { body: { placeholders: [String(code)] } };
  // Les templates WhatsApp d'authentification ont un bouton « copier le code »
  // dont le paramètre est le code lui-même. Désactivable si le template n'en a pas.
  if (withButton) {
    templateData.buttons = [{ type: "URL", parameter: String(code) }];
  }

  try {
    const { data } = await axios.post(
      `${baseUrl()}/whatsapp/1/message/template`,
      {
        messages: [
          {
            from: String(env.INFOBIP_WA_SENDER).replace(/[^\d]/g, ""),
            to: phone,
            content: {
              templateName: env.INFOBIP_OTP_TEMPLATE,
              templateData,
              language: env.INFOBIP_WA_LANG || "fr",
            },
          },
        ],
      },
      {
        headers: {
          Authorization: `App ${env.INFOBIP_API_KEY}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 12_000,
      }
    );

    const msg = data?.messages?.[0];
    const messageId = msg?.messageId;
    const status = msg?.status?.name || msg?.status?.groupName;
    logger.info("[Infobip][OTP] envoyé", { phone, messageId, status });
    return { messageId };
  } catch (err) {
    // On ne loggue jamais le code ni la clé API. Seul le message d'erreur Infobip.
    logger.warn("[Infobip][OTP] échec envoi", {
      phone,
      error: err.response?.data?.requestError?.serviceException?.text
        || err.response?.data
        || err.message,
    });
    return { failed: true };
  }
}

export const infobipService = { isInfobipConfigured, sendOtpWhatsApp };
