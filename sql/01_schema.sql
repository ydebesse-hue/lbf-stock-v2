-- =============================================================
-- LBF Stock v2 — Schéma de base de données
-- Exécuter dans l'ordre : 01_schema → 02_rls → 03_seed
-- =============================================================

-- Extension uuid
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================
-- TABLE : users
-- Gestion des comptes utilisateurs avec mots de passe hashés
-- =============================================================
CREATE TABLE IF NOT EXISTS users (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username       TEXT        UNIQUE NOT NULL,
  password_hash  TEXT        NOT NULL,  -- SHA-256 hex (64 chars)
  nom            TEXT        NOT NULL,
  prenom         TEXT        NOT NULL,
  role           TEXT        NOT NULL
                             CHECK (role IN ('consultation', 'gestion', 'administration')),
  actif          BOOLEAN     NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index sur username pour les lookups d'auth
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =============================================================
-- TABLE : sections
-- Catalogue des profilés acier standard (bibliothèque)
-- =============================================================
CREATE TABLE IF NOT EXISTS sections (
  id                     SERIAL      PRIMARY KEY,
  famille                TEXT        NOT NULL
                                     CHECK (famille IN (
                                       'IPE','IPN','HEA','HEB','HEM',
                                       'UPE','UPN','Cornière','Tube carré',
                                       'Tube rond','Plat','Rond plein'
                                     )),
  designation            TEXT        NOT NULL,
  hauteur_mm             NUMERIC(7,2),
  largeur_mm             NUMERIC(7,2),
  epaisseur_ame_mm       NUMERIC(6,2),
  epaisseur_semelle_mm   NUMERIC(6,2),
  rayon_mm               NUMERIC(6,2),
  poids_ml               NUMERIC(8,3) NOT NULL,  -- kg/m
  UNIQUE (famille, designation)
);

CREATE INDEX IF NOT EXISTS idx_sections_famille ON sections(famille);

-- =============================================================
-- TABLE : stock
-- Inventaire des barres et tôles
-- =============================================================
CREATE TABLE IF NOT EXISTS stock (
  id                    TEXT        PRIMARY KEY,  -- ex: BAR-0001, TOL-0001
  categorie             TEXT        NOT NULL
                                    CHECK (categorie IN ('profil', 'tole')),

  -- Champs communs
  designation           TEXT        NOT NULL,
  lieu_stockage         TEXT,
  chantier_origine      TEXT,
  disponibilite         TEXT        NOT NULL DEFAULT 'disponible'
                                    CHECK (disponibilite IN ('disponible','reserve','sorti')),
  chantier_affectation  TEXT,
  statut                TEXT        NOT NULL DEFAULT 'en_attente'
                                    CHECK (statut IN ('valide','en_attente','rejete','archive')),
  commentaire           TEXT,

  -- Champs spécifiques profils
  section_type          TEXT,       -- IPE, HEA, UPN, etc.
  section_designation   TEXT,       -- ex: 200, 300
  longueur_m            NUMERIC(8,3),
  poids_ml              NUMERIC(8,3),
  poids_barre_kg        NUMERIC(10,3),

  -- Champs spécifiques tôles
  nuance                TEXT,       -- S235, S275, S355, etc.
  epaisseur_mm          NUMERIC(6,2),
  largeur_mm            NUMERIC(8,2),
  longueur_tole_mm      NUMERIC(8,2),
  poids_kg              NUMERIC(10,3),

  -- Métadonnées
  date_ajout            DATE        NOT NULL DEFAULT CURRENT_DATE,
  ajoute_par            TEXT        REFERENCES users(username) ON UPDATE CASCADE,
  valide_par            TEXT        REFERENCES users(username) ON UPDATE CASCADE,
  date_validation       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_statut        ON stock(statut);
CREATE INDEX IF NOT EXISTS idx_stock_disponibilite ON stock(disponibilite);
CREATE INDEX IF NOT EXISTS idx_stock_categorie     ON stock(categorie);
CREATE INDEX IF NOT EXISTS idx_stock_section_type  ON stock(section_type);

-- =============================================================
-- TABLE : demandes
-- Demandes de réservation/affectation de matériel
-- =============================================================
CREATE TABLE IF NOT EXISTS demandes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id         TEXT        NOT NULL REFERENCES stock(id) ON DELETE CASCADE,
  demandeur        TEXT        NOT NULL REFERENCES users(username) ON UPDATE CASCADE,
  chantier         TEXT        NOT NULL,
  quantite_m       NUMERIC(8,3),   -- longueur demandée (profils)
  commentaire      TEXT,
  statut           TEXT        NOT NULL DEFAULT 'en_attente'
                               CHECK (statut IN ('en_attente','approuvee','refusee','annulee')),
  traite_par       TEXT        REFERENCES users(username) ON UPDATE CASCADE,
  date_demande     TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_traitement  TIMESTAMPTZ,
  motif_refus      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demandes_statut    ON demandes(statut);
CREATE INDEX IF NOT EXISTS idx_demandes_demandeur ON demandes(demandeur);
CREATE INDEX IF NOT EXISTS idx_demandes_stock_id  ON demandes(stock_id);

-- =============================================================
-- TRIGGERS : mise à jour automatique de updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_stock_updated_at
  BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_demandes_updated_at
  BEFORE UPDATE ON demandes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- FONCTION : vérification des identifiants (auth côté serveur)
-- SECURITY DEFINER = s'exécute avec les droits du propriétaire
-- Évite d'exposer password_hash via la clé anon
-- =============================================================
CREATE OR REPLACE FUNCTION verify_user(
  p_username      TEXT,
  p_password_hash TEXT
)
RETURNS TABLE (
  id       UUID,
  username TEXT,
  nom      TEXT,
  prenom   TEXT,
  role     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.username, u.nom, u.prenom, u.role
  FROM   users u
  WHERE  u.username      = p_username
    AND  u.password_hash = p_password_hash
    AND  u.actif         = true;
END;
$$;

-- Seule la clé anon peut appeler cette fonction
REVOKE ALL ON FUNCTION verify_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_user TO anon;
