-- Skript-Anschreiben: Ansprechpartner nur als Empfaenger-Typ, Mailvorlage pro Skript.
-- Siehe docs/adr/0029-ansprechpartner-nur-skript-anschreiben.md.

ALTER TABLE public.mailvorlage
  DROP CONSTRAINT IF EXISTS mailvorlage_empfaenger_typ_check;

ALTER TABLE public.mailvorlage
  ADD CONSTRAINT mailvorlage_empfaenger_typ_check
  CHECK (empfaenger_typ IS NULL OR empfaenger_typ IN ('creator', 'management', 'ansprechpartner'));

ALTER TABLE public.anschreiben_log
  DROP CONSTRAINT IF EXISTS anschreiben_log_empfaenger_typ_check;

ALTER TABLE public.anschreiben_log
  ADD CONSTRAINT anschreiben_log_empfaenger_typ_check
  CHECK (empfaenger_typ IN ('creator', 'management', 'ansprechpartner'));

ALTER TABLE public.mailvorlage
  DROP CONSTRAINT IF EXISTS mailvorlage_dokument_typ_check;

ALTER TABLE public.mailvorlage
  ADD CONSTRAINT mailvorlage_dokument_typ_check
  CHECK (dokument_typ IN ('briefing', 'vertrag', 'skript'));

INSERT INTO public.mailvorlage (name, betreff, body, empfaenger_typ, is_standard, is_shared, dokument_typ)
SELECT
  'Standard',
  'Skript: {{skript}}',
  'Hallo {{vorname}},

anbei das Skript „{{skript}}"{{#kampagne}} zur Kampagne {{kampagne}}{{/kampagne}}{{#unternehmen}} für {{unternehmen}}{{/unternehmen}} als PDF.

Bei Fragen antworte einfach auf diese E-Mail.

Viele Grüße',
  NULL,
  true,
  true,
  'skript'
WHERE NOT EXISTS (
  SELECT 1 FROM public.mailvorlage WHERE is_standard AND dokument_typ = 'skript'
);
