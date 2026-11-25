-- Produktionen ohne eigenes Budget zehren am Creator-Budget der Kampagne.
-- Reihenfolge der Decke: kampagne.creator_budget, auftrag.creator_budget,
-- nur im Altbestand ohne Creator-Budget kampagne.volumen.

CREATE OR REPLACE FUNCTION public.guard_video_verkaufspreis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_produktion_id uuid;
  v_kampagne_id uuid;
  v_budget numeric;
  v_decke numeric;
  v_quelle text;
  v_used numeric;
  v_any_budget boolean;
BEGIN
  SELECT ko.produktion_id, ko.kampagne_id
    INTO v_produktion_id, v_kampagne_id
  FROM public.kooperationen ko
  WHERE ko.id = NEW.kooperation_id;

  IF v_produktion_id IS NULL THEN
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
