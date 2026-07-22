import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { cache } from "../config/redis.js";
import { query } from "../config/db.js";
import { unauth, forbidden } from "../utils/response.js";

// Jeton d'un membre du staff restaurant (login_id + PIN). Il agit comme le
// restaurateur PROPRIÉTAIRE (mêmes données du resto), mais ses onglets sont
// restreints côté interface via ses permissions.
export function signRestaurantStaffToken(staff) {
  return jwt.sign(
    { typ: "resto_staff", staff_id: staff.id, restaurant_id: staff.restaurant_id },
    env.JWT_SECRET,
    { expiresIn: "12h" }
  );
}

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

    // ── Token staff restaurant ──────────────────────────────────────────────
    // Le staff agit comme l'owner (req.user.id = owner_id → pas de souci de FK),
    // scopé à son restaurant, avec ses permissions d'onglets.
    if (decoded.typ === "resto_staff") {
      const { rows: [s] } = await query(
        `SELECT rs.id, rs.restaurant_id, rs.name, rs.permissions, rs.is_active, r.owner_id, r.status AS resto_status
         FROM restaurant_staff rs JOIN restaurants r ON r.id = rs.restaurant_id
         WHERE rs.id = $1`, [decoded.staff_id]);
      if (!s || s.is_active === false) return unauth(res, "Accès staff révoqué");
      if (["suspendu", "bloque"].includes(s.resto_status)) return forbidden(res, "Restaurant suspendu");
      req.user = {
        id: s.owner_id, role: "restaurateur", restaurant_id: s.restaurant_id,
        is_staff: true, staff_id: s.id, staff_name: s.name,
        staff_permissions: Array.isArray(s.permissions) ? s.permissions : [],
      };
      req.token = token;
      return next();
    }

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

// Interdit l'accès à un membre du staff (routes du compte personnel du propriétaire).
export const denyStaff = (req, res, next) => {
  if (req.user?.is_staff) return forbidden(res, "Action réservée au titulaire du compte.");
  next();
};

// Restreint un endpoint aux membres du staff qui ont l'un des onglets requis.
// Le propriétaire et l'admin ne sont jamais restreints (accès complet à leur resto).
// C'est l'application SERVEUR des permissions d'onglets (pas seulement l'affichage).
export const requireTab = (...tabs) => (req, res, next) => {
  if (!req.user?.is_staff) return next();
  const perms = Array.isArray(req.user.staff_permissions) ? req.user.staff_permissions : [];
  if (tabs.some(t => perms.includes(t))) return next();
  return forbidden(res, "Cet accès n'est pas autorisé pour ce membre du staff.");
};

// Révoquer un token (logout)
export const revokeToken = async (token) => {
  const decoded = jwt.decode(token);
  if (!decoded?.exp) return;
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) await cache.set(`blacklist:${token}`, "1", ttl).catch(() => {});
};
