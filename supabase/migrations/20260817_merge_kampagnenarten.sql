-- Migration: Kampagnenarten zusammenführen
-- Paid-Familie  (UGC Paid, UGC Pro Paid, UGC Video Paid)                    -> UGC Paid
-- Organic-Familie (UGC Organic, UGC Pro/Video Organic, UGC-Kampagne, IGC)   -> UGC Organic
-- Story -> Influencer Story; Vor Ort Produktionen/Vorort-Produktion -> Vor-Ort-Produktion
-- Kanonisch danach: UGC Paid, UGC Organic, Influencer Kampagne, Influencer Story,
--                   Vor-Ort-Produktion, Whitelisting, Darkposting

-- ============================================================
-- 1. kampagne_art_typen: Überlebende umbenennen (IDs bleiben stabil)
-- ============================================================
UPDATE kampagne_art_typen SET name = 'UGC Paid', updated_at = now()
  WHERE id = 'be8aa1a7-4252-4bf6-a912-d48dd6029877'; -- war UGC Pro Paid
UPDATE kampagne_art_typen SET name = 'UGC Organic', updated_at = now()
  WHERE id = '8774071c-d782-4004-9ded-a6b7ee304238'; -- war UGC Pro Organic
UPDATE kampagne_art_typen SET name = 'Vor-Ort-Produktion', updated_at = now()
  WHERE id = '97d1136b-72fd-4724-8fe8-cfa1295c5b62'; -- war Vor Ort Produktionen

-- Fehlende kanonische Typen anlegen
INSERT INTO kampagne_art_typen (name, beschreibung, sort_order)
  SELECT 'Influencer Story', 'Story-Kampagne mit Influencern', 4
  WHERE NOT EXISTS (SELECT 1 FROM kampagne_art_typen WHERE name = 'Influencer Story');
INSERT INTO kampagne_art_typen (name, beschreibung, sort_order)
  SELECT 'Whitelisting', 'Whitelisting / Spark Ads', 6
  WHERE NOT EXISTS (SELECT 1 FROM kampagne_art_typen WHERE name = 'Whitelisting');
INSERT INTO kampagne_art_typen (name, beschreibung, sort_order)
  SELECT 'Darkposting', 'Darkposting', 7
  WHERE NOT EXISTS (SELECT 1 FROM kampagne_art_typen WHERE name = 'Darkposting');

-- ============================================================
-- 2. FK-Umhängen: auftrag_kampagne_art
-- ============================================================
UPDATE auftrag_kampagne_art SET kampagne_art_id = 'be8aa1a7-4252-4bf6-a912-d48dd6029877'
  WHERE kampagne_art_id = '1ef9dcd1-3c8d-4eda-bc5e-6ba2a7e24f83'; -- UGC Video Paid -> UGC Paid
UPDATE auftrag_kampagne_art SET kampagne_art_id = '8774071c-d782-4004-9ded-a6b7ee304238'
  WHERE kampagne_art_id IN (
    'ff455fd4-6bc8-4eb1-890c-dd0be60ece95', -- UGC Video Organic
    'ae78c7ef-4709-444f-9f22-63a507879351', -- UGC-Kampagne
    '354b2e16-b49e-4346-8452-44fefdc7b668'  -- IGC Kampagnen
  );

-- Duplikate pro (auftrag_id, kampagne_art_id) entfernen (ältester Eintrag gewinnt)
DELETE FROM auftrag_kampagne_art a
  USING auftrag_kampagne_art b
  WHERE a.auftrag_id = b.auftrag_id
    AND a.kampagne_art_id = b.kampagne_art_id
    AND (a.hinzugefuegt_am > b.hinzugefuegt_am
         OR (a.hinzugefuegt_am = b.hinzugefuegt_am AND a.id > b.id));

-- ============================================================
-- 3. FK-Umhängen: auftrag_kampagnenart_blocks
-- ============================================================
UPDATE auftrag_kampagnenart_blocks SET kampagne_art_id = 'be8aa1a7-4252-4bf6-a912-d48dd6029877'
  WHERE kampagne_art_id = '1ef9dcd1-3c8d-4eda-bc5e-6ba2a7e24f83';
UPDATE auftrag_kampagnenart_blocks SET kampagne_art_id = '8774071c-d782-4004-9ded-a6b7ee304238'
  WHERE kampagne_art_id IN (
    'ff455fd4-6bc8-4eb1-890c-dd0be60ece95',
    'ae78c7ef-4709-444f-9f22-63a507879351',
    '354b2e16-b49e-4346-8452-44fefdc7b668'
  );

