import crypto from "crypto";
import { query } from "../config/db.js";

// Authentification par CLÉ API (intégration caisse). La clé arrive dans l'en-tête
// `X-Api-Key` ou `Authorization: Bearer <clé>`. On ne stocke QUE son hash → une
// fuite de la base ne révèle aucune clé utilisable. Scope strict à UN restaurant.
export const apiKeyAuth = async (req, res, next) => {
  try {
    const raw = req.headers["x-api-key"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!raw) return res.status(401).json({ success: false, message: "Clé API manquante" });
    const hash = crypto.createHash("sha256").update(String(raw)).digest("hex");
    const { rows: [row] } = await query(
      "SELECT restaurant_id FROM restaurant_integrations WHERE api_key_hash = $1 AND is_active = TRUE", [hash]);
    if (!row) return res.status(401).json({ success: false, message: "Clé API invalide ou révoquée" });
    req.integrationResto = row.restaurant_id;
    query("UPDATE restaurant_integrations SET last_used_at = NOW() WHERE restaurant_id = $1", [row.restaurant_id]).catch(() => {});
    next();
  } catch (e) {
    return res.status(500).json({ success: false, message: "Erreur d'authentification" });
  }
};
