-- Medienablage: Abschluss nach dem Deploy, der Dropbox entfernt (ADR 0082). Ablage ist immer SharePoint.
-- Weg sind: Weiche je Unternehmen (ablage_ziel, dokument_ablage_ziel), kein_dropbox, die Notschalter,
-- der Bestandsumzug (Tabelle ablage_umzug und ihre RPCs) und die Staging-/Dropbox-Spalten der Creator-Jobs.
-- ablage = 'dropbox' an den Asset-Tabellen bleibt der Wert für "nicht in SharePoint" (Altbestand, nur Link).
-- Voraussetzung: 20261228 (staging_key nullable, ablage-Default der Creator-Jobs) und der Deploy.
--
-- ROLLBACK: nur strukturell. Die Spalten kommen mit ihren Defaults zurück, die Werte nicht:
--   ALTER TABLE unternehmen ADD COLUMN ablage_ziel text NOT NULL DEFAULT 'dropbox' CHECK (ablage_ziel IN ('dropbox','sharepoint')),
--     ADD COLUMN dokument_ablage_ziel text NOT NULL DEFAULT 'dropbox' CHECK (dokument_ablage_ziel IN ('dropbox','sharepoint')),
--     ADD COLUMN kein_dropbox boolean NOT NULL DEFAULT false;
--   Trigger trg_unternehmen_ablage_schutz, ablage_geruest_offen, ablage_umzug und die Umzug-/Stand-RPCs
--   aus 20261201, 20261202, 20261212 und 20261222 erneut ausführen.

BEGIN;

-- ─── Umzug ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.ablage_umzug_anlegen(text, uuid);
DROP FUNCTION IF EXISTS public.ablage_umzug_holen(text, integer);
DROP FUNCTION IF EXISTS public.ablage_umzug_fortschritt(text, uuid[]);
DROP FUNCTION IF EXISTS public.ablage_dokument_umzug_anlegen(text, uuid);
DROP FUNCTION IF EXISTS public.ablage_dokument_umzug_holen(text, integer);
DROP FUNCTION IF EXISTS public.ablage_unternehmen_stand(text);
DROP FUNCTION IF EXISTS public.ablage_dokumente_stand(text);
DROP TABLE IF EXISTS public.ablage_umzug;

-- ─── Notschalter ────────────────────────────────────────────

DELETE FROM public.ablage_einstellung WHERE schluessel IN ('notschalter', 'notschalter_dokumente');

-- ─── Fach-Gerüst ohne Weiche ────────────────────────────────

CREATE OR REPLACE FUNCTION public.ablage_geruest_offen(p_drive_id text, p_limit integer DEFAULT 5)
RETURNS TABLE(kooperation_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH offen AS (
    SELECT v.kooperation_id, v.created_at
    FROM kooperation_videos v
    WHERE NOT EXISTS (
      SELECT 1 FROM ablage_ordner o
      WHERE o.drive_id = p_drive_id AND o.art = 'video' AND o.typ = 'videos'
        AND o.kooperation_video_id = v.id AND o.item_id IS NOT NULL AND o.geloescht_at IS NULL
    )
    UNION ALL
    SELECT v.kooperation_id, s.created_at
    FROM kooperation_story s
    JOIN kooperation_videos v ON v.id = s.video_id
    WHERE NOT EXISTS (
      SELECT 1 FROM ablage_ordner o
      WHERE o.drive_id = p_drive_id AND o.art = 'story' AND o.typ = 'videos' AND o.version_number IS NULL
        AND o.kooperation_video_id = v.id AND o.story_nummer = s.slot_index
        AND o.item_id IS NOT NULL AND o.geloescht_at IS NULL
    )
  )
  SELECT o.kooperation_id
  FROM offen o
  JOIN kooperationen k ON k.id = o.kooperation_id
  JOIN kampagne ka ON ka.id = k.kampagne_id
  JOIN unternehmen u ON u.id = ka.unternehmen_id
  GROUP BY o.kooperation_id
  ORDER BY min(o.created_at)
  LIMIT p_limit
$function$;

REVOKE EXECUTE ON FUNCTION public.ablage_geruest_offen(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ablage_geruest_offen(text, integer) TO service_role;

-- ─── Weiche und kein_dropbox ────────────────────────────────

DROP TRIGGER IF EXISTS trg_unternehmen_ablage_schutz ON public.unternehmen;

-- Bleibt für das Microsoft-Konto der Benutzer (trg_benutzer_ablage_schutz).
CREATE OR REPLACE FUNCTION private.ablage_spalten_schutz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'benutzer' AND NEW.microsoft_konto IS DISTINCT FROM OLD.microsoft_konto THEN
    RAISE EXCEPTION 'Nur Admins ändern das Microsoft-Konto' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.unternehmen
  DROP COLUMN IF EXISTS ablage_ziel,
  DROP COLUMN IF EXISTS dokument_ablage_ziel,
  DROP COLUMN IF EXISTS kein_dropbox;

-- ─── Creator-Jobs ───────────────────────────────────────────

ALTER TABLE public.creator_upload_job
  DROP COLUMN IF EXISTS staging_key,
  DROP COLUMN IF EXISTS dropbox_path,
  DROP COLUMN IF EXISTS dropbox_save_job_id,
  DROP COLUMN IF EXISTS ablage;

COMMIT;
