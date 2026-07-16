/**
 * Test d'intégration — rotation / révocation / détection de réutilisation des
 * refresh tokens. Nécessite une base PostgreSQL accessible (DATABASE_URL).
 *
 *   DATABASE_URL=postgres://… node --test backend/test/refreshTokens.test.js
 *
 * Le test crée un utilisateur temporaire et le supprime à la fin (CASCADE nettoie
 * ses refresh_tokens). NE PAS lancer contre la base de PRODUCTION.
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { query, closeDB } from "../src/config/db.js";
import {
  createRefreshToken, rotateRefreshToken, revokeByToken, revokeAllForUser,
} from "../src/utils/refreshTokens.js";

const HAS_DB = !!process.env.DATABASE_URL;

// Ferme le pool à la fin → le process se termine (sinon les connexions keepalive
// maintiennent l'event loop en vie et `node --test` reste bloqué).
after(async () => { if (HAS_DB) await closeDB(); });

test("refresh tokens : rotation, grâce, révocation, détection de vol", { skip: HAS_DB ? false : "DATABASE_URL requis" }, async (t) => {
  const email = `rt-test-${Date.now()}@example.invalid`;
  const { rows: [u] } = await query(
    `INSERT INTO users (email, password_hash, full_name, role, status, email_verified)
     VALUES ($1, 'x', 'RT Test', 'client', 'actif', TRUE) RETURNING id`, [email]
  );
  const userId = u.id;
  t.after(async () => { await query("DELETE FROM users WHERE id = $1", [userId]); });

  // 1. Émission
  const { token: t1 } = await createRefreshToken(userId, "client");
  assert.ok(t1, "un token est émis");

  // 2. Rotation : t1 → t2 (nouveau token, différent)
  const r2 = await rotateRefreshToken(t1);
  assert.equal(r2.error, undefined, "rotation sans erreur");
  assert.ok(r2.token && r2.token !== t1, "le token change à chaque rotation");

  // 3. Fenêtre de grâce : rejouer t1 aussitôt (retry réseau) → renvoie le remplaçant
  const grace = await rotateRefreshToken(t1);
  assert.equal(grace.error, undefined, "retry immédiat toléré (idempotent)");

  // 4. t2 fonctionne → t3
  const r3 = await rotateRefreshToken(r2.token);
  assert.equal(r3.error, undefined, "le token courant tourne normalement");

  // 5. Révocation explicite (logout) → le token ne marche plus
  await revokeByToken(r3.token);
  const afterLogout = await rotateRefreshToken(r3.token);
  assert.equal(afterLogout.error, "invalid", "token révoqué par logout → refusé");

  // 6. Détection de vol : un token consommé, rejoué APRÈS la grâce → session coupée
  const { token: fresh } = await createRefreshToken(userId, "client");
  const rot = await rotateRefreshToken(fresh);                     // fresh est consommé → rot.token actif
  await query(                                                     // on sort de la fenêtre de grâce
    "UPDATE refresh_tokens SET used_at = NOW() - interval '10 minutes' WHERE user_id = $1 AND used = TRUE",
    [userId]
  );
  const reuse = await rotateRefreshToken(fresh);
  assert.equal(reuse.error, "reuse", "réutilisation tardive détectée comme vol");
  const killed = await rotateRefreshToken(rot.token);
  assert.ok(killed.error, "toute la famille est révoquée après un vol détecté");

  // 7. revokeAllForUser coupe tout
  const { token: last } = await createRefreshToken(userId, "client");
  await revokeAllForUser(userId);
  const afterAll = await rotateRefreshToken(last);
  assert.equal(afterAll.error, "invalid", "revokeAllForUser invalide les sessions");
});
