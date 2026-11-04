-- Kommentare mit Timecode am Kooperationsvideo (Videos-Tab, Spaltenbrowser).
--
-- kooperation_video_comment haelt genau eine editierbare Notiz pro Slot
-- (video_id, runde, feedback_typ; Upsert in VideoFeedbackRepository). Mehrere
-- Kommentare an Stellen im Video passen nicht in dieses Modell, deshalb eine
-- additive Tabelle daneben. Die vorhandenen Slot-Notizen bleiben unberuehrt
-- und erscheinen im Detail als Kommentare ohne Timecode.
--
-- runde = Feedbackschleife (1..3), feedback_typ wie in kooperation_video_comment.
-- Rechte wie dort: Staff plus Kunde ueber Marke oder Unternehmen.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kooperation_video_zeitkommentar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.kooperation_videos(id) ON DELETE CASCADE,
  runde integer NOT NULL CHECK (runde = ANY (ARRAY[1, 2, 3])),
  feedback_typ text NOT NULL CHECK (feedback_typ IN ('cj', 'kunde')),
  text text NOT NULL,
  -- Datei der Feedbackschleife, auf die sich der Kommentar bezieht (null = ganze Schleife)
  asset_id uuid REFERENCES public.kooperation_video_asset(id) ON DELETE SET NULL,
  -- null = nicht an eine Stelle im Video geheftet
  timecode_sec numeric(8, 2) CHECK (timecode_sec IS NULL OR timecode_sec >= 0),
  author_benutzer_id uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  author_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kooperation_video_zeitkommentar_video
  ON public.kooperation_video_zeitkommentar(video_id, runde, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.kooperation_video_zeitkommentar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kooperation_video_zeitkommentar_select ON public.kooperation_video_zeitkommentar;
CREATE POLICY kooperation_video_zeitkommentar_select ON public.kooperation_video_zeitkommentar
  FOR SELECT TO authenticated
  USING ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_video_zeitkommentar_insert ON public.kooperation_video_zeitkommentar;
CREATE POLICY kooperation_video_zeitkommentar_insert ON public.kooperation_video_zeitkommentar
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT can_access_video_comment(video_id)));

DROP POLICY IF EXISTS kooperation_video_zeitkommentar_update ON public.kooperation_video_zeitkommentar;
CREATE POLICY kooperation_video_zeitkommentar_update ON public.kooperation_video_zeitkommentar
  FOR UPDATE TO authenticated
  USING ((SELECT can_access_video_comment(video_id)))
  WITH CHECK ((SELECT can_access_video_comment(video_id)));

COMMIT;
