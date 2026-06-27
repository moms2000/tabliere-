import rateLimit from "express-rate-limit";

const limiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    message: { success: false, message },
  });

// Auth : 10 tentatives / 15 min
export const authLimiter = limiter(15 * 60 * 1000, 10, "Trop de tentatives, réessayez dans 15 minutes");

// Réservations : 20 / 10 min
export const reservationLimiter = limiter(10 * 60 * 1000, 20, "Limite de réservations atteinte, réessayez dans 10 minutes");

// API générale : 200 / min
export const apiLimiter = limiter(60 * 1000, 200, "Trop de requêtes, ralentissez");
