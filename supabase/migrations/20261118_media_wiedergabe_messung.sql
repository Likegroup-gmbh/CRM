-- Wiedergabe-Messung im Videos-Tab (SLO: p95 erstes Bild < 1,5 s, keine Stalls
-- in den ersten 60 s).
--
-- Eine Zeile pro Wiedergabe, geschrieben vom Browser (append-only: es gibt keine
-- Update- oder Delete-Policy). Perzentile kommen aus Rohwerten echter Sessions,
-- nicht aus der Konsole einzelner Nutzer. Die View rechnet p50/p95/p99 getrennt
-- nach Ansicht, Quelle und Format, damit jede Phase gegen die Baseline steht.
--
-- asset_id ohne Fremdschluessel: die Messung bleibt, auch wenn die Datei geht.
--
-- ROLLBACK:
--   DROP VIEW IF EXISTS public.media_wiedergabe_perzentile;
--   DROP TABLE IF EXISTS public.media_wiedergabe_messung;

BEGIN;

CREATE TABLE IF NOT EXISTS public.media_wiedergabe_messung (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  auth_user_id uuid DEFAULT auth.uid(),
  ansicht text NOT NULL CHECK (ansicht IN ('team', 'kunde')),
  asset_id uuid,
  quelle text NOT NULL CHECK (quelle IN ('original', 'blob', 'vorschau')),
  format text,
  -- Laden bis erstes Bild (inkl. Link-Aufloesung)
  ttff_ms integer CHECK (ttff_ms IS NULL OR ttff_ms >= 0),
  -- Play bis erstes `playing`
  start_ms integer CHECK (start_ms IS NULL OR start_ms >= 0),
  stalls integer NOT NULL DEFAULT 0 CHECK (stalls >= 0),
  stall_ms integer NOT NULL DEFAULT 0 CHECK (stall_ms >= 0),
  abgespielt_sek numeric(8, 2),
  fehler boolean NOT NULL DEFAULT false,
  browser text
);

CREATE INDEX IF NOT EXISTS idx_media_wiedergabe_messung_created
  ON public.media_wiedergabe_messung(created_at DESC);

ALTER TABLE public.media_wiedergabe_messung ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS media_wiedergabe_messung_insert ON public.media_wiedergabe_messung;
CREATE POLICY media_wiedergabe_messung_insert ON public.media_wiedergabe_messung
  FOR INSERT TO authenticated
  WITH CHECK (auth_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS media_wiedergabe_messung_select ON public.media_wiedergabe_messung;
CREATE POLICY media_wiedergabe_messung_select ON public.media_wiedergabe_messung
  FOR SELECT TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()));

-- Letzte 14 Tage. Fehlversuche zaehlen nicht in die Zeiten, aber in `fehlerquote`.
CREATE OR REPLACE VIEW public.media_wiedergabe_perzentile
WITH (security_invoker = true) AS
SELECT
  ansicht,
  quelle,
  coalesce(format, '?') AS format,
  count(*) AS wiedergaben,
  round(avg(fehler::int)::numeric, 3) AS fehlerquote,
  percentile_cont(0.50) WITHIN GROUP (ORDER BY ttff_ms) FILTER (WHERE NOT fehler) AS ttff_p50_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY ttff_ms) FILTER (WHERE NOT fehler) AS ttff_p95_ms,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY ttff_ms) FILTER (WHERE NOT fehler) AS ttff_p99_ms,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY start_ms) FILTER (WHERE NOT fehler) AS start_p95_ms,
  round(avg((stalls > 0)::int) FILTER (WHERE start_ms IS NOT NULL)::numeric, 3) AS anteil_mit_stall,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY stall_ms) FILTER (WHERE start_ms IS NOT NULL) AS stall_p95_ms
FROM public.media_wiedergabe_messung
WHERE created_at > now() - interval '14 days'
GROUP BY ansicht, quelle, coalesce(format, '?');

COMMIT;
