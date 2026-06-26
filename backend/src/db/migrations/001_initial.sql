-- ============================================================
-- TablièreCI — Migration initiale
-- PostgreSQL 15+
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- recherche texte rapide

-- ── ENUM types ─────────────────────────────────────────────
CREATE TYPE user_role    AS ENUM ('client', 'restaurateur', 'admin');
CREATE TYPE user_status  AS ENUM ('actif', 'suspendu', 'en_attente');
CREATE TYPE plan_type    AS ENUM ('gratuit', 'standard', 'premium');
CREATE TYPE resto_status AS ENUM ('actif', 'suspendu', 'en_attente');
CREATE TYPE table_status AS ENUM ('libre', 'occupe', 'reserve');
CREATE TYPE resa_status  AS ENUM ('en_attente', 'confirme', 'annule', 'no_show', 'termine');
CREATE TYPE pay_method   AS ENUM ('orange_money', 'mtn_momo', 'wave', 'carte', 'cash');
CREATE TYPE pay_status   AS ENUM ('en_attente', 'succes', 'echec', 'rembourse');
CREATE TYPE notif_type   AS ENUM ('confirmation', 'rappel', 'annulation', 'marketing');

-- ── USERS ──────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  phone         VARCHAR(20)  UNIQUE,               -- WhatsApp
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(255) NOT NULL,
  role          user_role    NOT NULL DEFAULT 'client',
  status        user_status  NOT NULL DEFAULT 'actif',
  restaurant_id UUID,                              -- FK ajoutée après la table restaurants
  avatar_url    VARCHAR(500),
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email   ON users(email);
CREATE INDEX idx_users_phone   ON users(phone);
CREATE INDEX idx_users_role    ON users(role);
CREATE INDEX idx_users_status  ON users(status);

-- ── RESTAURANTS ─────────────────────────────────────────────
CREATE TABLE restaurants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(255) UNIQUE NOT NULL,       -- URL-friendly, ex: le-maquis-du-plateau
  description   TEXT,
  cuisine_type  VARCHAR(100),
  address       VARCHAR(500),
  ville         VARCHAR(100) NOT NULL DEFAULT 'Abidjan',
  quartier      VARCHAR(100),
  latitude      DECIMAL(10, 8),
  longitude     DECIMAL(11, 8),
  phone         VARCHAR(20),
  email         VARCHAR(255),
  website       VARCHAR(500),
  opening_hours JSONB,                              -- { lun: "12h-23h", mar: "12h-23h", ... }
  price_range   VARCHAR(50),                        -- "5 000 – 15 000 F"
  capacity      INTEGER NOT NULL DEFAULT 20,
  plan          plan_type    NOT NULL DEFAULT 'gratuit',
  status        resto_status NOT NULL DEFAULT 'en_attente',
  qr_active     BOOLEAN NOT NULL DEFAULT FALSE,
  qr_code_url   VARCHAR(500),
  theme_color   VARCHAR(7)   DEFAULT '#1D9E75',    -- couleur hex personnalisée
  rating        DECIMAL(3,2) DEFAULT 0.00,
  review_count  INTEGER      DEFAULT 0,
  commission_pct DECIMAL(4,2) DEFAULT 5.00,        -- % prélevé par la plateforme
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resto_slug      ON restaurants(slug);
CREATE INDEX idx_resto_ville     ON restaurants(ville);
CREATE INDEX idx_resto_quartier  ON restaurants(quartier);
CREATE INDEX idx_resto_status    ON restaurants(status);
CREATE INDEX idx_resto_plan      ON restaurants(plan);
CREATE INDEX idx_resto_rating    ON restaurants(rating DESC);
-- Recherche full-text rapide sur le nom
CREATE INDEX idx_resto_name_trgm ON restaurants USING gin(name gin_trgm_ops);

-- FK user → restaurant
ALTER TABLE users ADD CONSTRAINT fk_users_restaurant
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL;

-- ── TABLES (salles) ─────────────────────────────────────────
CREATE TABLE restaurant_tables (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  label         VARCHAR(20)  NOT NULL,              -- T1, TE2, etc.
  capacity      INTEGER      NOT NULL DEFAULT 2,
  zone          VARCHAR(50)  DEFAULT 'interieur',   -- interieur | terrasse | salon_prive
  status        table_status NOT NULL DEFAULT 'libre',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tables_restaurant ON restaurant_tables(restaurant_id);
CREATE INDEX idx_tables_status     ON restaurant_tables(status);
-- Contrainte unicité : pas deux tables avec le même label dans un restaurant
CREATE UNIQUE INDEX idx_tables_label_unique ON restaurant_tables(restaurant_id, label);

-- ── RESERVATIONS ────────────────────────────────────────────
CREATE TABLE reservations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ref             VARCHAR(20) UNIQUE NOT NULL,      -- RES-0041
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id)       ON DELETE RESTRICT,
  client_id       UUID NOT NULL REFERENCES users(id)             ON DELETE RESTRICT,
  table_id        UUID REFERENCES restaurant_tables(id)          ON DELETE SET NULL,
  reserved_at     TIMESTAMPTZ NOT NULL,             -- date + heure de la réservation
  party_size      INTEGER     NOT NULL CHECK (party_size > 0),
  status          resa_status NOT NULL DEFAULT 'en_attente',
  special_request TEXT,
  confirmed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  no_show_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resa_restaurant   ON reservations(restaurant_id);
