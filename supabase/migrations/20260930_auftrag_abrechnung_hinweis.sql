-- Abrechnungshinweis auf dem Auftrag (ADR 0015): Freitext-Regelung, wie
-- Kosten bei diesem Auftrag abgerechnet werden — z.B. die Juniper-Konvention
-- "Programmteilnahmen laufen ueber das Honorar, Reisekosten separat als
-- Zusatzkosten". Wird beim Anlegen von Creator-Rechnungen eingeblendet.

ALTER TABLE auftrag ADD COLUMN IF NOT EXISTS abrechnung_hinweis text;
