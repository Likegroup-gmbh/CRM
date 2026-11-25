-- Casting-Eintraege haengen an einer Briefing-Persona (ADR 0019).
-- Gruppenkoepfe kommen live aus campaign_briefings.persona_ids;
-- creator_auswahl.teilbereich / items.kategorie bleiben nur fuer
-- den reservierten Eimer "Nicht umsetzen".

BEGIN;

ALTER TABLE creator_auswahl_items
  ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES personas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS creator_auswahl_items_persona_id_idx
  ON creator_auswahl_items(persona_id);

COMMENT ON COLUMN creator_auswahl_items.persona_id IS
  'Briefing-Persona, unter der der Casting-Eintrag gruppiert wird.';

-- Backfill: Kategorie-Name trifft einen Persona-Namen des Briefings.
UPDATE creator_auswahl_items i
SET persona_id = p.id
FROM creator_auswahl l
JOIN campaign_briefings b ON b.id = l.briefing_id
JOIN LATERAL unnest(COALESCE(b.persona_ids, '{}'::uuid[])) AS pid ON true
JOIN personas p ON p.id = pid
WHERE i.creator_auswahl_id = l.id
  AND i.persona_id IS NULL
  AND i.kategorie IS NOT NULL
  AND lower(btrim(i.kategorie)) <> 'nicht umsetzen'
  AND lower(btrim(i.kategorie)) = lower(btrim(p.name));

-- Nach dem Match keine Freitext-Kategorie mehr (Nicht umsetzen bleibt).
UPDATE creator_auswahl_items
SET kategorie = NULL
WHERE persona_id IS NOT NULL
  AND kategorie IS NOT NULL
  AND lower(btrim(kategorie)) <> 'nicht umsetzen';

COMMIT;
