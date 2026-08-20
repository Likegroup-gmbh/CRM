-- Skript-Generator: CRM-Briefing statt PDF-Upload.
-- briefing_id haengt am ausgewaehlten campaign_briefings-Datensatz.
-- ON DELETE SET NULL: Briefing loeschen darf bestehende Skripte nicht killen.

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS briefing_id uuid REFERENCES campaign_briefings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS skripte_briefing_id_idx ON skripte(briefing_id);
