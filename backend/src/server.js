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
    // Réservations — colonnes walk-in + no-show + notes
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_name  VARCHAR(255)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_phone VARCHAR(30)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS walk_in_email VARCHAR(255)`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_noshow     BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS notes         TEXT`,
    // Menu items — image_url élargi (base64 peut faire 100k chars)
    `ALTER TABLE menu_items ALTER COLUMN image_url TYPE TEXT`,
    // Restaurants — logo_url élargi + colonne
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT`,
    `ALTER TABLE restaurants ALTER COLUMN qr_code_url TYPE TEXT`,
    // Utilisateurs — avatar_url élargi
    `ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT`,
    // Tables — colonne QR URL + updated_at (requis par le trigger trg_updated_at)
    `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_x   INTEGER DEFAULT 20`,
    `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS pos_y   INTEGER DEFAULT 20`,
    `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS qr_url  TEXT`,
    `ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,
    // Menu items — options JSONB
    `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS options JSONB`,
    // Restaurants — options/spécificités (Terrasse, Live music, Halal…)
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS options JSONB DEFAULT '[]'`,
    // Restaurants — confirmation auto ou manuelle des réservations
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS auto_confirm BOOLEAN DEFAULT TRUE`,
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

/**
 * Migrations métier : nouvelles fonctionnalités
 * Photos restaurant, avis clients, vérification email
 */
async function runBusinessMigrations() {
  const stmts = [
    // Photos restaurant (jusqu'à 4, stockées en JSON)
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'`,

    // Email vérification (TRUE par défaut pour les comptes existants)
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_token        VARCHAR(64)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_token_expires TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token   VARCHAR(64)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ`,

    // Table avis clients
    `CREATE TABLE IF NOT EXISTS reviews (
       id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
       client_id       UUID NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
       rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
       comment         TEXT,
       created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE(restaurant_id, client_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON reviews(restaurant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_client     ON reviews(client_id)`,

    // ── Chat, notifications in-app, liste d'attente (migration 002) ──────────
    `CREATE TABLE IF NOT EXISTS messages (
       id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
       sender_id      UUID NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
       content        TEXT NOT NULL,
       is_read        BOOLEAN NOT NULL DEFAULT false,
       created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_reservation ON messages(reservation_id)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_sender      ON messages(sender_id, is_read)`,
    `CREATE TABLE IF NOT EXISTS user_notifications (
       id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       type       VARCHAR(40) NOT NULL DEFAULT 'info',
       title      VARCHAR(120) NOT NULL,
       body       TEXT,
       meta       JSONB,
       is_read    BOOLEAN NOT NULL DEFAULT false,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_user_notif_user ON user_notifications(user_id, is_read, created_at DESC)`,
    `CREATE TABLE IF NOT EXISTS waitlist (
       id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
       user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
       client_name   VARCHAR(100) NOT NULL,
       client_phone  VARCHAR(30),
       party_size    INTEGER NOT NULL DEFAULT 2,
       preferred_at  TIMESTAMPTZ,
       status        VARCHAR(20) NOT NULL DEFAULT 'waiting',
       notified_at   TIMESTAMPTZ,
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_waitlist_resto ON waitlist(restaurant_id, status)`,
    `CREATE TABLE IF NOT EXISTS favorites (
       id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE (user_id, restaurant_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id)`,
  ];

  for (const sql of stmts) {
    try { await query(sql); } catch (_) {}
  }
  logger.info("Migrations métier exécutées");
}

async function activateTestRestaurants() {
  // Activer les restaurants de test créés pour la démonstration
  const testEmails = [
    'contact@cara-abidjan.ci',
    'contact@west-abidjan.ci',
    'contact@calla-abidjan.ci',
    'contact@must-abidjan.ci',
    'contact@lecomptoir-abidjan.ci',
  ];
  try {
    await query(
      `UPDATE restaurants SET status = 'actif', updated_at = NOW()
       WHERE owner_id IN (SELECT id FROM users WHERE email = ANY($1))
         AND status = 'en_attente'`,
      [testEmails]
    );
    logger.info("Restaurants de test activés");
  } catch (_) {}
}

async function runCodesMigration() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS restaurateur_codes (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code        VARCHAR(20) UNIQUE NOT NULL,
        is_used     BOOLEAN NOT NULL DEFAULT FALSE,
        used_by     UUID REFERENCES users(id) ON DELETE SET NULL,
        used_at     TIMESTAMPTZ,
        created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at  TIMESTAMPTZ,
        notes       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Dépôt sur restaurants
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_min_guests INTEGER DEFAULT 0`);
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_amount INTEGER DEFAULT 0`);
    logger.info("Table restaurateur_codes + dépôt prêts");
  } catch (_) {}
}

async function runProspectsMigration() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS prospects (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        full_name     VARCHAR(255) NOT NULL,
        phone         VARCHAR(30)  NOT NULL,
        email         VARCHAR(255),
        restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
        reservation_ref VARCHAR(20),
        source        VARCHAR(50) NOT NULL DEFAULT 'guest_reservation',
        notes         TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_prospects_phone ON prospects(phone)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_prospects_restaurant ON prospects(restaurant_id)`);
    logger.info("Table prospects prête");
  } catch (_) {}
}

/**
 * Indexes de performance — créés une seule fois, idempotents (IF NOT EXISTS)
 * Impact : -60% à -80% sur les requêtes fréquentes, essentiel pour 1M users
 */
async function runPerfIndexes() {
  const indexes = [
    // Restaurants — filtrages les plus courants
    `CREATE INDEX IF NOT EXISTS idx_restaurants_status      ON restaurants(status)`,
    `CREATE INDEX IF NOT EXISTS idx_restaurants_rating      ON restaurants(rating DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine     ON restaurants(cuisine_type)`,
    `CREATE INDEX IF NOT EXISTS idx_restaurants_ville       ON restaurants(ville)`,
    `CREATE INDEX IF NOT EXISTS idx_restaurants_slug        ON restaurants(slug)`,
    // Réservations — jointures + filtres fréquents
    `CREATE INDEX IF NOT EXISTS idx_reservations_restaurant ON reservations(restaurant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reservations_client     ON reservations(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reservations_date       ON reservations(reserved_at)`,
    `CREATE INDEX IF NOT EXISTS idx_reservations_status     ON reservations(status)`,
    // Index composite réservation (date + restaurant) — requête de dispo
    `CREATE INDEX IF NOT EXISTS idx_reservations_resto_date ON reservations(restaurant_id, reserved_at)`,
    // Utilisateurs — login + lookup
    `CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_phone     ON users(phone) WHERE phone IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role)`,
    // Tables restaurant — dispo
    `CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON restaurant_tables(restaurant_id)`,
    // Menu items — affichage menu QR
    `CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id)`,
    // Codes restaurateurs
    `CREATE INDEX IF NOT EXISTS idx_codes_used ON restaurateur_codes(is_used)`,
  ];

  let ok = 0;
  for (const sql of indexes) {
    try { await query(sql); ok++; } catch (_) {}
  }
  logger.info(`Performance indexes : ${ok}/${indexes.length} prêts`);
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

    // Migrations démarrage (idempotentes)
    await runStartupMigrations();
    await runBusinessMigrations();
    await runProspectsMigration();
    await runCodesMigration();
    await runPerfIndexes();       // ← Indexes de performance
    await activateTestRestaurants();

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
