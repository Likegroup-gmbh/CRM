-- Videolänge als geschlossenes Sekundenintervall. Altspalten bleiben,
-- der Editor übersetzt sie beim Öffnen. Kein Daten-Update.

ALTER TABLE public.campaign_briefings
  ADD COLUMN IF NOT EXISTS videolaenge_von integer,
  ADD COLUMN IF NOT EXISTS videolaenge_bis integer;

ALTER TABLE public.campaign_briefings
  DROP CONSTRAINT IF EXISTS campaign_briefings_videolaenge_intervall;

ALTER TABLE public.campaign_briefings
  ADD CONSTRAINT campaign_briefings_videolaenge_intervall
  CHECK (
    (videolaenge_von IS NULL AND videolaenge_bis IS NULL)
    OR (
      videolaenge_von BETWEEN 1 AND 180
      AND videolaenge_bis BETWEEN videolaenge_von AND 180
    )
  );

COMMENT ON COLUMN public.campaign_briefings.videolaenge_von IS
  'Videolänge, untere Sekunde inklusive. Zusammen mit videolaenge_bis leer oder gesetzt.';
COMMENT ON COLUMN public.campaign_briefings.videolaenge_bis IS
  'Videolänge, obere Sekunde inklusive.';
