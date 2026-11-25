-- Ad-Manager-Dateiname: zweiter Name neben dem Anzeigetitel (titel).
-- Wird gesetzt, wenn das Team die Datei für den Ad Manager umbenennt. Die Datei in Dropbox
-- heißt dann genauso (ohne Endung gespeichert); Downloads nutzen diesen Namen.
--
-- Rollback: ALTER TABLE public.kooperation_video_asset DROP COLUMN ad_manager_name;

ALTER TABLE public.kooperation_video_asset
  ADD COLUMN IF NOT EXISTS ad_manager_name text;
