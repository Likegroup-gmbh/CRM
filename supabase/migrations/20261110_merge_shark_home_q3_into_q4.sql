-- Merge: Shark Home - Q3 - BlastBoss -> Shark Home Q4 Total Budget
-- Survivor Auftrag:   1e34f4c9-2395-4dc8-bdeb-72e89a64260c (Shark Home Q4 Total Budget)
-- Survivor Kampagne:  141a7d0d-efad-4ce3-9750-d2ab65889ccf
-- Geloescht Auftrag:  c132a1cf-d3f1-48df-94cb-2411b7184e76 (Shark Home - Q3 - BlastBoss)
-- Geloescht Kampagne: e2a671df-17ce-4a3b-b618-d5c3022a9c83
-- Q3-Produktion 54e684b8 wandert als eigene Produktion unter Q4 (Produktionsbudget 99.473,62),
-- mit 13 Kooperationen / 18 Videos / 12 Vertraegen / 5 Rechnungen / 1 Casting.
-- Herkunfts-Tag "Shark Home - Q3 - BlastBoss" auf allen 13 Kooperationen.
-- Q4 waechst um Q3: 296.586 netto (dritte, ungestellte Teilrechnung 120.000), Creator-Budget
-- 242.153,80, Kampagnen-Volumen 318.217,98, Soll 70/70, Auftragsdetails addiert,
-- Q3-Kampagnenart-Block als zweiter Block. Dropbox bleibt unangetastet.
-- Backup: backups/2026-11-10-shark-home-q3-to-q4.json

BEGIN;

-- 0) Vorbedingungen: Q3 vollstaendig da, Q4 seit dem Backup unveraendert
DO $$
DECLARE
  q3k constant uuid := 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';
  q3a constant uuid := 'c132a1cf-d3f1-48df-94cb-2411b7184e76';
  q3p constant uuid := '54e684b8-7317-477b-a9b8-d2eeae61ead6';
  q4k constant uuid := '141a7d0d-efad-4ce3-9750-d2ab65889ccf';
  q4a constant uuid := '1e34f4c9-2395-4dc8-bdeb-72e89a64260c';
BEGIN
  IF (SELECT count(*) FROM kooperationen WHERE kampagne_id = q3k AND produktion_id = q3p) <> 13
     OR (SELECT count(*) FROM kooperationen WHERE kampagne_id = q3k) <> 13 THEN
    RAISE EXCEPTION 'Q3: erwartet 13 Kooperationen in Produktion %', q3p;
  END IF;
  IF (SELECT count(*) FROM vertraege WHERE kampagne_id = q3k) <> 12 THEN
    RAISE EXCEPTION 'Q3: erwartet 12 Vertraege';
  END IF;
  IF (SELECT count(*) FROM rechnung WHERE kampagne_id = q3k) <> 5
     OR (SELECT count(*) FROM rechnung WHERE auftrag_id = q3a) <> 5 THEN
    RAISE EXCEPTION 'Q3: erwartet 5 Rechnungen';
  END IF;
  IF (SELECT count(*) FROM produktion WHERE kampagne_id = q3k) <> 1 THEN
    RAISE EXCEPTION 'Q3: erwartet genau eine Produktion';
  END IF;
  IF (SELECT count(*) FROM auftrag_teilrechnung WHERE auftrag_id = q3a AND rechnung_gestellt) > 0 THEN
    RAISE EXCEPTION 'Q3: Teilrechnung ist inzwischen gestellt';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auftrag
     WHERE id = q4a AND nettobetrag = 176586 AND ust_betrag = 33551.34
       AND bruttobetrag = 210137.34 AND creator_budget = 142680.18
       AND anzahl_teilrechnungen = 2
  ) THEN
    RAISE EXCEPTION 'Q4-Auftrag weicht vom Backup ab';
  END IF;
  IF (SELECT array_agg(position ORDER BY position) FROM auftrag_teilrechnung WHERE auftrag_id = q4a) <> ARRAY[1, 2] THEN
    RAISE EXCEPTION 'Q4: Teilrechnungen weichen vom Backup ab';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM kampagne
     WHERE id = q4k AND volumen = 198217.98 AND creator_budget = 142680.18
       AND videoanzahl = 50 AND creatoranzahl = 50
       AND influencer_video_anzahl = 50 AND influencer_creator_anzahl = 50
  ) THEN
    RAISE EXCEPTION 'Q4-Kampagne weicht vom Backup ab';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auftrag_details
     WHERE auftrag_id = q4a AND gesamt_videos = 50 AND gesamt_creator = 50
       AND influencer_video_anzahl = 50 AND influencer_creator_anzahl = 50
       AND influencer_einkaufspreis_netto_von = 149890.84 AND influencer_einkaufspreis_netto_bis = 149890.84
       AND influencer_verkaufspreis_netto_von = 149890.84 AND influencer_verkaufspreis_netto_bis = 149890.84
       AND percentage_fee_value = 25854.52 AND ksk_value = 8051.30
  ) THEN
    RAISE EXCEPTION 'Q4-Auftragsdetails weichen vom Backup ab';
  END IF;
  IF (SELECT count(*) FROM auftrag_kampagnenart_blocks WHERE auftrag_id = q4a) <> 1 THEN
    RAISE EXCEPTION 'Q4: erwartet genau einen Kampagnenart-Block';
  END IF;
