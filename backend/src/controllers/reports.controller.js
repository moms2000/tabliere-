/**
 * Reports Controller — TablièreCI
 * Signalement de contenu (avis, chat) — conformité UGC Play Store / App Store.
 */
import { query }               from "../config/db.js";
import { created }             from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";

const TYPES = ["review", "chat", "message", "user"];

export const createReport = asyncHandler(async (req, res) => {
  const { type, target_id, reason } = req.body || {};
  if (!TYPES.includes(type))  throw new AppError("Type de signalement invalide", 400);
  if (!target_id)             throw new AppError("Contenu à signaler manquant", 400);

  await query(
    `INSERT INTO content_reports (type, target_id, reason, reporter_id)
     VALUES ($1, $2, $3, $4)`,
    [type, String(target_id).slice(0, 200), (reason || "").slice(0, 500), req.user?.id || null]
  );

  return created(res, { received: true }, "Signalement enregistré. Merci, notre équipe va l'examiner.");
});
