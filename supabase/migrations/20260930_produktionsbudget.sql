-- Produktionsbudget: Anteil am Kampagnen-Volumen, gesetzt vor dem Briefing.
-- Leer heißt, die Produktion teilt sich das Volumen mit den anderen ohne Budget.

ALTER TABLE public.produktion
  ADD COLUMN IF NOT EXISTS budget numeric;

ALTER TABLE public.produktion
  DROP CONSTRAINT IF EXISTS produktion_budget_positiv;

ALTER TABLE public.produktion
  ADD CONSTRAINT produktion_budget_positiv
  CHECK (budget IS NULL OR budget > 0);

COMMENT ON TABLE public.produktion IS
  'Lauf unter einer Kampagne. budget ist das Produktionsbudget, leer heißt gemeinsamer Topf.';

COMMENT ON COLUMN public.produktion.budget IS
  'Produktionsbudget aus dem Volumen der Kampagne. NULL = kein eigenes Budget.';

ALTER TABLE public.campaign_briefings
  ADD COLUMN IF NOT EXISTS ziel_produktion_id uuid
  REFERENCES public.produktion(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.campaign_briefings.ziel_produktion_id IS
  'Gewählte Produktion am Entwurf. Gebunden wird produktion.briefing_id erst beim Finalisieren.';

CREATE INDEX IF NOT EXISTS campaign_briefings_ziel_produktion_id_idx
  ON public.campaign_briefings (ziel_produktion_id);

CREATE OR REPLACE FUNCTION public.guard_video_verkaufspreis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_produktion_id uuid;
  v_kampagne_id uuid;
  v_budget numeric;
  v_volumen numeric;
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

  SELECT k.volumen
    INTO v_volumen
  FROM public.kampagne k
  WHERE k.id = v_kampagne_id;

  IF v_volumen IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(kv.verkaufspreis_netto), 0)
    INTO v_used
  FROM public.kooperation_videos kv
  JOIN public.kooperationen ko ON ko.id = kv.kooperation_id
  WHERE ko.kampagne_id = v_kampagne_id
    AND kv.id IS DISTINCT FROM NEW.id;

  v_used := v_used + COALESCE(NEW.verkaufspreis_netto, 0);

  IF v_used > v_volumen THEN
    RAISE EXCEPTION 'Verkaufspreis übersteigt das Volumen der Kampagne'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kooperation_videos_guard_verkaufspreis ON public.kooperation_videos;
CREATE TRIGGER kooperation_videos_guard_verkaufspreis
  BEFORE INSERT OR UPDATE OF verkaufspreis_netto ON public.kooperation_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_video_verkaufspreis();

CREATE OR REPLACE FUNCTION public.guard_produktion_budget_floor()
RETURNS trigger
LANGUAGE plpgsql
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
  WHERE ko.produktion_id = NEW.id;

  IF v_used > NEW.budget THEN
    RAISE EXCEPTION 'Produktionsbudget liegt unter dem Verbrauch'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS produktion_guard_budget_floor ON public.produktion;
CREATE TRIGGER produktion_guard_budget_floor
  BEFORE INSERT OR UPDATE OF budget ON public.produktion
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_produktion_budget_floor();

CREATE OR REPLACE FUNCTION public.guard_produktion_mit_briefing()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.briefing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Produktion mit Briefing kann nicht gelöscht werden'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS produktion_guard_delete_mit_briefing ON public.produktion;
CREATE TRIGGER produktion_guard_delete_mit_briefing
  BEFORE DELETE ON public.produktion
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_produktion_mit_briefing();
