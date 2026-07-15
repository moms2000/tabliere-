/**
 * Mode maintenance : quand `maintenance_mode = "true"` dans platform_settings,
 * le site public est fermé (503) sauf pour les administrateurs (qui doivent
 * pouvoir se connecter et désactiver la maintenance) et quelques routes vitales.
 * La valeur est mise en cache (10 s) pour éviter une lecture DB par requête.
 */
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { getSetting } from "../utils/platformSettings.js";

export async function isMaintenanceOn() {
  return (await getSetting("maintenance_mode", "false")) === "true";
}

// Toujours autorisé même en maintenance (connexion admin + statut + santé)
const ALLOW = new Set([
  "/api/v1/status",
  "/api/v1/auth/login", "/api/v1/auth/refresh", "/api/v1/auth/logout", "/api/v1/auth/me",
]);

export const maintenanceGuard = async (req, res, next) => {
  if (!(await isMaintenanceOn())) return next();

  const path = req.path;
  // Routes vitales + espace admin (déjà protégé par authorize('admin'))
  if (ALLOW.has(path) || path.startsWith("/api/v1/admin")) return next();

  // Un administrateur authentifié garde un accès complet
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) {
    try { if (jwt.verify(h.slice(7), env.JWT_SECRET)?.role === "admin") return next(); } catch { /* token invalide → bloqué */ }
  }

  return res.status(503).json({
    success: false, code: "MAINTENANCE",
    message: "Le site est en maintenance. Merci de revenir dans quelques instants.",
  });
};
