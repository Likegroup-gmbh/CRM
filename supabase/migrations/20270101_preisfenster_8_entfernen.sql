-- Contract-Schritt zu ADR 0084: die Spalten des alten 8er-Fensters fallen weg, ebenso die
-- 8er-Schluessel in ig_stats/tt_stats, die das Nachrechnen fuer den alten Client stehen liess.
--
-- Erst einspielen, wenn
--   1. 20261231_preisfenster_12.sql eingespielt ist,
--   2. der Code mit dem 12er-Fenster live ist (kein Abruf schreibt mehr _8),
--   3. scripts/preisfenster-12-nachrechnen.mjs --apply gelaufen ist.
--
-- Kontrolle vorher: Zeilen mit 8er-, aber ohne 12er-Wert. Uebrig bleiben duerfen nur Zeilen
-- vor calc_version 4 und Zeilen mit weniger als 12 Videos.
--   SELECT count(*) FROM public.creator_auswahl_items
--   WHERE ig_views_8 IS NOT NULL AND ig_views_12 IS NULL;
--
-- ROLLBACK (Werte sind weg, der naechste Abruf schreibt ohnehin nur noch _12):
--   ALTER TABLE public.creator_auswahl_items ADD COLUMN IF NOT EXISTS ig_views_8 integer,
--     ADD COLUMN IF NOT EXISTS cpm_ig_8 numeric, ADD COLUMN IF NOT EXISTS tt_views_8 integer;
--   ALTER TABLE public.sourcing_creator ADD COLUMN IF NOT EXISTS ig_views_8 integer,
--     ADD COLUMN IF NOT EXISTS cpm_ig_8 numeric;
--   ALTER TABLE public.sourcing_creator_tiktok ADD COLUMN IF NOT EXISTS tt_views_8 integer;

BEGIN;

DO $$
DECLARE
  fehlend text;
  offen integer;
BEGIN
  SELECT string_agg(soll.tabelle || '.' || soll.spalte, ', ')
  INTO fehlend
  FROM (VALUES
    ('creator_auswahl_items', 'ig_views_12'),
    ('creator_auswahl_items', 'cpm_ig_12'),
    ('creator_auswahl_items', 'tt_views_12'),
    ('sourcing_creator', 'ig_views_12'),
    ('sourcing_creator', 'cpm_ig_12'),
    ('sourcing_creator_tiktok', 'tt_views_12')
  ) AS soll(tabelle, spalte)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = soll.tabelle AND c.column_name = soll.spalte
  );
  IF fehlend IS NOT NULL THEN
    RAISE EXCEPTION '20261231_preisfenster_12.sql fehlt, Spalten nicht da: %', fehlend;
  END IF;

  EXECUTE 'SELECT count(*) FROM public.creator_auswahl_items
           WHERE ig_views_8 IS NOT NULL AND ig_views_12 IS NULL' INTO offen;
  RAISE NOTICE 'Casting-Zeilen mit 8er-, aber ohne 12er-Wert: %', offen;
END $$;

CREATE FUNCTION pg_temp.ohne_achter(s jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN jsonb_typeof(s->'ohne_trials') = 'object'
      THEN jsonb_set(s - k, '{ohne_trials}', (s->'ohne_trials') - k)
    ELSE s - k
  END
  FROM (SELECT array['views_8', 'cpm_8', 'sample_8', 'used_8', 'outliers_8'] AS k) AS achter
$$;

CREATE FUNCTION pg_temp.hat_achter(s jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_typeof(s) = 'object' AND (
    s ?| array['views_8', 'cpm_8', 'sample_8', 'used_8', 'outliers_8']
    OR coalesce(s->'ohne_trials' ?| array['views_8', 'cpm_8', 'sample_8', 'used_8', 'outliers_8'], false)
  )
$$;

UPDATE public.creator_auswahl_items SET ig_stats = pg_temp.ohne_achter(ig_stats)
WHERE pg_temp.hat_achter(ig_stats);
UPDATE public.creator_auswahl_items SET tt_stats = pg_temp.ohne_achter(tt_stats)
WHERE pg_temp.hat_achter(tt_stats);
UPDATE public.sourcing_creator SET ig_stats = pg_temp.ohne_achter(ig_stats)
WHERE pg_temp.hat_achter(ig_stats);
UPDATE public.sourcing_creator_tiktok SET tt_stats = pg_temp.ohne_achter(tt_stats)
WHERE pg_temp.hat_achter(tt_stats);

ALTER TABLE public.creator_auswahl_items
  DROP COLUMN IF EXISTS ig_views_8,
  DROP COLUMN IF EXISTS cpm_ig_8,
  DROP COLUMN IF EXISTS tt_views_8;

ALTER TABLE public.sourcing_creator
  DROP COLUMN IF EXISTS ig_views_8,
  DROP COLUMN IF EXISTS cpm_ig_8;

ALTER TABLE public.sourcing_creator_tiktok
  DROP COLUMN IF EXISTS tt_views_8;

COMMIT;
