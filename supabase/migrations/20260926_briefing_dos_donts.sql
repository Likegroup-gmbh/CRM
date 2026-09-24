-- Do's und Don'ts als eigene Felder. Bestehendes dos_donts bleibt liegen,
-- nichts wird hinüberkopiert.

ALTER TABLE campaign_briefings
  ADD COLUMN IF NOT EXISTS dos text,
  ADD COLUMN IF NOT EXISTS donts text;

COMMENT ON COLUMN campaign_briefings.dos IS
  'Was der Inhalt tun soll. Kein Ausschluss.';
COMMENT ON COLUMN campaign_briefings.donts IS
  'Was nicht getan werden darf. Wird vor dem Matching gelesen.';