CREATE INDEX idx_resa_client       ON reservations(client_id);
CREATE INDEX idx_resa_reserved_at  ON reservations(reserved_at);
CREATE INDEX idx_resa_status       ON reservations(status);
CREATE INDEX idx_resa_ref          ON reservations(ref);

-- Génération automatique du ref RES-XXXX
CREATE SEQUENCE resa_ref_seq START 1000;
CREATE OR REPLACE FUNCTION set_reservation_ref()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ref := 'RES-' || LPAD(nextval('resa_ref_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_ref
  BEFORE INSERT ON reservations
  FOR EACH ROW WHEN (NEW.ref IS NULL OR NEW.ref = '')
  EXECUTE FUNCTION set_reservation_ref();

-- ── PAIEMENTS ───────────────────────────────────────────────
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  restaurant_id   UUID REFERENCES restaurants(id)  ON DELETE SET NULL,
  user_id         UUID REFERENCES users(id)        ON DELETE SET NULL,
  type            VARCHAR(50) NOT NULL,             -- reservation | abonnement | commission
  method          pay_method  NOT NULL,
  amount          INTEGER     NOT NULL,             -- en FCFA (centimes non utilisés en CI)
  commission      INTEGER     DEFAULT 0,            -- part plateforme
  status          pay_status  NOT NULL DEFAULT 'en_attente',
  provider_ref    VARCHAR(255),                     -- ref Orange Money / MTN / Wave
  provider_data   JSONB,                            -- réponse brute du prestataire
  refund_reason   TEXT,
  refunded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_reservation  ON payments(reservation_id);
CREATE INDEX idx_pay_restaurant   ON payments(restaurant_id);
CREATE INDEX idx_pay_user         ON payments(user_id);
CREATE INDEX idx_pay_status       ON payments(status);
CREATE INDEX idx_pay_created_at   ON payments(created_at DESC);

-- ── ABONNEMENTS ─────────────────────────────────────────────
CREATE TABLE subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  plan            plan_type   NOT NULL,
  price           INTEGER     NOT NULL,             -- FCFA / mois
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  payment_id      UUID REFERENCES payments(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subs_restaurant ON subscriptions(restaurant_id);
CREATE INDEX idx_subs_active     ON subscriptions(is_active);

-- ── MENU ────────────────────────────────────────────────────
CREATE TABLE menu_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  position      INTEGER      NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_cat_restaurant ON menu_categories(restaurant_id);

CREATE TABLE menu_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id   UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id)     ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  price         INTEGER      NOT NULL CHECK (price >= 0),  -- FCFA
  image_url     VARCHAR(500),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  is_available  BOOLEAN      NOT NULL DEFAULT TRUE,        -- rupture de stock temp
  position      INTEGER      NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_category   ON menu_items(category_id);
CREATE INDEX idx_menu_items_restaurant ON menu_items(restaurant_id);

-- ── COMMANDES QR ────────────────────────────────────────────
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id   UUID NOT NULL REFERENCES restaurants(id)       ON DELETE RESTRICT,
  table_id        UUID REFERENCES restaurant_tables(id)          ON DELETE SET NULL,
  reservation_id  UUID REFERENCES reservations(id)               ON DELETE SET NULL,
  client_session  VARCHAR(255),                     -- session anonyme si client non connecté
  status          VARCHAR(50) NOT NULL DEFAULT 'en_attente', -- en_attente|prepare|servi|paye
  total           INTEGER     NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id     UUID    NOT NULL REFERENCES menu_items(id),
  quantity    INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  INTEGER NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_restaurant ON orders(restaurant_id);
CREATE INDEX idx_orders_table      ON orders(table_id);
CREATE INDEX idx_orders_status     ON orders(status);

-- ── NOTIFICATIONS ───────────────────────────────────────────
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  reservation_id  UUID REFERENCES reservations(id) ON DELETE SET NULL,
  type            notif_type  NOT NULL,
  channel         VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
  phone           VARCHAR(20),
  message         TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|sent|delivered|failed
  provider_ref    VARCHAR(255),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user    ON notifications(user_id);
CREATE INDEX idx_notif_status  ON notifications(status);

-- ── TRIGGER updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

-- Applique le trigger sur toutes les tables avec updated_at
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','restaurants','restaurant_tables',
    'reservations','payments','menu_items','orders']
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at()', t
    );
  END LOOP;
END;
$$;
