-- Medienablage: SharePoint als zweite Ablage neben Dropbox (Plan medienablage_sharepoint).
-- Nur additiv: neue Tabellen, neue Spalten mit Default. Alte Bundles auf main und v2 laufen
-- unverändert weiter; Dropbox bleibt Standard, bis die Weiche pro Unternehmen umgelegt wird.
--
-- Führung je Tatsache (eine Quelle pro Fakt, kein Multi-Leader):
--   CRM → SharePoint: Fach-Gerüst, Ordnernamen, Rechte, Löschen von Fachdateien.
--   SharePoint → CRM: neue Dateien, freie Ordner, Dateinamen (letztes Umbenennen gewinnt).
-- Der Abgleich liest den Delta-Feed (Change Data Capture) und schreibt idempotent per
-- (drive_id, item_id). Cursor (deltaLink) und Arbeit sind getrennt: erst Eingang speichern,
-- dann Cursor weiterschieben; abgearbeitet wird aus ablage_eingang mit Lease + Fencing.
--
-- ROLLBACK (nur solange keine Unternehmen auf sharepoint stehen):
--   DROP VIEW IF EXISTS public.ablage_unzugeordnet;
--   DROP FUNCTION IF EXISTS public.ablage_lease_holen(text, integer);
--   DROP FUNCTION IF EXISTS public.ablage_lease_freigeben(text, bigint);
--   DROP FUNCTION IF EXISTS public.ablage_delta_speichern(text, bigint, text);
--   DROP FUNCTION IF EXISTS public.ablage_eingang_aufnehmen(text, jsonb);
--   DROP FUNCTION IF EXISTS public.ablage_eingang_holen(text, integer, integer, integer);
--   DROP FUNCTION IF EXISTS public.ablage_eingang_abschliessen(text, text, bigint, text, text, jsonb, integer);
--   DROP FUNCTION IF EXISTS public.ablage_geheimnis(text);
--   DROP FUNCTION IF EXISTS public.ablage_geheimnis_setzen(text, text);
--   DROP TABLE IF EXISTS public.ablage_freigabelink, public.ablage_upload, public.ablage_eingang,
--     public.ablage_ordner, public.ablage_stand, public.ablage_einstellung;
--   ALTER TABLE public.kooperation_video_asset DROP COLUMN ablage, DROP COLUMN drive_id, ... (je Asset-Tabelle)
--   ALTER TABLE public.unternehmen DROP COLUMN ablage_ziel;
--   ALTER TABLE public.benutzer DROP COLUMN microsoft_konto;
--   (poster_soll: Definition aus 20261129 erneut ausführen)

BEGIN;

-- ─── Weiche und Konten ──────────────────────────────────────

ALTER TABLE public.unternehmen
  ADD COLUMN IF NOT EXISTS ablage_ziel text NOT NULL DEFAULT 'dropbox'
    CHECK (ablage_ziel IN ('dropbox', 'sharepoint'));
COMMENT ON COLUMN public.unternehmen.ablage_ziel IS
  'Wohin neue Uploads dieses Unternehmens gehen. Notschalter (ablage_einstellung.notschalter oder Env ABLAGE_ZIEL=dropbox) übersteuert.';

-- Microsoft-Konto für die SharePoint-Rechte. Leer = benutzer.email.
ALTER TABLE public.benutzer ADD COLUMN IF NOT EXISTS microsoft_konto text;
COMMENT ON COLUMN public.benutzer.microsoft_konto IS
  'Abweichendes Microsoft-Konto (UPN) für die Medienablage. Leer = email. Nur Admins ändern es.';

-- Weiche und Konto setzen Rechte in SharePoint: nur Admins (oder ohne JWT, z. B. service_role).
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
  IF TG_TABLE_NAME = 'unternehmen' AND NEW.ablage_ziel IS DISTINCT FROM OLD.ablage_ziel THEN
    RAISE EXCEPTION 'Nur Admins ändern die Medienablage-Weiche' USING ERRCODE = '42501';
  END IF;
  IF TG_TABLE_NAME = 'benutzer' AND NEW.microsoft_konto IS DISTINCT FROM OLD.microsoft_konto THEN
    RAISE EXCEPTION 'Nur Admins ändern das Microsoft-Konto' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unternehmen_ablage_schutz ON public.unternehmen;
