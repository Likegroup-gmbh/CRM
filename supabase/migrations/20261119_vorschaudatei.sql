-- Vorschaudatei: streamingfreundliche Kopie eines Kooperationsvideos fuer die Sichtung
-- im Videos-Tab (ADR 0061). Das Original in Dropbox bleibt System of Record und
-- Download; die Vorschaudatei ist abgeleitete Daten, jederzeit wegwerfbar.
--
-- Identitaet = Quelle + Pfad + Revision, nicht die Asset-Zeile:
--   - Promote (Finale Version) legt eine neue Zeile mit demselben file_path an und
--     teilt sich die Vorschaudatei der Quelle (source_asset_id).
--   - Replace ueberschreibt denselben Pfad (mode: overwrite) und setzt created_at neu:
--     neue Revision, neue Vorschaudatei, die alte wird nie mehr ausgeliefert.
--   Revision = created_at der Quelle (bei Promote die der source_asset_id-Zeile, live
--   berechnet: ein Replace der Quelle gilt auch fuer ihre Finalen Versionen).
--
-- Entstehung ueber eine Outbox: ein Trigger schreibt den Auftrag in derselben
-- Transaktion wie die Asset-Zeile. Kein Schreibpfad im Client muss etwas aufrufen.
-- Abgearbeitet von vorschau-verarbeiten (Database Webhook + Sweeper), at-least-once;
-- `versuche` dient als Fencing-Token beim Abschliessen.
--
-- Lesepfad: View kooperation_video_vorschau_je_asset (security_invoker) liefert nur
-- Vorschaudateien, deren Revision zur aktuellen Asset-Zeile passt.
--
-- Rollout-Schalter: app_schalter.vorschau_wiedergabe { team, kunde }.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_kooperation_video_asset_vorschau ON public.kooperation_video_asset;
--   DROP VIEW IF EXISTS public.kooperation_video_vorschau_je_asset;
--   DROP FUNCTION IF EXISTS public.kooperation_video_vorschau_auftrag_anlegen();
--   DROP FUNCTION IF EXISTS public.vorschau_auftraege_holen(integer, integer, text[]);
--   DROP FUNCTION IF EXISTS public.vorschau_referenzen(text, text, text);
--   DROP FUNCTION IF EXISTS public.vorschau_quelle_revision(timestamptz, uuid);
--   DROP FUNCTION IF EXISTS public.vorschau_revision(timestamptz);
--   DROP FUNCTION IF EXISTS public.vorschau_quelle(text);
--   DROP TABLE IF EXISTS public.kooperation_video_vorschau_auftrag;
--   DROP TABLE IF EXISTS public.kooperation_video_vorschau;
--   DROP INDEX IF EXISTS public.idx_kooperation_video_asset_file_path;
--   DELETE FROM public.app_schalter WHERE schluessel = 'vorschau_wiedergabe';

BEGIN;

-- ─── Schluessel-Funktionen ──────────────────────────────────

