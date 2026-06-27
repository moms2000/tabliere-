import jwt   from "jsonwebtoken";
import { cache } from "../config/redis.js";
import { env } from "../config/env.js";
import { query } from "../config/db.js";
import { unauthorized, forbidden } from "../utils/response.js";

/**
 * Vérifie le JWT et attache req.user
 */
export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return unauthorized(res, "Token manquant");
    }

    const token = header.slice(7);
    // Vérifier si le token a été révoqué (logout)
    const revoked = await cache.get(`revoked:${token}`).catch(() => null);
    if (revoked) return unauthorized(res, "Session expirée, reconnectez-vous");

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      return unauthorized(res, "Token invalide ou expiré");
    }

    const { rows } = await query(
      "SELECT id, email, full_name, role, status, restaurant_id FROM users WHERE id = $1",
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return unauthorized(res, "Utilisateur introuvable");
    if (user.status === "suspendu") return forbidden(res, "Compte suspendu");

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Révoque un token (le met en blacklist Redis jusqu'à son expiration)
 */
export const revokeToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (decoded?.exp) {
      const ttl = decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) await cache.set(`revoked:${token}`, 1, ttl);
    }
  } catch { /* ignore */ }
};

/**
 * Vérifie que req.user a l'un des rôles listés
 */
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return forbidden(res, "Droits insuffisants");
  }
  next();
};
