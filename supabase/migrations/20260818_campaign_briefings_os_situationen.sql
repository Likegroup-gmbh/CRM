-- =====================================================================
-- Fix: fehlende Spalte os_situationen in campaign_briefings
-- umsetzungFields('os') in fieldConfig.js sendet os_situationen,
-- die Basis-Migration 20260818_campaign_briefings hatte die Spalte
-- (im Gegensatz zu im_situationen / pa_situationen) nicht angelegt.
-- =====================================================================

ALTER TABLE campaign_briefings
  ADD COLUMN IF NOT EXISTS os_situationen text;
