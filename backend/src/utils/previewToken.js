/**
 * Jeton de PRÉVISUALISATION privée d'une page restaurant.
 * Permet au propriétaire de voir sa page (et son menu) exactement comme le
 * public, même « en préparation » (non publiée). Signé, lié au slug, courte
 * durée. Ne donne accès qu'à des données déjà destinées au public.
 */
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signPreviewToken(slug) {
  return jwt.sign({ typ: "resto_preview", slug }, env.JWT_SECRET, { expiresIn: "12h" });
}

export function verifyPreviewToken(token, slug) {
  try {
    const d = jwt.verify(token, env.JWT_SECRET);
    return d.typ === "resto_preview" && d.slug === slug;
  } catch { return false; }
}
