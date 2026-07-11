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
  if (!/^data:image\//.test(file) && !/^https?:\/\//.test(file)) {
    throw new AppError("Format d'image invalide", 400);
  }

  const folder = FOLDERS[type] || "tabliereci/misc";
  const { url, public_id } = await uploadImage(file, { folder });
  return ok(res, { url, public_id }, "Image téléversée");
});
