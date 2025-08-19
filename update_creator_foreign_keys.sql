-- Migration: Creator-Tabelle mit neuen Foreign Keys aktualisieren
-- Ausführung: Dieses Script muss mit Schreibrechten ausgeführt werden

-- 1. Neue Spalten für Foreign Keys hinzufügen
ALTER TABLE creator ADD COLUMN creator_type_id UUID REFERENCES creator_type(id);
ALTER TABLE creator ADD COLUMN sprache_id UUID REFERENCES sprachen(id);
ALTER TABLE creator ADD COLUMN branche_id UUID REFERENCES branchen_creator(id);

-- 2. Temporäre Spalten für die Migration der bestehenden Daten
ALTER TABLE creator ADD COLUMN temp_sprachen TEXT[];
ALTER TABLE creator ADD COLUMN temp_branche TEXT[];
ALTER TABLE creator ADD COLUMN temp_creator_type VARCHAR;

-- 3. Bestehende Daten in temporäre Spalten kopieren
UPDATE creator SET 
    temp_sprachen = sprachen,
    temp_branche = branche,
    temp_creator_type = creator_type;

-- 4. Kommentar für die alten Spalten hinzufügen
COMMENT ON COLUMN creator.sprachen IS 'Legacy-Feld - wird durch sprache_id ersetzt';
COMMENT ON COLUMN creator.branche IS 'Legacy-Feld - wird durch branche_id ersetzt';
COMMENT ON COLUMN creator.creator_type IS 'Legacy-Feld - wird durch creator_type_id ersetzt';

-- 5. Beispiel für die Migration der Daten (muss manuell angepasst werden)
-- UPDATE creator SET creator_type_id = (SELECT id FROM creator_type WHERE name = temp_creator_type) WHERE temp_creator_type IS NOT NULL;
-- UPDATE creator SET sprache_id = (SELECT id FROM sprachen WHERE name = ANY(temp_sprachen)) WHERE temp_sprachen IS NOT NULL;
-- UPDATE creator SET branche_id = (SELECT id FROM branchen_creator WHERE name = ANY(temp_branche)) WHERE temp_branche IS NOT NULL;

-- 6. Nach der Migration können die temporären Spalten entfernt werden:
-- ALTER TABLE creator DROP COLUMN temp_sprachen;
-- ALTER TABLE creator DROP COLUMN temp_branche;
-- ALTER TABLE creator DROP COLUMN temp_creator_type;

-- 7. Optional: Alte Spalten entfernen (nur nach vollständiger Migration):
-- ALTER TABLE creator DROP COLUMN sprachen;
-- ALTER TABLE creator DROP COLUMN branche;
-- ALTER TABLE creator DROP COLUMN creator_type; 