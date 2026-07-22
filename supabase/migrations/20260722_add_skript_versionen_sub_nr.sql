-- Skript-Versionen: Unterversionen (v2.1, v2.2, ...) beim Weiterarbeiten an
-- einer aelteren Version + Merker, welche Version im Editor aktiv ist.

-- sub_nr = 0 -> Hauptversion ("v2"), sub_nr > 0 -> Unterversion ("v2.1")
ALTER TABLE skript_versionen
  ADD COLUMN IF NOT EXISTS sub_nr int NOT NULL DEFAULT 0;

ALTER TABLE skript_versionen
  DROP CONSTRAINT IF EXISTS skript_versionen_skript_id_version_nr_key;

ALTER TABLE skript_versionen
  ADD CONSTRAINT skript_versionen_skript_id_version_nr_sub_nr_key
  UNIQUE (skript_id, version_nr, sub_nr);

-- Aktive Version am Skript (Reload-sicher). NULL = neueste Version.
ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS aktive_version_nr int,
  ADD COLUMN IF NOT EXISTS aktive_sub_nr int;
