-- Teams-Meldungen bei Video-Kommentaren der Kundenseite (ADR 0066).
--
-- teams_kanal hält Name und Workflow-URL eines Teams-Kanals, teams_kanal_unternehmen die
-- abgedeckten Unternehmen. Ein Trigger auf kooperation_video_zeitkommentar legt je passendem
-- aktivem Kanal eine Zeile in der Outbox teams_meldung an; verschickt wird sie von der
-- Netlify-Function (teams-meldung-senden bzw. teams-meldung-zeitplan) über
-- teams_meldungen_holen.
--
-- Entfernen (deleted_at gesetzt): noch offene Meldungen fallen weg, für gesendete oder
-- gerade versendete entsteht art = 'entfernt'. txid bündelt sie: das Löschen einer Datei
-- entfernt alle ihre Kommentare in einer Transaktion (assetDelete.js).
--
-- Die Webhook-URL ist ein Geheimnis: Kanaltabellen nur für Admins, Outbox nur lesend.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_teams_meldung ON public.kooperation_video_zeitkommentar;
--   DROP FUNCTION IF EXISTS public.teams_meldung_vormerken();
--   DROP FUNCTION IF EXISTS public.teams_meldungen_holen(integer, integer);
--   DROP TABLE IF EXISTS public.teams_meldung;
--   DROP TABLE IF EXISTS public.teams_kanal_unternehmen;
--   DROP TABLE IF EXISTS public.teams_kanal;

BEGIN;

CREATE TABLE IF NOT EXISTS public.teams_kanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  webhook_url text NOT NULL CHECK (webhook_url ~ '^https://'),
  aktiv boolean NOT NULL DEFAULT true,
  letzte_meldung_at timestamptz,
  letzter_fehler text,
  letzter_fehler_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.teams_kanal_unternehmen (
  kanal_id uuid NOT NULL REFERENCES public.teams_kanal(id) ON DELETE CASCADE,
  unternehmen_id uuid NOT NULL REFERENCES public.unternehmen(id) ON DELETE CASCADE,
  PRIMARY KEY (kanal_id, unternehmen_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_kanal_unternehmen_unternehmen
  ON public.teams_kanal_unternehmen (unternehmen_id);

CREATE TABLE IF NOT EXISTS public.teams_meldung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kanal_id uuid NOT NULL REFERENCES public.teams_kanal(id) ON DELETE CASCADE,
  art text NOT NULL CHECK (art IN ('kommentar', 'entfernt')),
  zeitkommentar_id uuid NOT NULL REFERENCES public.kooperation_video_zeitkommentar(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'in_arbeit', 'gesendet', 'fehler')),
  versuche integer NOT NULL DEFAULT 0,
  naechster_versuch timestamptz NOT NULL DEFAULT now(),
  gesperrt_bis timestamptz,
  fehler text,
  txid bigint NOT NULL DEFAULT txid_current(),
  created_at timestamptz NOT NULL DEFAULT now(),
  gesendet_at timestamptz,
  CONSTRAINT teams_meldung_einmal UNIQUE (kanal_id, zeitkommentar_id, art)
);

CREATE INDEX IF NOT EXISTS idx_teams_meldung_faellig
  ON public.teams_meldung (naechster_versuch)
  WHERE status IN ('offen', 'in_arbeit');
CREATE INDEX IF NOT EXISTS idx_teams_meldung_zeitkommentar
  ON public.teams_meldung (zeitkommentar_id);

-- ─── Rechte ─────────────────────────────────────────────────

ALTER TABLE public.teams_kanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_kanal_unternehmen ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams_meldung ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.teams_kanal, public.teams_kanal_unternehmen, public.teams_meldung FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams_kanal, public.teams_kanal_unternehmen TO authenticated;
GRANT SELECT ON public.teams_meldung TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams_kanal, public.teams_kanal_unternehmen, public.teams_meldung TO service_role;

DROP POLICY IF EXISTS teams_kanal_admin ON public.teams_kanal;
CREATE POLICY teams_kanal_admin ON public.teams_kanal
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS teams_kanal_unternehmen_admin ON public.teams_kanal_unternehmen;
CREATE POLICY teams_kanal_unternehmen_admin ON public.teams_kanal_unternehmen
  FOR ALL TO authenticated
  USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()));