-- ============================================================
-- 4. Zusammengeführte Typen löschen
-- ============================================================
DELETE FROM kampagne_art_typen WHERE id IN (
  '1ef9dcd1-3c8d-4eda-bc5e-6ba2a7e24f83', -- UGC Video Paid
  'ff455fd4-6bc8-4eb1-890c-dd0be60ece95', -- UGC Video Organic
  'ae78c7ef-4709-444f-9f22-63a507879351', -- UGC-Kampagne
  '354b2e16-b49e-4346-8452-44fefdc7b668'  -- IGC Kampagnen
);

-- sort_order kanonisch setzen
UPDATE kampagne_art_typen SET sort_order = 1 WHERE name = 'UGC Paid';
UPDATE kampagne_art_typen SET sort_order = 2 WHERE name = 'UGC Organic';
UPDATE kampagne_art_typen SET sort_order = 3 WHERE name = 'Influencer Kampagne';
UPDATE kampagne_art_typen SET sort_order = 4 WHERE name = 'Influencer Story';
UPDATE kampagne_art_typen SET sort_order = 5 WHERE name = 'Vor-Ort-Produktion';
UPDATE kampagne_art_typen SET sort_order = 6 WHERE name = 'Whitelisting';
UPDATE kampagne_art_typen SET sort_order = 7 WHERE name = 'Darkposting';

-- ============================================================
-- 5. kampagne.art_der_kampagne normalisieren (UUIDs + Altschreibweisen -> kanonische Namen, dedupliziert)
-- ============================================================
WITH map(val, canonical) AS (VALUES
  ('UGC Paid','UGC Paid'), ('UGC Pro Paid','UGC Paid'), ('UGC Video Paid','UGC Paid'),
  ('UGC Organic','UGC Organic'), ('UGC Pro Organic','UGC Organic'), ('UGC Video Organic','UGC Organic'),
  ('UGC-Kampagne','UGC Organic'), ('UGC Kampagne','UGC Organic'),
  ('IGC Kampagnen','UGC Organic'), ('IGC Kampagne','UGC Organic'),
  ('Influencer Kampagne','Influencer Kampagne'),
  ('Story','Influencer Story'), ('Influencer Story','Influencer Story'),
  ('Vorort-Produktion','Vor-Ort-Produktion'), ('Vor-Ort-Produktion','Vor-Ort-Produktion'),
  ('Vor Ort Produktionen','Vor-Ort-Produktion'),
  ('Whitelisting','Whitelisting'), ('Darkposting','Darkposting'),
  ('be8aa1a7-4252-4bf6-a912-d48dd6029877','UGC Paid'),
  ('1ef9dcd1-3c8d-4eda-bc5e-6ba2a7e24f83','UGC Paid'),
  ('8774071c-d782-4004-9ded-a6b7ee304238','UGC Organic'),
  ('ff455fd4-6bc8-4eb1-890c-dd0be60ece95','UGC Organic'),
  ('ae78c7ef-4709-444f-9f22-63a507879351','UGC Organic'),
  ('354b2e16-b49e-4346-8452-44fefdc7b668','UGC Organic'),
  ('b522e35e-3b25-4342-86b0-fe8091baf982','Influencer Kampagne'),
  ('97d1136b-72fd-4724-8fe8-cfa1295c5b62','Vor-Ort-Produktion')
)
UPDATE kampagne k
SET art_der_kampagne = sub.new_arr
FROM (
  SELECT k2.id, (
    SELECT array_agg(DISTINCT COALESCE(m.canonical, u.el))
    FROM unnest(k2.art_der_kampagne) AS u(el)
    LEFT JOIN map m ON m.val = u.el
  ) AS new_arr
  FROM kampagne k2
  WHERE k2.art_der_kampagne IS NOT NULL
) sub
WHERE k.id = sub.id;

-- ============================================================
-- 6. kooperation_videos.kampagnenart (Freitext) mappen
-- ============================================================
WITH map(val, canonical) AS (VALUES
  ('UGC Pro Paid','UGC Paid'), ('UGC Video Paid','UGC Paid'),
  ('UGC Pro Organic','UGC Organic'), ('UGC Video Organic','UGC Organic'),
  ('UGC-Kampagne','UGC Organic'), ('UGC Kampagne','UGC Organic'),
  ('IGC Kampagnen','UGC Organic'), ('IGC Kampagne','UGC Organic'),
  ('Story','Influencer Story'),
  ('Vorort-Produktion','Vor-Ort-Produktion'), ('Vor Ort Produktionen','Vor-Ort-Produktion')
)
UPDATE kooperation_videos v SET kampagnenart = m.canonical
FROM map m WHERE v.kampagnenart = m.val;

