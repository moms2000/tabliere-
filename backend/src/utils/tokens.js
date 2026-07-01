/**
 * Génération et révocation de tokens JWT
 * Séparé de auth.middleware pour éviter les dépendances circulaires
 */
import jwt   from "jsonwebtoken";
import { env }   from "../config/env.js";
import { cache } from "../config/redis.js";

export const generateTokens = (userId, role) => {
  const access = jwt.sign(
    { id: userId, role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
  const refresh = jwt.sign(
    { id: userId, role, type: "refresh" },
    env.jwt.secret,
    { expiresIn: env.jwt.refreshExpires }
  );
  return { access, refresh };
};

export const revokeToken = async (token) => {
  if (!token) return;
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.exp) return;
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await cache.set(`blacklist:${token}`, "1", ttl);
  } catch (_) {}
};
