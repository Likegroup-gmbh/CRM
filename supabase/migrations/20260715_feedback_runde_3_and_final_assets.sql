-- Feedback Runde 3 + Finale-Version-Assets
-- 1) kooperation_video_comment: Runde 3 erlauben
-- 2) kooperation_video_asset: is_final-Flag fuer finale Versionen (9:16 / 4:5)

ALTER TABLE public.kooperation_video_comment
  DROP CONSTRAINT kooperation_video_comment_runde_check;

ALTER TABLE public.kooperation_video_comment
  ADD CONSTRAINT kooperation_video_comment_runde_check CHECK (runde = ANY (ARRAY[1, 2, 3]));

ALTER TABLE public.kooperation_video_asset
  ADD COLUMN is_final boolean NOT NULL DEFAULT false;
