-- ════════════════════════════════════════════════════════════════
--  LBF Stock — Migration : colonne id_barre dans demandes
--  À exécuter dans l'éditeur SQL Supabase
--
--  Le JSON initial utilisait « id_element » pour référencer la barre.
--  Le code JavaScript utilise « id_barre » partout.
--  Ce script ajoute la colonne id_barre et copie les données
--  existantes depuis id_element.
-- ════════════════════════════════════════════════════════════════

-- Ajouter la colonne si elle n'existe pas encore
ALTER TABLE demandes ADD COLUMN IF NOT EXISTS id_barre TEXT;

-- Copier les valeurs de l'ancienne colonne vers la nouvelle
UPDATE demandes
SET id_barre = id_element
WHERE id_barre IS NULL AND id_element IS NOT NULL;

-- Vérification — doit retourner les lignes avec id_barre renseigné
SELECT id, id_element, id_barre, statut
FROM demandes
ORDER BY id;