CREATE TRIGGER trg_unternehmen_ablage_schutz
  BEFORE UPDATE OF ablage_ziel ON public.unternehmen
  FOR EACH ROW EXECUTE FUNCTION private.ablage_spalten_schutz();

DROP TRIGGER IF EXISTS trg_benutzer_ablage_schutz ON public.benutzer;
CREATE TRIGGER trg_benutzer_ablage_schutz
  BEFORE UPDATE OF microsoft_konto ON public.benutzer
  FOR EACH ROW EXECUTE FUNCTION private.ablage_spalten_schutz();

-- ─── Asset-Spalten ──────────────────────────────────────────
-- ablage sagt, wo die Datei liegt. file_path bleibt der lesbare Pfad (bei SharePoint ab der
-- Bibliothekswurzel, zuletzt bekannt); die Identität ist (drive_id, item_id).
-- ctag ändert sich nur bei neuem Inhalt (Poster-Revision), etag bei jeder Änderung (If-Match).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['kooperation_video_asset', 'kooperation_story_asset',
                           'kooperation_bilder_asset', 'kooperation_rohmaterial_asset']
  LOOP
    EXECUTE format($f$
      ALTER TABLE public.%1$I
        ADD COLUMN IF NOT EXISTS ablage text NOT NULL DEFAULT 'dropbox',
        ADD COLUMN IF NOT EXISTS drive_id text,
        ADD COLUMN IF NOT EXISTS item_id text,
        ADD COLUMN IF NOT EXISTS etag text,
        ADD COLUMN IF NOT EXISTS ctag text,
        ADD COLUMN IF NOT EXISTS breite integer,
        ADD COLUMN IF NOT EXISTS hoehe integer
    $f$, t);

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_ablage_check') THEN
      EXECUTE format($f$
        ALTER TABLE public.%1$I ADD CONSTRAINT %2$I
          CHECK (ablage IN ('dropbox', 'sharepoint')
                 AND (ablage = 'dropbox' OR (drive_id IS NOT NULL AND item_id IS NOT NULL)))
      $f$, t, t || '_ablage_check');
    END IF;

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (drive_id, item_id) WHERE item_id IS NOT NULL',
                   'idx_' || t || '_ablage_item', t);
  END LOOP;
END $$;

-- Eine Datei = eine Asset-Zeile. Ausnahme: Promote (Finale Version verweist per
-- source_asset_id auf die Datei in der Schleife und teilt sie).
CREATE UNIQUE INDEX IF NOT EXISTS ux_kooperation_video_asset_ablage_item
  ON public.kooperation_video_asset (drive_id, item_id)
  WHERE item_id IS NOT NULL AND source_asset_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_kooperation_story_asset_ablage_item
  ON public.kooperation_story_asset (drive_id, item_id)
  WHERE item_id IS NOT NULL AND source_asset_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_kooperation_bilder_asset_ablage_item
  ON public.kooperation_bilder_asset (drive_id, item_id)
  WHERE item_id IS NOT NULL AND source_asset_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_kooperation_rohmaterial_asset_ablage_item
  ON public.kooperation_rohmaterial_asset (drive_id, item_id)
  WHERE item_id IS NOT NULL;

-- ─── Einstellungen (Notschalter) ────────────────────────────

