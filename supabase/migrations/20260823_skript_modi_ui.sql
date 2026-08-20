-- UI-Felder fuer Regie-Modi: IconSystem-Key + Item-Layout + kurze Subtexte

ALTER TABLE skript_modi
  ADD COLUMN IF NOT EXISTS icon varchar,
  ADD COLUMN IF NOT EXISTS item_layout varchar NOT NULL DEFAULT 'icon-label-sub';

ALTER TABLE skript_modi DROP CONSTRAINT IF EXISTS skript_modi_item_layout_check;
ALTER TABLE skript_modi ADD CONSTRAINT skript_modi_item_layout_check
  CHECK (item_layout IN ('icon', 'icon-label', 'icon-label-sub'));

UPDATE skript_modi SET
  icon = 'clapperboard',
  item_layout = 'icon-label-sub',
  beschreibung = 'Ruhige Shots, klare Schnitte'
WHERE slug = 'klassisch';

UPDATE skript_modi SET
  icon = 'spark-doc',
  item_layout = 'icon-label-sub',
  beschreibung = 'Schnelle Wechsel, mehr Szenen'
WHERE slug = 'dynamisch';
