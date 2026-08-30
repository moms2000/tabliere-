import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import client from "../config/redis.js";
import { logger } from "../utils/logger.js";
import { normalizePhone } from "../utils/phone.js";

// Store partagé Redis : les compteurs survivent aux redéploiements Render et sont
// cohérents en multi-instance (sinon les limites anti-brute-force sont remises à
// zéro à chaque restart / multipliées par le nombre d'instances). Repli mémoire
// si Redis indisponible — ne peut jamais empêcher le démarrage.
function makeStore(prefix) {
  try {
    if (!client) return undefined;
    return new RedisStore({ prefix, sendCommand: (...args) => client.call(...args) });
  } catch (e) {
    logger.warn("RateLimiter: store Redis indisponible, repli mémoire", { error: e?.message });
    return undefined;
  }
}

const limiter = (windowMs, max, message, prefix = "rl:", extra = {}) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    store: makeStore(prefix),
    message: { success: false, message },
    ...extra,
  });

// Auth : 10 tentatives / 15 min
export const authLimiter = limiter(15 * 60 * 1000, 10, "Trop de tentatives, réessayez dans 15 minutes", "rl:auth:");

// OTP : 5 envois / 15 min PAR NUMÉRO (en plus de authLimiter par IP) — anti-spam
// SMS/WhatsApp et anti-coût. Repli sur l'IP si le numéro est absent/illisible.
const otpKey = (req) => {
  const p = normalizePhone(req.body?.phone);
  return p ? `otp:${p}` : req.ip;
};
export const otpLimiter = limiter(
  15 * 60 * 1000, 5, "Trop de demandes de code, patientez quelques minutes.", "rl:otpsend:",
  { keyGenerator: otpKey, validate: { ip: false } }
);

// Réservations : 20 / 10 min
export const reservationLimiter = limiter(10 * 60 * 1000, 20, "Limite de réservations atteinte, réessayez dans 10 minutes", "rl:resa:");

// Commandes QR (route publique, sans auth) : limite PAR RESTAURANT, pas par IP.
// Les terminaux et les clients d'un même restaurant sortent souvent derrière une
// seule IP (Wi-Fi du resto, NAT opérateur) : les compter ensemble bridait à tort
// un service chargé. On clé donc sur restaurant_id. Repli sur l'IP si absent — un
// faux restaurant_id échoue de toute façon (FK NOT NULL vers restaurants), et le
// plafond global /api (200/min par IP) reste le filet anti-flood brut.
const orderKey = (req) => {
  const rid = req.body?.restaurant_id;
  return (typeof rid === "string" && rid.length >= 8) ? `resto:${rid}` : req.ip;
};
export const orderLimiter = limiter(
  5 * 60 * 1000, 120, "Trop de commandes envoyées, patientez quelques minutes", "rl:order:",
  { keyGenerator: orderKey, validate: { ip: false } }
);

// Vérification du code responsable (4 chiffres) : strict, anti-brute-force
export const pinLimiter = limiter(10 * 60 * 1000, 8, "Trop d'essais de code, réessayez dans 10 minutes", "rl:pin:");

// Diffusion push admin : envoi de masse, bruyant et irréversible. Même réservé aux
// admins, on plafonne (10/heure) pour limiter les dégâts d'un token admin volé ou
// d'une fausse manip. Repli sur l'IP (les admins sont peu nombreux).
export const broadcastLimiter = limiter(60 * 60 * 1000, 10, "Trop de diffusions, patientez avant d'en envoyer une autre.", "rl:broadcast:");

// Upload d'images (authentifié) : coûteux (base64 8 Mo + Cloudinary) → 20 / 5 min
export const uploadLimiter = limiter(5 * 60 * 1000, 20, "Trop d'envois d'images, patientez quelques minutes", "rl:upload:");

// Webhooks paiement (public) : 120 / min par IP — tolère les retries fournisseur
export const webhookLimiter = limiter(60 * 1000, 120, "Trop de requêtes webhook", "rl:wh:");

// API générale : 200 / min
export const apiLimiter = limiter(60 * 1000, 200, "Trop de requêtes, ralentissez", "rl:api:");
