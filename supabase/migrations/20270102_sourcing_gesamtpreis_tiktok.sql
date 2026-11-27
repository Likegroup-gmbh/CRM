-- Sourcing: Gesamtpreis wie Preis Video und Preis Story je Plattform (Instagram / TikTok).
--
-- Bisher fuehrte creator_auswahl_items.pricing einen einzelnen Gesamtpreis fuer beide
-- Plattformen. Ab jetzt haelt pricing den Gesamtpreis fuer Instagram (und bei UGC weiter
-- die Pauschale), pricing_tiktok den Gesamtpreis fuer TikTok.
--
-- Listen ohne TikTok (cp-col-link-tt versteckt) bekommen cp-col-pricing-tt in
-- hidden_columns, reine TikTok-Listen (cp-col-link-ig versteckt) cp-col-pricing-ig.
-- Listen, die cp-col-pricing als Ganzes ausblenden, behalten das unveraendert.
--
-- ROLLBACK:
--   ALTER TABLE public.creator_auswahl_items DROP COLUMN IF EXISTS pricing_tiktok;
--   (hidden_columns: cp-col-pricing-tt / cp-col-pricing-ig sind fuer aelteren Code folgenlos)

BEGIN;

ALTER TABLE public.creator_auswahl_items
  ADD COLUMN IF NOT EXISTS pricing_tiktok text;

COMMENT ON COLUMN public.creator_auswahl_items.pricing IS
  'Manuell gepflegter Gesamtpreis (Instagram bzw. Pauschale bei UGC). Freitext.';

COMMENT ON COLUMN public.creator_auswahl_items.pricing_tiktok IS
  'Manuell gepflegter Gesamtpreis fuer TikTok. Freitext.';

-- Bestehende Listen ohne TikTok blenden die neue TikTok-Gesamtpreis-Zeile direkt mit aus.
UPDATE public.creator_auswahl
SET hidden_columns = hidden_columns || '["cp-col-pricing-tt"]'::jsonb
WHERE jsonb_typeof(hidden_columns) = 'array'
  AND hidden_columns ? 'cp-col-link-tt'
  AND NOT hidden_columns ? 'cp-col-pricing-tt';

-- Bestehende reine TikTok-Listen blenden die Instagram-Gesamtpreis-Zeile direkt mit aus.
UPDATE public.creator_auswahl
SET hidden_columns = hidden_columns || '["cp-col-pricing-ig"]'::jsonb
WHERE jsonb_typeof(hidden_columns) = 'array'
  AND hidden_columns ? 'cp-col-link-ig'
  AND NOT hidden_columns ? 'cp-col-pricing-ig';

COMMIT;
