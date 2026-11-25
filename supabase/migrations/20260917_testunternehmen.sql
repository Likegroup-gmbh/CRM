-- Testunternehmen: Flag am Unternehmen, nach dem Anlegen eingefroren.
-- Sichtbarkeit nur Admin (RESTRICTIVE, damit investor_select und
-- mitarbeiter-SELECT nicht leaken). Kind-Tabellen via information_schema.

BEGIN;

ALTER TABLE public.unternehmen
  ADD COLUMN IF NOT EXISTS ist_test boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.unternehmen.ist_test IS
  'Testunternehmen: nur Admins sehen den Unterbaum; nie in Investor-Zahlen.';

CREATE OR REPLACE FUNCTION public.testunternehmen_ok(p_unternehmen_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_unternehmen_id IS NULL THEN true
    WHEN (SELECT is_admin()) THEN true
    ELSE COALESCE(
      (SELECT NOT u.ist_test FROM public.unternehmen u WHERE u.id = p_unternehmen_id),
      true
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_marke(p_marke_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT m.unternehmen_id FROM public.marke m WHERE m.id = p_marke_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_auftrag(p_auftrag_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT a.unternehmen_id FROM public.auftrag a WHERE a.id = p_auftrag_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_kampagne(p_kampagne_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    COALESCE(
      (SELECT k.unternehmen_id FROM public.kampagne k WHERE k.id = p_kampagne_id),
      (SELECT a.unternehmen_id
         FROM public.kampagne k
         JOIN public.auftrag a ON a.id = k.auftrag_id
        WHERE k.id = p_kampagne_id)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_kooperation(p_kooperation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok_kampagne(
    (SELECT k.kampagne_id FROM public.kooperationen k WHERE k.id = p_kooperation_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_casting(p_creator_auswahl_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT c.unternehmen_id FROM public.creator_auswahl c WHERE c.id = p_creator_auswahl_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_strategie(p_strategie_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT s.unternehmen_id FROM public.strategie s WHERE s.id = p_strategie_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_skript(p_skript_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT s.unternehmen_id FROM public.skripte s WHERE s.id = p_skript_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_produkt(p_produkt_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT p.unternehmen_id FROM public.produkt p WHERE p.id = p_produkt_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_persona(p_persona_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT p.unternehmen_id FROM public.personas p WHERE p.id = p_persona_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_briefing(p_briefing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok(
    (SELECT b.unternehmen_id FROM public.campaign_briefings b WHERE b.id = p_briefing_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_video(p_video_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.testunternehmen_ok_kooperation(
    (SELECT v.kooperation_id FROM public.kooperation_videos v WHERE v.id = p_video_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.testunternehmen_ok_entity(p_type text, p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE lower(coalesce(p_type, ''))
    WHEN 'unternehmen' THEN public.testunternehmen_ok(p_id)
    WHEN 'marke' THEN public.testunternehmen_ok_marke(p_id)
    WHEN 'auftrag' THEN public.testunternehmen_ok_auftrag(p_id)
    WHEN 'kampagne' THEN public.testunternehmen_ok_kampagne(p_id)
    WHEN 'kooperation' THEN public.testunternehmen_ok_kooperation(p_id)
    WHEN 'kooperationen' THEN public.testunternehmen_ok_kooperation(p_id)
    WHEN 'creator_auswahl' THEN public.testunternehmen_ok_casting(p_id)
    WHEN 'casting' THEN public.testunternehmen_ok_casting(p_id)
    WHEN 'strategie' THEN public.testunternehmen_ok_strategie(p_id)
    WHEN 'skript' THEN public.testunternehmen_ok_skript(p_id)
    WHEN 'skripte' THEN public.testunternehmen_ok_skript(p_id)
    WHEN 'produkt' THEN public.testunternehmen_ok_produkt(p_id)
    WHEN 'persona' THEN public.testunternehmen_ok_persona(p_id)
    WHEN 'personas' THEN public.testunternehmen_ok_persona(p_id)
    WHEN 'briefing' THEN public.testunternehmen_ok_briefing(p_id)
    WHEN 'campaign_briefings' THEN public.testunternehmen_ok_briefing(p_id)
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.testunternehmen_ok(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_marke(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_auftrag(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_kampagne(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_kooperation(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_casting(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_strategie(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_skript(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_produkt(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_persona(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_briefing(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_video(uuid) FROM public;
REVOKE ALL ON FUNCTION public.testunternehmen_ok_entity(text, uuid) FROM public;

GRANT EXECUTE ON FUNCTION public.testunternehmen_ok(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_marke(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_auftrag(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_kampagne(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_kooperation(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_casting(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_strategie(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_skript(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_produkt(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_persona(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_briefing(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_video(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.testunternehmen_ok_entity(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.unternehmen_ist_test_freeze()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ist_test IS DISTINCT FROM OLD.ist_test THEN
    RAISE EXCEPTION 'ist_test ist nach dem Anlegen unveränderbar';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unternehmen_ist_test_freeze ON public.unternehmen;
CREATE TRIGGER unternehmen_ist_test_freeze
  BEFORE UPDATE ON public.unternehmen
  FOR EACH ROW
  EXECUTE FUNCTION public.unternehmen_ist_test_freeze();

DROP POLICY IF EXISTS testunternehmen_hide ON public.unternehmen;
CREATE POLICY testunternehmen_hide ON public.unternehmen
  AS RESTRICTIVE
  FOR SELECT
  TO public
  USING ((NOT ist_test) OR (SELECT is_admin()));

DROP POLICY IF EXISTS testunternehmen_insert ON public.unternehmen;
CREATE POLICY testunternehmen_insert ON public.unternehmen
  AS RESTRICTIVE
  FOR INSERT
  TO public
  WITH CHECK ((NOT ist_test) OR (SELECT is_admin()));

DO $$
DECLARE
  r record;
  cols text[];
  expr text;
BEGIN
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT IN (
        'unternehmen', 'creator', 'ansprechpartner', 'benutzer'
      )
  LOOP
    SELECT coalesce(array_agg(c.column_name::text), ARRAY[]::text[])
    INTO cols
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.table_name;

    expr := NULL;
    IF 'unternehmen_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok(unternehmen_id))';
    ELSIF 'kunde_unternehmen_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok(kunde_unternehmen_id))';
    ELSIF 'auftrag_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_auftrag(auftrag_id))';
    ELSIF 'kampagne_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_kampagne(kampagne_id))';
    ELSIF 'marke_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_marke(marke_id))';
    ELSIF 'kooperation_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_kooperation(kooperation_id))';
    ELSIF 'creator_auswahl_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_casting(creator_auswahl_id))';
    ELSIF 'strategie_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_strategie(strategie_id))';
    ELSIF 'skript_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_skript(skript_id))';
    ELSIF 'produkt_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_produkt(produkt_id))';
    ELSIF 'persona_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_persona(persona_id))';
    ELSIF 'briefing_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_briefing(briefing_id))';
    ELSIF 'campaign_briefing_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_briefing(campaign_briefing_id))';
    ELSIF 'video_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_video(video_id))';
    ELSIF 'entity_type' = ANY (cols) AND 'entity_id' = ANY (cols) THEN
      expr := '(SELECT testunternehmen_ok_entity(entity_type, entity_id))';
    END IF;

    IF expr IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      EXECUTE format('DROP POLICY IF EXISTS testunternehmen_hide ON public.%I', r.table_name);
      EXECUTE format(
        'CREATE POLICY testunternehmen_hide ON public.%I AS RESTRICTIVE FOR ALL TO public USING (%s) WITH CHECK (%s)',
        r.table_name, expr, expr
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'testunternehmen_hide skip %: %', r.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

COMMIT;
