-- Schlussrechnung-Markierung (ADR 0015): eine als letzte markierte Teilrechnung
-- schliesst die Kooperation unabhaengig vom Restbetrag ab. Ein offener Restbetrag
-- gilt dann als Minderabrechnung.

ALTER TABLE public.rechnung
  ADD COLUMN IF NOT EXISTS ist_schlussrechnung boolean NOT NULL DEFAULT false;
