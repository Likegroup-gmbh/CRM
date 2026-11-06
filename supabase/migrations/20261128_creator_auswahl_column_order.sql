-- Reihenfolge der beweglichen Casting-Spalten.
-- Null = Standardreihenfolge aus dem Code. Sonst cp-col-* und custom:{uuid},
-- ohne die festen Spalten Drag, Name und Aktionen.

ALTER TABLE public.creator_auswahl
  ADD COLUMN IF NOT EXISTS column_order jsonb;

COMMENT ON COLUMN public.creator_auswahl.column_order IS
  'Reihenfolge der beweglichen Casting-Spalten (cp-col-* und custom:uuid). Null = Standardreihenfolge.';
