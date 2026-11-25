-- Medienablage, Teil 2: Creator-Upload direkt nach SharePoint, Fach-Gerüst-Warteschlange,
-- Rechte-Abgleich, Umzug des Bestands. Nur additiv. Creator-Jobs mit ablage = 'sharepoint' laden ohne Staging-Bucket direkt in eine
-- Upload-Session mit deferCommit; creator-upload-complete (ablage-creator-complete) schaltet frei.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.ablage_unternehmen_stand(text);
--   DROP FUNCTION IF EXISTS public.ablage_umzug_holen(text, integer);
--   DROP FUNCTION IF EXISTS public.ablage_umzug_anlegen(text, uuid);
--   DROP TABLE IF EXISTS public.ablage_umzug;
--   DROP FUNCTION IF EXISTS public.ablage_meine_kooperationen(uuid[]);
--   DROP TRIGGER IF EXISTS "Ablage_promote_erbe" ON public.kooperation_video_asset; (ebenso _story_, _bilder_)
--   DROP FUNCTION IF EXISTS private.ablage_promote_erbe();
--   DROP FUNCTION IF EXISTS public.ablage_geruest_offen(text, integer);
--   ALTER TABLE public.ablage_stand DROP COLUMN pflege_at;
--   DROP TRIGGER IF EXISTS ablage_rechte_faellig ON public.ablage_ordner; (ebenso benutzer, mitarbeiter_klasse,
--     unternehmen, mitarbeiter_unternehmen, marke_mitarbeiter, kampagne_mitarbeiter, kunde_unternehmen)
--   DROP FUNCTION IF EXISTS private.ablage_rechte_faellig();
--   DROP FUNCTION IF EXISTS public.ablage_rechte_lease_holen(text, integer);
--   ALTER TABLE public.ablage_stand DROP COLUMN rechte_lease_bis, DROP COLUMN rechte_faellig;
--   ALTER TABLE public.ablage_ordner DROP COLUMN list_item_id;
--   ALTER TABLE public.creator_upload_job DROP COLUMN ablage, DROP COLUMN upload_url,
--     DROP COLUMN item_id, DROP COLUMN ablage_kontext;

BEGIN;

-- ─── Creator-Upload ─────────────────────────────────────────

ALTER TABLE public.creator_upload_job
  ADD COLUMN IF NOT EXISTS ablage text NOT NULL DEFAULT 'dropbox',
  ADD COLUMN IF NOT EXISTS upload_url text,
  ADD COLUMN IF NOT EXISTS item_id text,
  ADD COLUMN IF NOT EXISTS ablage_kontext jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'creator_upload_job_ablage_check') THEN
    ALTER TABLE public.creator_upload_job ADD CONSTRAINT creator_upload_job_ablage_check
      CHECK (ablage IN ('dropbox', 'sharepoint'));
  END IF;
END $$;

COMMENT ON COLUMN public.creator_upload_job.upload_url IS
  'SharePoint: vorab signierte Upload-Session (deferCommit). Nur service_role liest die Tabelle.';

-- ─── Fach-Gerüst ────────────────────────────────────────────
-- Kooperationen von SharePoint-Unternehmen, deren Videos oder Story-Slots noch keinen
-- registrierten Ordner haben. Der Zeitplan baut davon wenige pro Lauf.

