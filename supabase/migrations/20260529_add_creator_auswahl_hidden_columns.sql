ALTER TABLE creator_auswahl
  ADD COLUMN IF NOT EXISTS hidden_columns jsonb NOT NULL DEFAULT '[]'::jsonb;
