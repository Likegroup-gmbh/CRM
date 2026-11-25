-- Videos-Tab für Gäste geteilter Kampagnen (ADR 0072): Gäste lesen die Dateien der Videos.
-- Kommentare, Varianten-Tags und die Freigabe-RPC kennen Gäste schon (gast_can_access_video),
-- die Datei-Tabellen prüften nur Team und Kunden: der Tab bliebe für Gäste leer, und
-- ablage-link (Aufrufer-JWT unter RLS) gäbe keine Wiedergabe-Links heraus.
-- Rohmaterial bleibt Team-Sache.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS kooperation_video_asset_gast_select ON public.kooperation_video_asset;
--   DROP POLICY IF EXISTS kooperation_story_gast_select ON public.kooperation_story;
--   DROP POLICY IF EXISTS kooperation_story_asset_gast_select ON public.kooperation_story_asset;
--   DROP POLICY IF EXISTS kooperation_bilder_asset_gast_select ON public.kooperation_bilder_asset;

DROP POLICY IF EXISTS kooperation_video_asset_gast_select ON public.kooperation_video_asset;
CREATE POLICY kooperation_video_asset_gast_select ON public.kooperation_video_asset
  FOR SELECT
  USING ((SELECT public.current_role_is_gast()) AND public.gast_can_access_video(video_id, false));

DROP POLICY IF EXISTS kooperation_story_gast_select ON public.kooperation_story;
CREATE POLICY kooperation_story_gast_select ON public.kooperation_story
  FOR SELECT
  USING ((SELECT public.current_role_is_gast()) AND public.gast_can_access_video(video_id, false));

DROP POLICY IF EXISTS kooperation_story_asset_gast_select ON public.kooperation_story_asset;
CREATE POLICY kooperation_story_asset_gast_select ON public.kooperation_story_asset
  FOR SELECT
  USING ((SELECT public.current_role_is_gast()) AND public.gast_can_access_video(video_id, false));

DROP POLICY IF EXISTS kooperation_bilder_asset_gast_select ON public.kooperation_bilder_asset;
CREATE POLICY kooperation_bilder_asset_gast_select ON public.kooperation_bilder_asset
  FOR SELECT
  USING ((SELECT public.current_role_is_gast()) AND public.gast_can_access_kooperation(kooperation_id, false));
