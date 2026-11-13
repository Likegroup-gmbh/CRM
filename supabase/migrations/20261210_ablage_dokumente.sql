-- Dokumente in der Ablage (ADR 0068): Verträge, Rechnungs-PDFs, Belege und Auftragsdokumente
-- liegen in SharePoint unter Daten/<Firma>/<Bereich>/[<Marke>/]... statt in Dropbox/Supabase-Storage.
-- Nur additiv: die URL-/Pfad-Spalten bleiben die Quelle für Status und Anzeige (bei SharePoint
-- webUrl und Pfad ab Bibliothekswurzel); die Identität ist (drive_id, item_id).
-- Eigene Weiche je Unternehmen (dokument_ablage_ziel) und eigener Notschalter, getrennt von den Medien.
-- Dokument-Ordner sind Fachordner mit art = 'dokument' und einem eindeutigen dok_schluessel
-- (die Unique-Indizes für marke/kampagne erlauben je Drive nur einen Ordner, den der Medien).
-- Dazu: vertraege_select war für jeden angemeldeten Benutzer offen (auch Kunden fremder Firmen).
--
-- ROLLBACK (nur solange kein Unternehmen auf dokument_ablage_ziel = 'sharepoint' steht):
--   DROP FUNCTION IF EXISTS public.ablage_dokumente_stand(text);
--   DROP FUNCTION IF EXISTS public.ablage_dokument_umzug_anlegen(text, uuid);
--   DROP FUNCTION IF EXISTS public.ablage_dokument_umzug_holen(text, integer);
--   ablage_umzug_holen, ablage_unternehmen_stand: Definition aus 20261202 erneut ausführen.
--   ablage_pfad_umschreiben (20261201), ablage_url_umschreiben (20261209) erneut ausführen.
--   DROP INDEX ux_ablage_ordner_dokument; ALTER TABLE ablage_ordner DROP COLUMN ebene, auftrag_id, rechnung_id, dok_schluessel;
--   art-/bereich-CHECK wie in 20261209, ablage_upload.typ-CHECK wie in 20261201, ablage_umzug-CHECKs wie in 20261202.
--   ALTER TABLE vertraege DROP COLUMN datei_ablage, datei_drive_id, datei_item_id, signiert_ablage, signiert_drive_id, signiert_item_id;
--   ALTER TABLE rechnung_pdfs / rechnung_belege / auftrag_dokumente DROP COLUMN ablage, drive_id, item_id, etag, ctag;
--   ALTER TABLE unternehmen DROP COLUMN dokument_ablage_ziel; DELETE FROM ablage_einstellung WHERE schluessel = 'notschalter_dokumente';
--   vertraege_select: USING ((SELECT auth.role()) = 'authenticated') (nicht empfohlen).

BEGIN;

-- ─── Weiche und Notschalter ─────────────────────────────────

ALTER TABLE public.unternehmen
  ADD COLUMN IF NOT EXISTS dokument_ablage_ziel text NOT NULL DEFAULT 'dropbox'
    CHECK (dokument_ablage_ziel IN ('dropbox', 'sharepoint'));
COMMENT ON COLUMN public.unternehmen.dokument_ablage_ziel IS
  'Wohin neue Dokumente (Verträge, Rechnungen, Belege, Auftragsdokumente) dieses Unternehmens gehen. ablage_einstellung.notschalter_dokumente oder Env ABLAGE_ZIEL=dropbox übersteuert.';

CREATE OR REPLACE FUNCTION private.ablage_spalten_schutz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'unternehmen' AND (NEW.ablage_ziel IS DISTINCT FROM OLD.ablage_ziel
      OR NEW.dokument_ablage_ziel IS DISTINCT FROM OLD.dokument_ablage_ziel) THEN
    RAISE EXCEPTION 'Nur Admins ändern die Medienablage-Weiche' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'benutzer' AND NEW.microsoft_konto IS DISTINCT FROM OLD.microsoft_konto THEN
    RAISE EXCEPTION 'Nur Admins ändern das Microsoft-Konto' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION private.ablage_spalten_schutz() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_unternehmen_ablage_schutz ON public.unternehmen;
CREATE TRIGGER trg_unternehmen_ablage_schutz
  BEFORE UPDATE OF ablage_ziel, dokument_ablage_ziel ON public.unternehmen
  FOR EACH ROW EXECUTE FUNCTION private.ablage_spalten_schutz();