CREATE TABLE IF NOT EXISTS public.ablage_einstellung (
  schluessel text PRIMARY KEY,
  wert jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.ablage_einstellung IS
  'notschalter = true: alle neuen Uploads gehen nach Dropbox, egal was unternehmen.ablage_ziel sagt. Wirkt sofort (Env ABLAGE_ZIEL erst nach Deploy).';

INSERT INTO public.ablage_einstellung (schluessel, wert)
VALUES ('notschalter', 'false'::jsonb)
ON CONFLICT (schluessel) DO NOTHING;

-- ─── Ordner-Register ────────────────────────────────────────
-- Jeder Ordner, den das CRM kennt: Fach-Gerüst (vom CRM angelegt, Name führt das CRM) und
-- freie Ordner (im Finder angelegt, Name führt SharePoint). item_id ist NULL, solange das
-- CRM den Ordner gerade anlegt: die Zeile reserviert den Namen unter dem Elternordner,
-- parallele Anlagen weichen auf "Name (2)" aus.

CREATE TABLE IF NOT EXISTS public.ablage_ordner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id text NOT NULL,
  item_id text,
  parent_item_id text NOT NULL,
  name text NOT NULL,
  pfad text,
  art text NOT NULL CHECK (art IN (
    'unternehmen', 'marke', 'kampagne', 'kooperation', 'typ', 'video', 'story',
    'schleife', 'finale', 'format', 'variante', 'frei', 'test', 'unzugeordnet'
  )),
  typ text CHECK (typ IN ('videos', 'storys', 'bilder', 'rohmaterial')),
  unternehmen_id uuid REFERENCES public.unternehmen(id) ON DELETE SET NULL,
  marke_id uuid REFERENCES public.marke(id) ON DELETE SET NULL,
  kampagne_id uuid REFERENCES public.kampagne(id) ON DELETE SET NULL,
  kooperation_id uuid REFERENCES public.kooperationen(id) ON DELETE SET NULL,
  kooperation_video_id uuid REFERENCES public.kooperation_videos(id) ON DELETE SET NULL,
  story_nummer integer,
  version_number integer,
  variante text,
  format text CHECK (format IN ('9-16', '4-5', '1-1')),
  -- Rechte-Abgleich: eigene Rechte (Vererbung unterbrochen) und Hash des zuletzt gesetzten Solls
  rechte_eigen boolean NOT NULL DEFAULT false,
  rechte_hash text,
  rechte_geprueft_at timestamptz,
  geloescht_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_item
  ON public.ablage_ordner (drive_id, item_id) WHERE item_id IS NOT NULL;
-- Namensreservierung (SharePoint vergleicht Namen ohne Groß/Klein)
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_name
  ON public.ablage_ordner (drive_id, parent_item_id, lower(name))
  WHERE geloescht_at IS NULL AND art <> 'frei';
-- Je Fach-Objekt genau ein Ordner
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_unternehmen
  ON public.ablage_ordner (drive_id, unternehmen_id) WHERE art = 'unternehmen' AND geloescht_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_marke
  ON public.ablage_ordner (drive_id, marke_id) WHERE art = 'marke' AND geloescht_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_kampagne
  ON public.ablage_ordner (drive_id, kampagne_id) WHERE art = 'kampagne' AND geloescht_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_kooperation
  ON public.ablage_ordner (drive_id, kooperation_id) WHERE art = 'kooperation' AND geloescht_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_ordner_typ
  ON public.ablage_ordner (drive_id, kooperation_id, typ) WHERE art = 'typ' AND geloescht_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_ordner_parent
  ON public.ablage_ordner (drive_id, parent_item_id) WHERE geloescht_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_ordner_kooperation
  ON public.ablage_ordner (kooperation_id) WHERE geloescht_at IS NULL;

-- ─── Stand je Bibliothek ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ablage_stand (
  drive_id text PRIMARY KEY,
  site_id text,
  root_item_id text,
  delta_link text,
  -- Lease + Fencing für den Delta-Lauf (ein Läufer je Bibliothek)
  lease_bis timestamptz,
  lease_token bigint NOT NULL DEFAULT 0,
  voll_abgleich_noetig boolean NOT NULL DEFAULT false,
  abo_id text,
  abo_ablauf timestamptz,
  letzte_meldung timestamptz,
  letzter_lauf timestamptz,
  letzter_erfolg timestamptz,
  fehler text,
  fehler_seit timestamptz,
  rechte_lauf timestamptz,
  rechte_fehler text,
  quota_used bigint,
  quota_total bigint,
  quota_at timestamptz,
  zert_ablauf timestamptz,
  alarme jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── Eingang (Delta-Feed) ───────────────────────────────────
-- Letzter bekannter Zustand je Item. Eine neue Meldung mit anderem Inhalt setzt das Item
-- auf offen und erhöht fence: ein Läufer, der die alte Fassung bearbeitet, schließt dann
-- nicht mehr ab (Fencing), die neue Fassung wird neu bearbeitet.

CREATE TABLE IF NOT EXISTS public.ablage_eingang (
  drive_id text NOT NULL,
  item_id text NOT NULL,
  parent_item_id text,
  name text,
  pfad text,
  ist_ordner boolean NOT NULL DEFAULT false,
  geloescht boolean NOT NULL DEFAULT false,
  groesse bigint,
  etag text,
  ctag text,
  mime text,
  breite integer,
  hoehe integer,
  dauer_ms bigint,
  geaendert_at timestamptz,
  geaendert_von text,
  gesehen_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'offen'
    CHECK (status IN ('offen', 'erledigt', 'ignoriert', 'unzugeordnet', 'fehler')),
  grund text,
  fence bigint NOT NULL DEFAULT 0,
  versuche integer NOT NULL DEFAULT 0,
  naechster_versuch timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis timestamptz,
  ergebnis jsonb,
  erledigt_at timestamptz,
  PRIMARY KEY (drive_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_ablage_eingang_offen
  ON public.ablage_eingang (drive_id, naechster_versuch) WHERE status = 'offen';
CREATE INDEX IF NOT EXISTS idx_ablage_eingang_parent
  ON public.ablage_eingang (drive_id, parent_item_id);

CREATE OR REPLACE VIEW public.ablage_unzugeordnet
WITH (security_invoker = true) AS
SELECT e.drive_id, e.item_id, e.parent_item_id, e.name, e.pfad, e.groesse, e.breite, e.hoehe,
       e.geaendert_at, e.geaendert_von, e.grund, e.ergebnis, e.gesehen_at
FROM public.ablage_eingang e
WHERE e.status = 'unzugeordnet' AND NOT e.geloescht;

-- ─── Uploads aus dem CRM ────────────────────────────────────
-- Offene Upload-Sessions. Der Abgleich legt für eine Datei, die gerade aus dem CRM kommt,
-- keine eigene Asset-Zeile an (sonst doppelt), sondern wartet auf den Commit.

CREATE TABLE IF NOT EXISTS public.ablage_upload (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id text NOT NULL,
  parent_item_id text NOT NULL,
  name text NOT NULL,
  groesse bigint NOT NULL,
  typ text NOT NULL CHECK (typ IN ('video', 'story', 'still', 'roh')),
  kontext jsonb NOT NULL DEFAULT '{}'::jsonb,
  item_id text,
  erstellt_von uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  erstellt_at timestamptz NOT NULL DEFAULT now(),
  abgeschlossen_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ablage_upload_offen
  ON public.ablage_upload (drive_id, parent_item_id) WHERE abgeschlossen_at IS NULL;

-- ─── Kunden-Leselinks ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ablage_freigabelink (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id text NOT NULL,
  item_id text NOT NULL,
  kooperation_id uuid NOT NULL REFERENCES public.kooperationen(id) ON DELETE CASCADE,
  ordner_art text NOT NULL,
  permission_id text NOT NULL,
  url text NOT NULL,
  erstellt_von uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  erstellt_at timestamptz NOT NULL DEFAULT now(),
  laeuft_ab_at timestamptz NOT NULL,
  widerrufen_at timestamptz,
  widerruf_grund text
);

CREATE INDEX IF NOT EXISTS idx_ablage_freigabelink_aktiv
  ON public.ablage_freigabelink (kooperation_id) WHERE widerrufen_at IS NULL;

-- ─── RPCs für den Abgleich (nur service_role) ───────────────

-- Lease für den Delta-Lauf einer Bibliothek. Liefert das neue Fencing-Token oder NULL.
CREATE OR REPLACE FUNCTION public.ablage_lease_holen(p_drive_id text, p_sekunden integer DEFAULT 840)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ablage_stand
     SET lease_bis = now() + make_interval(secs => p_sekunden),
         lease_token = lease_token + 1,
         letzter_lauf = now(),
         updated_at = now()
   WHERE drive_id = p_drive_id
     AND (lease_bis IS NULL OR lease_bis < now())
  RETURNING lease_token
$$;

CREATE OR REPLACE FUNCTION public.ablage_lease_freigeben(p_drive_id text, p_token bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    UPDATE public.ablage_stand SET lease_bis = NULL, updated_at = now()
     WHERE drive_id = p_drive_id AND lease_token = p_token
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM u)
$$;

-- Cursor nur mit gültiger Lease weiterschieben (sonst hat ein anderer Läufer übernommen).
CREATE OR REPLACE FUNCTION public.ablage_delta_speichern(p_drive_id text, p_token bigint, p_delta_link text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    UPDATE public.ablage_stand
       SET delta_link = p_delta_link,
           voll_abgleich_noetig = CASE WHEN p_delta_link IS NULL THEN voll_abgleich_noetig ELSE false END,
           updated_at = now()
     WHERE drive_id = p_drive_id AND lease_token = p_token AND lease_bis > now()
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM u)
$$;

-- Eine Seite des Delta-Feeds aufnehmen. p_items: Array aus Objekten mit den Spalten von
-- ablage_eingang (item_id, parent_item_id, name, pfad, ist_ordner, geloescht, groesse, etag,
-- ctag, mime, breite, hoehe, dauer_ms, geaendert_at, geaendert_von).
-- Unveränderte Meldungen (gleicher etag, gleicher Ort, gleicher Löschstand) ändern nichts.
CREATE OR REPLACE FUNCTION public.ablage_eingang_aufnehmen(p_drive_id text, p_items jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH neu AS (
    SELECT * FROM jsonb_to_recordset(p_items) AS x(
      item_id text, parent_item_id text, name text, pfad text, ist_ordner boolean,
      geloescht boolean, groesse bigint, etag text, ctag text, mime text, breite integer,
      hoehe integer, dauer_ms bigint, geaendert_at timestamptz, geaendert_von text
    )
  ),
  u AS (
    INSERT INTO public.ablage_eingang AS e (
      drive_id, item_id, parent_item_id, name, pfad, ist_ordner, geloescht, groesse, etag,
      ctag, mime, breite, hoehe, dauer_ms, geaendert_at, geaendert_von, status, fence
    )
    SELECT p_drive_id, n.item_id, n.parent_item_id, n.name, n.pfad, coalesce(n.ist_ordner, false),
           coalesce(n.geloescht, false), n.groesse, n.etag, n.ctag, n.mime, n.breite, n.hoehe,
           n.dauer_ms, n.geaendert_at, n.geaendert_von, 'offen', 1
    FROM neu n
    WHERE n.item_id IS NOT NULL
    ON CONFLICT (drive_id, item_id) DO UPDATE SET
      parent_item_id = coalesce(EXCLUDED.parent_item_id, e.parent_item_id),
      name = coalesce(EXCLUDED.name, e.name),
      pfad = coalesce(EXCLUDED.pfad, e.pfad),
      ist_ordner = EXCLUDED.ist_ordner OR e.ist_ordner,
      geloescht = EXCLUDED.geloescht,
      groesse = coalesce(EXCLUDED.groesse, e.groesse),
      etag = coalesce(EXCLUDED.etag, e.etag),
      ctag = coalesce(EXCLUDED.ctag, e.ctag),
      mime = coalesce(EXCLUDED.mime, e.mime),
      breite = coalesce(EXCLUDED.breite, e.breite),
      hoehe = coalesce(EXCLUDED.hoehe, e.hoehe),
      dauer_ms = coalesce(EXCLUDED.dauer_ms, e.dauer_ms),
      geaendert_at = coalesce(EXCLUDED.geaendert_at, e.geaendert_at),
      geaendert_von = coalesce(EXCLUDED.geaendert_von, e.geaendert_von),
      gesehen_at = now(),
      status = 'offen',
      grund = NULL,
      fence = e.fence + 1,
      versuche = 0,
      naechster_versuch = now(),
      gesperrt_bis = NULL
    WHERE e.etag IS DISTINCT FROM EXCLUDED.etag
       OR e.geloescht IS DISTINCT FROM EXCLUDED.geloescht
       OR e.parent_item_id IS DISTINCT FROM coalesce(EXCLUDED.parent_item_id, e.parent_item_id)
       OR e.name IS DISTINCT FROM coalesce(EXCLUDED.name, e.name)
    RETURNING 1
  )
  SELECT count(*)::integer FROM u
$$;

-- Fällige Items claimen. Dateien erst nach p_ruhe_sek Ruhe (Finder lädt in Stücken, Kunden
-- sollen keine halben Dateien sehen); Ordner und Löschungen sofort. Ordner zuerst, damit
-- das Register die Eltern kennt, bevor die Dateien darin eingeordnet werden.
CREATE OR REPLACE FUNCTION public.ablage_eingang_holen(
  p_drive_id text,
  p_limit integer DEFAULT 50,
  p_ruhe_sek integer DEFAULT 120,
  p_lease_sec integer DEFAULT 300
)
RETURNS SETOF public.ablage_eingang
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH k AS (
    SELECT e.drive_id, e.item_id
    FROM public.ablage_eingang e
    WHERE e.drive_id = p_drive_id
      AND e.status = 'offen'
      AND e.naechster_versuch <= now()
      AND (e.gesperrt_bis IS NULL OR e.gesperrt_bis <= now())
      AND (e.ist_ordner OR e.geloescht
           OR coalesce(e.geaendert_at, e.gesehen_at) <= now() - make_interval(secs => p_ruhe_sek))
    ORDER BY e.ist_ordner DESC, length(coalesce(e.pfad, '')), e.gesehen_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.ablage_eingang e
     SET gesperrt_bis = now() + make_interval(secs => p_lease_sec),
         versuche = e.versuche + 1,
         fence = e.fence + 1
    FROM k
   WHERE e.drive_id = k.drive_id AND e.item_id = k.item_id
  RETURNING e.*
$$;

-- Abschluss mit Fencing: nur wenn seit dem Claim keine neuere Meldung kam.
-- p_wiederholen_sek > 0: offen lassen und später erneut versuchen (Backoff).
CREATE OR REPLACE FUNCTION public.ablage_eingang_abschliessen(
  p_drive_id text,
  p_item_id text,
  p_fence bigint,
  p_status text,
  p_grund text DEFAULT NULL,
  p_ergebnis jsonb DEFAULT NULL,
  p_wiederholen_sek integer DEFAULT 0
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    UPDATE public.ablage_eingang
       SET status = CASE WHEN p_wiederholen_sek > 0 THEN 'offen' ELSE p_status END,
           grund = p_grund,
           ergebnis = coalesce(p_ergebnis, ergebnis),
           gesperrt_bis = NULL,
           naechster_versuch = now() + make_interval(secs => greatest(p_wiederholen_sek, 0)),
           erledigt_at = CASE WHEN p_wiederholen_sek > 0 THEN erledigt_at ELSE now() END
     WHERE drive_id = p_drive_id AND item_id = p_item_id AND fence = p_fence
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM u)
$$;

-- ─── Geheimnisse (Zertifikat) ───────────────────────────────
-- Netlify-Functions haben 4 KB für alle Env-Variablen; Schlüssel und Zertifikat liegen im
-- Vault. Nur Namen mit Präfix medienablage_, nur service_role.

CREATE OR REPLACE FUNCTION public.ablage_geheimnis(p_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT ds.decrypted_secret
  FROM vault.decrypted_secrets ds
  WHERE ds.name = p_name AND p_name LIKE 'medienablage\_%'
  ORDER BY ds.updated_at DESC NULLS LAST
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.ablage_geheimnis_setzen(p_name text, p_wert text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_name NOT LIKE 'medienablage\_%' THEN
    RAISE EXCEPTION 'Nur Geheimnisse mit Präfix medienablage_';
  END IF;
  SELECT s.id INTO v_id FROM vault.secrets s WHERE s.name = p_name;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_wert, p_name, 'Medienablage');
  ELSE
    PERFORM vault.update_secret(v_id, p_wert, p_name, 'Medienablage');
  END IF;
END;
$$;

-- ─── Pfade nachziehen, Teilbäume ────────────────────────────
-- Umbenennen/Verschieben eines Ordners meldet der Delta-Feed nur für den Ordner selbst.
-- file_path (lesbarer Pfad ab Bibliothekswurzel) und ablage_ordner.pfad darunter zieht das CRM nach.

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
  RETURN n;
END;
$$;

-- Alle bekannten Items unter einem Ordner (Eingang + Register), z. B. wenn ein Admin im Web
-- einen ganzen Ordner löscht und der Feed nur den Ordner meldet.
CREATE OR REPLACE FUNCTION public.ablage_nachfahren(p_drive_id text, p_item_id text)
RETURNS TABLE (item_id text, ist_ordner boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE kinder(item_id, ist_ordner, tiefe) AS (
    SELECT k.item_id, k.ist_ordner, 1
    FROM (
      SELECT e.item_id, e.ist_ordner FROM ablage_eingang e
       WHERE e.drive_id = p_drive_id AND e.parent_item_id = p_item_id
      UNION
      SELECT o.item_id, true FROM ablage_ordner o
       WHERE o.drive_id = p_drive_id AND o.parent_item_id = p_item_id AND o.item_id IS NOT NULL
    ) k
    UNION
    SELECT x.item_id, x.ist_ordner, b.tiefe + 1
    FROM kinder b
    CROSS JOIN LATERAL (
      SELECT e.item_id, e.ist_ordner FROM ablage_eingang e
       WHERE e.drive_id = p_drive_id AND e.parent_item_id = b.item_id
      UNION
      SELECT o.item_id, true FROM ablage_ordner o
       WHERE o.drive_id = p_drive_id AND o.parent_item_id = b.item_id AND o.item_id IS NOT NULL
    ) x
    WHERE b.ist_ordner AND b.tiefe < 30
  )
  SELECT k.item_id, bool_or(k.ist_ordner) FROM kinder k GROUP BY k.item_id
$$;

-- ─── Poster: Schlüssel item_id + cTag für SharePoint ────────
-- (20261129 ist auf Live noch nicht angewendet; Dropbox-Schlüssel bleibt file_path + Revision.)
-- Bei SharePoint ändert Umbenennen oder Verschieben den Schlüssel nicht, nur neuer Inhalt.

CREATE OR REPLACE FUNCTION public.poster_schluessel(
  p_ablage text, p_drive_id text, p_item_id text, p_file_path text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_ablage = 'sharepoint' THEN 'sp:' || p_drive_id || ':' || p_item_id ELSE p_file_path END
$$;

CREATE OR REPLACE VIEW public.poster_soll
WITH (security_invoker = true) AS
SELECT 'video'::text AS typ, a.id AS asset_id,
       public.poster_schluessel(coalesce(s.ablage, a.ablage), coalesce(s.drive_id, a.drive_id),
                                coalesce(s.item_id, a.item_id), a.file_path) AS file_path,
       public.poster_art(a.file_path) AS art,
       CASE WHEN coalesce(s.ablage, a.ablage) = 'sharepoint'
            THEN coalesce(s.ctag, a.ctag, s.etag, a.etag, public.poster_revision(coalesce(s.created_at, a.created_at)))
            ELSE public.poster_revision(coalesce(s.created_at, a.created_at)) END AS revision
FROM public.kooperation_video_asset a
LEFT JOIN public.kooperation_video_asset s ON s.id = a.source_asset_id
WHERE public.poster_art(a.file_path) IS NOT NULL
UNION ALL
SELECT 'story'::text, a.id,
       public.poster_schluessel(coalesce(s.ablage, a.ablage), coalesce(s.drive_id, a.drive_id),
                                coalesce(s.item_id, a.item_id), a.file_path),
       public.poster_art(a.file_path),
       CASE WHEN coalesce(s.ablage, a.ablage) = 'sharepoint'
            THEN coalesce(s.ctag, a.ctag, s.etag, a.etag, public.poster_revision(coalesce(s.created_at, a.created_at)))
            ELSE public.poster_revision(coalesce(s.created_at, a.created_at)) END
FROM public.kooperation_story_asset a
LEFT JOIN public.kooperation_story_asset s ON s.id = a.source_asset_id
WHERE public.poster_art(a.file_path) IS NOT NULL
UNION ALL
SELECT 'still'::text, a.id,
       public.poster_schluessel(coalesce(s.ablage, a.ablage), coalesce(s.drive_id, a.drive_id),
                                coalesce(s.item_id, a.item_id), a.file_path),
       public.poster_art(a.file_path),
       CASE WHEN coalesce(s.ablage, a.ablage) = 'sharepoint'
            THEN coalesce(s.ctag, a.ctag, s.etag, a.etag, public.poster_revision(coalesce(s.created_at, a.created_at)))
            ELSE public.poster_revision(coalesce(s.created_at, a.created_at)) END
FROM public.kooperation_bilder_asset a
LEFT JOIN public.kooperation_bilder_asset s ON s.id = a.source_asset_id
WHERE public.poster_art(a.file_path) IS NOT NULL
UNION ALL
SELECT 'roh'::text, a.id,
       public.poster_schluessel(a.ablage, a.drive_id, a.item_id, a.file_path),
       public.poster_art(a.file_path),
       CASE WHEN a.ablage = 'sharepoint'
            THEN coalesce(a.ctag, a.etag, public.poster_revision(a.created_at))
            ELSE public.poster_revision(a.created_at) END
FROM public.kooperation_rohmaterial_asset a
WHERE public.poster_art(a.file_path) IS NOT NULL;

-- ─── Rechte ─────────────────────────────────────────────────

ALTER TABLE public.ablage_einstellung ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ablage_ordner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ablage_stand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ablage_eingang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ablage_upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ablage_freigabelink ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ablage_einstellung, public.ablage_ordner, public.ablage_stand,
  public.ablage_eingang, public.ablage_upload, public.ablage_freigabelink,
  public.ablage_unzugeordnet FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ablage_einstellung, public.ablage_ordner,
  public.ablage_stand, public.ablage_eingang, public.ablage_upload, public.ablage_freigabelink
  TO service_role;
GRANT SELECT ON public.ablage_unzugeordnet TO service_role;

-- Admin-Seite liest Stand, Eingang, Einstellung direkt; der Notschalter ist ein Update.
GRANT SELECT ON public.ablage_einstellung, public.ablage_stand, public.ablage_eingang,
  public.ablage_unzugeordnet TO authenticated;
GRANT UPDATE (wert, updated_at, updated_by) ON public.ablage_einstellung TO authenticated;

DROP POLICY IF EXISTS ablage_einstellung_admin_select ON public.ablage_einstellung;
CREATE POLICY ablage_einstellung_admin_select ON public.ablage_einstellung
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
DROP POLICY IF EXISTS ablage_einstellung_admin_update ON public.ablage_einstellung;
CREATE POLICY ablage_einstellung_admin_update ON public.ablage_einstellung
  FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS ablage_stand_admin_select ON public.ablage_stand;
CREATE POLICY ablage_stand_admin_select ON public.ablage_stand
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

DROP POLICY IF EXISTS ablage_eingang_admin_select ON public.ablage_eingang;
CREATE POLICY ablage_eingang_admin_select ON public.ablage_eingang
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- Freie Ordner zeigt der Videos-Tab auf Kooperations-Ebene, nur intern.
GRANT SELECT ON public.ablage_ordner TO authenticated;
DROP POLICY IF EXISTS ablage_ordner_staff_select ON public.ablage_ordner;
CREATE POLICY ablage_ordner_staff_select ON public.ablage_ordner
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR ((SELECT public.is_admin_or_mitarbeiter())
        AND kooperation_id IN (SELECT private.rls_my_kooperation_ids()))
  );

-- Leselinks: wer die Kooperation sieht, sieht ihre Links. Anlegen nur über ablage-freigabe.
GRANT SELECT ON public.ablage_freigabelink TO authenticated;
DROP POLICY IF EXISTS ablage_freigabelink_select ON public.ablage_freigabelink;
CREATE POLICY ablage_freigabelink_select ON public.ablage_freigabelink
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR kooperation_id IN (SELECT private.rls_my_kooperation_ids())
  );

REVOKE EXECUTE ON FUNCTION public.ablage_lease_holen(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_lease_freigeben(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_delta_speichern(text, bigint, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_eingang_aufnehmen(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_eingang_holen(text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_eingang_abschliessen(text, text, bigint, text, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_geheimnis(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_geheimnis_setzen(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_pfad_umschreiben(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ablage_nachfahren(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION private.ablage_spalten_schutz() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ablage_lease_holen(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_lease_freigeben(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_delta_speichern(text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_eingang_aufnehmen(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_eingang_holen(text, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_eingang_abschliessen(text, text, bigint, text, text, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_geheimnis(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_geheimnis_setzen(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_pfad_umschreiben(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ablage_nachfahren(text, text) TO service_role;

COMMIT;
