-- Finale-Version-Uploads fuer Storys
-- kooperation_story_asset: is_final-Flag analog zu kooperation_video_asset

ALTER TABLE public.kooperation_story_asset
  ADD COLUMN is_final boolean NOT NULL DEFAULT false;
