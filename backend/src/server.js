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
    // Restaurants — durée d'assise (minutes) : libère la table après ce délai
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS seating_duration INTEGER DEFAULT 120`,
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

    // Publication contrôlée par le restaurateur : TRUE par défaut (les restos
    // existants restent visibles). Mis à FALSE = « en préparation », masqué de
    // la liste publique le temps de finir la configuration.
    `ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT TRUE`,

    // Email vérification (TRUE par défaut pour les comptes existants)
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified     BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_token        VARCHAR(64)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_token_expires TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token   VARCHAR(64)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ`,
    // RATTRAPAGE une-fois : au déploiement de la vérification e-mail obligatoire au
    // login, on considère TOUS les comptes déjà créés comme vérifiés (sinon ils
    // seraient bloqués rétroactivement). Cutoff figé = instant du déploiement → les
    // NOUVELLES inscriptions (après) devront vérifier. Idempotent (cutoff fixe).
    `UPDATE users SET email_verified = TRUE
       WHERE email_verified = FALSE AND created_at < TIMESTAMPTZ '2026-07-15 17:56:55+00'`,

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

    // Contacts clients importés (CRM propre au restaurant) — base clients externe
    // (ex. migration depuis un autre service). Fusionnés avec les clients issus
    // des réservations dans « Mes clients ». Dédoublonnage par téléphone normalisé.
    `CREATE TABLE IF NOT EXISTS restaurant_contacts (
       id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
       name          VARCHAR(160),
       phone         VARCHAR(40),
       phone_norm    VARCHAR(40),
       email         VARCHAR(200),
       note          TEXT,
       source        VARCHAR(40) DEFAULT 'import',
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uidx_contacts_resto_phone
       ON restaurant_contacts(restaurant_id, phone_norm) WHERE phone_norm IS NOT NULL AND phone_norm <> ''`,
    `CREATE INDEX IF NOT EXISTS idx_contacts_resto ON restaurant_contacts(restaurant_id)`,
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

