-- Einladung und Einreichung (ADR 0055)
-- Kunden füllen Produkt oder Briefing ohne Konto aus (Link + Code). Das Abgeschickte
-- ist eine Einreichung und liegt hier, nicht in produkt / campaign_briefings.
-- Erst "Anlegen" durch einen Mitarbeiter schreibt dorthin.
-- Kein anon-Zugriff: Anlegen, Prüfen und Absenden laufen über die Edge Function
-- `einladung` mit Service Role.

BEGIN;

-- =====================================================================
-- 1) einladung
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.einladung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  code_hash text NOT NULL,
  art text NOT NULL CHECK (art IN ('produkt', 'briefing')),
  label text NOT NULL DEFAULT 'Einladung',
  unternehmen_id uuid NOT NULL REFERENCES public.unternehmen(id) ON DELETE CASCADE,
  marke_id uuid REFERENCES public.marke(id) ON DELETE SET NULL,
  produktion_id uuid REFERENCES public.produktion(id) ON DELETE CASCADE,
  briefing_typ text CHECK (briefing_typ IN ('paid_creator_ads', 'owned_social', 'influencer_marketing')),
  created_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_access_at timestamptz,
  CONSTRAINT einladung_art_felder CHECK (
    (art = 'briefing' AND produktion_id IS NOT NULL AND briefing_typ IS NOT NULL)
    OR
    (art = 'produkt' AND produktion_id IS NULL AND briefing_typ IS NULL)
  )
);

COMMENT ON TABLE public.einladung IS
  'Link + Code ohne Konto, mit dem ein Kunde ein Formular abschickt. Produkt-Einladung an Marke/Unternehmen, Briefing-Einladung an einer Produktion mit Briefing-Typ.';

CREATE INDEX IF NOT EXISTS einladung_produktion_idx ON public.einladung (produktion_id) WHERE produktion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS einladung_unternehmen_idx ON public.einladung (unternehmen_id, marke_id);

-- =====================================================================
-- 2) einreichung
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.einreichung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einladung_id uuid NOT NULL REFERENCES public.einladung(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'angelegt', 'verworfen')),
  absender_name text NOT NULL,
  payload jsonb NOT NULL,
  dateien jsonb NOT NULL DEFAULT '[]'::jsonb,
  produkt_id uuid REFERENCES public.produkt(id) ON DELETE SET NULL,
  briefing_id uuid REFERENCES public.campaign_briefings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  erledigt_am timestamptz,
  erledigt_von uuid REFERENCES public.benutzer(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.einreichung IS
  'Was über eine Einladung abgeschickt wurde. Noch kein Produkt und kein Briefing. payload bleibt unverändert.';

CREATE INDEX IF NOT EXISTS einreichung_einladung_idx ON public.einreichung (einladung_id, status);
CREATE INDEX IF NOT EXISTS einreichung_offen_idx ON public.einreichung (created_at DESC) WHERE status = 'offen';

-- payload, dateien und Herkunft sind nach dem Absenden fest; nur der Status wandert
-- (offen -> angelegt | verworfen), danach ist die Zeile abgeschlossen.
CREATE OR REPLACE FUNCTION public.einreichung_schuetzen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.payload IS DISTINCT FROM OLD.payload
     OR NEW.dateien IS DISTINCT FROM OLD.dateien
     OR NEW.einladung_id IS DISTINCT FROM OLD.einladung_id
     OR NEW.absender_name IS DISTINCT FROM OLD.absender_name
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Eine abgeschickte Einreichung bleibt unverändert.';
  END IF;
  IF OLD.status <> 'offen' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Diese Einreichung ist schon abgeschlossen.';
  END IF;
  IF NEW.status <> OLD.status AND NEW.erledigt_am IS NULL THEN
    NEW.erledigt_am := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS einreichung_schuetzen ON public.einreichung;
CREATE TRIGGER einreichung_schuetzen
  BEFORE UPDATE ON public.einreichung
  FOR EACH ROW EXECUTE FUNCTION public.einreichung_schuetzen();

-- =====================================================================
-- 3) Rate-Limit für Code-Versuche
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.einladung_verify_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  einladung_id uuid NOT NULL REFERENCES public.einladung(id) ON DELETE CASCADE,
  aktion text NOT NULL DEFAULT 'verify' CHECK (aktion IN ('verify', 'upload', 'submit')),
  ip text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_einladung_verify_attempts_window
  ON public.einladung_verify_attempts (einladung_id, aktion, attempted_at);

-- =====================================================================
-- 4) RLS und Grants: kein anon, Kunden schreiben nur über die Edge Function
-- =====================================================================

ALTER TABLE public.einladung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einreichung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.einladung_verify_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.einladung FROM anon, authenticated;
REVOKE ALL ON public.einreichung FROM anon, authenticated;
REVOKE ALL ON public.einladung_verify_attempts FROM anon, authenticated;

-- Staff liest Einladungen ohne code_hash. Anlegen, Widerrufen, Code rotieren: Edge Function.
GRANT SELECT (
  id, token, art, label, unternehmen_id, marke_id, produktion_id, briefing_typ,
  created_by, created_at, expires_at, revoked_at, last_access_at
) ON public.einladung TO authenticated;

GRANT SELECT ON public.einreichung TO authenticated;
GRANT UPDATE (status, produkt_id, briefing_id, erledigt_am, erledigt_von)
  ON public.einreichung TO authenticated;
GRANT DELETE ON public.einreichung TO authenticated;

DROP POLICY IF EXISTS einladung_select_staff ON public.einladung;
CREATE POLICY einladung_select_staff ON public.einladung
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS einreichung_select_staff ON public.einreichung;
CREATE POLICY einreichung_select_staff ON public.einreichung
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS einreichung_update_staff ON public.einreichung;
CREATE POLICY einreichung_update_staff ON public.einreichung
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS einreichung_delete_staff ON public.einreichung;
CREATE POLICY einreichung_delete_staff ON public.einreichung
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

-- einladung_verify_attempts: keine Policies, nur Service Role.

-- =====================================================================
-- 5) Storage: privater Bucket für Bilder und Referenzdateien
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'einreichung', 'einreichung', false, 26214400,
  ARRAY[
    'image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Uploads kommen nur über die Edge Function (Service Role umgeht RLS).
-- Staff liest für das Review und räumt beim Verwerfen auf.
DROP POLICY IF EXISTS einreichung_storage_select_staff ON storage.objects;
CREATE POLICY einreichung_storage_select_staff ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'einreichung' AND (SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS einreichung_storage_delete_staff ON storage.objects;
CREATE POLICY einreichung_storage_delete_staff ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'einreichung' AND (SELECT is_admin_or_mitarbeiter()));

COMMIT;