END $$;

-- 1) Herkunfts-Tag anlegen (idempotent) und an alle Q3-Kooperationen haengen
INSERT INTO kooperation_tag_typen (name)
SELECT 'Shark Home - Q3 - BlastBoss'
WHERE NOT EXISTS (SELECT 1 FROM kooperation_tag_typen WHERE name = 'Shark Home - Q3 - BlastBoss');

INSERT INTO kooperation_tags (kooperation_id, tag_id)
SELECT k.id, t.id
FROM kooperationen k, kooperation_tag_typen t
WHERE k.kampagne_id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83'
  AND t.name = 'Shark Home - Q3 - BlastBoss'
  AND NOT EXISTS (
    SELECT 1 FROM kooperation_tags kt
    WHERE kt.kooperation_id = k.id AND kt.tag_id = t.id
  );

-- 2) Produktion zuerst unter Q4, damit die Kooperationen ihre kampagne_id daraus ableiten
UPDATE produktion
SET kampagne_id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf',
    budget      = 99473.62
WHERE id = '54e684b8-7317-477b-a9b8-d2eeae61ead6';

-- 3) Kooperationen (Trigger sync_kampagne_id_from_produktion setzt kampagne_id aus der Produktion)
UPDATE kooperationen
SET kampagne_id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf', updated_at = now()
WHERE kampagne_id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';

-- 4) Vertraege, Rechnungen, Casting
UPDATE vertraege
SET kampagne_id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf', updated_at = now()
WHERE kampagne_id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';

UPDATE rechnung
SET kampagne_id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf',
    auftrag_id  = '1e34f4c9-2395-4dc8-bdeb-72e89a64260c',
    updated_at  = now()
WHERE kampagne_id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';

UPDATE creator_auswahl
SET kampagne_id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf'
WHERE kampagne_id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';

-- 5) Ansprechpartner: fehlende Q3-Zuordnungen an Q4, Rest loeschen
INSERT INTO ansprechpartner_kampagne (kampagne_id, ansprechpartner_id)
SELECT '141a7d0d-efad-4ce3-9750-d2ab65889ccf', ak.ansprechpartner_id
FROM ansprechpartner_kampagne ak
WHERE ak.kampagne_id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83'
  AND NOT EXISTS (
    SELECT 1 FROM ansprechpartner_kampagne x
    WHERE x.kampagne_id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf'
      AND x.ansprechpartner_id = ak.ansprechpartner_id
  );

