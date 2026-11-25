-- Creator-Tausch: Absage-Grund am Casting-Eintrag, Tausch-Vermerk am Skript.
-- Track zaehlt den absage-Flag schon; der Grund ist nur Kontext.

ALTER TABLE creator_auswahl_items
  ADD COLUMN IF NOT EXISTS absage_grund text;

-- { vorher_creator_id, vorher_name, jetzt_creator_id, jetzt_name, am, quittiert }
-- Banner im Skript-Editor, bis quittiert wird.
ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS creator_tausch jsonb;
