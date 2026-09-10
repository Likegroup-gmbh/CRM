-- Merge: DA Direkt Q2 -> DADirekt Influencer-Marketing H1
-- Survivor Auftrag:   b875738f-68bc-4475-bc41-62b251be81b4 (DADirekt Influencer-Marketing H1)
-- Survivor Kampagne:  273f938c-3abe-465f-92b6-59f675dfa7d7
-- Geloescht Auftrag:  d46c7c44-e274-4389-b185-153020726133 (DA Direkt Q2)
-- Geloescht Kampagne: 88bfc294-da43-4578-919c-5aaa67864953
-- 15 Kooperationen / 15 Vertraege / 16 Rechnungen / 7 Custom Columns wandern nach H1.
-- Herkunfts-Tag "DA Direkt Q2" auf allen 15 Kooperationen (bestehende Monats-Tags bleiben).
-- H1-Betraege/Zaehler unveraendert (86.670,68 netto, 200/200). Q2-60k-Teilrechnung
-- war nie gestellt und stirbt per CASCADE mit dem Auftrag.
-- Backup: backups/2026-09-07-dadirekt-q2-to-h1.json (+ -vertraege.json)

BEGIN;

-- 1) Herkunfts-Tag anlegen (idempotent)
INSERT INTO kooperation_tag_typen (name)
SELECT 'DA Direkt Q2'
WHERE NOT EXISTS (SELECT 1 FROM kooperation_tag_typen WHERE name = 'DA Direkt Q2');

-- 2) Tag an alle Q2-Kooperationen haengen
INSERT INTO kooperation_tags (kooperation_id, tag_id)
SELECT k.id, t.id
FROM kooperationen k, kooperation_tag_typen t
WHERE k.kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953'
  AND t.name = 'DA Direkt Q2'
  AND NOT EXISTS (
    SELECT 1 FROM kooperation_tags kt
    WHERE kt.kooperation_id = k.id AND kt.tag_id = t.id
  );

-- 3) kampagne_id-Referenzen auf H1 umschreiben
UPDATE kooperationen
SET kampagne_id = '273f938c-3abe-465f-92b6-59f675dfa7d7', updated_at = now()
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

UPDATE vertraege
SET kampagne_id = '273f938c-3abe-465f-92b6-59f675dfa7d7', updated_at = now()
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

UPDATE rechnung
SET kampagne_id = '273f938c-3abe-465f-92b6-59f675dfa7d7',
    auftrag_id  = 'b875738f-68bc-4475-bc41-62b251be81b4',
    updated_at  = now()
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

UPDATE kampagne_plattformen
SET kampagne_id = '273f938c-3abe-465f-92b6-59f675dfa7d7'
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

UPDATE kampagne_formate
SET kampagne_id = '273f938c-3abe-465f-92b6-59f675dfa7d7'
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

UPDATE custom_columns
SET kampagne_id = '273f938c-3abe-465f-92b6-59f675dfa7d7', updated_at = now()
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

-- 4) Duplikat-Ansprechpartner (identisch bereits auf H1) + Q2-Kampagnenart-Block loeschen
DELETE FROM ansprechpartner_kampagne
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

DELETE FROM auftrag_kampagnenart_blocks
WHERE kampagne_id = '88bfc294-da43-4578-919c-5aaa67864953';

-- 5) H1-Kampagne: Typ + Tabellen-View von Q2 uebernehmen (Zaehler bleiben 200/200)
UPDATE kampagne
SET kampagne_typ = 'influencer_posting',
    video_table_hidden_columns = '["col-videoanzahl","col-video-nr","col-drehort","col-caption","col-nutzungsrechte","col-link-skript","col-lieferadresse","col-video-typ","col-organic-paid"]'::jsonb,
    column_order = '["col-nr","col-creator","col-status","col-tags","col-extra-kosten","col-vertrag","col-nutzungsrechte","col-start-datum","col-videoanzahl","col-video-nr","col-vk-video","col-video-script-deadline","col-video-content-deadline","col-video-typ","col-thema","col-organic-paid","col-produkt","col-lieferadresse","col-paket-tracking","col-drehort","col-link-skript","col-skript-freigegeben","col-video-name","col-link-content","col-feedback-cj-1","col-feedback-kunde-1","col-feedback-cj-2","col-feedback-kunde-2","col-freigabe","col-caption","col-posting-datum","custom:3b4e5069-87ef-444f-899f-8e70091f6a6b","custom:2ae4d5f1-69e2-4c7c-aa6e-0390b842df3e","custom:93470bb5-91c9-4c8d-9774-2e9c5ddf368e","custom:f8873715-911b-40e4-ac1f-508e5f67d933","custom:6ed0d230-77f1-4a95-b489-c6013abe4506","custom:201cf891-b55c-4be3-9c98-de2b8b2d1d1c","custom:262ed42b-6382-4dbf-849c-4c3ff36b5552","col-actions"]'::jsonb,
    updated_at = now()
WHERE id = '273f938c-3abe-465f-92b6-59f675dfa7d7';

-- 6) Q2 loeschen (Kampagne zuerst leer, dann Auftrag; Teilrechnung cascaded)
DELETE FROM kampagne WHERE id = '88bfc294-da43-4578-919c-5aaa67864953';
DELETE FROM auftrag_details WHERE auftrag_id = 'd46c7c44-e274-4389-b185-153020726133';
DELETE FROM auftrag_kampagne_art WHERE auftrag_id = 'd46c7c44-e274-4389-b185-153020726133';
DELETE FROM auftrag WHERE id = 'd46c7c44-e274-4389-b185-153020726133';

COMMIT;
