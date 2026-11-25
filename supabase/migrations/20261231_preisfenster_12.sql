-- Preisfenster 12 statt 8 Videos (ADR 0084). Das kurze Fenster rechnet ab jetzt mit den
-- letzten 12 Videos, das lange bleibt bei 30. Views und Preis stehen in der Casting-Tabelle
-- in getrennten Spalten.
--
-- Expand/contract: die _12-Spalten kommen hier dazu, die _8-Spalten fallen erst mit
-- 20270101_preisfenster_8_entfernen.sql weg - nach dem Deploy und nachdem
-- scripts/preisfenster-12-nachrechnen.mjs die Bestandswerte aus den gespeicherten
-- Videos nachgerechnet hat. So bricht kein Abruf, solange noch alter Code live ist.
--
-- Gespeicherte Spalteneinstellungen der Castings: die 8er-Keys heissen jetzt 12, und die
-- neuen Views-Spalten starten so versteckt wie die Preisspalte ihres Fensters.
--
-- ROLLBACK:
--   ALTER TABLE public.creator_auswahl_items DROP COLUMN IF EXISTS ig_views_12,
--     DROP COLUMN IF EXISTS cpm_ig_12, DROP COLUMN IF EXISTS tt_views_12;
--   ALTER TABLE public.sourcing_creator DROP COLUMN IF EXISTS ig_views_12,
--     DROP COLUMN IF EXISTS cpm_ig_12;
--   ALTER TABLE public.sourcing_creator_tiktok DROP COLUMN IF EXISTS tt_views_12;
--   (hidden_columns/column_order: das Frontend liest alte Keys weiter ueber migrateHiddenColumns)

BEGIN;

ALTER TABLE public.creator_auswahl_items
  ADD COLUMN IF NOT EXISTS ig_views_12 integer,
  ADD COLUMN IF NOT EXISTS cpm_ig_12 numeric,
  ADD COLUMN IF NOT EXISTS tt_views_12 integer;

ALTER TABLE public.sourcing_creator
  ADD COLUMN IF NOT EXISTS ig_views_12 integer,
  ADD COLUMN IF NOT EXISTS cpm_ig_12 numeric;

ALTER TABLE public.sourcing_creator_tiktok
  ADD COLUMN IF NOT EXISTS tt_views_12 integer;

COMMENT ON COLUMN public.creator_auswahl_items.ig_views_12 IS
  'Views-Schnitt der letzten 12 Feed-Reels, ohne Werbe-Reels und ohne Ausreisser.';
COMMENT ON COLUMN public.creator_auswahl_items.cpm_ig_12 IS
  'Referenzpreis aus ig_views_12 bei 25 EUR TKP. Die Tabelle rechnet mit dem TKP der Liste.';
COMMENT ON COLUMN public.creator_auswahl_items.tt_views_12 IS
  'Views-Schnitt der letzten 12 TikTok-Videos, ohne Werbung, angepinnte Videos und Ausreisser.';
COMMENT ON COLUMN public.sourcing_creator.ig_views_12 IS
  'Views-Schnitt der letzten 12 Feed-Reels, ohne Werbe-Reels und ohne Ausreisser.';
COMMENT ON COLUMN public.sourcing_creator.cpm_ig_12 IS
  'Referenzpreis aus ig_views_12 bei 25 EUR TKP.';
COMMENT ON COLUMN public.sourcing_creator_tiktok.tt_views_12 IS
  'Views-Schnitt der letzten 12 TikTok-Videos, ohne Werbung, angepinnte Videos und Ausreisser.';

-- 8er-Keys in hidden_columns umbenennen
UPDATE public.creator_auswahl
SET hidden_columns = (
  SELECT coalesce(jsonb_agg(CASE spalte
    WHEN 'cp-col-cpm-8' THEN 'cp-col-cpm-12'
    WHEN 'cp-col-cpm-ig-8' THEN 'cp-col-cpm-ig-12'
    WHEN 'cp-col-cpm-tt-8' THEN 'cp-col-cpm-tt-12'
    ELSE spalte
  END), '[]'::jsonb)
  FROM jsonb_array_elements_text(hidden_columns) AS spalte
)
WHERE hidden_columns ?| array['cp-col-cpm-8', 'cp-col-cpm-ig-8', 'cp-col-cpm-tt-8'];

-- Views-Spalten und -Zeilen folgen der versteckten Preisspalte ihres Fensters
UPDATE public.creator_auswahl
SET hidden_columns = hidden_columns || (
  SELECT coalesce(jsonb_agg(paar.views), '[]'::jsonb)
  FROM (VALUES
    ('cp-col-cpm-12', 'cp-col-views-12'),
    ('cp-col-cpm-30', 'cp-col-views-30'),
    ('cp-col-cpm-ig-12', 'cp-col-views-ig-12'),
    ('cp-col-cpm-ig-30', 'cp-col-views-ig-30'),
    ('cp-col-cpm-tt-12', 'cp-col-views-tt-12'),
    ('cp-col-cpm-tt-30', 'cp-col-views-tt-30')
  ) AS paar(preis, views)
  WHERE hidden_columns ? paar.preis AND NOT hidden_columns ? paar.views
)
WHERE hidden_columns ?| array[
  'cp-col-cpm-12', 'cp-col-cpm-30',
  'cp-col-cpm-ig-12', 'cp-col-cpm-ig-30',
  'cp-col-cpm-tt-12', 'cp-col-cpm-tt-30'
];

-- Eigene Spaltenreihenfolge: die Views-Spalten fehlen dort. baueBeweglicheSpalten setzt
-- fehlende Standardspalten hinter ihren Vorgaenger aus der Standardfolge.
UPDATE public.creator_auswahl
SET column_order = (
  SELECT jsonb_agg(CASE spalte
    WHEN 'cp-col-cpm-8' THEN 'cp-col-cpm-12'
    WHEN 'cp-col-cpm-ig-8' THEN 'cp-col-cpm-12'
    ELSE spalte
  END ORDER BY ord)
  FROM jsonb_array_elements_text(column_order) WITH ORDINALITY AS e(spalte, ord)
)
WHERE jsonb_typeof(column_order) = 'array'
  AND column_order ?| array['cp-col-cpm-8', 'cp-col-cpm-ig-8'];

COMMIT;
