-- Migration 002 : Chat, Notifications, Liste d'attente, No-show
-- TablièreCI — à exécuter dans Render Shell : node src/db/migrate2.js

-- ── Messages (chat privé) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id             BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT    NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  sender_id      BIGINT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content        TEXT      NOT NULL,
  is_read        BOOLEAN   NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_reservation ON messages(reservation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, is_read);

-- ── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(40)  NOT NULL DEFAULT 'info',
  -- types: info | reservation | message | promo | system
  title      VARCHAR(120) NOT NULL,
  body       TEXT,
  meta       JSONB,
  is_read    BOOLEAN      NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);

-- ── Liste d'attente ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waitlist (
  id            BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT      NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id       BIGINT      REFERENCES users(id) ON DELETE SET NULL,
  client_name   VARCHAR(100) NOT NULL,
  client_phone  VARCHAR(30),
  party_size    INT          NOT NULL DEFAULT 2,
  preferred_at  TIMESTAMPTZ,
  status        VARCHAR(20)  NOT NULL DEFAULT 'waiting',
  -- waiting | notified | confirmed | cancelled
  notified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_resto ON waitlist(restaurant_id, status);

-- ── Champ no-show sur réservations (si absent) ───────────────────────────────
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS is_noshow BOOLEAN NOT NULL DEFAULT false;

-- ── Champ statut table en temps réel ────────────────────────────────────────
-- Déjà présent dans 001 : tables.status
