-- Finale Version einer Story ohne Re-Upload markieren (Promote im Videos-Tab)
-- kooperation_story_asset.source_asset_id verweist wie bei Video und Bildern auf die Quell-Datei.

BEGIN;

ALTER TABLE public.kooperation_story_asset
  ADD COLUMN IF NOT EXISTS source_asset_id uuid REFERENCES public.kooperation_story_asset(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kooperation_story_asset_source
  ON public.kooperation_story_asset(source_asset_id)
  WHERE source_asset_id IS NOT NULL;

COMMIT;
