-- Erlaube neuen Rechnungsstatus "Marc an Qonto gesendet"
-- Bestehender CHECK rechnung_status_check wird ersetzt.

ALTER TABLE public.rechnung
  DROP CONSTRAINT IF EXISTS rechnung_status_check;

ALTER TABLE public.rechnung
  ADD CONSTRAINT rechnung_status_check
  CHECK (status IN (
    'Offen',
    'Rückfrage',
    'Bezahlt',
    'An Qonto gesendet',
    'Marc an Qonto gesendet'
  ));
