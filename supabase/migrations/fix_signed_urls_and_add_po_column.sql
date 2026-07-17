-- Migration: Fix Signed URLs + Add kunde_po_nummer column
-- Ausführen im Supabase SQL Editor

-- 1. Konvertiere alle abgelaufenen Signed URLs zu permanenten Public URLs
-- Der vertraege Bucket ist bereits public, daher funktionieren Public URLs sofort
UPDATE vertraege 
SET datei_url = regexp_replace(
  split_part(datei_url, '?token=', 1),
  '/object/sign/',
  '/object/public/'
)
WHERE datei_url LIKE '%/object/sign/%';

-- 2. Neue Spalte für Kunden-PO-Nummer (wird aus Auftrag gezogen)
ALTER TABLE vertraege
ADD COLUMN IF NOT EXISTS kunde_po_nummer TEXT;
