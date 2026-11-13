-- Kommentare an Stories und Bildern im Videos-Tab.
-- asset_id verweist nur auf kooperation_video_asset. Stories (kooperation_story_asset) und
-- Bilder (kooperation_bilder_asset) bekommen je eine eigene Spalte, damit die FKs bleiben.
-- Ein Kommentar gehört zu höchstens einer Datei (alle null = ganze Feedbackschleife).
-- Bilder haben keine Zeitleiste, also nie einen Timecode.
--
-- Rechte, Teams-Trigger und Realtime hängen an video_id und bleiben unverändert.
-- ON DELETE SET NULL ist nur das Netz: beim Löschen einer Datei setzen assetDelete.js und
-- ablage/asset.js deleted_at, sonst stünde der Kommentar bei allen Videos der Runde.
--
-- ROLLBACK:
--   ALTER TABLE public.kooperation_video_zeitkommentar
--     DROP CONSTRAINT IF EXISTS kooperation_video_zeitkommentar_bild_ohne_zeit,
--     DROP CONSTRAINT IF EXISTS kooperation_video_zeitkommentar_eine_datei,
--     DROP COLUMN IF EXISTS still_asset_id,
--     DROP COLUMN IF EXISTS story_asset_id;

BEGIN;

ALTER TABLE public.kooperation_video_zeitkommentar
  ADD COLUMN IF NOT EXISTS story_asset_id uuid REFERENCES public.kooperation_story_asset(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS still_asset_id uuid REFERENCES public.kooperation_bilder_asset(id) ON DELETE SET NULL;

ALTER TABLE public.kooperation_video_zeitkommentar
  DROP CONSTRAINT IF EXISTS kooperation_video_zeitkommentar_eine_datei,
  ADD CONSTRAINT kooperation_video_zeitkommentar_eine_datei
    CHECK (num_nonnulls(asset_id, story_asset_id, still_asset_id) <= 1),
  DROP CONSTRAINT IF EXISTS kooperation_video_zeitkommentar_bild_ohne_zeit,
  ADD CONSTRAINT kooperation_video_zeitkommentar_bild_ohne_zeit
    CHECK (still_asset_id IS NULL OR timecode_sec IS NULL);

CREATE INDEX IF NOT EXISTS idx_kooperation_video_zeitkommentar_story_asset
  ON public.kooperation_video_zeitkommentar(story_asset_id) WHERE story_asset_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kooperation_video_zeitkommentar_still_asset
  ON public.kooperation_video_zeitkommentar(still_asset_id) WHERE still_asset_id IS NOT NULL;

COMMIT;
