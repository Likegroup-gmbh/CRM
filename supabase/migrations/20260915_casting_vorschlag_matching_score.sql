-- casting_vorschlag.matching_score: persistierter finaler Score (ADR 0014)
-- Die Anzeige sortiert streng danach (hoechster Match oben); position
-- bleibt LLM-Interna. slot ist Legacy (Slot-Portfolio entfallen):
-- CHECK entfernt, Default 'tight'.

BEGIN;

ALTER TABLE casting_vorschlag ADD COLUMN IF NOT EXISTS matching_score smallint;

ALTER TABLE casting_vorschlag ALTER COLUMN slot SET DEFAULT 'tight';
ALTER TABLE casting_vorschlag DROP CONSTRAINT IF EXISTS casting_vorschlag_slot_check;

-- Backfill mit der neuen Formel (0.8 Fit / 0.15 Track / 0.05 Fresh).
-- Alt-Zeilen tragen keine Renorm-Info (castings), darum Standardformel;
-- ein frischer Lauf des Castings rechnet sie mit Renorm neu.
UPDATE casting_vorschlag
SET matching_score = round(
  0.8 * coalesce((scores->>'fit')::numeric, 0)
  + 0.15 * coalesce((scores->>'track')::numeric, 0)
  + 0.05 * coalesce((scores->>'fresh')::numeric, 0))
WHERE matching_score IS NULL AND scores IS NOT NULL;

CREATE INDEX IF NOT EXISTS casting_vorschlag_matching_idx
  ON casting_vorschlag (casting_id, matching_score DESC);

COMMIT;
