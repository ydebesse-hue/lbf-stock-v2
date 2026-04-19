-- ════════════════════════════════════════════════════════════════
--  LBF Stock — Référentiels administrables
--  À exécuter dans l'éditeur SQL Supabase
-- ════════════════════════════════════════════════════════════════

-- ── Lieux de stockage ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lieux_stockage (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom        text        NOT NULL,
  ordre      integer     NOT NULL DEFAULT 0,
  actif      boolean     NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lieux_stockage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acces_anon_lieux" ON lieux_stockage;
CREATE POLICY "acces_anon_lieux" ON lieux_stockage
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Données initiales (ignorées si déjà présentes)
INSERT INTO lieux_stockage (nom, ordre) VALUES
  ('Rack 1',    1),
  ('Rack 2',    2),
  ('Rack 3',    3),
  ('Rack 4',    4),
  ('Extérieur', 5),
  ('Autre',     6)
ON CONFLICT DO NOTHING;

-- ── Chantiers ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chantiers (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom        text        NOT NULL,
  reference  text,
  actif      boolean     NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acces_anon_chantiers" ON chantiers;
CREATE POLICY "acces_anon_chantiers" ON chantiers
  FOR ALL TO anon USING (true) WITH CHECK (true);
