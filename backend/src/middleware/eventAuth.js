/**
 * Auth Événements — accès aux opérations (commandes bouteilles, check-in) par :
 *  - l'organisateur PROPRIÉTAIRE de l'événement (token utilisateur), ou
 *  - un STAFF de l'événement (token staff émis via PIN).
 * Pose req.eventScope = id de l'événement autorisé.
 */
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { query } from "../config/db.js";
import { unauth, forbidden } from "../utils/response.js";

export function signStaffToken(staff) {
  return jwt.sign(
    { typ: "staff", staff_id: staff.id, event_id: staff.event_id, role: staff.role, name: staff.name },
    env.JWT_SECRET,
    { expiresIn: "24h" }
  );
}

const bearer = (req) => {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
};

export const ownerOrStaff = async (req, res, next) => {
  const token = bearer(req);
  if (!token) return unauth(res, "Authentification requise");
  let decoded;
  try { decoded = jwt.verify(token, env.JWT_SECRET); }
  catch { return unauth(res, "Session invalide ou expirée"); }

  // Staff : périmètre = événement du token
  if (decoded.typ === "staff") {
    req.staff = decoded;
    req.eventScope = decoded.event_id;
    return next();
  }

  // Sinon token utilisateur → organisateur propriétaire (ou admin)
  const { rows: [u] } = await query("SELECT id, role FROM users WHERE id = $1", [decoded.id]);
  if (!u) return unauth(res, "Session invalide");
  req.user = u;
  // event_id vient de la query ou du body (jamais de :id qui peut être une commande/résa)
  const eventId = req.query.event_id || req.body?.event_id;
  if (!eventId) return forbidden(res, "Événement non précisé");
  if (u.role === "admin") { req.eventScope = eventId; return next(); }
  const { rows: [e] } = await query("SELECT owner_id FROM events WHERE id = $1", [eventId]);
  if (!e || e.owner_id !== u.id) return forbidden(res, "Accès refusé");
  req.eventScope = eventId;
  return next();
};
