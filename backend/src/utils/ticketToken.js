/**
 * Jeton anti-énumération pour l'e-billet public (/billet/:ref).
 * Les réfs (EVT-1000, EVT-1001…) sont séquentielles donc devinables : sans jeton,
 * n'importe qui pourrait lister les billets confirmés (nom + événement + table).
 * Le jeton est dérivé de la réf + JWT_SECRET (aucune colonne en base). Il est
 * inclus dans les liens email/WhatsApp et exigé pour dévoiler le billet.
 */
import crypto from "crypto";
import { env } from "../config/env.js";

export function ticketToken(ref) {
  return crypto.createHmac("sha256", env.JWT_SECRET).update("ticket:" + String(ref)).digest("hex").slice(0, 20);
}

export function verifyTicketToken(ref, token) {
  const expected = ticketToken(ref);
  const t = String(token || "");
  if (t.length !== expected.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(t), Buffer.from(expected)); }
  catch { return false; }
}
