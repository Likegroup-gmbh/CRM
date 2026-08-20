-- Migration: Kampagnenart "Influencer Events" ergänzen
-- Block-only (keine Legacy-Spalten in auftrag_details/kampagne), analog Whitelisting/Darkposting.

INSERT INTO kampagne_art_typen (name, beschreibung, sort_order)
  SELECT 'Influencer Events', 'Influencer Events', 5
  WHERE NOT EXISTS (SELECT 1 FROM kampagne_art_typen WHERE name = 'Influencer Events');

-- sort_order kanonisch setzen
UPDATE kampagne_art_typen SET sort_order = 1 WHERE name = 'UGC Paid';
UPDATE kampagne_art_typen SET sort_order = 2 WHERE name = 'UGC Organic';
UPDATE kampagne_art_typen SET sort_order = 3 WHERE name = 'Influencer Kampagne';
UPDATE kampagne_art_typen SET sort_order = 4 WHERE name = 'Influencer Story';
UPDATE kampagne_art_typen SET sort_order = 5 WHERE name = 'Influencer Events';
UPDATE kampagne_art_typen SET sort_order = 6 WHERE name = 'Vor-Ort-Produktion';
UPDATE kampagne_art_typen SET sort_order = 7 WHERE name = 'Whitelisting';
UPDATE kampagne_art_typen SET sort_order = 8 WHERE name = 'Darkposting';
