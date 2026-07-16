-- Skripte: Location (fliesst in die Generierung ein) und
-- Regieanweisung (reine Zusatzinfo fuer die Umsetzung, KEIN Prompt-Input)

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS regieanweisung text;