DELETE FROM ansprechpartner_kampagne
WHERE kampagne_id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';

-- 6) Q3-Kampagnenart-Block als zweiter Block an Q4
UPDATE auftrag_kampagnenart_blocks
SET auftrag_id = '1e34f4c9-2395-4dc8-bdeb-72e89a64260c',
    kampagne_id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf',
    sort_order = 1,
    updated_at = now()
WHERE auftrag_id = 'c132a1cf-d3f1-48df-94cb-2411b7184e76';

-- 7) Q4-Kampagne: Volumen, Creator-Budget, Soll
UPDATE kampagne
SET volumen = 318217.98,
    creator_budget = 242153.80,
    videoanzahl = 70,
    creatoranzahl = 70,
    influencer_video_anzahl = 70,
    influencer_creator_anzahl = 70,
    updated_at = now()
WHERE id = '141a7d0d-efad-4ce3-9750-d2ab65889ccf';

-- 8) Q4-Auftrag: Betraege und dritte Teilrechnung
UPDATE auftrag
SET nettobetrag = 296586,
    ust_betrag = 56351.34,
    bruttobetrag = 352937.34,
    creator_budget = 242153.80,
    anzahl_teilrechnungen = 3,
    updated_at = now()
WHERE id = '1e34f4c9-2395-4dc8-bdeb-72e89a64260c';

INSERT INTO auftrag_teilrechnung
  (auftrag_id, position, nettobetrag, ust_prozent, ust_betrag, bruttobetrag, rechnung_gestellt, notiz)
VALUES
  ('1e34f4c9-2395-4dc8-bdeb-72e89a64260c', 3, 120000, 19, 22800, 142800, false,
   'Übernommen aus Shark Home - Q3 - BlastBoss (PO PO-SharkNinja-2026-48-494, Angebot A-2026-0190)');

-- 9) Q4-Auftragsdetails addieren
UPDATE auftrag_details
SET gesamt_videos = 70,
    gesamt_creator = 70,
    influencer_video_anzahl = 70,
    influencer_creator_anzahl = 70,
    influencer_einkaufspreis_netto_von = 249021.28,
    influencer_einkaufspreis_netto_bis = 249021.28,
    influencer_verkaufspreis_netto_von = 249021.28,
    influencer_verkaufspreis_netto_bis = 249021.28,
    percentage_fee_value = 41506.69,
    ksk_value = 12925.51,
    influencer_budget_info = coalesce(influencer_budget_info || E'\n\n', '')
      || 'inkl. Shark Home - Q3 - BlastBoss: Influencer Budget 99,130.44, Agency Fee 15,652.17, KSK 4,874.21 (Auftrag 120,000.00 netto)',
    updated_at = now()
WHERE auftrag_id = '1e34f4c9-2395-4dc8-bdeb-72e89a64260c';

-- 10) Keine Verweise mehr auf Q3, sonst Abbruch (CASCADE wuerde sie still mitloeschen)
DO $$
DECLARE
  q3k constant uuid := 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';
  q3a constant uuid := 'c132a1cf-d3f1-48df-94cb-2411b7184e76';
  rest bigint;
