-- Medienablage-Seite ohne Disk-IO-Last.
-- ablage_dokumente_stand: Die CTE v wird zweimal gelesen und deshalb materialisiert. Mit x.* trug sie
-- alle Spalten von vertraege (rund 4 MB) und lief bei work_mem 3,5 MB in Temp-Dateien, rund 3 MB je
-- Aufruf. v traegt jetzt nur die Spalten, die a braucht.
-- ablage_umzug_fortschritt: Zaehler je Unternehmen und Bereich fuer die beobachteten Umzuege. Damit
-- laedt die Seite waehrend eines Umzugs nach, ohne jedes Mal den ganzen Stand zu rechnen.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.ablage_umzug_fortschritt(text, uuid[]);
--   ablage_dokumente_stand: Definition aus 20261210 erneut ausfuehren.

BEGIN;

CREATE OR REPLACE FUNCTION public.ablage_dokumente_stand(p_drive_id text)
RETURNS TABLE (
  id uuid, dokument_ablage_ziel text,
  dokumente_sharepoint bigint, dokumente_dropbox bigint, dokumente_storage bigint,
  umzug_offen bigint, umzug_fertig bigint, umzug_fehler bigint, umzug_uebersprungen bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (
    SELECT coalesce(x.kunde_unternehmen_id, ka.unternehmen_id, au.unternehmen_id) AS uid,
      x.datei_url, x.datei_ablage, x.datei_path, x.signiert_ablage,
      x.dropbox_file_url, x.dropbox_file_path,
      x.unterschriebener_vertrag_url, x.unterschriebener_vertrag_path
    FROM vertraege x
    LEFT JOIN kampagne ka ON ka.id = x.kampagne_id
    LEFT JOIN auftrag au ON au.id = x.contracting_auftrag_id
  ),
  a AS (
    SELECT v.uid, v.datei_ablage AS ablage, v.datei_path AS pfad FROM v WHERE v.datei_url IS NOT NULL
    UNION ALL
    SELECT v.uid, v.signiert_ablage,
      CASE WHEN v.dropbox_file_url IS NOT NULL THEN v.dropbox_file_path ELSE v.unterschriebener_vertrag_path END
      FROM v WHERE coalesce(v.dropbox_file_url, v.unterschriebener_vertrag_url) IS NOT NULL
    UNION ALL
    SELECT r.unternehmen_id, p.ablage, p.file_path FROM rechnung_pdfs p JOIN rechnung r ON r.id = p.rechnung_id
    UNION ALL
    SELECT r.unternehmen_id, b.ablage, b.file_path FROM rechnung_belege b JOIN rechnung r ON r.id = b.rechnung_id
    UNION ALL
    SELECT au.unternehmen_id, d.ablage, d.dropbox_file_path FROM auftrag_dokumente d JOIN auftrag au ON au.id = d.auftrag_id
  ),
  d AS (
    SELECT a.uid,
      count(*) FILTER (WHERE a.ablage = 'sharepoint') AS sp,
      count(*) FILTER (WHERE a.ablage <> 'sharepoint' AND a.pfad LIKE '/%') AS dbx,
      count(*) FILTER (WHERE a.ablage <> 'sharepoint' AND a.pfad IS DISTINCT FROM NULL AND a.pfad NOT LIKE '/%') AS st
    FROM a WHERE a.uid IS NOT NULL
    GROUP BY a.uid
  ),
  m AS (
    SELECT z.unternehmen_id,
      count(*) FILTER (WHERE z.status = 'offen') AS offen,
      count(*) FILTER (WHERE z.status = 'fertig') AS fertig,
      count(*) FILTER (WHERE z.status = 'fehler') AS fehler,
      count(*) FILTER (WHERE z.status = 'uebersprungen') AS uebersprungen
    FROM ablage_umzug z
    WHERE z.drive_id = p_drive_id AND z.typ NOT IN ('video', 'story', 'still', 'roh')
    GROUP BY z.unternehmen_id
  )
  SELECT u.id, coalesce(u.dokument_ablage_ziel, 'dropbox'),
    coalesce(d.sp, 0), coalesce(d.dbx, 0), coalesce(d.st, 0),
    coalesce(m.offen, 0), coalesce(m.fertig, 0), coalesce(m.fehler, 0), coalesce(m.uebersprungen, 0)
  FROM unternehmen u
  LEFT JOIN d ON d.uid = u.id
  LEFT JOIN m ON m.unternehmen_id = u.id
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_dokumente_stand(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_dokumente_stand(text) TO service_role;

-- Admin-Seite: Umzugsfortschritt der beobachteten Unternehmen, je Bereich (Medien, Dokumente)
CREATE OR REPLACE FUNCTION public.ablage_umzug_fortschritt(p_drive_id text, p_ids uuid[])
RETURNS TABLE (
  unternehmen_id uuid, bereich text,
  offen bigint, fertig bigint, fehler bigint, uebersprungen bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.unternehmen_id,
    CASE WHEN z.typ IN ('video', 'story', 'still', 'roh') THEN 'medien' ELSE 'dokumente' END,
    count(*) FILTER (WHERE z.status = 'offen'),
    count(*) FILTER (WHERE z.status = 'fertig'),
    count(*) FILTER (WHERE z.status = 'fehler'),
    count(*) FILTER (WHERE z.status = 'uebersprungen')
  FROM ablage_umzug z
  WHERE z.drive_id = p_drive_id AND z.unternehmen_id = ANY(p_ids)
  GROUP BY 1, 2
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_umzug_fortschritt(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_umzug_fortschritt(text, uuid[]) TO service_role;

COMMIT;
