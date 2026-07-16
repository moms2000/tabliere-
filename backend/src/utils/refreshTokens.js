/**
 * Refresh tokens — rotation + révocation + détection de réutilisation.
 *
 * Modèle : chaque refresh token correspond à UNE ligne `refresh_tokens`. À chaque
 * rafraîchissement on émet un nouveau jeton et on invalide l'ancien (rotation).
 * Les jetons d'une même session partagent un `family_id` : si un jeton déjà utilisé
 * est representé (vol probable), on révoque TOUTE la famille (kill-switch).
 *
 * Compat : les anciens refresh tokens (sans `jti`) sont migrés à la volée vers le
 * nouveau système au premier rafraîchissement (pas de déconnexion massive).
 */
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";
import { env } from "../config/env.js";

// Fenêtre de grâce : un jeton tout juste tourné et rejoué (retry réseau du client)
// renvoie son remplaçant au lieu de déclencher une fausse alerte de vol.
const GRACE_SEC = 60;

export function signAccessToken(userId, role) {
  return jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
}

function signRefresh(userId, role, recordId, familyId) {
  return jwt.sign(
    { id: userId, role, type: "refresh", jti: recordId, fam: familyId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_REFRESH_IN }
  );
}

// Crée un enregistrement de refresh token et renvoie { token, id, family_id }.
export async function createRefreshToken(userId, role, familyId = null) {
  const { rows: [row] } = await query(
    `INSERT INTO refresh_tokens (user_id, family_id, expires_at)
     VALUES ($1, COALESCE($2, uuid_generate_v4()), NOW() + interval '30 days')
     RETURNING id, family_id`,
    [userId, familyId]
  );
  const token = signRefresh(userId, role, row.id, row.family_id);
  return { token, id: row.id, family_id: row.family_id };
}

// Valide + tourne un refresh token. Renvoie { user, token } ou { error }.
export async function rotateRefreshToken(rawToken) {
  let decoded;
  try { decoded = jwt.verify(rawToken, env.JWT_SECRET); }
  catch { return { error: "invalid" }; }
  if (decoded.type !== "refresh") return { error: "invalid" };

  // Rôle/statut relus en base : un compte rétrogradé/suspendu ne garde pas ses droits.
  const { rows: [user] } = await query(
    "SELECT id, role, status, email_verified FROM users WHERE id = $1", [decoded.id]
  );
  if (!user) return { error: "no_user" };
  if (["suspendu", "bloque"].includes(user.status)) return { error: "suspended" };
  if (user.email_verified === false) return { error: "unverified" };

  // Ancien jeton (avant rotation) : pas de jti → on migre vers le nouveau système.
  if (!decoded.jti) {
    const { token } = await createRefreshToken(user.id, user.role);
    return { user, token };
  }

  const { rows: [rec] } = await query(
    "SELECT id, family_id, used, used_at, revoked, replaced_by, expires_at FROM refresh_tokens WHERE id = $1",
    [decoded.jti]
  );
  if (!rec || new Date(rec.expires_at) < new Date()) {
    if (decoded.fam) await revokeFamily(decoded.fam);
    return { error: "invalid" };
  }
  if (rec.revoked && !rec.replaced_by) {
    // Révoqué explicitement (logout / reset) → simple refus, pas d'alerte vol.
    return { error: "invalid" };
  }
  if (rec.used) {
    const ageSec = rec.used_at ? (Date.now() - new Date(rec.used_at).getTime()) / 1000 : 1e9;
    // Retry réseau bénin (< GRACE) → on renvoie le remplaçant déjà émis (idempotent).
    if (rec.replaced_by && ageSec <= GRACE_SEC) {
      return { user, token: signRefresh(user.id, user.role, rec.replaced_by, rec.family_id) };
    }
    // Sinon : jeton déjà consommé rejoué tardivement → vol probable → on coupe tout.
    await revokeFamily(rec.family_id);
    return { error: "reuse" };
  }

  // Rotation normale : créer le remplaçant, puis marquer l'ancien comme utilisé.
  const next = await createRefreshToken(user.id, user.role, rec.family_id);
  await query(
    "UPDATE refresh_tokens SET used = TRUE, used_at = NOW(), revoked = TRUE, replaced_by = $2 WHERE id = $1",
    [rec.id, next.id]
  );
  return { user, token: next.token };
}

export async function revokeFamily(familyId) {
  await query("UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = $1 AND revoked = FALSE", [familyId]).catch(() => {});
}

export async function revokeAllForUser(userId) {
  await query("UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = $1 AND revoked = FALSE", [userId]).catch(() => {});
}

// Révoque la session (famille) d'un refresh token — utilisé au logout.
export async function revokeByToken(rawToken) {
  if (!rawToken) return;
  try {
    const d = jwt.verify(rawToken, env.JWT_SECRET);
    if (d?.fam) await revokeFamily(d.fam);
  } catch { /* jeton invalide → rien à faire */ }
}
