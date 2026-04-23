-- ════════════════════════════════════════════════════════════════
--  LBF Stock — Row Level Security (RLS)
--  À exécuter dans l'éditeur SQL Supabase (une seule fois)
--
--  PRINCIPE : la clé "anon" est publique par conception Supabase.
--  Ces politiques limitent ce qu'elle peut faire aux stricts besoins
--  de l'application. Sans RLS, la clé anon peut tout faire.
--
--  Limites actuelles : l'authentification étant côté client, on ne
--  peut pas différencier "gestion" et "administration" au niveau BDD.
--  La séparation des rôles reste gérée par le code JavaScript.
--  → Voir commentaire en bas pour la piste d'amélioration future.
-- ════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
--  TABLE : users
--  Accès complet nécessaire — l'auth est côté client (auth.js)
--  et la gestion des comptes passe par cette table.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_anon"  ON users;
DROP POLICY IF EXISTS "users_insert_anon"  ON users;
DROP POLICY IF EXISTS "users_update_anon"  ON users;
DROP POLICY IF EXISTS "users_delete_anon"  ON users;

-- Lecture : nécessaire pour la connexion (comparaison hash côté client)
CREATE POLICY "users_select_anon" ON users
  FOR SELECT TO anon USING (true);

-- Création de compte (interface admin)
CREATE POLICY "users_insert_anon" ON users
  FOR INSERT TO anon WITH CHECK (true);

-- Modification : changement de profil, mot de passe, activation
CREATE POLICY "users_update_anon" ON users
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Suppression : autorisée sauf si c'est le dernier compte admin
-- (évite de se retrouver sans administrateur)
CREATE POLICY "users_delete_anon" ON users
  FOR DELETE TO anon
  USING (
    profil != 'administration'
    OR (SELECT COUNT(*) FROM users WHERE profil = 'administration') > 1
  );


-- ═══════════════════════════════════════════════════════════════
--  TABLE : stock
--  CRUD complet : ajout, modification, suppression de barres/tôles
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_select_anon" ON stock;
DROP POLICY IF EXISTS "stock_insert_anon" ON stock;
DROP POLICY IF EXISTS "stock_update_anon" ON stock;
DROP POLICY IF EXISTS "stock_delete_anon" ON stock;

CREATE POLICY "stock_select_anon" ON stock
  FOR SELECT TO anon USING (true);

CREATE POLICY "stock_insert_anon" ON stock
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "stock_update_anon" ON stock
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "stock_delete_anon" ON stock
  FOR DELETE TO anon USING (true);


-- ═══════════════════════════════════════════════════════════════
--  TABLE : demandes
--  Lecture + création/modification (pas de suppression physique)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE demandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "demandes_select_anon" ON demandes;
DROP POLICY IF EXISTS "demandes_insert_anon" ON demandes;
DROP POLICY IF EXISTS "demandes_update_anon" ON demandes;

CREATE POLICY "demandes_select_anon" ON demandes
  FOR SELECT TO anon USING (true);

CREATE POLICY "demandes_insert_anon" ON demandes
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "demandes_update_anon" ON demandes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Pas de DELETE : les demandes refusées/acceptées sont conservées
-- avec leur statut (pas supprimées physiquement)


-- ═══════════════════════════════════════════════════════════════
--  TABLE : sections
--  LECTURE SEULE — catalogue de référence, ne doit pas être
--  modifiable via l'API publique
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sections_select_anon" ON sections;

CREATE POLICY "sections_select_anon" ON sections
  FOR SELECT TO anon USING (true);

-- Pas de INSERT / UPDATE / DELETE pour anon :
-- le catalogue sections ne se modifie que depuis le dashboard Supabase


-- ═══════════════════════════════════════════════════════════════
--  TABLE : lbf_barres_historique
--  Journal d'audit IMMUABLE : lecture + ajout uniquement.
--  Personne ne doit pouvoir modifier ou supprimer l'historique.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE lbf_barres_historique ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "historique_select_anon" ON lbf_barres_historique;
DROP POLICY IF EXISTS "historique_insert_anon" ON lbf_barres_historique;

CREATE POLICY "historique_select_anon" ON lbf_barres_historique
  FOR SELECT TO anon USING (true);

CREATE POLICY "historique_insert_anon" ON lbf_barres_historique
  FOR INSERT TO anon WITH CHECK (true);

-- Pas de UPDATE ni DELETE : l'historique est en écriture seule


-- ════════════════════════════════════════════════════════════════
--  VÉRIFICATION — lancer après exécution
--  Doit retourner une ligne par politique créée ci-dessus
-- ════════════════════════════════════════════════════════════════

SELECT
  schemaname,
  tablename,
  policyname,
  cmd AS operation,
  roles
FROM pg_policies
WHERE tablename IN ('users','stock','demandes','sections','lbf_barres_historique',
                    'racks','chantiers','fournisseurs','demandeurs')
ORDER BY tablename, cmd;


-- ════════════════════════════════════════════════════════════════
--  AMÉLIORATION FUTURE (hors périmètre actuel)
--
--  Pour que RLS puisse distinguer les rôles "gestion" et "administration",
--  il faudrait migrer l'authentification vers Supabase Auth :
--
--  1. Créer une Supabase Edge Function "login" qui :
--     - reçoit {identifiant, motDePasse}
--     - compare le hash côté serveur (service_role)
--     - retourne un JWT Supabase signé avec le profil dans les claims
--
--  2. Le frontend utilise ce JWT pour toutes les requêtes suivantes
--
--  3. Les politiques RLS utilisent auth.jwt() ->> 'profil' pour autoriser
--     uniquement 'administration' à modifier users, valider demandes, etc.
--
--  Exemple de politique restrictive future :
--    CREATE POLICY "users_delete_admin_only" ON users
--      FOR DELETE TO authenticated
--      USING (auth.jwt() ->> 'profil' = 'administration');
-- ════════════════════════════════════════════════════════════════