INSERT INTO public.ablage_einstellung (schluessel, wert)
VALUES ('notschalter_dokumente', 'false'::jsonb)
ON CONFLICT (schluessel) DO NOTHING;

-- ─── Dokument-Spalten ───────────────────────────────────────
-- ablage = 'dropbox' heißt: alter Weg (Dropbox-Pfad mit '/' oder Supabase-Storage-Objekt).

ALTER TABLE public.vertraege
  ADD COLUMN IF NOT EXISTS datei_ablage text NOT NULL DEFAULT 'dropbox',
  ADD COLUMN IF NOT EXISTS datei_drive_id text,
  ADD COLUMN IF NOT EXISTS datei_item_id text,
  ADD COLUMN IF NOT EXISTS signiert_ablage text NOT NULL DEFAULT 'dropbox',
  ADD COLUMN IF NOT EXISTS signiert_drive_id text,
  ADD COLUMN IF NOT EXISTS signiert_item_id text;
COMMENT ON COLUMN public.vertraege.datei_ablage IS
  'Ablage des erzeugten Vertrags (datei_url/datei_path). sharepoint: datei_url = webUrl, datei_path = Pfad ab Bibliothekswurzel.';
COMMENT ON COLUMN public.vertraege.signiert_ablage IS
  'Ablage des unterschriebenen Vertrags (dropbox_file_url/dropbox_file_path, Spaltennamen historisch).';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vertraege_datei_ablage_check') THEN
    ALTER TABLE public.vertraege ADD CONSTRAINT vertraege_datei_ablage_check CHECK (
      datei_ablage IN ('dropbox', 'sharepoint')
      AND (datei_ablage = 'dropbox' OR (datei_drive_id IS NOT NULL AND datei_item_id IS NOT NULL)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vertraege_signiert_ablage_check') THEN
    ALTER TABLE public.vertraege ADD CONSTRAINT vertraege_signiert_ablage_check CHECK (
      signiert_ablage IN ('dropbox', 'sharepoint')
      AND (signiert_ablage = 'dropbox' OR (signiert_drive_id IS NOT NULL AND signiert_item_id IS NOT NULL)));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_vertraege_datei_item
  ON public.vertraege (datei_drive_id, datei_item_id) WHERE datei_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_vertraege_signiert_item
  ON public.vertraege (signiert_drive_id, signiert_item_id) WHERE signiert_item_id IS NOT NULL;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rechnung_pdfs', 'rechnung_belege', 'auftrag_dokumente']
  LOOP
    EXECUTE format('ALTER TABLE public.%I
      ADD COLUMN IF NOT EXISTS ablage text NOT NULL DEFAULT ''dropbox'',
      ADD COLUMN IF NOT EXISTS drive_id text,
      ADD COLUMN IF NOT EXISTS item_id text,
      ADD COLUMN IF NOT EXISTS etag text,
      ADD COLUMN IF NOT EXISTS ctag text', t);
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_ablage_check') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (
        ablage IN (''dropbox'', ''sharepoint'')
        AND (ablage = ''dropbox'' OR (drive_id IS NOT NULL AND item_id IS NOT NULL)))', t, t || '_ablage_check');
    END IF;
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (drive_id, item_id) WHERE item_id IS NOT NULL',
      'ux_' || t || '_item', t);
  END LOOP;
END $$;

-- ─── Register: Dokument-Ordner und Bereiche ─────────────────

ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_art_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_art_check CHECK (art IN (
  'unternehmen', 'bereich', 'marke', 'kampagne', 'kooperation', 'typ', 'video', 'story',
  'schleife', 'finale', 'format', 'variante', 'dokument', 'frei', 'test', 'unzugeordnet'
));

ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_bereich_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_bereich_check
  CHECK (bereich IN ('medien', 'vertraege', 'rechnungen', 'auftraege'));

ALTER TABLE public.ablage_ordner
  ADD COLUMN IF NOT EXISTS ebene text,
  ADD COLUMN IF NOT EXISTS auftrag_id uuid REFERENCES public.auftrag(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rechnung_id uuid REFERENCES public.rechnung(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dok_schluessel text;
COMMENT ON COLUMN public.ablage_ordner.ebene IS
  'Nur art = dokument: marke, kampagne, contracting, auftrag, rechnung, belege, rechnungen (Unterordner eines Auftrags).';
COMMENT ON COLUMN public.ablage_ordner.dok_schluessel IS
  'Nur art = dokument: <bereich>:<unternehmen_id>:<ebene>:<bezug>, ein Ordner je Schlüssel und Drive.';

ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_ebene_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_ebene_check CHECK (
  ebene IN ('marke', 'kampagne', 'contracting', 'auftrag', 'rechnung', 'belege', 'rechnungen'));
ALTER TABLE public.ablage_ordner DROP CONSTRAINT IF EXISTS ablage_ordner_dokument_check;
ALTER TABLE public.ablage_ordner ADD CONSTRAINT ablage_ordner_dokument_check CHECK (
  art <> 'dokument' OR (dok_schluessel IS NOT NULL AND ebene IS NOT NULL AND bereich IN ('vertraege', 'rechnungen', 'auftraege')));

CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_dokument
  ON public.ablage_ordner (drive_id, dok_schluessel) WHERE art = 'dokument' AND geloescht_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_ordner_auftrag ON public.ablage_ordner (auftrag_id) WHERE auftrag_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_ordner_rechnung ON public.ablage_ordner (rechnung_id) WHERE rechnung_id IS NOT NULL;

ALTER TABLE public.ablage_upload DROP CONSTRAINT IF EXISTS ablage_upload_typ_check;
ALTER TABLE public.ablage_upload ADD CONSTRAINT ablage_upload_typ_check CHECK (typ IN (
  'video', 'story', 'still', 'roh',
  'vertrag', 'vertrag_unterschrieben', 'rechnung', 'beleg', 'auftragsdokument'
));

-- ─── Umzug: Dokumente aus Dropbox und Supabase-Storage ──────
-- rechnung_alt: rechnung.pdf_url ohne passende rechnung_pdfs-Zeile, wird nach dem Umzug eine.

ALTER TABLE public.ablage_umzug DROP CONSTRAINT IF EXISTS ablage_umzug_typ_check;
ALTER TABLE public.ablage_umzug ADD CONSTRAINT ablage_umzug_typ_check CHECK (typ IN (
  'video', 'story', 'still', 'roh',
  'vertrag', 'vertrag_unterschrieben', 'rechnung', 'beleg', 'auftragsdokument', 'rechnung_alt'
));
ALTER TABLE public.ablage_umzug DROP CONSTRAINT IF EXISTS ablage_umzug_quelle_check;
ALTER TABLE public.ablage_umzug ADD CONSTRAINT ablage_umzug_quelle_check
  CHECK (quelle IN ('dropbox', 'onedrive', 'storage'));
ALTER TABLE public.ablage_umzug ADD COLUMN IF NOT EXISTS quelle_bucket text;
COMMENT ON COLUMN public.ablage_umzug.quelle_bucket IS 'Nur quelle = storage: Supabase-Bucket, quelle_ref ist der Objektpfad.';

-- Medien-Läufer nimmt nur Medien (Dokumente laufen über ablage_dokument_umzug_holen)
CREATE OR REPLACE FUNCTION public.ablage_umzug_holen(p_drive_id text, p_sekunden integer DEFAULT 900)
RETURNS SETOF public.ablage_umzug
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ablage_umzug u
  SET gesperrt_bis = now() + make_interval(secs => p_sekunden)
  WHERE u.id = (
    SELECT x.id
    FROM ablage_umzug x
    JOIN unternehmen un ON un.id = x.unternehmen_id
    WHERE x.drive_id = p_drive_id AND x.status = 'offen' AND x.naechster_versuch <= now()
      AND (x.gesperrt_bis IS NULL OR x.gesperrt_bis < now())
      AND x.typ IN ('video', 'story', 'still', 'roh')
      AND un.ablage_ziel = 'sharepoint'
    ORDER BY x.naechster_versuch, x.id
    LIMIT 1
    FOR UPDATE OF x SKIP LOCKED
  )
  RETURNING u.*
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_umzug_holen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_umzug_holen(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.ablage_dokument_umzug_holen(p_drive_id text, p_sekunden integer DEFAULT 900)
RETURNS SETOF public.ablage_umzug
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ablage_umzug u
  SET gesperrt_bis = now() + make_interval(secs => p_sekunden)
  WHERE u.id = (
    SELECT x.id
    FROM ablage_umzug x
    JOIN unternehmen un ON un.id = x.unternehmen_id
    WHERE x.drive_id = p_drive_id AND x.status = 'offen' AND x.naechster_versuch <= now()
      AND (x.gesperrt_bis IS NULL OR x.gesperrt_bis < now())
      AND x.typ NOT IN ('video', 'story', 'still', 'roh')
      AND un.dokument_ablage_ziel = 'sharepoint'
    ORDER BY x.naechster_versuch, x.id
    LIMIT 1
    FOR UPDATE OF x SKIP LOCKED
  )
  RETURNING u.*
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_dokument_umzug_holen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_dokument_umzug_holen(text, integer) TO service_role;

-- Dokumente eines Unternehmens einreihen. Erneuter Aufruf öffnet fehlgeschlagene Zeilen wieder.
CREATE OR REPLACE FUNCTION public.ablage_dokument_umzug_anlegen(p_drive_id text, p_unternehmen_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  WITH v AS (
    SELECT x.* FROM vertraege x
    LEFT JOIN kampagne ka ON ka.id = x.kampagne_id
    LEFT JOIN auftrag au ON au.id = x.contracting_auftrag_id
    WHERE coalesce(x.kunde_unternehmen_id, ka.unternehmen_id, au.unternehmen_id) = p_unternehmen_id
  ),
  a AS (
    SELECT 'vertrag'::text AS typ, v.id, v.datei_path AS pfad, v.datei_url AS url, 'vertraege'::text AS bucket
      FROM v WHERE v.datei_url IS NOT NULL AND v.datei_ablage = 'dropbox'
    UNION ALL
    SELECT 'vertrag_unterschrieben', v.id,
      CASE WHEN v.dropbox_file_url IS NOT NULL THEN v.dropbox_file_path ELSE v.unterschriebener_vertrag_path END,
      coalesce(v.dropbox_file_url, v.unterschriebener_vertrag_url), 'unterschriebene-vertraege'
      FROM v WHERE coalesce(v.dropbox_file_url, v.unterschriebener_vertrag_url) IS NOT NULL AND v.signiert_ablage = 'dropbox'
    UNION ALL
    SELECT 'rechnung', p.id, p.file_path, p.file_url, 'rechnungen'
      FROM rechnung_pdfs p JOIN rechnung r ON r.id = p.rechnung_id
      WHERE r.unternehmen_id = p_unternehmen_id AND p.ablage = 'dropbox'
    UNION ALL
    SELECT 'beleg', b.id, b.file_path, b.file_url, 'rechnung-belege'
      FROM rechnung_belege b JOIN rechnung r ON r.id = b.rechnung_id
      WHERE r.unternehmen_id = p_unternehmen_id AND b.ablage = 'dropbox'
    UNION ALL
    SELECT 'auftragsdokument', d.id, d.dropbox_file_path, d.dropbox_file_url, 'auftragsbestaetigung'
      FROM auftrag_dokumente d JOIN auftrag au ON au.id = d.auftrag_id
      WHERE au.unternehmen_id = p_unternehmen_id AND d.ablage = 'dropbox'
    UNION ALL
    SELECT 'rechnung_alt', r.id, r.pdf_path, r.pdf_url, 'rechnungen'
      FROM rechnung r
      WHERE r.unternehmen_id = p_unternehmen_id AND r.pdf_url IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM rechnung_pdfs p WHERE p.rechnung_id = r.id
                        AND (p.file_url = r.pdf_url OR p.file_path = r.pdf_path))
  ),
  q AS (
    SELECT a.typ, a.id,
      CASE WHEN a.pfad LIKE '/%' THEN 'dropbox'
           WHEN a.url ~ '/storage/v1/object/' OR (a.pfad IS NOT NULL AND a.pfad <> '') THEN 'storage'
      END AS quelle,
      coalesce(substring(a.url FROM '/storage/v1/object/(?:public|sign|authenticated)/([^/]+)/'), a.bucket) AS bucket,
      coalesce(nullif(a.pfad, ''), a.url) AS ref
    FROM a
  )
  INSERT INTO ablage_umzug (drive_id, unternehmen_id, typ, asset_id, quelle, quelle_ref, quelle_bucket, status, grund)
  SELECT p_drive_id, p_unternehmen_id, q.typ, q.id, coalesce(q.quelle, 'storage'), coalesce(q.ref, ''),
    CASE WHEN q.quelle = 'storage' THEN q.bucket END,
    CASE WHEN q.quelle IS NOT NULL AND q.ref IS NOT NULL THEN 'offen' ELSE 'uebersprungen' END,
    CASE WHEN q.quelle IS NOT NULL AND q.ref IS NOT NULL THEN NULL ELSE 'ohne_quelle' END
  FROM q
  ON CONFLICT (typ, asset_id) DO UPDATE
    SET status = 'offen', grund = NULL, versuche = 0, naechster_versuch = now(), gesperrt_bis = NULL
    WHERE ablage_umzug.status = 'fehler';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE EXECUTE ON FUNCTION public.ablage_dokument_umzug_anlegen(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_dokument_umzug_anlegen(text, uuid) TO service_role;

-- Medien-Stand zählt nur Medien-Zeilen des Umzugs
CREATE OR REPLACE FUNCTION public.ablage_unternehmen_stand(p_drive_id text)
RETURNS TABLE (
  id uuid, firmenname text, ablage_ziel text, ist_test boolean,
  dateien_sharepoint bigint, dateien_dropbox bigint,
  umzug_offen bigint, umzug_fertig bigint, umzug_fehler bigint, umzug_uebersprungen bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH a AS (
    SELECT kv.kooperation_id, x.ablage FROM kooperation_video_asset x
      JOIN kooperation_videos kv ON kv.id = x.video_id WHERE x.source_asset_id IS NULL
    UNION ALL
    SELECT kv.kooperation_id, x.ablage FROM kooperation_story_asset x
      JOIN kooperation_videos kv ON kv.id = x.video_id WHERE x.source_asset_id IS NULL
    UNION ALL
    SELECT x.kooperation_id, x.ablage FROM kooperation_bilder_asset x WHERE x.source_asset_id IS NULL
    UNION ALL
    SELECT x.kooperation_id, x.ablage FROM kooperation_rohmaterial_asset x
  ),
  d AS (
    SELECT ka.unternehmen_id,
      count(*) FILTER (WHERE a.ablage = 'sharepoint') AS sp,
      count(*) FILTER (WHERE a.ablage IS DISTINCT FROM 'sharepoint') AS dbx
    FROM a
    JOIN kooperationen k ON k.id = a.kooperation_id
    JOIN kampagne ka ON ka.id = k.kampagne_id
    GROUP BY ka.unternehmen_id
  ),
  m AS (
    SELECT z.unternehmen_id,
      count(*) FILTER (WHERE z.status = 'offen') AS offen,
      count(*) FILTER (WHERE z.status = 'fertig') AS fertig,
      count(*) FILTER (WHERE z.status = 'fehler') AS fehler,
      count(*) FILTER (WHERE z.status = 'uebersprungen') AS uebersprungen
    FROM ablage_umzug z
    WHERE z.drive_id = p_drive_id AND z.typ IN ('video', 'story', 'still', 'roh')
    GROUP BY z.unternehmen_id
  )
  SELECT u.id, u.firmenname, coalesce(u.ablage_ziel, 'dropbox'), coalesce(u.ist_test, false),
    coalesce(d.sp, 0), coalesce(d.dbx, 0),
    coalesce(m.offen, 0), coalesce(m.fertig, 0), coalesce(m.fehler, 0), coalesce(m.uebersprungen, 0)
  FROM unternehmen u
  LEFT JOIN d ON d.unternehmen_id = u.id
  LEFT JOIN m ON m.unternehmen_id = u.id
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_unternehmen_stand(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_unternehmen_stand(text) TO service_role;

-- Admin-Seite: Weiche, Dokumente je Ablage und Umzugsfortschritt je Unternehmen
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
    SELECT x.*, coalesce(x.kunde_unternehmen_id, ka.unternehmen_id, au.unternehmen_id) AS uid
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

-- ─── Pfade und webUrls nachziehen ───────────────────────────
-- Je Dateispalte: (Tabelle, Pfad-Spalte, URL-Spalte, Ablage-Spalte, Drive-Spalte)

CREATE OR REPLACE FUNCTION public.ablage_pfad_umschreiben(p_drive_id text, p_alt text, p_neu text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  c integer;
  t text;
  s text[];
BEGIN
  IF p_alt IS NULL OR p_neu IS NULL OR p_alt = '' OR p_alt = p_neu THEN
    RETURN 0;
  END IF;
  UPDATE ablage_ordner
     SET pfad = p_neu || substr(pfad, length(p_alt) + 1), updated_at = now()
   WHERE drive_id = p_drive_id AND left(pfad, length(p_alt) + 1) = p_alt || '/';
  GET DIAGNOSTICS c = ROW_COUNT;
  n := n + c;
  UPDATE ablage_eingang
     SET pfad = p_neu || substr(pfad, length(p_alt) + 1)
   WHERE drive_id = p_drive_id AND left(pfad, length(p_alt) + 1) = p_alt || '/';
  FOREACH t IN ARRAY ARRAY['kooperation_video_asset', 'kooperation_story_asset',
                           'kooperation_bilder_asset', 'kooperation_rohmaterial_asset']
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET file_path = $2 || substr(file_path, length($1) + 1)
        WHERE ablage = ''sharepoint'' AND drive_id = $3 AND left(file_path, length($1) + 1) = $1 || ''/''', t)
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  FOREACH s SLICE 1 IN ARRAY ARRAY[
    ['vertraege', 'datei_path', 'datei_ablage', 'datei_drive_id'],
    ['vertraege', 'dropbox_file_path', 'signiert_ablage', 'signiert_drive_id'],
    ['rechnung_pdfs', 'file_path', 'ablage', 'drive_id'],
    ['rechnung_belege', 'file_path', 'ablage', 'drive_id'],
    ['auftrag_dokumente', 'dropbox_file_path', 'ablage', 'drive_id']
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = $2 || substr(%2$I, length($1) + 1)
        WHERE %3$I = ''sharepoint'' AND %4$I = $3 AND left(%2$I, length($1) + 1) = $1 || ''/''', s[1], s[2], s[3], s[4])
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_pfad_umschreiben(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_pfad_umschreiben(text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.ablage_url_umschreiben(p_drive_id text, p_alt text, p_neu text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer := 0;
  c integer;
  t text;
  paar text[];
  s text[];
BEGIN
  IF p_alt IS NULL OR p_neu IS NULL OR p_alt = '' OR p_alt = p_neu THEN
    RETURN 0;
  END IF;
  FOREACH t IN ARRAY ARRAY['kooperation_video_asset', 'kooperation_story_asset',
                           'kooperation_bilder_asset', 'kooperation_rohmaterial_asset']
  LOOP
    EXECUTE format(
      'UPDATE public.%I SET file_url = $2 || substr(file_url, length($1) + 1)
        WHERE ablage = ''sharepoint'' AND drive_id = $3
          AND (file_url = $1 OR left(file_url, length($1) + 1) = $1 || ''/'')', t)
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  -- Ordner-Links tragen keine drive_id; der Präfix (Host + Site + Bibliothek) ist eindeutig
  FOREACH paar SLICE 1 IN ARRAY ARRAY[
    ['kooperation_rohmaterial_asset', 'folder_url'],
    ['kooperation_videos', 'folder_url'],
    ['kooperation_videos', 'story_folder_url'],
    ['kooperationen', 'bilder_folder_url']
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = $2 || substr(%2$I, length($1) + 1)
        WHERE %2$I = $1 OR left(%2$I, length($1) + 1) = $1 || ''/''', paar[1], paar[2])
      USING p_alt, p_neu;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  FOREACH s SLICE 1 IN ARRAY ARRAY[
    ['vertraege', 'datei_url', 'datei_ablage', 'datei_drive_id'],
    ['vertraege', 'dropbox_file_url', 'signiert_ablage', 'signiert_drive_id'],
    ['rechnung_pdfs', 'file_url', 'ablage', 'drive_id'],
    ['rechnung_belege', 'file_url', 'ablage', 'drive_id'],
    ['auftrag_dokumente', 'dropbox_file_url', 'ablage', 'drive_id']
  ]
  LOOP
    EXECUTE format(
      'UPDATE public.%1$I SET %2$I = $2 || substr(%2$I, length($1) + 1)
        WHERE %3$I = ''sharepoint'' AND %4$I = $3
          AND (%2$I = $1 OR left(%2$I, length($1) + 1) = $1 || ''/'')', s[1], s[2], s[3], s[4])
      USING p_alt, p_neu, p_drive_id;
    GET DIAGNOSTICS c = ROW_COUNT;
    n := n + c;
  END LOOP;
  RETURN n;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_url_umschreiben(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_url_umschreiben(text, text, text) TO service_role;

-- ─── RLS: Verträge nur für Team, Investoren und das eigene Unternehmen ─

DROP POLICY IF EXISTS vertraege_select ON public.vertraege;
CREATE POLICY vertraege_select ON public.vertraege
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin_or_mitarbeiter())
    OR (SELECT public.is_investor())
    OR kunde_unternehmen_id = ANY ((SELECT private.rls_my_unternehmen_ids())::uuid[])
  );

COMMIT;
