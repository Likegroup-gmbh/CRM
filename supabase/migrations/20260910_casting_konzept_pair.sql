-- Casting (creator_auswahl) und Konzept (strategie) werden ein optionales
-- 1:1-Paar. Die Videoidee bekommt den Creator nicht mehr aus dem freien
-- CRM-Picker, sondern als Casting-Eintrag aus dem verknuepften Casting.
--
-- 1:1 in beide Richtungen ueber zwei UNIQUE-FKs:
--   creator_auswahl.strategie_id  -> strategie.id
--   strategie.creator_auswahl_id  -> creator_auswahl.id
-- Nullable: beide duerfen unverknuepft existieren (Altbestand und beide
-- Arbeitsrichtungen). ON DELETE RESTRICT: ein gesetztes Paar wird nicht
-- still aufgeloest, wenn eine Seite geloescht wird - der Service loest
-- vorher explizit.
--
-- Kampagne/Briefing-Match und "Unlink nur ohne Zuordnung" sitzen im
-- Service-Layer, nicht als DB-Trigger: der Altbestand ist n x n unverknuepft
-- und darf es bleiben, bis gepaart wird.
--
-- strategie_items.creator_auswahl_item_id ersetzt den freien Picker
-- (creator_id/creator_name bleiben als Altbestand-Anzeige stehen, werden
-- nicht mehr geschrieben). ON DELETE SET NULL: Absage/Loeschen des
-- Casting-Eintrags loest die Zuordnung an der Idee.

ALTER TABLE creator_auswahl
  ADD COLUMN IF NOT EXISTS strategie_id uuid
  REFERENCES strategie(id) ON DELETE RESTRICT;

ALTER TABLE strategie
  ADD COLUMN IF NOT EXISTS creator_auswahl_id uuid
  REFERENCES creator_auswahl(id) ON DELETE RESTRICT;

ALTER TABLE strategie_items
  ADD COLUMN IF NOT EXISTS creator_auswahl_item_id uuid
  REFERENCES creator_auswahl_items(id) ON DELETE SET NULL;

-- 1:1: jede Seite hoechstens einmal vergeben. NULLs sind bei UNIQUE
-- mehrfach erlaubt, unverknuepfte Saetze kollidieren also nicht.
CREATE UNIQUE INDEX IF NOT EXISTS creator_auswahl_strategie_id_key
  ON creator_auswahl(strategie_id) WHERE strategie_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS strategie_creator_auswahl_id_key
  ON strategie(creator_auswahl_id) WHERE creator_auswahl_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS strategie_items_creator_auswahl_item_id_idx
  ON strategie_items(creator_auswahl_item_id);
