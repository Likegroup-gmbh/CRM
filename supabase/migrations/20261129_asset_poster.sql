-- Poster: Standbild je Datei fuer Showcase und Ordner im Videos-Tab (ADR 0064).
-- Das Original in Dropbox bleibt System of Record; das Poster ist abgeleitete Daten,
-- jederzeit wegwerfbar und neu erzeugbar.
--
-- Identitaet = Pfad + Revision, nicht die Asset-Zeile (wie ADR 0061):
--   - Promote legt eine neue Zeile mit demselben file_path an und teilt sich das Poster
--     der Quelle (source_asset_id).
--   - Replace ueberschreibt denselben Pfad und setzt created_at neu: neue Revision,
--     neues Poster, das alte wird nicht mehr ausgeliefert und spaeter geraeumt.
--
-- Entstehung ueber Abgleich statt Outbox: poster_soll ist der Soll-Zustand (jede Datei mit
-- Bild- oder Videoendung), asset_poster der Ist-Zustand. poster-abgleich (Scheduled) und
-- poster-urls (Read-Repair) stossen poster-erzeugen-background an, das per
-- poster_auftraege_holen claimt. Kein Trigger, kein Schreibpfad im Client.
--
-- Nur service_role liest und schreibt. Clients bekommen Poster ausschliesslich ueber
-- poster-urls (RLS-Pruefung mit dem JWT des Aufrufers, kurze Signed URLs).
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.poster_stand();
--   DROP FUNCTION IF EXISTS public.poster_verwaiste_entfernen(integer);
--   DROP FUNCTION IF EXISTS public.poster_auftraege_holen(integer, integer, integer);
--   DROP VIEW IF EXISTS public.asset_poster_je_asset;
--   DROP VIEW IF EXISTS public.poster_soll;
--   DROP TABLE IF EXISTS public.asset_poster;
--   DROP FUNCTION IF EXISTS public.poster_revision(timestamptz);
--   DROP FUNCTION IF EXISTS public.poster_art(text);
--   DELETE FROM storage.objects WHERE bucket_id = 'video-posters';
--   DELETE FROM storage.buckets WHERE id = 'video-posters';

BEGIN;

-- ─── Schluessel ─────────────────────────────────────────────

