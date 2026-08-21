-- RLS auf kooperation_video_asset / kooperation_story_asset: inline Joins
-- durch den bestehenden SECURITY-DEFINER-Helper ersetzen. Dieselbe Semantik
-- wie kooperation_video_comment (Staff + Kunde ueber Marke oder Unternehmen),
-- ohne RLS-Reentry auf den Join-Tabellen. MEGGLE hat marke_id = null — der
-- Unternehmen-Zweig muss bleiben.
--
-- Gast-Policies gibt es auf diesen Tabellen nicht.

BEGIN;

DROP POLICY IF EXISTS kooperation_video_asset_select ON public.kooperation_video_asset;
CREATE POLICY kooperation_video_asset_select ON public.kooperation_video_asset
  FOR SELECT
  USING ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_story_asset_select ON public.kooperation_story_asset;
CREATE POLICY kooperation_story_asset_select ON public.kooperation_story_asset
  FOR SELECT
  USING ((SELECT can_access_video_comment(video_id)));

COMMIT;
