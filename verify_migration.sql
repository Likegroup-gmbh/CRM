-- Verifikation der Creator-Migration
-- Ausführung: Nach der Migration um zu prüfen, ob alles korrekt ist

-- 1. Überprüfung der Migration-Status
SELECT 
    COUNT(*) as total_creators,
    COUNT(creator_type_id) as creators_with_type,
    COUNT(sprache_id) as creators_with_sprache,
    COUNT(branche_id) as creators_with_branche
FROM creator;

-- 2. Detaillierte Übersicht aller Creator mit ihren neuen Feldern
SELECT 
    c.vorname,
    c.nachname,
    c.creator_type_id,
    ct.name as creator_type_name,
    c.sprache_id,
    s.name as sprache_name,
    c.branche_id,
    bc.name as branche_name
FROM creator c
LEFT JOIN creator_type ct ON c.creator_type_id = ct.id
LEFT JOIN sprachen s ON c.sprache_id = s.id
LEFT JOIN branchen_creator bc ON c.branche_id = bc.id
ORDER BY c.vorname, c.nachname;

-- 3. Creator ohne zugewiesene Werte (sollten nach der Migration 0 sein)
SELECT 
    c.vorname,
    c.nachname,
    CASE 
        WHEN c.creator_type_id IS NULL THEN 'Fehlt'
        ELSE 'OK'
    END as creator_type_status,
    CASE 
        WHEN c.sprache_id IS NULL THEN 'Fehlt'
        ELSE 'OK'
    END as sprache_status,
    CASE 
        WHEN c.branche_id IS NULL THEN 'Fehlt'
        ELSE 'OK'
    END as branche_status
FROM creator c
WHERE c.creator_type_id IS NULL 
   OR c.sprache_id IS NULL 
   OR c.branche_id IS NULL;

-- 4. Test für Ben Klock speziell
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
WHERE c.vorname ILIKE '%Ben%' OR c.nachname ILIKE '%Klock%'; 