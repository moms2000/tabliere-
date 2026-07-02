import { logger } from "../utils/logger.js";

// Classe d'erreur applicative avec statusCode
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.expose = true;
  }
}

// Wrapper async pour éviter les try/catch dans chaque controller
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  const httpStatus = err.statusCode || err.status ||
    (err.code === "23505" ? 409 : err.code === "23503" ? 400 : 500);

  // Ne logger en ERROR que les vraies erreurs serveur (5xx).
  // Les erreurs client (4xx : validation, auth, not found) sont des
  // événements normaux → log léger en "warn", sans stack trace.
  if (httpStatus >= 500) {
    logger.error("Erreur serveur", {
      message: err.message,
      stack:   err.stack,
      url:     req.originalUrl,
      method:  req.method,
      userId:  req.user?.id,
    });
  } else {
    logger.warn("Requête rejetée", {
      message: err.message,
      status:  httpStatus,
      url:     req.originalUrl,
    });
  }

  // Erreurs PostgreSQL connues
  if (err.code === "23505") {
    // Détecter quelle colonne cause le doublon
    const detail = err.detail || "";
    let msg = "Cette valeur existe déjà.";
    if (detail.includes("email"))  msg = "Cette adresse e-mail est déjà associée à un compte.";
    if (detail.includes("phone"))  msg = "Ce numéro de téléphone est déjà associé à un compte. Utilisez un autre numéro ou laissez ce champ vide.";
    if (detail.includes("slug"))   msg = "Ce nom de restaurant est déjà pris.";
    if (detail.includes("label"))  msg = "Ce label existe déjà pour ce restaurant.";
    return res.status(409).json({ success: false, message: msg });
  }
  if (err.code === "23503") {
    return res.status(400).json({
      success: false,
      message: "Référence invalide (clé étrangère)",
    });
  }

  const status  = err.statusCode || err.status || 500;
  const message = err.expose ? err.message : "Erreur serveur interne";

  res.status(status).json({ success: false, message });
};
