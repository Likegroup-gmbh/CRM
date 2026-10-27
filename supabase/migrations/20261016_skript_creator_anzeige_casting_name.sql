-- Gast-Anzeige folgt dem Namen im Casting, nicht den Stammdaten.
-- Vorname und Nachname bleiben leer, sobald der Casting-Name gilt,
-- damit die Sidebar nicht den alten Stammdaten-Namen zeigt.

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
      CASE WHEN NULLIF(btrim(cai.name), '') IS NULL THEN c.vorname ELSE NULL END AS vorname,
      CASE WHEN NULLIF(btrim(cai.name), '') IS NULL THEN c.nachname ELSE NULL END AS nachname,
      COALESCE(
        NULLIF(btrim(cai.name), ''),
        NULLIF(btrim(concat_ws(' ', c.vorname, c.nachname)), ''),
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

-- Umbenennen in der Akte schreibt den Namen in Casting und Altbestand.
CREATE OR REPLACE FUNCTION public.sync_creator_anzeige_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anzeige text;
BEGIN
  IF NEW.vorname IS NOT DISTINCT FROM OLD.vorname
     AND NEW.nachname IS NOT DISTINCT FROM OLD.nachname THEN
    RETURN NEW;
  END IF;

  anzeige := NULLIF(btrim(concat_ws(' ', NEW.vorname, NEW.nachname)), '');
  IF anzeige IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE creator_auswahl_items
  SET name = anzeige
  WHERE creator_id = NEW.id
    AND name IS DISTINCT FROM anzeige;

  UPDATE strategie_items
  SET creator_name = anzeige
  WHERE creator_id = NEW.id
    AND creator_name IS DISTINCT FROM anzeige;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_creator_anzeige_name() FROM PUBLIC;

DROP TRIGGER IF EXISTS creator_anzeige_name_sync ON public.creator;
CREATE TRIGGER creator_anzeige_name_sync
  AFTER UPDATE OF vorname, nachname ON public.creator
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_creator_anzeige_name();
