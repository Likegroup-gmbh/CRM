-- Finale Version im Finder (ADR 0073): Spiegel-Kopie jeder Finalen Version, die nur ein Verweis auf
-- eine Datei der Feedbackschleife ist ("Als finale Version freigeben", Video-Freigabe durch den Kunden).
-- Die Final-Zeile behält die item_id der Quelle; die Kopie in Finale_Version/<Format> bzw. Story_K
-- führt allein ablage_final_spiegel. Der Abgleich ignoriert Kopien (kein zweites Asset).
--
-- Soll: Finale mit ablage = 'sharepoint', deren Datei nicht schon in einem Ordner Finale_Version liegt.
-- Direkt hochgeladene Finale liegen dort und brauchen keine Kopie.
-- Automatisch gespiegelt wird ab ablage_einstellung.final_spiegel_seit (= Zeitpunkt dieser
-- Migration). Den Bestand davor reiht die Admin-Seite ein ("Finale spiegeln", p_alle = true).
-- Zwei Minuten Wartezeit nach dem Markieren: "Rückgängig" der Kunden-Freigabe kopiert dann nichts.
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.ablage_final_spiegel_stand(text);
--   DROP FUNCTION IF EXISTS public.ablage_final_spiegel_holen(text, integer);
--   DROP FUNCTION IF EXISTS public.ablage_final_spiegel_scan(text, boolean);
--   DROP FUNCTION IF EXISTS private.ablage_final_soll(text);
--   DROP TABLE IF EXISTS public.ablage_final_spiegel;
--   DELETE FROM public.ablage_einstellung WHERE schluessel = 'final_spiegel_seit';
--   Kopien in SharePoint bleiben liegen; der Abgleich würde sie danach als direkt hochgeladene Finale einlesen.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ablage_final_spiegel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_id text NOT NULL,
  typ text NOT NULL CHECK (typ IN ('video', 'story', 'still')),
  -- Final-Zeile; kein FK: "Final aufheben" und "Rückgängig" löschen sie im Client, die Kopie räumt der Läufer
  asset_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'fertig', 'fehler', 'entfernt')),
  grund text,
  versuche integer NOT NULL DEFAULT 0,
  naechster_versuch timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis timestamptz,
  -- Stand der Quelle beim Kopieren: quell_ctag aus der Final-Zeile (Vergleich im Scan),
  -- kopie_von_ctag vom Item selbst (ob ein Re-Sync wirklich neue Bytes bringt)
  quell_item_id text,
  quell_ctag text,
  kopie_von_ctag text,
  groesse bigint,
  kopie_item_id text,
  kopie_parent_item_id text,
  kopie_name text,
  monitor_url text,
  -- Kopie vor dem Re-Sync: wird gelöscht, der Abgleich ignoriert sie bis dahin
  alt_kopie_item_id text,
  erstellt_at timestamptz NOT NULL DEFAULT now(),
  fertig_at timestamptz,
  UNIQUE (typ, asset_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_ablage_final_spiegel_kopie
  ON public.ablage_final_spiegel (drive_id, kopie_item_id) WHERE kopie_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_final_spiegel_alt
  ON public.ablage_final_spiegel (drive_id, alt_kopie_item_id) WHERE alt_kopie_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ablage_final_spiegel_laufend
  ON public.ablage_final_spiegel (drive_id, kopie_parent_item_id) WHERE kopie_item_id IS NULL AND status = 'offen';
CREATE INDEX IF NOT EXISTS idx_ablage_final_spiegel_offen
  ON public.ablage_final_spiegel (drive_id, naechster_versuch) WHERE status = 'offen';

ALTER TABLE public.ablage_final_spiegel ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ablage_final_spiegel FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ablage_final_spiegel TO service_role;

INSERT INTO public.ablage_einstellung (schluessel, wert)
VALUES ('final_spiegel_seit', to_jsonb(now()))
ON CONFLICT (schluessel) DO NOTHING;

-- Finale, die eine Kopie brauchen (gleiche Regel wie finalSpiegelSoll in final-spiegel.js)
CREATE OR REPLACE FUNCTION private.ablage_final_soll(p_drive_id text)
RETURNS TABLE (typ text, asset_id uuid, item_id text, ctag text, groesse bigint, erstellt_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'video'::text, x.id, x.item_id, x.ctag, x.file_size::bigint, x.created_at FROM kooperation_video_asset x
  WHERE x.is_final AND x.ablage = 'sharepoint' AND x.drive_id = p_drive_id AND x.item_id IS NOT NULL
    AND coalesce(x.file_path, '') !~* '/Finale[_ ]Version/'
  UNION ALL
  SELECT 'story', x.id, x.item_id, x.ctag, x.file_size::bigint, x.created_at FROM kooperation_story_asset x
  WHERE x.is_final AND x.ablage = 'sharepoint' AND x.drive_id = p_drive_id AND x.item_id IS NOT NULL
    AND coalesce(x.file_path, '') !~* '/Finale[_ ]Version/'
  UNION ALL
  SELECT 'still', x.id, x.item_id, x.ctag, x.file_size::bigint, x.created_at FROM kooperation_bilder_asset x
  WHERE x.is_final AND x.ablage = 'sharepoint' AND x.drive_id = p_drive_id AND x.item_id IS NOT NULL
    AND coalesce(x.file_path, '') !~* '/Finale[_ ]Version/'
$$;

REVOKE EXECUTE ON FUNCTION private.ablage_final_soll(text) FROM PUBLIC, anon, authenticated;

-- Warteschlange abgleichen: neue Finale einreihen, veraltete (Quelle ersetzt) und verwaiste
-- (Final aufgehoben, Datei weg) wieder öffnen. p_alle: auch Finale vor final_spiegel_seit,
-- dazu Fehler und im Finder gelöschte Kopien erneut. -> fällige offene Zeilen
CREATE OR REPLACE FUNCTION public.ablage_final_spiegel_scan(p_drive_id text, p_alle boolean DEFAULT false)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seit timestamptz;
  v_n integer;
BEGIN
  SELECT (e.wert #>> '{}')::timestamptz INTO v_seit FROM ablage_einstellung e WHERE e.schluessel = 'final_spiegel_seit';

  INSERT INTO ablage_final_spiegel (drive_id, typ, asset_id, groesse)
  SELECT p_drive_id, s.typ, s.asset_id, s.groesse
  FROM private.ablage_final_soll(p_drive_id) s
  WHERE s.erstellt_at <= now() - interval '2 minutes'
    AND (p_alle OR (v_seit IS NOT NULL AND s.erstellt_at >= v_seit))
  ON CONFLICT (typ, asset_id) DO NOTHING;

  -- Quelle ersetzt (neuer Inhalt) oder umgestellt (Umzug)
  UPDATE ablage_final_spiegel f
  SET status = 'offen', grund = 'veraltet', versuche = 0, naechster_versuch = now()
  FROM private.ablage_final_soll(p_drive_id) s
  WHERE f.drive_id = p_drive_id AND f.status = 'fertig' AND s.typ = f.typ AND s.asset_id = f.asset_id
    AND (s.item_id IS DISTINCT FROM f.quell_item_id OR (s.ctag IS NOT NULL AND s.ctag IS DISTINCT FROM f.quell_ctag));

  -- Ohne Kopie in SharePoint reicht es, die Zeile zu löschen
  WITH s AS MATERIALIZED (SELECT typ, asset_id FROM private.ablage_final_soll(p_drive_id))
  DELETE FROM ablage_final_spiegel f
  WHERE f.drive_id = p_drive_id AND f.status IN ('entfernt', 'fehler')
    AND f.kopie_item_id IS NULL AND f.alt_kopie_item_id IS NULL AND f.monitor_url IS NULL
    AND NOT EXISTS (SELECT 1 FROM s WHERE s.typ = f.typ AND s.asset_id = f.asset_id);

  WITH s AS MATERIALIZED (SELECT typ, asset_id FROM private.ablage_final_soll(p_drive_id))
  UPDATE ablage_final_spiegel f
  SET status = 'offen', grund = 'verwaist', versuche = 0, naechster_versuch = now()
  WHERE f.drive_id = p_drive_id AND f.status <> 'offen'
    AND NOT EXISTS (SELECT 1 FROM s WHERE s.typ = f.typ AND s.asset_id = f.asset_id);

  IF p_alle THEN
    UPDATE ablage_final_spiegel f
    SET status = 'offen', grund = NULL, versuche = 0, naechster_versuch = now()
    WHERE f.drive_id = p_drive_id AND f.status IN ('fehler', 'entfernt');
  END IF;

  SELECT count(*) INTO v_n FROM ablage_final_spiegel f
  WHERE f.drive_id = p_drive_id AND f.status = 'offen' AND f.naechster_versuch <= now()
    AND (f.gesperrt_bis IS NULL OR f.gesperrt_bis < now());
  RETURN v_n;
END $$;

REVOKE EXECUTE ON FUNCTION public.ablage_final_spiegel_scan(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_final_spiegel_scan(text, boolean) TO service_role;

-- Nächste offene Zeile (mehrere Läufer möglich: SKIP LOCKED + Sperrfrist)
CREATE OR REPLACE FUNCTION public.ablage_final_spiegel_holen(p_drive_id text, p_sekunden integer DEFAULT 600)
RETURNS SETOF public.ablage_final_spiegel
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE ablage_final_spiegel u
  SET gesperrt_bis = now() + make_interval(secs => p_sekunden)
  WHERE u.id = (
    SELECT x.id
    FROM ablage_final_spiegel x
    WHERE x.drive_id = p_drive_id AND x.status = 'offen' AND x.naechster_versuch <= now()
      AND (x.gesperrt_bis IS NULL OR x.gesperrt_bis < now())
    ORDER BY x.naechster_versuch, x.id
    LIMIT 1
    FOR UPDATE OF x SKIP LOCKED
  )
  RETURNING u.*
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_final_spiegel_holen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_final_spiegel_holen(text, integer) TO service_role;

-- Admin-Seite und Trockenlauf: Warteschlange plus Finale ohne Spiegel-Zeile (Bestand vor dem Stichtag)
CREATE OR REPLACE FUNCTION public.ablage_final_spiegel_stand(p_drive_id text)
RETURNS TABLE (
  offen bigint, fertig bigint, fehler bigint, entfernt bigint,
  ohne_kopie bigint, ohne_kopie_bytes bigint, kopie_bytes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (SELECT * FROM private.ablage_final_soll(p_drive_id)),
  f AS (SELECT * FROM ablage_final_spiegel WHERE drive_id = p_drive_id)
  SELECT
    (SELECT count(*) FROM f WHERE f.status = 'offen'),
    (SELECT count(*) FROM f WHERE f.status = 'fertig'),
    (SELECT count(*) FROM f WHERE f.status = 'fehler'),
    (SELECT count(*) FROM f WHERE f.status = 'entfernt'),
    (SELECT count(*) FROM s WHERE NOT EXISTS (SELECT 1 FROM f WHERE f.typ = s.typ AND f.asset_id = s.asset_id)),
    (SELECT coalesce(sum(s.groesse), 0)::bigint FROM s WHERE NOT EXISTS (SELECT 1 FROM f WHERE f.typ = s.typ AND f.asset_id = s.asset_id)),
    (SELECT coalesce(sum(f.groesse), 0)::bigint FROM f WHERE f.status = 'fertig')
$$;

REVOKE EXECUTE ON FUNCTION public.ablage_final_spiegel_stand(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_final_spiegel_stand(text) TO service_role;

COMMIT;