-- ============================================================
-- 7. auftrag_kampagnenart_blocks: Slugs + Labels + NULL-FKs
-- ============================================================
UPDATE auftrag_kampagnenart_blocks
  SET campaign_type = 'ugc_paid', campaign_type_label = 'UGC Paid', updated_at = now()
  WHERE campaign_type IN ('ugc_pro_paid', 'ugc_video_paid');
UPDATE auftrag_kampagnenart_blocks
  SET campaign_type = 'ugc_organic', campaign_type_label = 'UGC Organic', updated_at = now()
  WHERE campaign_type IN ('ugc_pro_organic', 'ugc_video_organic');
UPDATE auftrag_kampagnenart_blocks
  SET campaign_type_label = 'Influencer Story', updated_at = now()
  WHERE campaign_type = 'story';
UPDATE auftrag_kampagnenart_blocks
  SET campaign_type_label = 'Vor-Ort-Produktion', updated_at = now()
  WHERE campaign_type = 'vorort_produktion';

-- NULL kampagne_art_id anhand des (jetzt kanonischen) Labels backfillen
UPDATE auftrag_kampagnenart_blocks b
  SET kampagne_art_id = t.id
  FROM kampagne_art_typen t
  WHERE b.kampagne_art_id IS NULL AND t.name = b.campaign_type_label;

-- Defensiv: Duplikate pro (auftrag_id, kampagne_id, campaign_type) mergen
WITH dup AS (
  SELECT auftrag_id, kampagne_id, campaign_type
  FROM auftrag_kampagnenart_blocks
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
),
agg AS (
  SELECT
    b.auftrag_id, b.kampagne_id, b.campaign_type,
    (SELECT b2.id FROM auftrag_kampagnenart_blocks b2
      WHERE b2.auftrag_id IS NOT DISTINCT FROM b.auftrag_id
        AND b2.kampagne_id IS NOT DISTINCT FROM b.kampagne_id
        AND b2.campaign_type = b.campaign_type
      ORDER BY b2.created_at, b2.id LIMIT 1) AS keep_id,
    sum(b.video_anzahl) AS video_anzahl,
    sum(b.creator_anzahl) AS creator_anzahl,
    min(b.einkaufspreis_netto_von) AS einkaufspreis_netto_von,
    max(b.einkaufspreis_netto_bis) AS einkaufspreis_netto_bis,
    min(b.verkaufspreis_netto_von) AS verkaufspreis_netto_von,
    max(b.verkaufspreis_netto_bis) AS verkaufspreis_netto_bis,
    string_agg(b.budget_info, E'\n\n') FILTER (WHERE b.budget_info IS NOT NULL AND b.budget_info <> '') AS budget_info,
    sum(b.umsatz_netto) AS umsatz_netto,
    min(b.kooperations_deadline) AS kooperations_deadline
  FROM auftrag_kampagnenart_blocks b
  JOIN dup d ON d.auftrag_id IS NOT DISTINCT FROM b.auftrag_id
    AND d.kampagne_id IS NOT DISTINCT FROM b.kampagne_id
    AND d.campaign_type = b.campaign_type
  GROUP BY 1, 2, 3
)
UPDATE auftrag_kampagnenart_blocks b
  SET video_anzahl = agg.video_anzahl,
      creator_anzahl = agg.creator_anzahl,
      einkaufspreis_netto_von = agg.einkaufspreis_netto_von,
      einkaufspreis_netto_bis = agg.einkaufspreis_netto_bis,
      verkaufspreis_netto_von = agg.verkaufspreis_netto_von,
      verkaufspreis_netto_bis = agg.verkaufspreis_netto_bis,
      budget_info = agg.budget_info,
      umsatz_netto = agg.umsatz_netto,
      kooperations_deadline = agg.kooperations_deadline,
      updated_at = now()
  FROM agg
  WHERE b.id = agg.keep_id;

WITH dup AS (
  SELECT auftrag_id, kampagne_id, campaign_type
  FROM auftrag_kampagnenart_blocks
  GROUP BY 1, 2, 3
  HAVING count(*) > 1
),
keepers AS (
  SELECT DISTINCT ON (b.auftrag_id, b.kampagne_id, b.campaign_type) b.id
  FROM auftrag_kampagnenart_blocks b
  JOIN dup d ON d.auftrag_id IS NOT DISTINCT FROM b.auftrag_id
    AND d.kampagne_id IS NOT DISTINCT FROM b.kampagne_id
    AND d.campaign_type = b.campaign_type
  ORDER BY b.auftrag_id, b.kampagne_id, b.campaign_type, b.created_at, b.id
)
DELETE FROM auftrag_kampagnenart_blocks b
  USING dup d
  WHERE b.auftrag_id IS NOT DISTINCT FROM d.auftrag_id
    AND b.kampagne_id IS NOT DISTINCT FROM d.kampagne_id
    AND b.campaign_type = d.campaign_type
    AND b.id NOT IN (SELECT id FROM keepers);