// ── Événements Phase 2 : QR bouteilles, staff, promoteurs, check-in, dashboard ─
async function runEventsPhase2Migration() {
  const stmts = [
    // Config événement : commande de bouteilles + mode de paiement
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS bottles_enabled BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS ordering_mode   VARCHAR(10) DEFAULT 'per_order'`, // per_order | tab
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity INTEGER`,               // jauge d'entrées (gratuites)
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS entry_price INTEGER DEFAULT 0`,  // prix d'entrée payé en espèces au-delà de la jauge (Phase 4)
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'`,      // galerie (max 5)
    `ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS min_order INTEGER DEFAULT 0`, // minimum de commande pour le salon
    // Réservations : code promoteur + check-in
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS promoter_code VARCHAR(30)`,
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ`,
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS arrived_size  INTEGER`,   // nb réel de personnes arrivées (check-in)
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS order_pin     VARCHAR(4)`, // code à 4 chiffres du responsable de salon (généré au check-in)
    // Carte des bouteilles / boissons de l'événement
    `CREATE TABLE IF NOT EXISTS event_bottles (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
       name        VARCHAR(120) NOT NULL,
       category    VARCHAR(60) DEFAULT 'Bouteilles',
       price       INTEGER NOT NULL DEFAULT 0,
       description TEXT,
       is_active   BOOLEAN NOT NULL DEFAULT TRUE,
       position    INTEGER NOT NULL DEFAULT 0,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    // Commandes de bouteilles par table (scan QR)
    `CREATE SEQUENCE IF NOT EXISTS event_order_ref_seq START 1000`,
    `CREATE TABLE IF NOT EXISTS event_orders (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       ref         VARCHAR(20) UNIQUE NOT NULL,
       event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
       table_id    UUID REFERENCES event_tables(id) ON DELETE SET NULL,
       table_label VARCHAR(40),
       guest_name  VARCHAR(120),
       items       JSONB NOT NULL DEFAULT '[]',
       total       INTEGER NOT NULL DEFAULT 0,
       status      VARCHAR(15) NOT NULL DEFAULT 'en_attente', -- en_attente|servi|paye|annule
       note        TEXT,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    // Comptes staff temporaires (accès par PIN, liés à un événement)
    `CREATE TABLE IF NOT EXISTS event_staff (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
       name        VARCHAR(80) NOT NULL,
       role        VARCHAR(15) NOT NULL DEFAULT 'all', -- all|checkin|bar
       pin         VARCHAR(8) NOT NULL,
       is_active   BOOLEAN NOT NULL DEFAULT TRUE,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
    // Codes promoteurs
    `CREATE TABLE IF NOT EXISTS event_promoters (
       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
       name        VARCHAR(80) NOT NULL,
       code        VARCHAR(30) NOT NULL,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE (event_id, code)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_evt_bottles_evt ON event_bottles(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_orders_evt  ON event_orders(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_staff_evt   ON event_staff(event_id)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_promoters_evt ON event_promoters(event_id)`,
    // Phase 3 : rôle serveur + assignation serveur ↔ table (après création de event_staff)
    `ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES event_staff(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_evt_tables_server ON event_tables(server_id)`,

    // ── Phase 5 : confirmation par acompte mobile money (pas de blocage de stock) ──
    // Config paiement de l'organisateur
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '[]'`,   // [{operator, number, holder}]
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS deposit_percent INTEGER DEFAULT 0`,    // % du prix de table exigé en acompte
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS deposit_message TEXT`,                 // consigne personnalisée
    // Acompte fixe optionnel par table (prioritaire sur le %)
    `ALTER TABLE event_tables ADD COLUMN IF NOT EXISTS deposit_amount INTEGER DEFAULT 0`,
    // Suivi d'acompte + réservations invité (sans compte, créées manuellement)
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS guest_email   VARCHAR(255)`,
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS deposit_amount INTEGER`,
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS deposit_method VARCHAR(30)`,
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS deposit_ref    VARCHAR(80)`,
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS deposit_confirmed_at TIMESTAMPTZ`,
    `ALTER TABLE event_reservations ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT FALSE`, // créée par l'organisateur
    // Réservations invité : client_id devient optionnel
    `ALTER TABLE event_reservations ALTER COLUMN client_id DROP NOT NULL`,
  ];
  let okc = 0, failc = 0;
  for (const sql of stmts) {
    try { await query(sql); okc++; } catch (e) {
      failc++; logger.warn("Migration Événements P2 — statement ignoré", { error: e?.message });
    }
  }
  logger.info(`Migration Événements P2 : ${okc} ok, ${failc} ignoré(s)`);
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
    // Rattrapage : LIBÉRER le slug des restaurants déjà supprimés (masqués) pour que
    // leur nom redevienne disponible à une nouvelle inscription (fin du blocage
    // « nom déjà pris »). Idempotent via le préfixe. N'affecte que les masqués.
    `UPDATE restaurants SET slug = 'deleted-' || id, updated_at = NOW()
       WHERE deleted_at IS NOT NULL AND slug NOT LIKE 'deleted-%'`,
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
    // Ajouts perf : owner (admin N+1 / login / cascade), table (conflit/annulation), commandes QR
    `CREATE INDEX IF NOT EXISTS idx_restaurants_owner  ON restaurants(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id) WHERE table_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_qr_orders_resto_date ON qr_orders(restaurant_id, created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_resa_table ON event_reservations(table_id) WHERE table_id IS NOT NULL`,
    // Dashboards événement — filtres/agrégats par statut
    `CREATE INDEX IF NOT EXISTS idx_evt_resa_evt_status  ON event_reservations(event_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_resa_checkin     ON event_reservations(event_id, checked_in_at)`,
    `CREATE INDEX IF NOT EXISTS idx_evt_orders_evt_status ON event_orders(event_id, status)`,
    // Code responsable — unicité STRICTE du PIN par événement (anti-collision sous
    // forte concurrence à l'entrée : deux salons ne peuvent jamais partager un code).
    // On neutralise d'abord d'éventuels doublons existants avant de poser l'index.
    `UPDATE event_reservations r SET order_pin = NULL
       WHERE order_pin IS NOT NULL AND EXISTS (
         SELECT 1 FROM event_reservations r2
         WHERE r2.event_id = r.event_id AND r2.order_pin = r.order_pin AND r2.id < r.id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uniq_evt_resa_order_pin ON event_reservations(event_id, order_pin) WHERE order_pin IS NOT NULL`,
    // Paiements — idempotence des webhooks : une référence fournisseur = un paiement
    `CREATE UNIQUE INDEX IF NOT EXISTS uidx_payments_provider_ref ON payments(provider_ref) WHERE provider_ref IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_payments_reservation ON payments(reservation_id)`,
  ];

  let ok = 0;
  for (const sql of indexes) {
    try { await query(sql); ok++; } catch (e) { logger.warn("Index ignoré", { error: e?.message }); }
  }
  logger.info(`Performance indexes : ${ok}/${indexes.length} prêts`);
}

let server;

async function start() {
  // ── Écouter IMMÉDIATEMENT ────────────────────────────────────────────────
  // Le health check de Render doit obtenir une réponse sans attendre la fin des
  // migrations (sinon « timed out waiting for internal health check » → deploy
  // marqué en échec). On ouvre le port d'abord, on migre ensuite en arrière-plan.
  server = app.listen(env.PORT, () => {
    logger.info("TablièreCI API démarrée", { port: env.PORT, env: env.NODE_ENV, url: `http://localhost:${env.PORT}` });
  });
  server.requestTimeout   = 30_000;
  server.headersTimeout   = 35_000;
  server.keepAliveTimeout = 65_000;
  server.on("error", (err) => { logger.error("Erreur serveur HTTP", { error: err?.message }); process.exit(1); });

  // ── Connexion DB + Redis + migrations EN ARRIÈRE-PLAN (le serveur écoute déjà) ──
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
    await runEventsPhase2Migration(); // ← Événements P2 (bouteilles, staff, promoteurs, check-in)
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

    logger.info("Initialisation terminée (migrations, files, purge)");
  } catch (err) {
    // Le serveur écoute déjà → /health répond. On journalise sans quitter le process.
    logger.error("Erreur pendant l'initialisation post-écoute", {
      error: err?.message || String(err), code: err?.code, stack: err?.stack,
    });
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
// Après une uncaughtException, l'état du process peut être corrompu : on logue
// puis on quitte pour laisser Render redémarrer proprement (fail-fast).
process.on("uncaughtException",  (err) => {
  logger.error("uncaughtException", { error: err.message, stack: err.stack });
  process.exit(1);
});
process.on("unhandledRejection", (err) => logger.error("unhandledRejection", { error: err?.message }));

start();
