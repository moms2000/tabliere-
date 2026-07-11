import api from "./api.js";

/**
 * Compresse/redimensionne une image côté client avant l'upload
 * (limite la taille envoyée au serveur → uploads rapides et légers).
 * @param {File} file
 * @param {number} maxSize  dimension max (px) du plus grand côté
 * @param {number} quality  qualité JPEG (0-1)
 * @returns {Promise<string>} data URI JPEG
 */
export function compressImage(file, maxSize = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
        else if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Téléverse une image vers Cloudinary (via le backend) et renvoie l'URL sécurisée.
 * @param {File} file
 * @param {'menu'|'restaurant'|'avatar'|'event'} type
 * @returns {Promise<{url:string, public_id:string}>}
 */
export async function uploadImage(file, type = "menu") {
  const dataUri = await compressImage(file);
  const res = await api.post("/upload", { file: dataUri, type });
  return res.data?.data || {};
}
