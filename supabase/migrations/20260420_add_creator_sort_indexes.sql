CREATE INDEX IF NOT EXISTS idx_creator_nachname
  ON creator (nachname);

CREATE INDEX IF NOT EXISTS idx_creator_created_at_desc
  ON creator (created_at DESC);
