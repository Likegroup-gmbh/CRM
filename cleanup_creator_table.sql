-- Cleanup: Temporäre Spalten und alte Felder entfernen
-- Ausführung: Nach erfolgreicher Migration und Überprüfung

-- 1. Temporäre Spalten entfernen
ALTER TABLE creator DROP COLUMN temp_sprachen;
ALTER TABLE creator DROP COLUMN temp_branche;
ALTER TABLE creator DROP COLUMN temp_creator_type;

-- 2. Alte Spalten entfernen (Legacy-Felder)
ALTER TABLE creator DROP COLUMN sprachen;
ALTER TABLE creator DROP COLUMN branche;
ALTER TABLE creator DROP COLUMN creator_type;

-- 3. Überprüfung der finalen Struktur
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'creator' 
AND column_name IN ('creator_type_id', 'sprache_id', 'branche_id')
ORDER BY ordinal_position;

-- 4. Test-Query um sicherzustellen, dass alles funktioniert
SELECT 
    c.vorname,
    c.nachname,
    ct.name as creator_type,
    s.name as sprache,
    bc.name as branche
FROM creator c
LEFT JOIN creator_type ct ON c.creator_type_id = ct.id
LEFT JOIN sprachen s ON c.sprache_id = s.id
LEFT JOIN branchen_creator bc ON c.branche_id = bc.id
LIMIT 5; 