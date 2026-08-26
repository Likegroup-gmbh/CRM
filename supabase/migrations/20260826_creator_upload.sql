-- Creator-Upload (tokenisiert, oeffentlich):
-- creator_upload_token  : ein aktiver Token pro (kampagne_id, creator_id)
-- creator_upload_job    : Upload-Auftraege inkl. Staging-Key und Ziel
-- Staging-Bucket        : privat, service-role only
-- kooperation_video_asset: file_size/file_name nachgezogen (Story/Bilder haben sie)
--
-- Kein Unique-Index auf kooperation_video_asset(video_id, version_number):
-- Bestandsdaten enthalten Duplikate. Die Seriennummern-Vergabe laeuft ueber
-- den In-Flight-Unique-Index auf creator_upload_job (ein aktiver Job pro Ziel)
-- plus Re-Check beim Finalisieren. Story-Assets sind sauber -> Index dort.

BEGIN;

CREATE TABLE IF NOT EXISTS public.creator_upload_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  -- AES-256-GCM verschluesselter Roh-Token (Server-Env-Key), damit derselbe
  -- Link erneut gemailt werden kann. Kein Klartext.
  token_encrypted text NOT NULL,
  kampagne_id uuid NOT NULL REFERENCES public.kampagne(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creator(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sent_at timestamptz,
  mail_count integer NOT NULL DEFAULT 0,
  mail_window_start timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_upload_token_active_unique
  ON public.creator_upload_token (kampagne_id, creator_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.creator_upload_token ENABLE ROW LEVEL SECURITY;
-- Bewusst keine Policies: deny-all fuer anon + authenticated.
-- Zugriff ausschliesslich ueber service role in den Netlify Functions.

CREATE TABLE IF NOT EXISTS public.creator_upload_job (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id uuid NOT NULL REFERENCES public.creator_upload_token(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('video', 'story', 'bilder')),
  -- video: kooperation_videos.id | story: kooperation_story.id | bilder: kooperationen.id
  target_id uuid NOT NULL,
  staging_key text NOT NULL UNIQUE,
  version_number integer,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  content_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed', 'aborted')),
  dropbox_path text,
  dropbox_save_job_id text,
  asset_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ein aktiver Upload pro Ziel (Doppelklick / parallele Tabs).
CREATE UNIQUE INDEX IF NOT EXISTS creator_upload_job_inflight_unique
  ON public.creator_upload_job (target_type, target_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS creator_upload_job_token_idx
  ON public.creator_upload_job (token_id, created_at DESC);

ALTER TABLE public.creator_upload_job ENABLE ROW LEVEL SECURITY;
-- Ebenfalls deny-all; nur service role.

-- Video-Assets: file_size/file_name wie bei Story/Bilder
ALTER TABLE public.kooperation_video_asset ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.kooperation_video_asset ADD COLUMN IF NOT EXISTS file_name text;

-- Story-Assets: Datenbestand sauber -> harte Unique-Regel
CREATE UNIQUE INDEX IF NOT EXISTS kooperation_story_asset_fs_unique
  ON public.kooperation_story_asset (story_id, version_number)
  WHERE NOT is_final;

-- Privates Staging (2 GB Cap; feinere Limits serverseitig pro Zieltyp)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-upload-staging',
  'creator-upload-staging',
  false,
  2147483648,
  ARRAY[
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'image/gif', 'image/bmp', 'image/tiff', 'image/avif'
  ]
)
ON CONFLICT (id) DO NOTHING;
-- Keine storage.objects-Policies fuer diesen Bucket: nur service role.

COMMIT;
