-- Skripte: eigene Branche fuer Kategorisierung und Branchen-DNA
-- (Feedback wird branchenspezifisch bewertbar: Food != Sport != Automobil)

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS branche_id uuid REFERENCES branchen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_skripte_branche ON skripte(branche_id);

-- Backfill: bestehende Skripte erben die Branche ihrer Marke
UPDATE skripte s SET branche_id = m.branche_id
FROM marke m
WHERE s.marke_id = m.id AND s.branche_id IS NULL AND m.branche_id IS NOT NULL;
