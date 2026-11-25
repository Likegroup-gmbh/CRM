-- Videolänge pro Funnel-Stufe (nur Paid): ein Sekundenintervall je Stufe.
-- Form: { "upper": { "von": 15, "bis": 20 }, "mid": { ... }, "lower": { ... } }
-- Keys nur upper/mid/lower (Briefing-Vokabular, nicht top/mid/bottom des Skripts).
--
-- videolaenge_von/bis bleiben der allgemeine Wert: gilt für Videoideen ohne Stufe
-- und für Stufen ohne eigenes Intervall. Keine Datenkopie nötig, null = unverändert.
-- Reihenfolge beim Ausrollen: erst diese Migration, dann der Deploy.

ALTER TABLE public.campaign_briefings
  ADD COLUMN IF NOT EXISTS videolaenge_funnel jsonb;

CREATE OR REPLACE FUNCTION public.videolaenge_funnel_gueltig(v jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    v IS NULL
    OR (
      jsonb_typeof(v) = 'object'
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_each(v) AS e(stufe, iv)
        WHERE e.stufe NOT IN ('upper', 'mid', 'lower')
          OR jsonb_typeof(e.iv) <> 'object'
          OR jsonb_typeof(e.iv -> 'von') <> 'number'
          OR jsonb_typeof(e.iv -> 'bis') <> 'number'
          OR (e.iv ->> 'von') !~ '^[0-9]+$'
          OR (e.iv ->> 'bis') !~ '^[0-9]+$'
          OR (e.iv ->> 'von')::integer NOT BETWEEN 1 AND 180
          OR (e.iv ->> 'bis')::integer NOT BETWEEN (e.iv ->> 'von')::integer AND 180
      )
    );
$$;

ALTER TABLE public.campaign_briefings
  DROP CONSTRAINT IF EXISTS campaign_briefings_videolaenge_funnel_check;

ALTER TABLE public.campaign_briefings
  ADD CONSTRAINT campaign_briefings_videolaenge_funnel_check
  CHECK (public.videolaenge_funnel_gueltig(videolaenge_funnel));

COMMENT ON COLUMN public.campaign_briefings.videolaenge_funnel IS
  'Paid: Videolänge je Funnel-Stufe als { upper|mid|lower: { von, bis } }, Sekunden inklusive. Fehlt eine Stufe, gilt videolaenge_von/bis.';
