-- Vertrag-Status am Vertrag (nicht Kooperation) + Mailvorlage pro Dokumenttyp.
-- Siehe docs/adr/0026-vertrag-status-am-vertrag.md

-- =====================================================================
-- 1) vertraege.status
-- =====================================================================

ALTER TABLE public.vertraege
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.vertraege
SET status = CASE
  WHEN dropbox_file_url IS NOT NULL OR unterschriebener_vertrag_url IS NOT NULL THEN 'unterschrieben'
  WHEN coalesce(is_draft, false) THEN 'entwurf'
  WHEN datei_url IS NOT NULL THEN 'erstellt'
  ELSE 'entwurf'
END
WHERE status IS NULL;

ALTER TABLE public.vertraege
  ALTER COLUMN status SET DEFAULT 'entwurf';

ALTER TABLE public.vertraege
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.vertraege
  DROP CONSTRAINT IF EXISTS vertraege_status_check;

ALTER TABLE public.vertraege
  ADD CONSTRAINT vertraege_status_check
  CHECK (status IN ('entwurf', 'erstellt', 'gesendet', 'unterschrieben', 'verzoegert', 'abgelehnt'));

CREATE INDEX IF NOT EXISTS idx_vertraege_status ON public.vertraege (status);

-- =====================================================================
-- 2) mailvorlage.dokument_typ — Standard pro Typ
-- =====================================================================

ALTER TABLE public.mailvorlage
  ADD COLUMN IF NOT EXISTS dokument_typ text;

UPDATE public.mailvorlage
SET dokument_typ = 'briefing'
WHERE dokument_typ IS NULL;

ALTER TABLE public.mailvorlage
  ALTER COLUMN dokument_typ SET DEFAULT 'briefing';

ALTER TABLE public.mailvorlage
  ALTER COLUMN dokument_typ SET NOT NULL;

ALTER TABLE public.mailvorlage
  DROP CONSTRAINT IF EXISTS mailvorlage_dokument_typ_check;

ALTER TABLE public.mailvorlage
  ADD CONSTRAINT mailvorlage_dokument_typ_check
  CHECK (dokument_typ IN ('briefing', 'vertrag'));

DROP INDEX IF EXISTS uq_mailvorlage_standard;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mailvorlage_standard_per_typ
  ON public.mailvorlage (dokument_typ)
  WHERE is_standard;

INSERT INTO public.mailvorlage (name, betreff, body, empfaenger_typ, is_standard, is_shared, dokument_typ)
SELECT
  'Standard',
  'Vertrag: {{vertrag}}',
  'Hallo {{vorname}},

anbei der Vertrag „{{vertrag}}"{{#unternehmen}} für {{unternehmen}}{{/unternehmen}} als PDF.

Bitte unterschreiben und zurücksenden.

Viele Grüße',
  NULL,
  true,
  true,
  'vertrag'
WHERE NOT EXISTS (
  SELECT 1 FROM public.mailvorlage WHERE is_standard AND dokument_typ = 'vertrag'
);
