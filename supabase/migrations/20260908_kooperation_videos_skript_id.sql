-- Kooperation-Video <-> internes Skript (CRM-Modul), analog strategie_item_id.
-- ON DELETE SET NULL: Skript loeschen darf Videos nicht killen.

ALTER TABLE public.kooperation_videos
  ADD COLUMN IF NOT EXISTS skript_id uuid REFERENCES public.skripte(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kooperation_videos_skript_id
  ON public.kooperation_videos (skript_id)
  WHERE skript_id IS NOT NULL;

COMMENT ON COLUMN public.kooperation_videos.skript_id
  IS 'Verknuepftes Skript aus dem Skripte-Modul';
