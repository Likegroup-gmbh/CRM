-- Reihenfolge der beweglichen Konzept-Spalten.
-- Null = Standardreihenfolge aus dem Code. Sonst col-* und custom:{uuid},
-- ohne die festen Spalten #, Griff, Profil, Creator, Bild, Plattform und Aktionen.

ALTER TABLE public.strategie
  ADD COLUMN IF NOT EXISTS column_order jsonb;

COMMENT ON COLUMN public.strategie.column_order IS
  'Reihenfolge der beweglichen Konzept-Spalten (col-* und custom:uuid). Null = Standardreihenfolge.';
