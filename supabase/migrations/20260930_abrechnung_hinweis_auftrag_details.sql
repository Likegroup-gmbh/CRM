-- Abrechnungshinweis von auftrag nach auftrag_details verschieben (ADR 0015):
-- Gepflegt und gelesen wird er in den Auftragsdetails, nicht im Auftrags-
-- Formular. Eine Quelle der Wahrheit.

ALTER TABLE auftrag DROP COLUMN IF EXISTS abrechnung_hinweis;
ALTER TABLE auftrag_details ADD COLUMN IF NOT EXISTS abrechnung_hinweis text;
