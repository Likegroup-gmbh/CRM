-- Stills-Versionierung + Final-Markierung (Promote ohne Re-Upload)
-- 1) kooperation_video_asset.source_asset_id
-- 2) kooperation_bilder_asset: Versionierung analog Video
-- 3) kooperation_still_comment + RLS (Player-Feedback, keine Tabellenspalten)

BEGIN;

ALTER TABLE public.kooperation_video_asset
  ADD COLUMN IF NOT EXISTS source_asset_id uuid REFERENCES public.kooperation_video_asset(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kooperation_video_asset_source
  ON public.kooperation_video_asset(source_asset_id)
  WHERE source_asset_id IS NOT NULL;

ALTER TABLE public.kooperation_bilder_asset
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_final boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variant_name text,
  ADD COLUMN IF NOT EXISTS source_asset_id uuid REFERENCES public.kooperation_bilder_asset(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kooperation_bilder_asset_video_final
  ON public.kooperation_bilder_asset(video_id, is_final);

CREATE TABLE IF NOT EXISTS public.kooperation_still_comment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.kooperation_videos(id) ON DELETE CASCADE,
  runde integer NOT NULL,
  feedback_typ text NOT NULL,
  text text,
  author_name text,
  author_benutzer_id uuid,
  is_public boolean NOT NULL DEFAULT true,
  deleted_at timestamptz,
  deleted_by_benutzer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz,
  CONSTRAINT kooperation_still_comment_runde_check CHECK (runde = ANY (ARRAY[1, 2, 3])),
  CONSTRAINT kooperation_still_comment_feedback_typ_check CHECK (feedback_typ IN ('cj', 'kunde')),
  CONSTRAINT kooperation_still_comment_slot_key UNIQUE (video_id, runde, feedback_typ)
);

CREATE INDEX IF NOT EXISTS idx_kooperation_still_comment_video_feedback
  ON public.kooperation_still_comment(video_id, runde, feedback_typ)
  WHERE deleted_at IS NULL;

ALTER TABLE public.kooperation_still_comment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kooperation_still_comment_select ON public.kooperation_still_comment;
CREATE POLICY kooperation_still_comment_select ON public.kooperation_still_comment
  FOR SELECT
  USING ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_still_comment_insert ON public.kooperation_still_comment;
CREATE POLICY kooperation_still_comment_insert ON public.kooperation_still_comment
  FOR INSERT
  WITH CHECK ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_still_comment_update ON public.kooperation_still_comment;
CREATE POLICY kooperation_still_comment_update ON public.kooperation_still_comment
  FOR UPDATE
  USING ((SELECT can_access_video_comment(video_id)))
  WITH CHECK ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_still_comment_delete ON public.kooperation_still_comment;
CREATE POLICY kooperation_still_comment_delete ON public.kooperation_still_comment
  FOR DELETE
  USING ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_still_comment_gast_select ON public.kooperation_still_comment;
CREATE POLICY kooperation_still_comment_gast_select ON public.kooperation_still_comment
  FOR SELECT USING (gast_can_access_video(video_id, false));

DROP POLICY IF EXISTS kooperation_still_comment_gast_insert ON public.kooperation_still_comment;
CREATE POLICY kooperation_still_comment_gast_insert ON public.kooperation_still_comment
  FOR INSERT WITH CHECK (gast_can_access_video(video_id, true));

DROP POLICY IF EXISTS kooperation_still_comment_gast_update ON public.kooperation_still_comment;
CREATE POLICY kooperation_still_comment_gast_update ON public.kooperation_still_comment
  FOR UPDATE
  USING (gast_can_access_video(video_id, true))
  WITH CHECK (gast_can_access_video(video_id, true));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kooperation_still_comment TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.kooperation_still_comment TO anon;

COMMIT;