DROP POLICY IF EXISTS teams_meldung_admin_select ON public.teams_meldung;
CREATE POLICY teams_meldung_admin_select ON public.teams_meldung
  FOR SELECT TO authenticated USING ((SELECT public.is_admin()));

-- ─── Vormerken ──────────────────────────────────────────────
-- SECURITY DEFINER: Kunden und Gäste schreiben den Kommentar, dürfen die Kanäle aber nicht lesen.
-- Das Unternehmen kommt aus der Kampagne (sonst ihrer Marke), sonst aus der Kooperation.

CREATE OR REPLACE FUNCTION public.teams_meldung_vormerken()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_unternehmen uuid;
BEGIN
  IF NEW.feedback_typ IS DISTINCT FROM 'kunde' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.deleted_at IS NOT NULL THEN
      RETURN NULL;
    END IF;

    SELECT coalesce(ka.unternehmen_id, m.unternehmen_id, k.unternehmen_id)
      INTO v_unternehmen
      FROM public.kooperation_videos v
      JOIN public.kooperationen k ON k.id = v.kooperation_id
      LEFT JOIN public.kampagne ka ON ka.id = k.kampagne_id
      LEFT JOIN public.marke m ON m.id = ka.marke_id
     WHERE v.id = NEW.video_id;

    IF v_unternehmen IS NULL THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.teams_meldung (kanal_id, art, zeitkommentar_id)
    SELECT ku.kanal_id, 'kommentar', NEW.id
      FROM public.teams_kanal_unternehmen ku
      JOIN public.teams_kanal t ON t.id = ku.kanal_id
     WHERE ku.unternehmen_id = v_unternehmen
       AND t.aktiv
    ON CONFLICT ON CONSTRAINT teams_meldung_einmal DO NOTHING;
    RETURN NULL;
  END IF;

  IF OLD.deleted_at IS NOT NULL OR NEW.deleted_at IS NULL THEN
    RETURN NULL;
  END IF;

  DELETE FROM public.teams_meldung
   WHERE zeitkommentar_id = NEW.id AND art = 'kommentar' AND status = 'offen';

  INSERT INTO public.teams_meldung (kanal_id, art, zeitkommentar_id)
  SELECT m.kanal_id, 'entfernt', NEW.id
    FROM public.teams_meldung m
   WHERE m.zeitkommentar_id = NEW.id
     AND m.art = 'kommentar'
     AND m.status IN ('in_arbeit', 'gesendet')
  ON CONFLICT ON CONSTRAINT teams_meldung_einmal DO NOTHING;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.teams_meldung_vormerken() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_teams_meldung ON public.kooperation_video_zeitkommentar;
CREATE TRIGGER trg_teams_meldung
  AFTER INSERT OR UPDATE OF deleted_at ON public.kooperation_video_zeitkommentar
  FOR EACH ROW EXECUTE FUNCTION public.teams_meldung_vormerken();

-- ─── Holen ──────────────────────────────────────────────────
-- Fällige Zeilen mit Lease übernehmen. SKIP LOCKED: zwei gleichzeitige Läufe (Anstoß aus dem
-- Browser und Zeitplan) bekommen verschiedene Zeilen. Eine abgelaufene Lease (Function
-- abgebrochen) gibt die Zeile wieder frei.

CREATE OR REPLACE FUNCTION public.teams_meldungen_holen(
  p_limit integer DEFAULT 50,
  p_lease_sek integer DEFAULT 120
)
RETURNS SETOF public.teams_meldung
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH k AS (
    SELECT m.id
      FROM public.teams_meldung m
     WHERE (m.status = 'offen' AND m.naechster_versuch <= now())
        OR (m.status = 'in_arbeit' AND m.gesperrt_bis < now())
     ORDER BY m.created_at
     LIMIT p_limit
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.teams_meldung m
     SET status = 'in_arbeit',
         gesperrt_bis = now() + make_interval(secs => p_lease_sek)
    FROM k
   WHERE m.id = k.id
  RETURNING m.*
$$;

REVOKE EXECUTE ON FUNCTION public.teams_meldungen_holen(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teams_meldungen_holen(integer, integer) TO service_role;

COMMIT;
