-- Freitext für Casting-Bedingungen, die in keine Checkbox passen.
-- Getrennt von produkt_erfahrung / *_voraussetzungen_custom.

ALTER TABLE campaign_briefings
  ADD COLUMN IF NOT EXISTS voraussetzungen_sonstiges text;

COMMENT ON COLUMN campaign_briefings.voraussetzungen_sonstiges IS
  'Sonstige Voraussetzungen: Freitext neben der Checkbox-Liste.';
