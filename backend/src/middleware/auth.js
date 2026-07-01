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
    const decoded = jwt.verify(token, env.jwt.secret);

    // Cache user pour éviter une requête DB à chaque requête
    let user = await cache.get(`user:${decoded.id}`).catch(() => null);

    if (!user) {
      const { rows } = await query(
        "SELECT id, email, role, status, restaurant_id FROM users WHERE id = $1",
        [decoded.id]
      );
      if (!rows[0]) return unauth(res, "Utilisateur introuvable");
      user = rows[0];
      await cache.set(`user:${decoded.id}`, user, 300).catch(() => {});
    }

    if (user.status === "suspendu") return forbidden(res, "Compte suspendu");

    req.user  = user;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return unauth(res, "Token invalide ou expiré");
    }
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

// Compatibilité — ces fonctions sont aussi dans auth.controller.js (inline)
export const generateTokens = (userId, role) => {
  const jwt_module = jwt;
  const access = jwt_module.sign({ id: userId, role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
  const refresh = jwt_module.sign({ id: userId, role, type: "refresh" }, env.jwt.secret, { expiresIn: env.jwt.refreshExpires });
  return { access, refresh };
};

export const revokeToken = async (_token) => {
  // No-op simplifié — tokens expireront naturellement
};