CREATE OR REPLACE FUNCTION public.ablage_geruest_offen(p_drive_id text, p_limit integer DEFAULT 5)
RETURNS TABLE (kooperation_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sp AS (
    SELECT k.id AS kooperation_id
    FROM kooperationen k
    JOIN kampagne ka ON ka.id = k.kampagne_id
    JOIN unternehmen u ON u.id = ka.unternehmen_id
    WHERE u.ablage_ziel = 'sharepoint'
  ),
  offen AS (
    SELECT v.kooperation_id, v.created_at
    FROM kooperation_videos v
    JOIN sp ON sp.kooperation_id = v.kooperation_id
    WHERE NOT EXISTS (
      SELECT 1 FROM ablage_ordner o
      WHERE o.drive_id = p_drive_id AND o.art = 'video' AND o.typ = 'videos'
        AND o.kooperation_video_id = v.id AND o.item_id IS NOT NULL AND o.geloescht_at IS NULL
    )
    UNION ALL
    SELECT v.kooperation_id, s.created_at
    FROM kooperation_story s
    JOIN kooperation_videos v ON v.id = s.video_id
    JOIN sp ON sp.kooperation_id = v.kooperation_id
    WHERE NOT EXISTS (
      SELECT 1 FROM ablage_ordner o
      WHERE o.drive_id = p_drive_id AND o.art = 'story' AND o.kooperation_video_id = v.id
        AND o.story_nummer = s.slot_index AND o.item_id IS NOT NULL AND o.geloescht_at IS NULL
    )
  )
  SELECT o.kooperation_id
  FROM offen o
  GROUP BY o.kooperation_id
  ORDER BY min(o.created_at)
  LIMIT p_limit
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_geruest_offen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_geruest_offen(text, integer) TO service_role;

-- Namensabgleich (CRM-Namen -> Ordner) und Aufräumen laufen seltener als der Delta-Lauf
ALTER TABLE public.ablage_stand ADD COLUMN IF NOT EXISTS pflege_at timestamptz;

-- ─── Promote: Erbe beim Löschen der Quelle ──────────────────
-- Finale teilen per source_asset_id die Datei der Quelle. Wird die Quelle gelöscht, setzt die
-- FK-Aktion (ON DELETE SET NULL) alle Finalen auf NULL, und ab zwei Finalen verletzt das
-- ux_*_ablage_item (eine Zeile ohne source_asset_id je Datei). Vorher: alle übrigen Finalen
-- auf die älteste Finale umhängen; die FK-Aktion macht danach nur sie zur neuen Quelle.
-- AFTER statt BEFORE: löscht ein Statement Quelle und Finale zusammen (Kaskade vom Video),
-- darf der Trigger keine Zeilen ändern, die dasselbe Statement noch löscht. Der Name beginnt
-- mit "A", damit er vor der FK-Aktion (RI_ConstraintTrigger_a_*) feuert (Reihenfolge nach Name).

CREATE OR REPLACE FUNCTION private.ablage_promote_erbe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_erbe uuid;
BEGIN
  IF OLD.item_id IS NULL OR OLD.source_asset_id IS NOT NULL THEN
    RETURN OLD;
  END IF;
  EXECUTE format('SELECT id FROM public.%I WHERE source_asset_id = $1 ORDER BY created_at, id LIMIT 1', TG_TABLE_NAME)
    INTO v_erbe USING OLD.id;
  IF v_erbe IS NOT NULL THEN
    EXECUTE format('UPDATE public.%I SET source_asset_id = $1 WHERE source_asset_id = $2 AND id <> $1', TG_TABLE_NAME)
      USING v_erbe, OLD.id;
  END IF;
  RETURN OLD;
END $$;

REVOKE EXECUTE ON FUNCTION private.ablage_promote_erbe() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kooperation_video_asset', 'kooperation_story_asset', 'kooperation_bilder_asset'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ablage_promote_erbe ON public.%I', t);
    EXECUTE format('DROP TRIGGER IF EXISTS "Ablage_promote_erbe" ON public.%I', t);
    EXECUTE format('CREATE TRIGGER "Ablage_promote_erbe" AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION private.ablage_promote_erbe()', t);
  END LOOP;
END $$;

-- ─── Mitarbeiter-Zuordnung für ablage-link / ablage-freigabe ──
-- Die Lese-Regel auf kooperation_video_asset/_story_asset lässt jeden Mitarbeiter durch.
-- Links gibt es aber nur für zugeordnete Kooperationen (gleiche Regel wie kooperation_videos).
-- SECURITY INVOKER: läuft mit dem JWT des Aufrufers.

