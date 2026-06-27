/**
 * QR Code Service — TablièreCI
 * ─────────────────────────────
 * Génère des QR codes pour les menus de restaurants.
 * Le QR pointe vers /menu/:slug — accessible sans authentification.
 */

import QRCode    from "qrcode";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

/**
 * Génère un QR code en base64 PNG pour le menu d'un restaurant.
 * @param {string} slug - Identifiant unique du restaurant
 * @param {object} theme - { primary, secondary, background } couleurs hex
 * @returns {Promise<{ dataUrl: string, url: string }>}
 */
export async function generateMenuQR(slug, theme = {}) {
  const menuUrl = `${config.APP_URL}/menu/${slug}`;

  const {
    primary    = "#1D9E75",
    secondary  = "#0F6E56",
    background = "#FFFFFF",
  } = theme;

  const dataUrl = await QRCode.toDataURL(menuUrl, {
    errorCorrectionLevel: "M",
    type:    "image/png",
    margin:  2,
    width:   400,
    color: {
      dark:  primary,
      light: background,
    },
  });

  logger.info("[QR] Code généré", { slug, menuUrl });
  return { dataUrl, url: menuUrl };
}

/**
 * Génère un QR code en SVG (pour l'impression haute qualité)
 */
export async function generateMenuQRSvg(slug, theme = {}) {
  const menuUrl = `${config.APP_URL}/menu/${slug}`;
  const { primary = "#1D9E75", background = "#FFFFFF" } = theme;

  const svg = await QRCode.toString(menuUrl, {
    type:  "svg",
    color: { dark: primary, light: background },
    margin: 2,
    width:  300,
  });

  return { svg, url: menuUrl };
}

export const qrService = { generateMenuQR, generateMenuQRSvg };