-- Quelle eines file_path. Nur Videodateien; ohne Pfad (Legacy file_url) keine Vorschau.
CREATE OR REPLACE FUNCTION public.vorschau_quelle(p_file_path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_file_path ~* '^/.+\.(mp4|mov|m4v|avi|mkv|webm|mxf|3gp|hevc)$' THEN 'dropbox'
  END
$$;

-- Revision als Text, unabhaengig von der TimeZone der Session.
CREATE OR REPLACE FUNCTION public.vorschau_revision(p_created_at timestamptz)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_char(p_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

CREATE OR REPLACE FUNCTION public.vorschau_quelle_revision(p_created_at timestamptz, p_source_asset_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.vorschau_revision(coalesce(
    (SELECT s.created_at FROM public.kooperation_video_asset s WHERE s.id = p_source_asset_id),
    p_created_at))
$$;

-- ─── Abgeleitete Daten ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kooperation_video_vorschau (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quelle text NOT NULL CHECK (quelle IN ('dropbox', 'sharepoint')),
  quelle_pfad text NOT NULL,
  quelle_revision text NOT NULL,
  anbieter text NOT NULL DEFAULT 'cloudflare_stream',
  -- uid beim Anbieter; null, solange der Upload noch nicht angestossen ist
  anbieter_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  dauer numeric(10, 3),
  fps numeric(7, 3),
  breite integer,
  hoehe integer,
  fehler text,
  versuche integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quelle, quelle_pfad, quelle_revision)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kooperation_video_vorschau_anbieter
  ON public.kooperation_video_vorschau(anbieter, anbieter_id)
  WHERE anbieter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kooperation_video_vorschau_pending
  ON public.kooperation_video_vorschau(updated_at)
  WHERE status = 'pending';

-- Join der View und Referenzpruefung beim Loeschen laufen ueber den Pfad.
CREATE INDEX IF NOT EXISTS idx_kooperation_video_asset_file_path
  ON public.kooperation_video_asset(file_path);

-- ─── Outbox ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.kooperation_video_vorschau_auftrag (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  art text NOT NULL CHECK (art IN ('erzeugen', 'loeschen')),
  quelle text NOT NULL,
  quelle_pfad text NOT NULL,
  quelle_revision text NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'in_arbeit', 'erledigt', 'failed')),
  versuche integer NOT NULL DEFAULT 0,
  naechster_versuch timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis timestamptz,
  fehler text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ein offener Auftrag je Schluessel und Art: doppelte Trigger erzeugen keine Doppelarbeit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_vorschau_auftrag_offen_je_schluessel
  ON public.kooperation_video_vorschau_auftrag(art, quelle, quelle_pfad, quelle_revision)
  WHERE status IN ('offen', 'in_arbeit');

CREATE INDEX IF NOT EXISTS idx_vorschau_auftrag_faellig
  ON public.kooperation_video_vorschau_auftrag(naechster_versuch)
  WHERE status IN ('offen', 'in_arbeit');

-- ─── Trigger auf den Asset-Zeilen ───────────────────────────

CREATE OR REPLACE FUNCTION public.kooperation_video_vorschau_auftrag_anlegen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quelle text;
  v_rev text;
BEGIN
  -- Alter Schluessel faellt weg (Delete, Replace, Pfadwechsel): Tombstone.
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (
       OLD.file_path IS DISTINCT FROM NEW.file_path OR OLD.created_at IS DISTINCT FROM NEW.created_at)) THEN
    v_quelle := public.vorschau_quelle(OLD.file_path);
    IF v_quelle IS NOT NULL THEN
      INSERT INTO public.kooperation_video_vorschau_auftrag (art, quelle, quelle_pfad, quelle_revision)
      VALUES ('loeschen', v_quelle, OLD.file_path,
              public.vorschau_quelle_revision(OLD.created_at, OLD.source_asset_id))
      ON CONFLICT (art, quelle, quelle_pfad, quelle_revision) WHERE status IN ('offen', 'in_arbeit')
      DO NOTHING;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (
       OLD.file_path IS DISTINCT FROM NEW.file_path OR OLD.created_at IS DISTINCT FROM NEW.created_at)) THEN
    v_quelle := public.vorschau_quelle(NEW.file_path);
    IF v_quelle IS NOT NULL THEN
      v_rev := public.vorschau_quelle_revision(NEW.created_at, NEW.source_asset_id);
      -- Promote: der Schluessel hat schon eine Vorschaudatei (auch failed: Reprocessing
      -- laeuft bewusst ueber einen neuen Auftrag, nicht nebenbei).
      IF NOT EXISTS (
        SELECT 1 FROM public.kooperation_video_vorschau v
        WHERE v.quelle = v_quelle AND v.quelle_pfad = NEW.file_path AND v.quelle_revision = v_rev
      ) THEN
        INSERT INTO public.kooperation_video_vorschau_auftrag (art, quelle, quelle_pfad, quelle_revision)
        VALUES ('erzeugen', v_quelle, NEW.file_path, v_rev)
        ON CONFLICT (art, quelle, quelle_pfad, quelle_revision) WHERE status IN ('offen', 'in_arbeit')
        DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_kooperation_video_asset_vorschau ON public.kooperation_video_asset;
CREATE TRIGGER trg_kooperation_video_asset_vorschau
  AFTER INSERT OR UPDATE OF file_path, created_at OR DELETE ON public.kooperation_video_asset
  FOR EACH ROW EXECUTE FUNCTION public.kooperation_video_vorschau_auftrag_anlegen();

-- ─── RPCs fuer den Konsumenten (nur service_role) ───────────

-- Faellige Auftraege claimen. Drosselung: hoechstens p_max_parallel gleichzeitig in
-- Arbeit (Creator laedt fuenf Videos auf einmal, Cloudflare hat Rate Limits).
-- p_arten: ohne 'erzeugen', solange beim Anbieter zu viele Videos in Arbeit sind.
-- Abgelaufene Leases werden neu vergeben; `versuche` zaehlt hoch und ist das
-- Fencing-Token fuer den Abschluss.
CREATE OR REPLACE FUNCTION public.vorschau_auftraege_holen(
  p_max_parallel integer DEFAULT 3,
  p_lease_sec integer DEFAULT 300,
  p_arten text[] DEFAULT ARRAY['erzeugen', 'loeschen']
)
RETURNS SETOF public.kooperation_video_vorschau_auftrag
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frei integer;
BEGIN
  -- Parallele Aufrufer serialisieren, sonst sehen beide dieselben freien Plaetze.
  PERFORM pg_advisory_xact_lock(hashtext('vorschau_auftraege_holen'));
  SELECT p_max_parallel - count(*) INTO v_frei
  FROM public.kooperation_video_vorschau_auftrag
  WHERE status = 'in_arbeit' AND gesperrt_bis > now();
  IF v_frei <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.kooperation_video_vorschau_auftrag t
  SET status = 'in_arbeit',
      versuche = t.versuche + 1,
      gesperrt_bis = now() + make_interval(secs => p_lease_sec),
      updated_at = now()
  WHERE t.id IN (
    SELECT a.id FROM public.kooperation_video_vorschau_auftrag a
    WHERE a.art = ANY (p_arten)
      AND ((a.status = 'offen' AND a.naechster_versuch <= now())
        OR (a.status = 'in_arbeit' AND a.gesperrt_bis <= now()))
    ORDER BY a.naechster_versuch, a.id
    LIMIT v_frei
    FOR UPDATE SKIP LOCKED
  )
  RETURNING t.*;
