import app           from "./app.js";
import { env }       from "./config/env.js";
import { connectDB, query } from "./config/db.js";
import { redis, connectRedis } from "./config/redis.js";
import { initQueues, closeQueues } from "./queues/index.js";
import { purgeExpiredStories } from "./controllers/stories.controller.js";
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

    // Menu visible sur la page publique du restaurant (opt-in du restaurateur)
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS menu_public BOOLEAN DEFAULT FALSE`,

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
    `CREATE TABLE IF NOT EXISTS device_tokens (
       id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       token      TEXT NOT NULL UNIQUE,
       platform   VARCHAR(10),
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id)`,
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
    // Dépôt sur restaurants (config restaurateur : activé / seuil couverts / message)
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_min_guests INTEGER DEFAULT 0`);
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_amount INTEGER DEFAULT 0`);
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_enabled   BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_min_party INTEGER DEFAULT 6`);
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_message   TEXT`);
    // Signalements de contenu (avis / chat) — conformité UGC Play/App Store
    await query(`
      CREATE TABLE IF NOT EXISTS content_reports (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        type        VARCHAR(20) NOT NULL,
        target_id   VARCHAR(200) NOT NULL,
        reason      TEXT,
        reporter_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status      VARCHAR(20) NOT NULL DEFAULT 'open',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    logger.info("Table restaurateur_codes + dépôt + signalements prêts");
  } catch (_) {}
}

