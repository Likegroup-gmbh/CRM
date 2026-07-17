-- Skripte: Unternehmen als Pflicht-Kontext (Marke ist optional,
-- nicht jedes Unternehmen hat eine Marke)

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS unternehmen_id uuid REFERENCES unternehmen(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_skripte_unternehmen ON skripte(unternehmen_id);

-- Backfill: bestehende Skripte erben das Unternehmen ihrer Marke
UPDATE skripte s SET unternehmen_id = m.unternehmen_id
FROM marke m
WHERE s.marke_id = m.id AND s.unternehmen_id IS NULL AND m.unternehmen_id IS NOT NULL;
