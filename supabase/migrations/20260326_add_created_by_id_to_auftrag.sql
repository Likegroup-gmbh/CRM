ALTER TABLE auftrag
  ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES benutzer(id);

ALTER TABLE auftrag_details
  ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES benutzer(id);
