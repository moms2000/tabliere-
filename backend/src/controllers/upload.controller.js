/**
 * Upload Controller — téléversement d'images vers Cloudinary.
 */
import { uploadImage, cloudinaryEnabled } from "../services/upload.service.js";
import { ok } from "../utils/response.js";
import { asyncHandler, AppError } from "../middleware/errorHandler.js";

// Dossiers autorisés par type (rangement propre dans Cloudinary)
const FOLDERS = {
  menu:       "tabliereci/menu",
  avatar:     "tabliereci/avatars",
  restaurant: "tabliereci/restaurants",
  event:      "tabliereci/events",
};

export const uploadOne = asyncHandler(async (req, res) => {
  if (!cloudinaryEnabled()) throw new AppError("Stockage d'images non configuré", 503);

  const { file, type } = req.body || {};
  if (!file || typeof file !== "string") throw new AppError("Image manquante", 400);
  // Anti-SSRF : on n'accepte QUE des images en base64 (data URI). On refuse les
  // URLs distantes, qui feraient de Cloudinary un proxy de récupération arbitraire.
  if (!/^data:image\/(png|jpe?g|webp|gif|avif);base64,/.test(file)) {
    throw new AppError("Format d'image invalide (image encodée requise)", 400);
  }
  if (file.length > 11_000_000) throw new AppError("Image trop volumineuse (max ~8 Mo)", 413);

  const folder = FOLDERS[type] || "tabliereci/misc";
  const { url, public_id } = await uploadImage(file, { folder });
  return ok(res, { url, public_id }, "Image téléversée");
});