END;
$$;

-- Wie viele Asset-Zeilen zeigen (mit live berechneter Revision) auf diesen Schluessel?
CREATE OR REPLACE FUNCTION public.vorschau_referenzen(p_quelle text, p_pfad text, p_revision text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.kooperation_video_asset a
  LEFT JOIN public.kooperation_video_asset s ON s.id = a.source_asset_id
  WHERE a.file_path = p_pfad
    AND public.vorschau_quelle(a.file_path) = p_quelle
    AND public.vorschau_revision(coalesce(s.created_at, a.created_at)) = p_revision
$$;

REVOKE EXECUTE ON FUNCTION public.vorschau_auftraege_holen(integer, integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vorschau_referenzen(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.vorschau_quelle_revision(timestamptz, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.kooperation_video_vorschau_auftrag_anlegen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vorschau_auftraege_holen(integer, integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.vorschau_referenzen(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vorschau_quelle_revision(timestamptz, uuid) TO service_role;

-- ─── Rechte ─────────────────────────────────────────────────

ALTER TABLE public.kooperation_video_vorschau ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kooperation_video_vorschau_auftrag ENABLE ROW LEVEL SECURITY;

-- Outbox: nur service_role (keine Policies).
REVOKE ALL ON public.kooperation_video_vorschau_auftrag FROM anon, authenticated;

-- Vorschau: lesen nur, wer eine Asset-Zeile auf diesen Pfad sieht (Pfade verraten
-- Unternehmen und Kampagne). Die uid beim Anbieter bleibt serverseitig.
REVOKE ALL ON public.kooperation_video_vorschau FROM anon, authenticated;
GRANT SELECT (id, quelle, quelle_pfad, quelle_revision, status, dauer, fps, breite, hoehe)
  ON public.kooperation_video_vorschau TO authenticated;

DROP POLICY IF EXISTS kooperation_video_vorschau_select ON public.kooperation_video_vorschau;
CREATE POLICY kooperation_video_vorschau_select ON public.kooperation_video_vorschau
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kooperation_video_asset a WHERE a.file_path = kooperation_video_vorschau.quelle_pfad
  ));

-- ─── Lesepfad ───────────────────────────────────────────────

-- Je Asset die Vorschaudatei mit passender Revision. Kein Treffer = Original streamen.
CREATE OR REPLACE VIEW public.kooperation_video_vorschau_je_asset
WITH (security_invoker = true) AS
SELECT
  a.id AS asset_id,
  v.id AS vorschau_id,
  v.status,
  v.dauer,
  v.fps
FROM public.kooperation_video_asset a
LEFT JOIN public.kooperation_video_asset s ON s.id = a.source_asset_id
JOIN public.kooperation_video_vorschau v
  ON v.quelle = public.vorschau_quelle(a.file_path)
 AND v.quelle_pfad = a.file_path
 AND v.quelle_revision = public.vorschau_revision(coalesce(s.created_at, a.created_at));

REVOKE ALL ON public.kooperation_video_vorschau_je_asset FROM anon;
GRANT SELECT ON public.kooperation_video_vorschau_je_asset TO authenticated;

-- ─── Rollout-Schalter ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_schalter (
  schluessel text PRIMARY KEY,
  wert jsonb NOT NULL,
  beschreibung text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_schalter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_schalter FROM anon;

DROP POLICY IF EXISTS app_schalter_select ON public.app_schalter;
CREATE POLICY app_schalter_select ON public.app_schalter
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS app_schalter_write ON public.app_schalter;
CREATE POLICY app_schalter_write ON public.app_schalter
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

INSERT INTO public.app_schalter (schluessel, wert, beschreibung)
VALUES (
  'vorschau_wiedergabe',
  '{"team": true, "kunde": false}'::jsonb,
  'Videos-Tab: Vorschaudatei statt Original abspielen (team = Mitarbeiter, kunde = Kunden). Aus = sofort Original.'
)
ON CONFLICT (schluessel) DO NOTHING;

COMMIT;
