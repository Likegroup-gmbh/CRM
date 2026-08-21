-- Skript-Generator: gewaehltes Strategie-Item als erste-Klasse-Verknuepfung.
-- ON DELETE SET NULL: Item loeschen darf bestehende Skripte nicht killen.

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS strategie_item_id uuid REFERENCES strategie_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS skripte_strategie_item_id_idx ON skripte(strategie_item_id);
