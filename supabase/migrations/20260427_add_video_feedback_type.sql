ALTER TABLE public.kooperation_video_comment
  ADD COLUMN IF NOT EXISTS feedback_typ text;

UPDATE public.kooperation_video_comment
SET
  feedback_typ = CASE
    WHEN runde = 2 THEN 'kunde'
    ELSE 'cj'
  END,
  runde = CASE
    WHEN runde = 2 THEN 1
    ELSE runde
  END
WHERE feedback_typ IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kooperation_video_comment_feedback_typ_check'
      AND conrelid = 'public.kooperation_video_comment'::regclass
  ) THEN
    ALTER TABLE public.kooperation_video_comment
      ADD CONSTRAINT kooperation_video_comment_feedback_typ_check
      CHECK (feedback_typ IN ('cj', 'kunde'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'kooperation_video_comment_runde_check'
      AND conrelid = 'public.kooperation_video_comment'::regclass
  ) THEN
    ALTER TABLE public.kooperation_video_comment
      ADD CONSTRAINT kooperation_video_comment_runde_check
      CHECK (runde IN (1, 2));
  END IF;
END $$;

ALTER TABLE public.kooperation_video_comment
  ALTER COLUMN feedback_typ SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kooperation_video_comment_video_feedback
  ON public.kooperation_video_comment(video_id, runde, feedback_typ)
  WHERE deleted_at IS NULL;