// ── Instants (stories éphémères 24h) ────────────────────────────────────────
// Migration ISOLÉE et LOGGUÉE : indépendante des autres migrations pour éviter
// qu'une erreur en amont (ou une base pas encore prête au boot) ne l'empêche
// silencieusement de créer les colonnes/tables → cause de 500 sur /stories.
async function runStoriesMigration() {
  try {
    await query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS stories_enabled BOOLEAN DEFAULT TRUE`);
    await query(`
      CREATE TABLE IF NOT EXISTS stories (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        restaurant_id  UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
        client_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
        photo_url      TEXT NOT NULL,
        public_id      VARCHAR(300),
        status         VARCHAR(20) NOT NULL DEFAULT 'active', -- active | hidden | removed
        hidden_by_resto BOOLEAN NOT NULL DEFAULT FALSE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at     TIMESTAMPTZ NOT NULL
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS story_reactions (
        story_id   UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        emoji      VARCHAR(8) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (story_id, user_id)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_stories_resto ON stories(restaurant_id, expires_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at)`);
    logger.info("Migration Instants OK (colonne stories_enabled + tables stories/story_reactions)");
  } catch (err) {
    logger.error("Migration Instants ÉCHOUÉE", { error: err?.message || String(err), code: err?.code });
  }
}

// ── Espace Événements (organisateurs) ───────────────────────────────────────
// Statuts en VARCHAR (pas d'ENUM Postgres) pour éviter le piège d'injection de
// valeur d'enum. Chaque statement isolé + logué. Idempotent.
async function runEventsMigration() {
  const stmts = [
    // Rôle organisateur (enum user_role existant → ajout de valeur, idempotent)
    `ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'organisateur'`,
    // Codes d'accès organisateur (générés par l'admin, comme les restaurateurs)
    `CREATE TABLE IF NOT EXISTS organisateur_codes (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       code        VARCHAR(20) UNIQUE NOT NULL,
       is_used     BOOLEAN NOT NULL DEFAULT FALSE,
       used_by     UUID REFERENCES users(id) ON DELETE SET NULL,
       used_at     TIMESTAMPTZ,
       created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
       expires_at  TIMESTAMPTZ,
       notes       TEXT,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    // Événements (un organisateur peut en avoir plusieurs)
    `CREATE TABLE IF NOT EXISTS events (
       id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       name         VARCHAR(160) NOT NULL,
       slug         VARCHAR(200) UNIQUE NOT NULL,
       description  TEXT,
       venue_name   VARCHAR(160),
       address      TEXT,
       ville        VARCHAR(80),
       quartier     VARCHAR(80),
       starts_at    TIMESTAMPTZ NOT NULL,
       ends_at      TIMESTAMPTZ,
       cover_url    TEXT,
       theme_color  VARCHAR(9) DEFAULT '#E8A045',
       is_public    BOOLEAN NOT NULL DEFAULT TRUE,
       status       VARCHAR(20) NOT NULL DEFAULT 'brouillon', -- brouillon|publie|annule|termine
       created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    // Plan de salle de l'événement : tables simples + packs VIP
    `CREATE TABLE IF NOT EXISTS event_tables (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
       label       VARCHAR(40) NOT NULL,
       kind        VARCHAR(10) NOT NULL DEFAULT 'simple', -- simple|vip
       capacity    INTEGER NOT NULL DEFAULT 2,
       price       INTEGER NOT NULL DEFAULT 0,            -- FCFA (packs VIP), 0 = gratuit
       description TEXT,
       zone        VARCHAR(50) DEFAULT 'general',
       pos_x       INTEGER DEFAULT 20,
       pos_y       INTEGER DEFAULT 20,
       status      VARCHAR(10) NOT NULL DEFAULT 'libre',  -- libre|reserve|occupe
       is_active   BOOLEAN NOT NULL DEFAULT TRUE,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    // Séquence pour les références de réservation (EVT-1000, EVT-1001, …)
    `CREATE SEQUENCE IF NOT EXISTS event_resa_ref_seq START 1000`,
    // Réservations d'événement (tables / packs VIP) — cash sur place, pas de paiement in-app
    `CREATE TABLE IF NOT EXISTS event_reservations (
       id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       ref             VARCHAR(20) UNIQUE NOT NULL,
       event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
       client_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       table_id        UUID REFERENCES event_tables(id) ON DELETE SET NULL,
       party_size      INTEGER NOT NULL DEFAULT 1,
       guest_name      VARCHAR(120),
       guest_phone     VARCHAR(30),
       special_request TEXT,
       status          VARCHAR(20) NOT NULL DEFAULT 'en_attente', -- en_attente|confirme|annule|termine
       confirmed_at    TIMESTAMPTZ,
       cancelled_at    TIMESTAMPTZ,
       created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE INDEX IF NOT EXISTS idx_events_owner   ON events(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_public  ON events(status, is_public, starts_at)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_tables_evt ON event_tables(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_resa_evt   ON event_reservations(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_resa_client ON event_reservations(client_id)`,
  ];
  let okc = 0, failc = 0;
  for (const sql of stmts) {
    try { await query(sql); okc++; } catch (e) {
      failc++;
      logger.warn("Migration Événements — statement ignoré", { error: e?.message, code: e?.code });
    }
  }
  logger.info(`Migration Événements : ${okc} ok, ${failc} ignoré(s)`);
}

// ── Cascade de suppression de compte (masquage réversible) ───────────────────
// Colonnes de soft-delete + rattrapage RÉVERSIBLE de l'existant : les restaurants
// des comptes déjà supprimés sont masqués, leurs réservations archivées, leurs
// codes libérés. Idempotent (ne retouche jamais une ligne déjà traitée).
const DELETED_MARK = `email LIKE 'deleted\\_%@tabliereci.ci' ESCAPE '\\'`;
async function runDeletionCascadeMigration() {
  const stmts = [
    `ALTER TABLE restaurants  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ`,
    `ALTER TABLE reservations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_restaurants_deleted ON restaurants(deleted_at)`,
    `CREATE INDEX IF NOT EXISTS idx_reservations_archived ON reservations(archived_at)`,
    // Rattrapage : libérer les codes des comptes supprimés
    `UPDATE restaurateur_codes SET is_used = FALSE, used_by = NULL, used_at = NULL
       WHERE used_by IN (SELECT id FROM users WHERE ${DELETED_MARK})`,
    `UPDATE organisateur_codes SET is_used = FALSE, used_by = NULL, used_at = NULL
       WHERE used_by IN (SELECT id FROM users WHERE ${DELETED_MARK})`,
    // Rattrapage : masquer les restaurants des comptes supprimés (réversible)
    `UPDATE restaurants SET status = 'suspendu', deleted_at = COALESCE(deleted_at, NOW()), updated_at = NOW()
       WHERE deleted_at IS NULL AND owner_id IN (SELECT id FROM users WHERE ${DELETED_MARK})`,
    // Rattrapage : archiver les réservations des restaurants masqués
    `UPDATE reservations SET archived_at = COALESCE(archived_at, NOW()), updated_at = NOW()
       WHERE archived_at IS NULL AND restaurant_id IN (SELECT id FROM restaurants WHERE deleted_at IS NOT NULL)`,
    // Rattrapage : annuler les événements des organisateurs supprimés
    `UPDATE events SET status = 'annule', updated_at = NOW()
       WHERE status <> 'annule' AND owner_id IN (SELECT id FROM users WHERE ${DELETED_MARK})`,
  ];
  let okc = 0, failc = 0;
  for (const sql of stmts) {
    try { const r = await query(sql); okc++;
      if (r.rowCount) logger.info("Cascade suppression — rattrapage", { affected: r.rowCount });
    } catch (e) { failc++; logger.warn("Cascade suppression — statement ignoré", { error: e?.message }); }
  }
  logger.info(`Migration Cascade suppression : ${okc} ok, ${failc} ignoré(s)`);
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
    await runStoriesMigration();  // ← Instants (isolée + logguée)
    await runEventsMigration();   // ← Espace Événements (organisateurs)
    await runDeletionCascadeMigration(); // ← Cascade suppression compte (soft-delete + rattrapage)
    await runPerfIndexes();       // ← Indexes de performance
    await activateTestRestaurants();

    // BullMQ workers
    try {
      await initQueues();
    } catch (err) {
      logger.warn("BullMQ non initialisé", { error: err?.message || String(err) });
    }

    // Purge des Instants expirés (suppression totale après 24h) — au démarrage + toutes les 30 min
    purgeExpiredStories().then(n => { if (n) logger.info(`[Instants] ${n} instant(s) expiré(s) purgé(s)`); });
    setInterval(() => {
      purgeExpiredStories().then(n => { if (n) logger.info(`[Instants] ${n} instant(s) expiré(s) purgé(s)`); });
    }, 30 * 60 * 1000);

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
