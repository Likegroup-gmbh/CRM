-- Personas: volle Profilfelder fuer globale Zielgruppen-Personas
-- (marke_id bleibt nullable bestehen, wird von der UI nicht mehr gesetzt)

ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS alter_von int,
  ADD COLUMN IF NOT EXISTS alter_bis int,
  ADD COLUMN IF NOT EXISTS geschlecht varchar,
  ADD COLUMN IF NOT EXISTS wohnort_region varchar,
  ADD COLUMN IF NOT EXISTS beruf varchar,
  ADD COLUMN IF NOT EXISTS budgetrahmen varchar CHECK (budgetrahmen IN ('niedrig','mittel','hoch')),
  ADD COLUMN IF NOT EXISTS bildungsstand varchar,
  ADD COLUMN IF NOT EXISTS lebenssituation varchar,
  ADD COLUMN IF NOT EXISTS kontext text,
  ADD COLUMN IF NOT EXISTS pain_points text;
