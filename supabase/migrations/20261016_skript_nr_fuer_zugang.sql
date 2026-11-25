-- Gast-Zugänge dürfen strategie_items nicht lesen. Die Skript-Nummer
-- (Rang der Videoidee im Konzept) kommt deshalb aus dieser Funktion,
-- nur für Skripte des aktuellen Zugangs.

CREATE OR REPLACE FUNCTION public.skript_nr_fuer_zugang(p_ids uuid[])
RETURNS TABLE (skript_id uuid, nr integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH erlaubt AS (
    SELECT s.id, s.strategie_item_id
    FROM skripte s
    WHERE p_ids IS NOT NULL
      AND cardinality(p_ids) BETWEEN 1 AND 200
      AND s.id = ANY (p_ids)
      AND can_gast_access_skript(s.id, false)
  ),
  konzepte AS (
    SELECT DISTINCT si.strategie_id
    FROM strategie_items si
    JOIN erlaubt e ON e.strategie_item_id = si.id
  ),
  idee AS (
    SELECT si.id, si.strategie_id, si.sortierung
    FROM strategie_items si
    JOIN konzepte k ON k.strategie_id = si.strategie_id
    WHERE si.id IN (SELECT strategie_item_id FROM erlaubt WHERE strategie_item_id IS NOT NULL)
       OR (
         coalesce(si.skript_freigabe, false)
         AND NOT coalesce(si.nicht_umsetzen, false)
         AND NOT coalesce(si.ist_vorschlag, false)
       )
  ),
  rang AS (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY strategie_id
        ORDER BY sortierung NULLS LAST, id
      )::integer AS nr
    FROM idee
  )
  SELECT e.id, r.nr
  FROM erlaubt e
  JOIN rang r ON r.id = e.strategie_item_id;
$$;

REVOKE ALL ON FUNCTION public.skript_nr_fuer_zugang(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skript_nr_fuer_zugang(uuid[]) TO anon, authenticated, service_role;