-- ============================================================
-- 8. auftrag_details: Legacy-Spalten in Ziel-Spalten konsolidieren
--    Anzahlen summieren, Preis-Spans min/max, budget_info konkatenieren.
--    Hinweis: bilder_anzahl der Pro/Video-Varianten entfällt (Ziel-Modell
--    hat fuer UGC Paid/Organic keine Bilder-Spalte).
-- ============================================================
UPDATE auftrag_details SET
  ugc_paid_video_anzahl = CASE
    WHEN ugc_paid_video_anzahl IS NOT NULL OR ugc_pro_paid_video_anzahl IS NOT NULL OR ugc_video_paid_video_anzahl IS NOT NULL
    THEN COALESCE(ugc_paid_video_anzahl, 0) + COALESCE(ugc_pro_paid_video_anzahl, 0) + COALESCE(ugc_video_paid_video_anzahl, 0) END,
  ugc_paid_creator_anzahl = CASE
    WHEN ugc_paid_creator_anzahl IS NOT NULL OR ugc_pro_paid_creator_anzahl IS NOT NULL OR ugc_video_paid_creator_anzahl IS NOT NULL
    THEN COALESCE(ugc_paid_creator_anzahl, 0) + COALESCE(ugc_pro_paid_creator_anzahl, 0) + COALESCE(ugc_video_paid_creator_anzahl, 0) END,
  ugc_paid_budget_info = NULLIF(concat_ws(E'\n\n',
    NULLIF(ugc_paid_budget_info, ''), NULLIF(ugc_pro_paid_budget_info, ''), NULLIF(ugc_video_paid_budget_info, '')), ''),
  ugc_paid_einkaufspreis_netto_von = LEAST(ugc_paid_einkaufspreis_netto_von, ugc_pro_paid_einkaufspreis_netto_von, ugc_video_paid_einkaufspreis_netto_von),
  ugc_paid_einkaufspreis_netto_bis = GREATEST(ugc_paid_einkaufspreis_netto_bis, ugc_pro_paid_einkaufspreis_netto_bis, ugc_video_paid_einkaufspreis_netto_bis),
  ugc_paid_verkaufspreis_netto_von = LEAST(ugc_paid_verkaufspreis_netto_von, ugc_pro_paid_verkaufspreis_netto_von, ugc_video_paid_verkaufspreis_netto_von),
  ugc_paid_verkaufspreis_netto_bis = GREATEST(ugc_paid_verkaufspreis_netto_bis, ugc_pro_paid_verkaufspreis_netto_bis, ugc_video_paid_verkaufspreis_netto_bis);

UPDATE auftrag_details SET
  ugc_organic_video_anzahl = CASE
    WHEN ugc_organic_video_anzahl IS NOT NULL OR ugc_pro_organic_video_anzahl IS NOT NULL OR ugc_video_organic_video_anzahl IS NOT NULL OR ugc_video_anzahl IS NOT NULL
    THEN COALESCE(ugc_organic_video_anzahl, 0) + COALESCE(ugc_pro_organic_video_anzahl, 0) + COALESCE(ugc_video_organic_video_anzahl, 0) + COALESCE(ugc_video_anzahl, 0) END,
  ugc_organic_creator_anzahl = CASE
    WHEN ugc_organic_creator_anzahl IS NOT NULL OR ugc_pro_organic_creator_anzahl IS NOT NULL OR ugc_video_organic_creator_anzahl IS NOT NULL OR ugc_creator_anzahl IS NOT NULL
    THEN COALESCE(ugc_organic_creator_anzahl, 0) + COALESCE(ugc_pro_organic_creator_anzahl, 0) + COALESCE(ugc_video_organic_creator_anzahl, 0) + COALESCE(ugc_creator_anzahl, 0) END,
  ugc_organic_budget_info = NULLIF(concat_ws(E'\n\n',
    NULLIF(ugc_organic_budget_info, ''), NULLIF(ugc_pro_organic_budget_info, ''), NULLIF(ugc_video_organic_budget_info, ''), NULLIF(ugc_budget_info, '')), ''),
  ugc_organic_einkaufspreis_netto_von = LEAST(ugc_organic_einkaufspreis_netto_von, ugc_pro_organic_einkaufspreis_netto_von, ugc_video_organic_einkaufspreis_netto_von, ugc_einkaufspreis_netto_von, ugc_einkaufspreis_netto),
  ugc_organic_einkaufspreis_netto_bis = GREATEST(ugc_organic_einkaufspreis_netto_bis, ugc_pro_organic_einkaufspreis_netto_bis, ugc_video_organic_einkaufspreis_netto_bis, ugc_einkaufspreis_netto_bis, ugc_einkaufspreis_netto),
  ugc_organic_verkaufspreis_netto_von = LEAST(ugc_organic_verkaufspreis_netto_von, ugc_pro_organic_verkaufspreis_netto_von, ugc_video_organic_verkaufspreis_netto_von, ugc_verkaufspreis_netto_von, ugc_verkaufspreis_netto),
  ugc_organic_verkaufspreis_netto_bis = GREATEST(ugc_organic_verkaufspreis_netto_bis, ugc_pro_organic_verkaufspreis_netto_bis, ugc_video_organic_verkaufspreis_netto_bis, ugc_verkaufspreis_netto_bis, ugc_verkaufspreis_netto);

