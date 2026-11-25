-- Platzhalter sind Kooperationen ohne Creator. Sie zählen erst mit,
-- wenn creator_id gesetzt ist: Video-Decke, Auftragsstatus, Listenverbrauch.

ALTER TABLE public.kooperationen ALTER COLUMN creator_id DROP NOT NULL;

CREATE OR REPLACE VIEW public.produktion_verbrauch
WITH (security_invoker = true) AS
SELECT
  ko.produktion_id,
  SUM(kv.verkaufspreis_netto) AS budget_used
FROM public.kooperationen ko
JOIN public.kooperation_videos kv ON kv.kooperation_id = ko.id
WHERE ko.produktion_id IS NOT NULL
  AND ko.creator_id IS NOT NULL
GROUP BY ko.produktion_id;

GRANT SELECT ON public.produktion_verbrauch TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_video_verkaufspreis()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_produktion_id uuid;
  v_kampagne_id uuid;
  v_creator_id uuid;
  v_budget numeric;
  v_decke numeric;
  v_quelle text;
  v_used numeric;
  v_any_budget boolean;
BEGIN
  SELECT ko.produktion_id, ko.kampagne_id, ko.creator_id
    INTO v_produktion_id, v_kampagne_id, v_creator_id
  FROM public.kooperationen ko
  WHERE ko.id = NEW.kooperation_id;

  IF v_creator_id IS NULL OR v_produktion_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.budget
    INTO v_budget
  FROM public.produktion p
  WHERE p.id = v_produktion_id;

  SELECT COALESCE(SUM(kv.verkaufspreis_netto), 0)
    INTO v_used
  FROM public.kooperation_videos kv
  JOIN public.kooperationen ko ON ko.id = kv.kooperation_id
  WHERE ko.produktion_id = v_produktion_id
    AND ko.creator_id IS NOT NULL
    AND kv.id IS DISTINCT FROM NEW.id;

  v_used := v_used + COALESCE(NEW.verkaufspreis_netto, 0);

  IF v_budget IS NOT NULL THEN
    IF v_used > v_budget THEN
      RAISE EXCEPTION 'Verkaufspreis übersteigt das Produktionsbudget'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.produktion p
    WHERE p.kampagne_id = v_kampagne_id
      AND p.budget IS NOT NULL
  ) INTO v_any_budget;

  IF v_any_budget THEN
    RAISE EXCEPTION 'Produktion hat kein Produktionsbudget'
      USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(k.creator_budget, a.creator_budget, k.volumen),
    CASE
      WHEN COALESCE(k.creator_budget, a.creator_budget) IS NOT NULL THEN 'creator'
      ELSE 'volumen'
    END
    INTO v_decke, v_quelle
  FROM public.kampagne k
  LEFT JOIN public.auftrag a ON a.id = k.auftrag_id
  WHERE k.id = v_kampagne_id;

  IF v_decke IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(kv.verkaufspreis_netto), 0)
    INTO v_used
  FROM public.kooperation_videos kv
  JOIN public.kooperationen ko ON ko.id = kv.kooperation_id
  WHERE ko.kampagne_id = v_kampagne_id
    AND ko.creator_id IS NOT NULL
    AND kv.id IS DISTINCT FROM NEW.id;

  v_used := v_used + COALESCE(NEW.verkaufspreis_netto, 0);

  IF v_used > v_decke THEN
    IF v_quelle = 'creator' THEN
      RAISE EXCEPTION 'Verkaufspreis übersteigt das Creator-Budget der Kampagne'
        USING ERRCODE = '23514';
    END IF;
    RAISE EXCEPTION 'Verkaufspreis übersteigt das Volumen der Kampagne'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_produktion_budget_floor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_used numeric;
BEGIN
  IF NEW.budget IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(kv.verkaufspreis_netto), 0)
    INTO v_used
  FROM public.kooperation_videos kv
  JOIN public.kooperationen ko ON ko.id = kv.kooperation_id
  WHERE ko.produktion_id = NEW.id
    AND ko.creator_id IS NOT NULL;

  IF v_used > NEW.budget THEN
    RAISE EXCEPTION 'Produktionsbudget liegt unter dem Verbrauch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Die Listen- und Auftragsfunktionen weichen zwischen Umgebungen ab.
-- Nur die Verbrauchssumme wird ergänzt, der restliche Funktionskörper bleibt.
DO $$
DECLARE
  src text;
BEGIN
  src := pg_get_functiondef('public.get_kampagnen_list(integer, integer, text, jsonb)'::regprocedure);
  IF src NOT LIKE '%ko.creator_id IS NOT NULL%' THEN
    src := replace(
      src,
      'WHERE ko.kampagne_id = k.id',
      'WHERE ko.kampagne_id = k.id AND ko.creator_id IS NOT NULL'
    );
    EXECUTE src;
  END IF;

  IF to_regprocedure('public.refresh_auftrag_budget_status(uuid)') IS NOT NULL THEN
    src := pg_get_functiondef('public.refresh_auftrag_budget_status(uuid)'::regprocedure);
    IF src NOT LIKE '%ko.creator_id IS NOT NULL%' THEN
      src := replace(
        src,
        'WHERE k.auftrag_id = p_auftrag_id',
        'WHERE k.auftrag_id = p_auftrag_id AND ko.creator_id IS NOT NULL'
      );
      EXECUTE src;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
