/**
 * Service d'upload d'images — Cloudinary
 * Socle réutilisable : menu, avatars, photos restaurant, Instants (stories), events.
 * La clé secrète reste dans la variable d'env CLOUDINARY_URL (jamais dans le code).
 */
import { v2 as cloudinary } from "cloudinary";
import { logger } from "../utils/logger.js";

// Le SDK lit automatiquement CLOUDINARY_URL (cloudinary://key:secret@cloud).
const CONFIGURED = !!process.env.CLOUDINARY_URL;
if (CONFIGURED) {
  cloudinary.config({ secure: true });
  logger.info("[Upload] Cloudinary configuré");
} else {
  logger.warn("[Upload] CLOUDINARY_URL absent — upload d'images désactivé");
}

export const cloudinaryEnabled = () => CONFIGURED;

/**
 * Téléverse une image vers Cloudinary.
 * @param {string} file  data URI base64 (data:image/...;base64,...) ou URL distante
 * @param {object} opts  { folder, moderation, tags, context }
 * @returns {Promise<{url:string, public_id:string, moderation?:any}>}
 */
export async function uploadImage(file, { folder = "tabliereci/misc", moderation, tags, context } = {}) {
  if (!CONFIGURED) throw new Error("Cloudinary non configuré");
  const options = {
    folder,
    resource_type: "image",
    overwrite: false,
    unique_filename: true,
    // Cloudinary REJETTE tout ce qui n'est pas réellement décodable dans ces
    // formats → bloque un SVG/HTML/JS déguisé en "data:image/png" (XSS stocké).
    allowed_formats: ["png", "jpg", "jpeg", "webp", "gif", "avif"],
  };
  if (moderation) options.moderation = moderation; // ex: "aws_rek" (Instants)
  if (tags)       options.tags = tags;
  if (context)    options.context = context;

  const res = await cloudinary.uploader.upload(file, options);
  return {
    url:        res.secure_url,
    public_id:  res.public_id,
    moderation: res.moderation, // statut de modération si demandée
  };
}

/** Supprime une image de Cloudinary (best-effort). */
export async function deleteImage(publicId) {
  if (!CONFIGURED || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch (e) {
    logger.warn("[Upload] suppression Cloudinary échouée", { publicId, error: e.message });
  }
}

export { cloudinary };
