-- Instagram-Auto-Fetch im Sourcing: Views/CPM aus Meta Business Discovery.
--
-- ig_views_*  = durchschnittliche Views der letzten 8 bzw. 30 Reels sowie der
--               getrimmte Schnitt (Ausreisser oben/unten gekappt).
-- cpm_ig_*    = daraus abgeleiteter Preis (Views / 1000 * 25 EUR).
-- ig_stats    = verwendete Videos (Permalink, Views, Timestamp) zur
--               Nachvollziehbarkeit im Tooltip.
--
-- Das bestehende cpm_instagram bleibt als manuelles Override erhalten.

ALTER TABLE creator_auswahl_items
  ADD COLUMN IF NOT EXISTS ig_views_8 integer,
  ADD COLUMN IF NOT EXISTS ig_views_30 integer,
  ADD COLUMN IF NOT EXISTS ig_views_trimmed integer,
  ADD COLUMN IF NOT EXISTS cpm_ig_8 numeric,
  ADD COLUMN IF NOT EXISTS cpm_ig_30 numeric,
  ADD COLUMN IF NOT EXISTS cpm_ig_trimmed numeric,
  ADD COLUMN IF NOT EXISTS ig_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS ig_fetch_error text,
  ADD COLUMN IF NOT EXISTS ig_stats jsonb NOT NULL DEFAULT '{}'::jsonb;
