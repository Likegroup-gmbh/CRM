-- Schalter am Skript: false lässt das Master-Regelwerk aus Rückfragen,
-- Erstgenerierung und späteren Bearbeitungen. Bestehende Zeilen bleiben an.

ALTER TABLE public.skripte
  ADD COLUMN IF NOT EXISTS master_regelwerk boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.skripte.master_regelwerk IS
  'false: KI-Aufrufe dieses Skripts ohne Master-Regelwerk. Default true.';
