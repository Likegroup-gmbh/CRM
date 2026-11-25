-- Zeitpunkt des letzten Anschreibens. Verzögert = 30 Tage nach gesendet_am
-- ohne unterschriebenes PDF. Uhr startet bei erneutem Versand neu.

ALTER TABLE public.vertraege
  ADD COLUMN IF NOT EXISTS gesendet_am timestamptz;

UPDATE public.vertraege v
SET gesendet_am = s.last_sent
FROM (
  SELECT dokument_id, max(sent_at) AS last_sent
  FROM public.anschreiben_log
  WHERE dokument_typ = 'vertrag'
    AND status = 'sent'
    AND sent_at IS NOT NULL
  GROUP BY dokument_id
) s
WHERE v.id = s.dokument_id
  AND v.gesendet_am IS NULL;

UPDATE public.vertraege
SET status = 'verzoegert'
WHERE status = 'gesendet'
  AND gesendet_am IS NOT NULL
  AND gesendet_am <= now() - interval '30 days'
  AND dropbox_file_url IS NULL
  AND unterschriebener_vertrag_url IS NULL;
