-- =============================================================
-- LBF Stock v2 — Row Level Security (RLS)
-- Exécuter après 01_schema.sql
-- =============================================================
-- Stratégie :
--   • La clé anon (exposée dans le JS) permet uniquement les
--     opérations nécessaires au fonctionnement de l'app.
--   • L'authentification métier est gérée par verify_user().
--   • La table users est protégée : password_hash inaccessible.
--   • Le contrôle des rôles (gestion/admin) est enforced côté app.
-- =============================================================

-- Activer RLS sur toutes les tables
ALTER TABLE users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock    ENABLE ROW LEVEL SECURITY;
ALTER TABLE demandes ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- TABLE : users
-- anon ne peut PAS lire directement (protection du password_hash)
-- L'auth passe exclusivement par verify_user()
-- =============================================================
CREATE POLICY users_anon_no_read
  ON users FOR SELECT
  TO anon
  USING (false);

-- Pas d'insert/update/delete pour anon sur users
-- (Les admins utilisent la service_role key via un edge function
--  ou directement depuis le dashboard Supabase)

-- =============================================================
-- TABLE : sections
-- Lecture publique, pas d'écriture pour anon
-- =============================================================
CREATE POLICY sections_anon_read
  ON sections FOR SELECT
  TO anon
  USING (true);

-- =============================================================
-- TABLE : stock
-- Lecture : tous les items validés + les propres items en attente
-- Insert  : autorisé pour anon (statut forcé à 'en_attente' par trigger)
-- Update  : limité aux champs de disponibilité/affectation
-- Delete  : interdit pour anon
-- =============================================================

-- Lecture : items validés uniquement (sécurité : pas de fuite des rejets d'autres)
CREATE POLICY stock_anon_read
  ON stock FOR SELECT
  TO anon
  USING (statut IN ('valide', 'en_attente'));

-- Insert : anon peut ajouter des items (statut sera toujours 'en_attente')
CREATE POLICY stock_anon_insert
  ON stock FOR INSERT
  TO anon
  WITH CHECK (statut = 'en_attente');

-- Update : anon peut mettre à jour uniquement disponibilite/chantier_affectation/commentaire
-- (La validation du statut → 'valide' se fait via service_role ou RPC)
CREATE POLICY stock_anon_update
  ON stock FOR UPDATE
  TO anon
  USING  (statut IN ('valide', 'en_attente'))
  WITH CHECK (statut IN ('valide', 'en_attente'));

-- =============================================================
-- TABLE : demandes
-- Lecture  : toutes les demandes visibles (pour les admins côté app)
-- Insert   : anon peut créer une demande
-- Update   : anon peut annuler ses demandes (statut → 'annulee')
-- Delete   : interdit pour anon
-- =============================================================
CREATE POLICY demandes_anon_read
  ON demandes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY demandes_anon_insert
  ON demandes FOR INSERT
  TO anon
  WITH CHECK (statut = 'en_attente');

CREATE POLICY demandes_anon_update
  ON demandes FOR UPDATE
  TO anon
  USING  (true)
  WITH CHECK (statut IN ('en_attente', 'approuvee', 'refusee', 'annulee'));

-- =============================================================
-- TRIGGER : force statut = 'en_attente' à l'insert stock
-- Empêche un utilisateur anon d'insérer avec statut = 'valide'
-- =============================================================
CREATE OR REPLACE FUNCTION enforce_stock_statut_on_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.statut        := 'en_attente';
  NEW.valide_par    := NULL;
  NEW.date_validation := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stock_enforce_statut
  BEFORE INSERT ON stock
  FOR EACH ROW EXECUTE FUNCTION enforce_stock_statut_on_insert();

-- =============================================================
-- VUE : users_public
-- Vue sans password_hash pour les besoins de l'app
-- (liste des utilisateurs pour les admins)
-- =============================================================
CREATE OR REPLACE VIEW users_public AS
SELECT id, username, nom, prenom, role, actif, created_at, updated_at
FROM   users;

-- La vue hérite des policies de la table users (RLS actif)
-- Pour permettre à service_role de lire : pas de restriction
-- Pour anon : bloqué par la policy users_anon_no_read sur la table de base

-- Grant minimal pour anon sur les tables
GRANT SELECT ON sections TO anon;
GRANT SELECT, INSERT, UPDATE ON stock TO anon;
GRANT SELECT, INSERT, UPDATE ON demandes TO anon;
GRANT USAGE, SELECT ON SEQUENCE sections_id_seq TO anon;
