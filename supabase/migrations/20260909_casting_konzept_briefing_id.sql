-- Step 1 Briefing-Pflicht: Casting (creator_auswahl) und Konzept (strategie)
-- bekommen je ein briefing_id auf campaign_briefings.
--
-- Nullable: Altbestand bleibt ohne Link gueltig (Grandfather).
-- ON DELETE RESTRICT: ein gesetzter Link darf nicht durch Loeschen des
-- Briefings zu NULL werden. Der Link ist nach dem Setzen eingefroren
-- (Service-Layer), die DB verhindert zusaetzlich das stille Aufloesen.
--
-- Pflicht + Final-Check (is_draft = false) sitzen im Service-Layer,
-- nicht als NOT NULL / CHECK, damit der Altbestand bestehen bleibt.

ALTER TABLE creator_auswahl
  ADD COLUMN IF NOT EXISTS briefing_id uuid
  REFERENCES campaign_briefings(id) ON DELETE RESTRICT;

ALTER TABLE strategie
  ADD COLUMN IF NOT EXISTS briefing_id uuid
  REFERENCES campaign_briefings(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS creator_auswahl_briefing_id_idx
  ON creator_auswahl(briefing_id);

CREATE INDEX IF NOT EXISTS strategie_briefing_id_idx
  ON strategie(briefing_id);
