-- Casting gruppiert wieder nach eigenen Kategorien statt nach Briefing-Persona
-- (loest die Gruppenachse aus 20260918_casting_item_persona.sql ab).
--
-- 1. Eintraege mit persona_id und ohne Kategorie bekommen den Persona-Namen als
--    Kategorie, damit die bisherigen Gruppen stehen bleiben. Das Label folgt
--    PersonaService.label ("Oberbegriff · Name"); Kommas fliegen raus, weil
--    creator_auswahl.teilbereich eine kommagetrennte Liste ist.
-- 2. creator_auswahl.teilbereich wird aus den Briefing-Personas der Liste (in
--    Briefing-Reihenfolge, auch leere Gruppen) und den Kategorien der Eintraege
--    neu aufgebaut. "Nicht umsetzen" ist keine Kategorie dieser Liste.
-- 3. persona_id bleibt an den Zeilen stehen (Skripte lesen sie am Casting-Eintrag).

BEGIN;

-- 1. Persona-Label als Kategorie
WITH labels AS (
  SELECT
    p.id,
    COALESCE(
      NULLIF(
        btrim(replace(
          concat_ws(' · ', NULLIF(btrim(p.oberbegriff), ''), NULLIF(btrim(p.name), '')),
          ',', ''
        )),
        ''
      ),
      'Persona'
    ) AS label
  FROM personas p
)
UPDATE creator_auswahl_items i
SET kategorie = labels.label
FROM labels
WHERE labels.id = i.persona_id
  AND COALESCE(i.nicht_umsetzen, false) = false
  AND (i.kategorie IS NULL OR btrim(i.kategorie) = '');

-- 2. teilbereich neu aufbauen
WITH labels AS (
  SELECT
    p.id,
    COALESCE(
      NULLIF(
        btrim(replace(
          concat_ws(' · ', NULLIF(btrim(p.oberbegriff), ''), NULLIF(btrim(p.name), '')),
          ',', ''
        )),
        ''
      ),
      'Persona'
    ) AS label
  FROM personas p
),
persona_kategorien AS (
  SELECT
    l.id AS liste_id,
    labels.label AS name,
    pos.ord::int AS ord
  FROM creator_auswahl l
  JOIN campaign_briefings b ON b.id = l.briefing_id
  CROSS JOIN LATERAL unnest(COALESCE(b.persona_ids, '{}'::uuid[])) WITH ORDINALITY AS pos(pid, ord)
  JOIN labels ON labels.id = pos.pid
),
item_kategorien AS (
  SELECT
    i.creator_auswahl_id AS liste_id,
    btrim(i.kategorie) AS name,
    min(COALESCE(i.sortierung, 0)) AS first_sort
  FROM creator_auswahl_items i
  WHERE i.kategorie IS NOT NULL
    AND btrim(i.kategorie) <> ''
    AND lower(btrim(i.kategorie)) <> 'nicht umsetzen'
    AND btrim(i.kategorie) NOT LIKE '%,%'
  GROUP BY i.creator_auswahl_id, btrim(i.kategorie)
),
alle AS (
  SELECT liste_id, name, 0 AS gruppe, ord AS sort_a, 0 AS sort_b
  FROM persona_kategorien
  UNION ALL
  SELECT liste_id, name, 1 AS gruppe, 0 AS sort_a, first_sort AS sort_b
  FROM item_kategorien
),
dedupliziert AS (
  SELECT DISTINCT ON (liste_id, name) liste_id, name, gruppe, sort_a, sort_b
  FROM alle
  ORDER BY liste_id, name, gruppe, sort_a, sort_b
),
csv AS (
  SELECT liste_id, string_agg(name, ', ' ORDER BY gruppe, sort_a, sort_b, name) AS teilbereich
  FROM dedupliziert
  GROUP BY liste_id
)
UPDATE creator_auswahl l
SET teilbereich = csv.teilbereich
FROM csv
WHERE l.id = csv.liste_id;

COMMENT ON COLUMN creator_auswahl.teilbereich IS
  'Kategorien des Castings, kommagetrennt in Anzeigereihenfolge. Der Eintrag traegt den Namen in creator_auswahl_items.kategorie.';

COMMIT;
