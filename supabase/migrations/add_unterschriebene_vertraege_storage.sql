-- Migration: Unterschriebene Verträge Storage
-- Ausführen im Supabase SQL Editor

-- 1. Storage Bucket für unterschriebene Verträge erstellen
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'unterschriebene-vertraege',
  'unterschriebene-vertraege',
  true,
  10485760, -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS Policy: Authenticated users können hochladen
CREATE POLICY "Authenticated users can upload signed contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'unterschriebene-vertraege');

-- 3. RLS Policy: Authenticated users können löschen
CREATE POLICY "Authenticated users can delete signed contracts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'unterschriebene-vertraege');

-- 4. RLS Policy: Jeder kann lesen (public bucket)
CREATE POLICY "Public read access for signed contracts"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'unterschriebene-vertraege');

-- 5. Neue Spalte für Storage-Pfad in vertraege Tabelle
ALTER TABLE vertraege
ADD COLUMN IF NOT EXISTS unterschriebener_vertrag_path TEXT;
