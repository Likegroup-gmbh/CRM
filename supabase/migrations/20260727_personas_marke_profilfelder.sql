-- Personas auf Markenebene: Profilfelder aus dem Persona-Briefing.
-- marke_id existiert bereits (nullable) und wird ab jetzt von der Marke-Detailseite
-- gesetzt. Personas ohne Marke bleiben erlaubt (globale Zielgruppen fuer skript_dna).

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS interessen text,
  ADD COLUMN IF NOT EXISTS beduerfnisse text,
  ADD COLUMN IF NOT EXISTS kaufmotive text,
  ADD COLUMN IF NOT EXISTS einwaende text,
  ADD COLUMN IF NOT EXISTS tonalitaet varchar,
  ADD COLUMN IF NOT EXISTS plattformen text,
  ADD COLUMN IF NOT EXISTS content_praeferenzen text,
  ADD COLUMN IF NOT EXISTS produkt_loesung text,
  ADD COLUMN IF NOT EXISTS produktvorteile text;

CREATE INDEX IF NOT EXISTS personas_marke_id_idx ON personas(marke_id);
