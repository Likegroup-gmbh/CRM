-- Finale Migration der Creator-Tabelle
-- Ausführung: Mit Schreibrechten ausführen

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

-- 5. Migration der Daten mit korrekten Mapping
-- Creator Type Migration
UPDATE creator 
SET creator_type_id = (
    SELECT id 
    FROM creator_type 
    WHERE name = temp_creator_type
) 
WHERE temp_creator_type IS NOT NULL;

-- Sprache Migration (nimmt die erste Sprache aus dem Array)
UPDATE creator 
SET sprache_id = (
    SELECT id 
    FROM sprachen 
    WHERE name = temp_sprachen[1]
) 
WHERE temp_sprachen IS NOT NULL AND array_length(temp_sprachen, 1) > 0;

-- Branche Migration (nimmt die erste Branche aus dem Array)
UPDATE creator 
SET branche_id = (
    SELECT id 
    FROM branchen_creator 
    WHERE name = temp_branche[1]
) 
WHERE temp_branche IS NOT NULL AND array_length(temp_branche, 1) > 0;

-- 6. Überprüfung der Migration
SELECT 
    c.vorname,
    c.nachname,
    c.temp_creator_type,
    ct.name as new_creator_type,
    c.temp_sprachen,
    s.name as new_sprache,
    c.temp_branche,
    bc.name as new_branche
FROM creator c
LEFT JOIN creator_type ct ON c.creator_type_id = ct.id
LEFT JOIN sprachen s ON c.sprache_id = s.id
LEFT JOIN branchen_creator bc ON c.branche_id = bc.id
WHERE c.temp_creator_type IS NOT NULL 
   OR c.temp_sprachen IS NOT NULL 
   OR c.temp_branche IS NOT NULL;

-- 7. Nach erfolgreicher Überprüfung können die temporären Spalten entfernt werden:
-- ALTER TABLE creator DROP COLUMN temp_sprachen;
-- ALTER TABLE creator DROP COLUMN temp_branche;
-- ALTER TABLE creator DROP COLUMN temp_creator_type;

-- 8. Optional: Alte Spalten entfernen (nur nach vollständiger Migration):
-- ALTER TABLE creator DROP COLUMN sprachen;
-- ALTER TABLE creator DROP COLUMN branche;
-- ALTER TABLE creator DROP COLUMN creator_type; 