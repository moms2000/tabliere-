import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { cache } from "../config/redis.js";
import { query } from "../config/db.js";
import { unauth, forbidden } from "../utils/response.js";
import { generateTokens, revokeToken } from "../utils/tokens.js";

export { generateTokens, revokeToken }; // ré-exporter pour compatibilité

// Vérifie le token JWT et charge l'utilisateur
export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return unauth(res, "Token manquant");

    const token = header.split(" ")[1];

    // Vérifier si le token est révoqué (blacklist Redis)
    const revoked = await cache.get(`blacklist:${token}`);
    if (revoked) return unauth(res, "Token révoqué");

    const decoded = jwt.verify(token, env.jwt.secret);

    // Cache user pour éviter une requête DB à chaque requête
    const cacheKey = `user:${decoded.id}`;
    let user = await cache.get(cacheKey);

    if (!user) {
      const { rows } = await query(
        "SELECT id, email, role, status, restaurant_id FROM users WHERE id = $1",
        [decoded.id]
      );
      if (!rows[0]) return unauth(res, "Utilisateur introuvable");
      user = rows[0];
      await cache.set(cacheKey, user, 300); // cache 5 minutes
    }

    if (user.status === "suspendu") return forbidden(res, "Compte suspendu");

    req.user  = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
};

// Middleware de rôle
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return forbidden(res, `Accès réservé aux rôles : ${roles.join(", ")}`);
  }
  next();
};

// generateTokens et revokeToken sont dans utils/tokens.js
// et ré-exportés au début de ce fichier
