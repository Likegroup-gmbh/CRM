-- Migration der Creator-Daten zu den neuen Foreign Key Feldern
-- Ausführung: Nach der Ausführung von update_creator_foreign_keys.sql

-- 1. Creator Type Migration
UPDATE creator 
SET creator_type_id = (
    SELECT id 
    FROM creator_type 
    WHERE name = temp_creator_type
) 
WHERE temp_creator_type IS NOT NULL;

-- 2. Sprache Migration (nimmt die erste Sprache aus dem Array)
UPDATE creator 
SET sprache_id = (
    SELECT id 
    FROM sprachen 
    WHERE name = temp_sprachen[1]
) 
WHERE temp_sprachen IS NOT NULL AND array_length(temp_sprachen, 1) > 0;

-- 3. Branche Migration (nimmt die erste Branche aus dem Array)
UPDATE creator 
SET branche_id = (
    SELECT id 
    FROM branchen_creator 
    WHERE name = temp_branche[1]
) 
WHERE temp_branche IS NOT NULL AND array_length(temp_branche, 1) > 0;

-- 4. Überprüfung der Migration
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