import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { cache } from "../config/redis.js";
import { query } from "../config/db.js";
import { unauth, forbidden } from "../utils/response.js";

// Vérifie le token JWT et charge l'utilisateur
export const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) return unauth(res, "Token manquant");

    const token = header.split(" ")[1];

    // Vérifier si le token est révoqué (blacklist Redis)
    const revoked = await cache.get(`blacklist:${token}`).catch(() => null);
    if (revoked) return unauth(res, "Token révoqué");

    const decoded = jwt.verify(token, env.JWT_SECRET);
    // Un refresh token ne doit jamais authentifier une requête API (il ne sert
    // qu'à /auth/refresh). Anti-usage détourné du jeton de rafraîchissement.
    if (decoded.type === "refresh") return unauth(res, "Token invalide");

    // Cache user pour éviter une requête DB à chaque requête
    const cacheKey = `user:${decoded.id}`;
    let user = await cache.get(cacheKey).catch(() => null);

    if (!user) {
      const { rows } = await query(
        "SELECT id, email, role, status, restaurant_id FROM users WHERE id = $1",
        [decoded.id]
      );
      if (!rows[0]) return unauth(res, "Utilisateur introuvable");
      user = rows[0];
      await cache.set(cacheKey, user, 300).catch(() => {}); // cache 5 minutes
    }

    if (["suspendu", "bloque"].includes(user.status)) return forbidden(res, "Compte suspendu");

    req.user  = user;
    req.token = token;
    next();
  } catch (err) {
    // Token expiré / invalide = événement NORMAL (le frontend rafraîchit).
    // On renvoie un 401 propre sans remonter au gestionnaire d'erreurs
    // (évite de polluer les logs avec des "erreurs" qui n'en sont pas).
    if (err.name === "TokenExpiredError") return unauth(res, "Token expiré");
    if (err.name === "JsonWebTokenError") return unauth(res, "Token invalide");
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

// Révoquer un token (logout)
export const revokeToken = async (token) => {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return;
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) await cache.set(`blacklist:${token}`, "1", ttl).catch(() => {});
};