-- Quell-Spalten leeren (DROP erst in spaeterem Cleanup)
UPDATE auftrag_details SET
  ugc_pro_paid_video_anzahl = NULL, ugc_pro_paid_creator_anzahl = NULL, ugc_pro_paid_bilder_anzahl = NULL,
  ugc_pro_paid_budget_info = NULL, ugc_pro_paid_einkaufspreis_netto_von = NULL, ugc_pro_paid_einkaufspreis_netto_bis = NULL,
  ugc_pro_paid_verkaufspreis_netto_von = NULL, ugc_pro_paid_verkaufspreis_netto_bis = NULL,
  ugc_video_paid_video_anzahl = NULL, ugc_video_paid_creator_anzahl = NULL, ugc_video_paid_bilder_anzahl = NULL,
  ugc_video_paid_budget_info = NULL, ugc_video_paid_einkaufspreis_netto_von = NULL, ugc_video_paid_einkaufspreis_netto_bis = NULL,
  ugc_video_paid_verkaufspreis_netto_von = NULL, ugc_video_paid_verkaufspreis_netto_bis = NULL,
  ugc_pro_organic_video_anzahl = NULL, ugc_pro_organic_creator_anzahl = NULL, ugc_pro_organic_bilder_anzahl = NULL,
  ugc_pro_organic_budget_info = NULL, ugc_pro_organic_einkaufspreis_netto_von = NULL, ugc_pro_organic_einkaufspreis_netto_bis = NULL,
  ugc_pro_organic_verkaufspreis_netto_von = NULL, ugc_pro_organic_verkaufspreis_netto_bis = NULL,
  ugc_video_organic_video_anzahl = NULL, ugc_video_organic_creator_anzahl = NULL, ugc_video_organic_bilder_anzahl = NULL,
  ugc_video_organic_budget_info = NULL, ugc_video_organic_einkaufspreis_netto_von = NULL, ugc_video_organic_einkaufspreis_netto_bis = NULL,
  ugc_video_organic_verkaufspreis_netto_von = NULL, ugc_video_organic_verkaufspreis_netto_bis = NULL,
  ugc_video_anzahl = NULL, ugc_creator_anzahl = NULL, ugc_bilder_anzahl = NULL, ugc_budget_info = NULL,
  ugc_einkaufspreis_netto = NULL, ugc_einkaufspreis_netto_von = NULL, ugc_einkaufspreis_netto_bis = NULL,
  ugc_verkaufspreis_netto = NULL, ugc_verkaufspreis_netto_von = NULL, ugc_verkaufspreis_netto_bis = NULL;

-- ============================================================
-- 9. creator_auswahl_items: CHECK zuerst loesen, Werte mappen, CHECK neu setzen
-- ============================================================
ALTER TABLE creator_auswahl_items DROP CONSTRAINT creator_auswahl_items_typ_check;

UPDATE creator_auswahl_items SET typ = 'UGC Paid' WHERE typ IN ('UGC Pro Paid', 'UGC Video Paid');
UPDATE creator_auswahl_items SET typ = 'UGC Organic' WHERE typ IN ('UGC Pro Organic', 'UGC Video Organic', 'UGC', 'IGC');

ALTER TABLE creator_auswahl_items ADD CONSTRAINT creator_auswahl_items_typ_check
  CHECK (typ IS NULL OR typ = ANY (ARRAY[
    'UGC Paid', 'UGC Organic', 'Influencer', 'Vor-Ort-Produktion', 'Videograf', 'Model'
  ]));