-- Art einer Datei nach Endung. Ohne Pfad (Legacy file_url) oder andere Endung: kein Poster.
CREATE OR REPLACE FUNCTION public.poster_art(p_file_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_file_path ~* '^/.+\.(mp4|mov|m4v|avi|mkv|webm|mxf|3gp|mts|m2ts|wmv)$' THEN 'video'
    WHEN p_file_path ~* '^/.+\.(jpe?g|png|heic|heif|webp|gif|tiff?|bmp)$' THEN 'bild'
  END
$$;

-- Revision als Text, unabhaengig von der TimeZone der Session.
CREATE OR REPLACE FUNCTION public.poster_revision(p_created_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

-- ─── Ist-Zustand ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.asset_poster (
  file_path text NOT NULL,
  revision text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  storage_path text,
  breite integer,
  hoehe integer,
  bytes integer,
  -- Fencing-Token: der Abschluss schreibt nur mit dem versuche-Stand seines Claims
  versuche integer NOT NULL DEFAULT 0,
  naechster_versuch timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis timestamptz,
  fehler text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (file_path, revision)
);

CREATE INDEX IF NOT EXISTS idx_asset_poster_pending
  ON public.asset_poster (naechster_versuch)
  WHERE status = 'pending';

-- ─── Soll-Zustand ───────────────────────────────────────────

-- Je Asset-Zeile mit Bild- oder Videodatei ein Schluessel. typ entspricht den Item-Typen
-- im Videos-Tab (video, story, still, roh).
CREATE OR REPLACE VIEW public.poster_soll
WITH (security_invoker = true) AS
SELECT 'video'::text AS typ, a.id AS asset_id, a.file_path, public.poster_art(a.file_path) AS art,
       public.poster_revision(coalesce(s.created_at, a.created_at)) AS revision
FROM public.kooperation_video_asset a
LEFT JOIN public.kooperation_video_asset s ON s.id = a.source_asset_id
WHERE public.poster_art(a.file_path) IS NOT NULL
UNION ALL
SELECT 'story'::text, a.id, a.file_path, public.poster_art(a.file_path),
       public.poster_revision(coalesce(s.created_at, a.created_at))
FROM public.kooperation_story_asset a
LEFT JOIN public.kooperation_story_asset s ON s.id = a.source_asset_id
WHERE public.poster_art(a.file_path) IS NOT NULL
UNION ALL
SELECT 'still'::text, a.id, a.file_path, public.poster_art(a.file_path),
       public.poster_revision(coalesce(s.created_at, a.created_at))
FROM public.kooperation_bilder_asset a
LEFT JOIN public.kooperation_bilder_asset s ON s.id = a.source_asset_id
WHERE public.poster_art(a.file_path) IS NOT NULL
UNION ALL
SELECT 'roh'::text, a.id, a.file_path, public.poster_art(a.file_path),
       public.poster_revision(a.created_at)
FROM public.kooperation_rohmaterial_asset a
WHERE public.poster_art(a.file_path) IS NOT NULL;

-- Lesepfad von poster-urls: je Asset der Schluessel und, falls vorhanden, das Poster.
CREATE OR REPLACE VIEW public.asset_poster_je_asset
WITH (security_invoker = true) AS
SELECT s.typ, s.asset_id, s.file_path, s.art, s.revision,
       p.status, p.storage_path, p.breite, p.hoehe
FROM public.poster_soll s
LEFT JOIN public.asset_poster p ON p.file_path = s.file_path AND p.revision = s.revision;

-- ─── RPCs fuer den Erzeuger (nur service_role) ──────────────

-- Faellige Schluessel claimen: fehlend im Ist-Zustand oder pending mit abgelaufener Lease.
-- Read-Repair zuerst (von poster-urls angelegte Zeilen), danach der Bestand.
-- Hoechstens p_max_in_arbeit gleichzeitig unter Lease, damit parallele Laeufe Dropbox
-- nicht fluten. versuche zaehlt hoch und ist das Fencing-Token fuer den Abschluss.
CREATE OR REPLACE FUNCTION public.poster_auftraege_holen(
  p_limit integer DEFAULT 25,
  p_lease_sec integer DEFAULT 300,
  p_max_in_arbeit integer DEFAULT 75
)
RETURNS TABLE (file_path text, revision text, art text, versuche integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_frei integer;
BEGIN
  -- Parallele Aufrufer serialisieren, sonst sehen beide dieselben freien Plaetze.
  PERFORM pg_advisory_xact_lock(hashtext('poster_auftraege_holen'));
  SELECT p_max_in_arbeit - count(*) INTO v_frei
  FROM public.asset_poster
  WHERE status = 'pending' AND gesperrt_bis > now();
  IF v_frei <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH soll AS (
    SELECT DISTINCT ON (s.file_path, s.revision) s.file_path, s.revision, s.art
    FROM public.poster_soll s
  ),
  kandidaten AS (
    SELECT soll.file_path, soll.revision
    FROM soll
    LEFT JOIN public.asset_poster p ON p.file_path = soll.file_path AND p.revision = soll.revision
    WHERE p.file_path IS NULL
       OR (p.status = 'pending' AND p.naechster_versuch <= now()
           AND (p.gesperrt_bis IS NULL OR p.gesperrt_bis <= now()))
    ORDER BY (p.file_path IS NULL), p.naechster_versuch
    LIMIT least(p_limit, v_frei)
  ),
  geholt AS (
    INSERT INTO public.asset_poster AS ap (file_path, revision, status, versuche, gesperrt_bis)
    SELECT k.file_path, k.revision, 'pending', 1, now() + make_interval(secs => p_lease_sec)
    FROM kandidaten k
    ON CONFLICT ON CONSTRAINT asset_poster_pkey DO UPDATE
      SET versuche = ap.versuche + 1,
          gesperrt_bis = EXCLUDED.gesperrt_bis,
          updated_at = now()
      WHERE ap.status = 'pending' AND ap.naechster_versuch <= now()
        AND (ap.gesperrt_bis IS NULL OR ap.gesperrt_bis <= now())
    RETURNING ap.file_path, ap.revision, ap.versuche
  )
  SELECT g.file_path, g.revision, soll.art, g.versuche
  FROM geholt g
  JOIN soll ON soll.file_path = g.file_path AND soll.revision = g.revision;
END;
$$;

-- Poster, auf deren Schluessel keine Asset-Zeile mehr zeigt (Loeschen, Replace, Umbenennen):
-- Zeilen entfernen und die Storage-Pfade zurueckgeben, die der Aufrufer im Bucket loescht.
-- Eine Stunde Schonfrist, damit ein Replace mitten im Schreiben nichts verliert.
CREATE OR REPLACE FUNCTION public.poster_verwaiste_entfernen(p_limit integer DEFAULT 200)
RETURNS TABLE (storage_path text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH weg AS (
    SELECT p.file_path, p.revision
    FROM public.asset_poster p
    WHERE p.updated_at < now() - interval '1 hour'
      AND NOT EXISTS (
        SELECT 1 FROM public.poster_soll s
        WHERE s.file_path = p.file_path AND s.revision = p.revision
      )
    LIMIT p_limit
  )
  DELETE FROM public.asset_poster p
  USING weg
  WHERE p.file_path = weg.file_path AND p.revision = weg.revision
  RETURNING p.storage_path
$$;

-- Zaehler fuer Betrieb und Abgleich. offen = Schluessel ohne ready/failed.
CREATE OR REPLACE FUNCTION public.poster_stand()
RETURNS TABLE (soll integer, ready integer, failed integer, offen integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH soll AS (
    SELECT DISTINCT s.file_path, s.revision FROM public.poster_soll s
  )
  SELECT count(*)::integer,
         count(*) FILTER (WHERE p.status = 'ready')::integer,
         count(*) FILTER (WHERE p.status = 'failed')::integer,
         count(*) FILTER (WHERE p.status IS NULL OR p.status = 'pending')::integer
  FROM soll
  LEFT JOIN public.asset_poster p ON p.file_path = soll.file_path AND p.revision = soll.revision
$$;

-- ─── Rechte ─────────────────────────────────────────────────

ALTER TABLE public.asset_poster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.asset_poster FROM anon, authenticated;
REVOKE ALL ON public.poster_soll FROM anon, authenticated;
REVOKE ALL ON public.asset_poster_je_asset FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_poster TO service_role;
GRANT SELECT ON public.poster_soll, public.asset_poster_je_asset TO service_role;

REVOKE EXECUTE ON FUNCTION public.poster_auftraege_holen(integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.poster_verwaiste_entfernen(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.poster_stand() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.poster_auftraege_holen(integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.poster_verwaiste_entfernen(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.poster_stand() TO service_role;

-- ─── Storage ────────────────────────────────────────────────

-- Privat und ohne Policies: nur service_role schreibt, Clients lesen ueber Signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('video-posters', 'video-posters', false, 524288, ARRAY['image/webp', 'image/jpeg'])
ON CONFLICT (id) DO NOTHING;

COMMIT;
