-- Rohmaterial-Intake: der Creator laedt sein Rohmaterial ab, intern wird daraus
-- geschnitten. Ersetzt die Mail-Kette (Creator -> Mitarbeiter -> Cutter).
--
-- kooperation_rohmaterial_asset haengt an der Kooperation, nicht an einem Video:
-- der Creator liefert einen Stapel Clips, bevor die Video-Slots geschnitten sind.
-- Keine version_number/is_current: es gibt keine Feedbackschleifen im Rohmaterial,
-- jede Datei steht fuer sich.
--
-- Bewusst nur intern sichtbar (kein Kunden-Zweig wie bei kooperation_bilder_asset):
-- Rohmaterial ist Schnitt-Input, der Kunde sieht ausschliesslich die
-- Feedbackschleifen/Finale-Assets in kooperation_video_asset.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kooperation_rohmaterial_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kooperation_id uuid NOT NULL REFERENCES public.kooperationen(id) ON DELETE CASCADE,
  file_url text,
  file_path text,
  file_name text,
  file_size bigint,
  folder_url text,
  -- null = Creator-Upload ueber den tokenisierten Link (kein Benutzer-Kontext)
  uploaded_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kooperation_rohmaterial_asset_koop
  ON public.kooperation_rohmaterial_asset(kooperation_id, created_at DESC);

-- Kollisions-Check beim Finalisieren laeuft ueber file_path
CREATE INDEX IF NOT EXISTS idx_kooperation_rohmaterial_asset_path
  ON public.kooperation_rohmaterial_asset(file_path);

ALTER TABLE public.kooperation_rohmaterial_asset ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kooperation_rohmaterial_asset_select ON public.kooperation_rohmaterial_asset;
CREATE POLICY kooperation_rohmaterial_asset_select ON public.kooperation_rohmaterial_asset
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS kooperation_rohmaterial_asset_insert ON public.kooperation_rohmaterial_asset;
CREATE POLICY kooperation_rohmaterial_asset_insert ON public.kooperation_rohmaterial_asset
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS kooperation_rohmaterial_asset_update ON public.kooperation_rohmaterial_asset;
CREATE POLICY kooperation_rohmaterial_asset_update ON public.kooperation_rohmaterial_asset
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS kooperation_rohmaterial_asset_delete ON public.kooperation_rohmaterial_asset;
CREATE POLICY kooperation_rohmaterial_asset_delete ON public.kooperation_rohmaterial_asset
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

COMMENT ON TABLE public.kooperation_rohmaterial_asset IS
  'Rohmaterial-Dateien einer Kooperation (Creator-Intake). Nur intern sichtbar, '
  'Quelle der Wahrheit fuer die Rohmaterial-Liste unter /videos.';

-- ─── creator_upload_job: neuer Zieltyp ───────────────────────

ALTER TABLE public.creator_upload_job
  DROP CONSTRAINT IF EXISTS creator_upload_job_target_type_check;
ALTER TABLE public.creator_upload_job
  ADD CONSTRAINT creator_upload_job_target_type_check
  CHECK (target_type IN ('video', 'story', 'bilder', 'rohmaterial'));

-- Der In-Flight-Lock schuetzt die FS-Seriennummern-Vergabe (ein aktiver Job pro
-- Ziel). Rohmaterial hat keine Seriennummern und ist ein Multi-Datei-Dump auf
-- dieselbe Kooperation -> dort wuerde der Lock parallele Uploads blockieren.
DROP INDEX IF EXISTS public.creator_upload_job_inflight_unique;
CREATE UNIQUE INDEX creator_upload_job_inflight_unique
  ON public.creator_upload_job (target_type, target_id)
  WHERE status IN ('pending', 'processing') AND target_type <> 'rohmaterial';

-- ─── Staging: groessere Rohmaterial-Dateien + zip ────────────
-- Rohmaterial kommt unkomprimiert vom Creator; 2 GB reicht dafuer nicht.
UPDATE storage.buckets
SET file_size_limit = 10737418240,
    allowed_mime_types = ARRAY[
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
      'image/gif', 'image/bmp', 'image/tiff', 'image/avif',
      'application/zip'
    ]
WHERE id = 'creator-upload-staging';

COMMIT;
