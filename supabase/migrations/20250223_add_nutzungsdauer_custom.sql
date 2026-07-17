-- Individuelle Nutzungsdauer: Jahre/Monate-Switch
ALTER TABLE vertraege
  ADD COLUMN IF NOT EXISTS nutzungsdauer_custom_wert integer,
  ADD COLUMN IF NOT EXISTS nutzungsdauer_custom_einheit text;

COMMENT ON COLUMN vertraege.nutzungsdauer_custom_wert IS 'Individueller Wert wenn nutzungsdauer = individuell (z.B. 3)';
COMMENT ON COLUMN vertraege.nutzungsdauer_custom_einheit IS 'Einheit: jahre oder monate';
