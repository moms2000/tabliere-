/**
 * Lecture mise en cache des réglages plateforme (table platform_settings).
 * Évite une requête par appel ; invalidé immédiatement quand l'admin sauvegarde.
 */
import { query } from "../config/db.js";

let cache = {};
let at = 0;
const TTL = 10000;

export async function refreshSettings() {
  try {
    const { rows } = await query("SELECT key, value FROM platform_settings");
    const next = {};
    rows.forEach(r => { next[r.key] = r.value; });
    cache = next; at = Date.now();
  } catch { at = Date.now(); } // en cas d'erreur DB, on garde la dernière valeur connue
}

export async function getSetting(key, def = null) {
  if (Date.now() - at > TTL) await refreshSettings();
  return key in cache ? cache[key] : def;
}

export function bustSettingsCache() { at = 0; }