BEGIN
  SELECT
      (SELECT count(*) FROM ablage_ordner WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM ansprechpartner_kampagne WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM auftrag_kampagnenart_blocks WHERE kampagne_id = q3k OR auftrag_id = q3a)
    + (SELECT count(*) FROM campaign_briefings WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM creator_auswahl WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM creator_notiz WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM creator_rating WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM creator_upload_token WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM custom_columns WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_adressen WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_creator WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_creator_favoriten WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_creator_sourcing WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_formate WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_mitarbeiter WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_organic_ziele WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_paid_ziele WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kampagne_plattformen WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kooperation_tasks WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM kooperationen WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM produktion WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM rechnung WHERE kampagne_id = q3k OR auftrag_id = q3a)
    + (SELECT count(*) FROM skript_pakete WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM skripte WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM strategie WHERE kampagne_id = q3k OR auftrag_id = q3a)
    + (SELECT count(*) FROM vertraege WHERE kampagne_id = q3k OR contracting_auftrag_id = q3a)
    + (SELECT count(*) FROM video_tag_typen WHERE kampagne_id = q3k)
    + (SELECT count(*) FROM auftrag_copywriter WHERE auftrag_id = q3a)
    + (SELECT count(*) FROM auftrag_cutter WHERE auftrag_id = q3a)
    + (SELECT count(*) FROM auftrag_dokumente WHERE auftrag_id = q3a)
    + (SELECT count(*) FROM auftrag_format_anpassung WHERE auftrag_id = q3a)
    + (SELECT count(*) FROM auftrag_mitarbeiter WHERE auftrag_id = q3a)
    + (SELECT count(*) FROM contracting_position WHERE auftrag_id = q3a)
  INTO rest;

  IF rest <> 0 THEN
    RAISE EXCEPTION 'Noch % Verweise auf Q3-Kampagne/-Auftrag', rest;
  END IF;
END $$;

-- 11) Q3 loeschen (Kampagne zuerst leer, dann Auftrag; ungestellte Q3-Teilrechnung cascaded)
DELETE FROM kampagne WHERE id = 'e2a671df-17ce-4a3b-b618-d5c3022a9c83';
DELETE FROM auftrag_details WHERE auftrag_id = 'c132a1cf-d3f1-48df-94cb-2411b7184e76';
DELETE FROM auftrag_kampagne_art WHERE auftrag_id = 'c132a1cf-d3f1-48df-94cb-2411b7184e76';
DELETE FROM auftrag WHERE id = 'c132a1cf-d3f1-48df-94cb-2411b7184e76';

-- 12) Nachbedingungen
DO $$
DECLARE
  q3p constant uuid := '54e684b8-7317-477b-a9b8-d2eeae61ead6';
  q4k constant uuid := '141a7d0d-efad-4ce3-9750-d2ab65889ccf';
  q4a constant uuid := '1e34f4c9-2395-4dc8-bdeb-72e89a64260c';
BEGIN
  IF (SELECT count(*) FROM kooperationen WHERE kampagne_id = q4k) <> 25
     OR (SELECT count(*) FROM kooperationen WHERE produktion_id = q3p AND kampagne_id = q4k) <> 13 THEN
    RAISE EXCEPTION 'Nachher: Kooperationen stimmen nicht';
  END IF;
  IF (SELECT count(*) FROM kooperation_videos v JOIN kooperationen k ON k.id = v.kooperation_id WHERE k.kampagne_id = q4k) <> 30 THEN
    RAISE EXCEPTION 'Nachher: Videos stimmen nicht';
  END IF;
  IF (SELECT count(*) FROM vertraege WHERE kampagne_id = q4k) <> 20 THEN
    RAISE EXCEPTION 'Nachher: Vertraege stimmen nicht';
  END IF;
  IF (SELECT count(*) FROM rechnung WHERE kampagne_id = q4k AND auftrag_id = q4a) <> 5 THEN
    RAISE EXCEPTION 'Nachher: Rechnungen stimmen nicht';
  END IF;
  IF (SELECT sum(nettobetrag) FROM auftrag_teilrechnung WHERE auftrag_id = q4a)
     <> (SELECT nettobetrag FROM auftrag WHERE id = q4a) THEN
    RAISE EXCEPTION 'Nachher: Teilrechnungen ergeben nicht den Auftrag';
  END IF;
  IF EXISTS (
    SELECT 1 FROM produktion_verbrauch v JOIN produktion p ON p.id = v.produktion_id
     WHERE p.kampagne_id = q4k AND p.budget IS NOT NULL AND v.budget_used > p.budget
  ) THEN
    RAISE EXCEPTION 'Nachher: Produktion ueber Budget';
  END IF;
END $$;

COMMIT;
