-- Custom Column Upload: field_type CHECK erweitern + Assets-Tabelle

ALTER TABLE custom_columns DROP CONSTRAINT IF EXISTS custom_columns_field_type_check;
ALTER TABLE custom_columns ADD CONSTRAINT custom_columns_field_type_check
  CHECK (field_type = ANY (ARRAY['text','link','date','boolean','dropdown','number','upload']));

CREATE TABLE IF NOT EXISTS custom_column_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_column_id UUID NOT NULL REFERENCES custom_columns(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cca_column_entity ON custom_column_assets(custom_column_id, entity_id);

ALTER TABLE custom_column_assets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'custom_column_assets' AND policyname = 'authenticated_all'
  ) THEN
    CREATE POLICY "authenticated_all" ON custom_column_assets
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
