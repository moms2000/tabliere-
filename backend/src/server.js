import app           from "./app.js";
import { env }       from "./config/env.js";
import { connectDB, query } from "./config/db.js";
import { redis, connectRedis } from "./config/redis.js";
import { initQueues, closeQueues } from "./queues/index.js";
import { logger }    from "./utils/logger.js";

/**
 * Migrations silencieuses au démarrage — colonnes optionnelles ajoutées
 * si elles n'existent pas encore. Idem pour les types TEXT.
 */
async function runStartupMigrations() {
  const migrations = [
    // Réservations — colonnes walk-in + no-show
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_name  VARCHAR(255)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_phone VARCHAR(30)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_noshow     BOOLEAN DEFAULT FALSE`,
    // Menu items — image_url élargi (base64 peut faire 100k chars)
    `ALTER TABLE menu_items ALTER COLUMN image_url TYPE TEXT`,
    // Restaurants — logo_url élargi + colonne
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT`,
    `ALTER TABLE restaurants ALTER COLUMN qr_code_url TYPE TEXT`,
    // Utilisateurs — avatar_url élargi
    `ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT`,
    // Tables — colonne QR URL
    `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_x   INTEGER DEFAULT 20`,
    `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_y   INTEGER DEFAULT 20`,
    `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS qr_url  TEXT`,
    // Menu items — options JSONB
    `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS options JSONB`,
    // Platform settings
    `CREATE TABLE IF NOT EXISTS platform_settings (
       key        VARCHAR(100) PRIMARY KEY,
       value      TEXT NOT NULL,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  ];

  let ok = 0, fail = 0;
  for (const sql of migrations) {
    try { await query(sql); ok++; } catch (_) { fail++; }
  }
  logger.info(`Migrations démarrage : ${ok} ok, ${fail} ignorées`);
}

let server;

async function start() {
  try {
    // Connexion PostgreSQL
    try {
      await connectDB();
    } catch (err) {
      logger.error("PostgreSQL non disponible au démarrage", {
        error: err?.message || String(err),
        code:  err?.code,
        hint:  "Vérifier DATABASE_URL dans les variables d'environnement Render",
      });
      // On ne quitte pas — le serveur démarre quand même pour exposer /health
    }

    // Connexion Redis (optionnelle)
    await connectRedis();

    // Migrations silencieuses (colonnes optionnelles)
    await runStartupMigrations();

    // BullMQ workers
    try {
      await initQueues();
    } catch (err) {
      logger.warn("BullMQ non initialisé", { error: err?.message || String(err) });
    }

    server = app.listen(env.PORT, () => {
      logger.info("TablièreCI API démarrée", {
        port: env.PORT,
        env:  env.NODE_ENV,
        url:  `http://localhost:${env.PORT}`,
      });
    });
  } catch (err) {
    logger.error("Erreur fatale au démarrage", {
      error:   err?.message || String(err),
      code:    err?.code,
      stack:   err?.stack,
    });
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`Signal ${signal} — arrêt gracieux...`);
  try {
    await closeQueues();
    if (redis) await redis.quit().catch(() => {});
    if (server) server.close(() => {
      logger.info("Serveur HTTP fermé");
      process.exit(0);
    });
  } catch (err) {
    logger.error("Erreur à l'arrêt", { error: err.message });
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  (err) => logger.error("uncaughtException",  { error: err.message, stack: err.stack }));
process.on("unhandledRejection", (err) => logger.error("unhandledRejection", { error: err?.message }));

start();
