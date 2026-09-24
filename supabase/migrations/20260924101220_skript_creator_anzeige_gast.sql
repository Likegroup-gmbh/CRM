-- Share-Gaeste duerfen Creator-Joins nicht lesen (RLS haengt an Kampagne,
-- Strategie, Sourcing). Die Skript-Sidebar braucht trotzdem Name und Bild.
-- Nur Anzeige-Felder, nur fuer Skripte des aktuellen Zugangs.

CREATE OR REPLACE FUNCTION public.skript_creator_anzeige(p_ids uuid[])
RETURNS TABLE (
  skript_id uuid,
  creator_id uuid,
  vorname text,
  nachname text,
  name text,
  profilbild_url text,
  profilbild_thumb_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH erlaubt AS (
    SELECT s.id
    FROM skripte s
    WHERE p_ids IS NOT NULL
      AND cardinality(p_ids) BETWEEN 1 AND 200
      AND s.id = ANY(p_ids)
      AND can_gast_access_skript(s.id, false)
  ),
  video AS (
    SELECT DISTINCT ON (v.skript_id, c.id)
      v.skript_id,
      c.id AS creator_id,
      c.vorname,
      c.nachname,
      NULLIF(btrim(concat_ws(' ', c.vorname, c.nachname)), '') AS name,
      c.profilbild_url,
      c.profilbild_thumb_url
    FROM kooperation_videos v
    JOIN erlaubt e ON e.id = v.skript_id
    JOIN kooperationen k ON k.id = v.kooperation_id
    JOIN creator c ON c.id = k.creator_id
    ORDER BY v.skript_id, c.id
  ),
  konzept AS (
    SELECT
      s.id AS skript_id,
      c.id AS creator_id,
      c.vorname,
      c.nachname,
      COALESCE(
        NULLIF(btrim(concat_ws(' ', c.vorname, c.nachname)), ''),
        NULLIF(btrim(cai.name), ''),
        NULLIF(btrim(si.creator_name), '')
      ) AS name,
      c.profilbild_url,
      c.profilbild_thumb_url
    FROM skripte s
    JOIN erlaubt e ON e.id = s.id
    JOIN strategie_items si ON si.id = s.strategie_item_id
    LEFT JOIN creator_auswahl_items cai ON cai.id = si.creator_auswahl_item_id
    LEFT JOIN creator c ON c.id = cai.creator_id
    WHERE NOT EXISTS (
      SELECT 1 FROM video vd WHERE vd.skript_id = s.id
    )
  )
  SELECT skript_id, creator_id, vorname, nachname, name, profilbild_url, profilbild_thumb_url
  FROM video
  WHERE name IS NOT NULL
  UNION ALL
  SELECT skript_id, creator_id, vorname, nachname, name, profilbild_url, profilbild_thumb_url
  FROM konzept
  WHERE name IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.skript_creator_anzeige(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.skript_creator_anzeige(uuid[]) TO anon, authenticated, service_role;
