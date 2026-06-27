/**
 * PostgreSQL Connection Pool — TablièreCI
 *
 * Paramètres calibrés pour Render free tier (max 97 connexions PostgreSQL)
 * et scalable jusqu'à des instances plus grandes sans changer le code.
 *
 * Règle de base :
 *   max pool size = (nombre de workers Node) × 10, plafonné à DB_MAX_CONNECTIONS
 *   Sur Render free : 1 worker → max 20 connexions (laisse 77 pour admin/migrations)
 */

import pg from "pg";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

// ── Taille du pool selon l'environnement ─────────────────────────────────────
const MAX_POOL   = parseInt(process.env.DB_POOL_MAX   || "20",  10);  // connexions actives max
const MIN_POOL   = parseInt(process.env.DB_POOL_MIN   || "2",   10);  // connexions toujours ouvertes
const IDLE_MS    = parseInt(process.env.DB_IDLE_MS    || "30000", 10); // ferme après 30s d'inactivité
const CONN_MS    = parseInt(process.env.DB_CONN_MS    || "5000",  10); // timeout d'acquisition
const STMT_MS    = parseInt(process.env.DB_STMT_MS    || "15000", 10); // statement_timeout PostgreSQL

// ── SSL — activé automatiquement en production ───────────────────────────────
const ssl = env.NODE_ENV === "production"
  ? { rejectUnauthorized: false } // Render utilise un certificat signé mais sans vérification de nom
  : false;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl,
  max:                    MAX_POOL,
  min:                    MIN_POOL,
  idleTimeoutMillis:      IDLE_MS,
  connectionTimeoutMillis: CONN_MS,
  // Appliqué à chaque connexion dès qu'elle est créée
  application_name: "tabliereci_api",
});

// ── Événements du pool ────────────────────────────────────────────────────────
pool.on("connect", (client) => {
  // Timeout par requête SQL (évite les queries bloquantes qui épuisent le pool)
  client.query(`SET statement_timeout = ${STMT_MS}`).catch(() => {});
  logger.debug("PG pool — nouvelle connexion ouverte", { total: pool.totalCount });
});

pool.on("acquire", () => {
  logger.debug("PG pool — connexion acquise", { idle: pool.idleCount, waiting: pool.waitingCount });
});

pool.on("remove", () => {
  logger.debug("PG pool — connexion fermée", { total: pool.totalCount });
});

pool.on("error", (err) => {
  logger.error("PG pool — erreur inattendue", { error: err.message });
  // Ne pas crasher le process — le pool gère la reconnexion automatiquement
});

// ── Connexion initiale au démarrage ──────────────────────────────────────────
export const connectDB = async () => {
  const client = await pool.connect();
  const { rows } = await client.query("SELECT version(), current_database() AS db");
  client.release();
  logger.info("PostgreSQL connecté", {
    db:      rows[0].db,
    version: rows[0].version.split(" ").slice(0, 2).join(" "),
    pool:    { max: MAX_POOL, min: MIN_POOL },
  });
};

// ── Helper principal ──────────────────────────────────────────────────────────
// Utiliser dans tous les controllers : await query("SELECT ...", [params])
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const ms = Date.now() - start;
    // Log les requêtes lentes (> 500ms) pour identifier les N+1 ou index manquants
    if (ms > 500) {
      logger.warn("PG — requête lente", { ms, query: text.slice(0, 120) });
    }
    return result;
  } catch (err) {
    logger.error("PG — erreur requête", { error: err.message, query: text.slice(0, 120) });
    throw err;
  }
};

// ── Transaction helper ────────────────────────────────────────────────────────
// Utilisation : const result = await withTransaction(async (client) => { ... })
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ── Métriques du pool — exposées par /health ─────────────────────────────────
export const poolStats = () => ({
  total:   pool.totalCount,   // connexions ouvertes en ce moment
  idle:    pool.idleCount,    // connexions disponibles (en attente de requêtes)
  waiting: pool.waitingCount, // requêtes en attente d'une connexion libre
  max:     MAX_POOL,
});

// ── Fermeture propre à l'arrêt du serveur ────────────────────────────────────
export const closeDB = async () => {
  await pool.end();
  logger.info("PG pool fermé proprement");
};

process.on("SIGTERM", async () => {
  await closeDB();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});

export default pool;
