-- Neuigkeiten-Umbau: Dashboard-Cards statt eigener Seite
--
-- Die Neuigkeiten erscheinen nur noch als kompakte Cards auf dem Dashboard.
-- Damit entfallen: Detail-Seite (slug), Teaser, Schritte-Tutorials und die
-- Screenshots samt Storage-Bucket. inhalt wird zu kurztext (1-3 Saetze,
-- Du-Form, kein Tutorial-Charakter).
--
-- Die Generierungs-Pipeline (GitHub Action -> Claude) bleibt, schreibt aber
-- nur noch titel + kurztext. commit_sha bleibt die Deduplizierung.

BEGIN;

ALTER TABLE neuigkeit
  DROP COLUMN slug,
  DROP COLUMN teaser,
  DROP COLUMN schritte;

ALTER TABLE neuigkeit
  RENAME COLUMN inhalt TO kurztext;

COMMENT ON TABLE neuigkeit IS 'Automatisch generierte Kurz-Updates nach Push auf main (titel + kurztext, Du-Form). Nur Dashboard-Cards, keine Detail-Seite. published = sichtbar, skipped = Deploy ohne User-sichtbare Aenderung (Deduplizierung ueber commit_sha).';

-- ============================================================
-- Screenshot-Bucket inkl. aller Dateien und Policy entfernen
-- ============================================================

DROP POLICY IF EXISTS "Public read access for neuigkeiten" ON storage.objects;

-- Der Bucket 'neuigkeiten' selbst wird manuell im Supabase-Dashboard
-- geloescht (Storage -> neuigkeiten -> Delete bucket): direktes DELETE auf
-- storage.objects/buckets blockiert der Supabase-Schutztrigger
-- storage.protect_delete, und die Migration laeuft nicht als Owner.

COMMIT;
