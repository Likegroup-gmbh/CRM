-- Skript-DNA: individueller Name pro Dokument
-- (fuer Auswahl im Generator und bessere Wiedererkennung bei mehreren DNAs)

ALTER TABLE skript_dna
  ADD COLUMN IF NOT EXISTS name varchar;