CREATE OR REPLACE FUNCTION public.ablage_meine_kooperationen(p_ids uuid[])
RETURNS TABLE (kooperation_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT k
  FROM unnest(p_ids) AS k
  WHERE (SELECT public.is_admin()) OR k IN (SELECT private.rls_my_kooperation_ids())
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_meine_kooperationen(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ablage_meine_kooperationen(uuid[]) TO authenticated, service_role;

-- ─── Rechte-Abgleich ────────────────────────────────────────
-- Eigener Läufer neben dem Delta-Lauf. Lease ohne Fencing: Rollen setzen ist idempotent.
-- rechte_faellig setzt ein Trigger, sobald sich Zuordnung, Rolle, Klasse oder ein
-- verwalteter Ordner ändert; der Zeitplan stößt den Lauf dann sofort an, sonst alle 15 Minuten.

ALTER TABLE public.ablage_stand
  ADD COLUMN IF NOT EXISTS rechte_lease_bis timestamptz,
  ADD COLUMN IF NOT EXISTS rechte_faellig boolean NOT NULL DEFAULT true;
-- SharePoint-REST adressiert Rollen über die List-Item-ID, nicht über die Drive-Item-ID
ALTER TABLE public.ablage_ordner ADD COLUMN IF NOT EXISTS list_item_id integer;

CREATE OR REPLACE FUNCTION public.ablage_rechte_lease_holen(p_drive_id text, p_sekunden integer DEFAULT 840)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    UPDATE ablage_stand
    SET rechte_lease_bis = now() + make_interval(secs => p_sekunden), rechte_faellig = false, updated_at = now()
    WHERE drive_id = p_drive_id AND (rechte_lease_bis IS NULL OR rechte_lease_bis < now())
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM u)
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_rechte_lease_holen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_rechte_lease_holen(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION private.ablage_rechte_faellig()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ablage_stand SET rechte_faellig = true WHERE NOT rechte_faellig;
  RETURN NULL;
END $$;

REVOKE EXECUTE ON FUNCTION private.ablage_rechte_faellig() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mitarbeiter_unternehmen', 'marke_mitarbeiter', 'kampagne_mitarbeiter', 'kunde_unternehmen'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS ablage_rechte_faellig ON public.%I', t);
    EXECUTE format('CREATE TRIGGER ablage_rechte_faellig AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION private.ablage_rechte_faellig()', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS ablage_rechte_faellig ON public.benutzer;
CREATE TRIGGER ablage_rechte_faellig
  AFTER INSERT OR DELETE OR UPDATE OF rolle, freigeschaltet, mitarbeiter_klasse_id, email, microsoft_konto ON public.benutzer
  FOR EACH STATEMENT EXECUTE FUNCTION private.ablage_rechte_faellig();

DROP TRIGGER IF EXISTS ablage_rechte_faellig ON public.mitarbeiter_klasse;
CREATE TRIGGER ablage_rechte_faellig AFTER UPDATE OF name ON public.mitarbeiter_klasse
  FOR EACH STATEMENT EXECUTE FUNCTION private.ablage_rechte_faellig();

DROP TRIGGER IF EXISTS ablage_rechte_faellig ON public.unternehmen;
CREATE TRIGGER ablage_rechte_faellig AFTER UPDATE OF ist_test ON public.unternehmen
  FOR EACH STATEMENT EXECUTE FUNCTION private.ablage_rechte_faellig();

-- Neue oder umgehängte Unternehmen-, Marken-, Kampagnen- und freie Ordner brauchen ihr Soll sofort
DROP TRIGGER IF EXISTS ablage_rechte_faellig ON public.ablage_ordner;
CREATE TRIGGER ablage_rechte_faellig
  AFTER INSERT OR UPDATE OF item_id, parent_item_id, art, unternehmen_id, marke_id, kampagne_id, geloescht_at
  ON public.ablage_ordner
  FOR EACH ROW WHEN (NEW.art IN ('unternehmen', 'marke', 'kampagne', 'frei'))
  EXECUTE FUNCTION private.ablage_rechte_faellig();

-- ─── Umzug des Bestands ─────────────────────────────────────
-- Eine Zeile je Original-Asset (Promote-Finale ziehen über source_asset_id mit). Fortsetzbar:
-- Upload-Session und Versatz (Dropbox) bzw. Monitor-URL (OneDrive-Kopie) bleiben zwischen
-- den Läufen stehen. Läuft nur für Unternehmen, deren Weiche auf sharepoint steht.

CREATE TABLE IF NOT EXISTS public.ablage_umzug (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id text NOT NULL,
  unternehmen_id uuid REFERENCES public.unternehmen(id) ON DELETE CASCADE,
  typ text NOT NULL CHECK (typ IN ('video', 'story', 'still', 'roh')),
  asset_id uuid NOT NULL,
  quelle text NOT NULL CHECK (quelle IN ('dropbox', 'onedrive')),
  -- Dropbox-Pfad bzw. Freigabelink
  quelle_ref text NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'fertig', 'fehler', 'uebersprungen')),
  grund text,
  versuche integer NOT NULL DEFAULT 0,
  naechster_versuch timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis timestamptz,
  ziel_parent_item_id text,
  ziel_name text,
  groesse bigint,
  upload_url text,
  versatz bigint NOT NULL DEFAULT 0,
  kopie_url text,
  -- ablage_upload vor Commit/Kopie: stirbt der Läufer, hängt der Abgleich die Datei an
  upload_id uuid,
  item_id text,
  erstellt_at timestamptz NOT NULL DEFAULT now(),
  fertig_at timestamptz,
  UNIQUE (typ, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_ablage_umzug_offen
  ON public.ablage_umzug (drive_id, naechster_versuch) WHERE status = 'offen';
CREATE INDEX IF NOT EXISTS idx_ablage_umzug_unternehmen
  ON public.ablage_umzug (unternehmen_id, status);

ALTER TABLE public.ablage_umzug ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ablage_umzug FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ablage_umzug TO service_role;

-- Bestand eines Unternehmens einreihen. Erneuter Aufruf öffnet fehlgeschlagene Zeilen wieder.
CREATE OR REPLACE FUNCTION public.ablage_umzug_anlegen(p_drive_id text, p_unternehmen_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  WITH koop AS (
    SELECT k.id FROM kooperationen k JOIN kampagne ka ON ka.id = k.kampagne_id
    WHERE ka.unternehmen_id = p_unternehmen_id
  ),
  vid AS (
    SELECT v.id FROM kooperation_videos v WHERE v.kooperation_id IN (SELECT id FROM koop)
  ),
  a AS (
    SELECT 'video'::text AS typ, x.id, x.file_path, x.file_url FROM kooperation_video_asset x
    WHERE x.video_id IN (SELECT id FROM vid) AND x.source_asset_id IS NULL AND x.ablage = 'dropbox'
    UNION ALL
    SELECT 'story', x.id, x.file_path, x.file_url FROM kooperation_story_asset x
    WHERE x.video_id IN (SELECT id FROM vid) AND x.source_asset_id IS NULL AND x.ablage = 'dropbox'
    UNION ALL
    SELECT 'still', x.id, x.file_path, x.file_url FROM kooperation_bilder_asset x
    WHERE x.kooperation_id IN (SELECT id FROM koop) AND x.source_asset_id IS NULL AND x.ablage = 'dropbox'
    UNION ALL
    SELECT 'roh', x.id, x.file_path, x.file_url FROM kooperation_rohmaterial_asset x
    WHERE x.kooperation_id IN (SELECT id FROM koop) AND x.ablage = 'dropbox'
  ),
  q AS (
    SELECT a.*,
      CASE WHEN a.file_url ~* '(sharepoint\.com|1drv\.ms|onedrive\.live\.com)' THEN 'onedrive' ELSE 'dropbox' END AS quelle,
      (a.file_url ~* '(sharepoint\.com|1drv\.ms|onedrive\.live\.com)' OR a.file_path LIKE '/%') AS hat_quelle
    FROM a
  )
  INSERT INTO ablage_umzug (drive_id, unternehmen_id, typ, asset_id, quelle, quelle_ref, status, grund)
  SELECT p_drive_id, p_unternehmen_id, q.typ, q.id, q.quelle,
    CASE WHEN q.quelle = 'onedrive' THEN q.file_url ELSE coalesce(q.file_path, '') END,
    CASE WHEN q.hat_quelle THEN 'offen' ELSE 'uebersprungen' END,
    CASE WHEN q.hat_quelle THEN NULL ELSE 'ohne_quelle' END
  FROM q
  ON CONFLICT (typ, asset_id) DO UPDATE
    SET status = 'offen', grund = NULL, versuche = 0, naechster_versuch = now(), gesperrt_bis = NULL
    WHERE ablage_umzug.status = 'fehler';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

REVOKE EXECUTE ON FUNCTION public.ablage_umzug_anlegen(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_umzug_anlegen(text, uuid) TO service_role;

-- Nächste offene Zeile (mehrere Läufer parallel: SKIP LOCKED + Sperrfrist)
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
      AND un.ablage_ziel = 'sharepoint'
    ORDER BY x.naechster_versuch, x.id
    LIMIT 1
    FOR UPDATE OF x SKIP LOCKED
  )
  RETURNING u.*
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_umzug_holen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_umzug_holen(text, integer) TO service_role;

-- Admin-Seite: Weiche, Originale je Ablage und Umzugsfortschritt je Unternehmen in einem Aufruf
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
    WHERE z.drive_id = p_drive_id
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

COMMIT;
