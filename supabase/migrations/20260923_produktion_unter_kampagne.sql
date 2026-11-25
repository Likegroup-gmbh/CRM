-- Produktion: Zwischenebene unter der Kampagne.
-- Eine Bestandskampagne bekommt genau eine Produktion. Kinder behalten kampagne_id
-- (immer die Kampagne der Produktion) und bekommen produktion_id zum Filtern.

BEGIN;

CREATE TABLE IF NOT EXISTS public.produktion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kampagne_id uuid NOT NULL REFERENCES public.kampagne(id) ON DELETE CASCADE,
  produkt_id uuid REFERENCES public.produkt(id) ON DELETE SET NULL,
  briefing_id uuid REFERENCES public.campaign_briefings(id) ON DELETE RESTRICT,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.produktion IS
  'Lauf unter einer Kampagne für ein Produkt. Budget und Soll bleiben an der Kampagne.';

CREATE UNIQUE INDEX IF NOT EXISTS produktion_briefing_id_key
  ON public.produktion (briefing_id)
  WHERE briefing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS produktion_kampagne_id_idx ON public.produktion (kampagne_id);
CREATE INDEX IF NOT EXISTS produktion_produkt_id_idx ON public.produktion (produkt_id);

DROP TRIGGER IF EXISTS produktion_updated_at ON public.produktion;
CREATE TRIGGER produktion_updated_at
  BEFORE UPDATE ON public.produktion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.creator_auswahl
  ADD COLUMN IF NOT EXISTS produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL;
ALTER TABLE public.strategie
  ADD COLUMN IF NOT EXISTS produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL;
ALTER TABLE public.skripte
  ADD COLUMN IF NOT EXISTS produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL;
ALTER TABLE public.vertraege
  ADD COLUMN IF NOT EXISTS produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL;
ALTER TABLE public.kooperationen
  ADD COLUMN IF NOT EXISTS produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS creator_auswahl_produktion_id_idx ON public.creator_auswahl (produktion_id);
CREATE INDEX IF NOT EXISTS strategie_produktion_id_idx ON public.strategie (produktion_id);
CREATE INDEX IF NOT EXISTS skripte_produktion_id_idx ON public.skripte (produktion_id);
CREATE INDEX IF NOT EXISTS vertraege_produktion_id_idx ON public.vertraege (produktion_id);
CREATE INDEX IF NOT EXISTS kooperationen_produktion_id_idx ON public.kooperationen (produktion_id);

INSERT INTO public.produktion (kampagne_id, name)
SELECT k.id,
       COALESCE(NULLIF(btrim(k.eigener_name), ''), NULLIF(btrim(k.kampagnenname), ''), 'Produktion')
FROM public.kampagne k
WHERE NOT EXISTS (
  SELECT 1 FROM public.produktion p WHERE p.kampagne_id = k.id
);

UPDATE public.creator_auswahl c
   SET produktion_id = p.id
  FROM public.produktion p
 WHERE c.kampagne_id = p.kampagne_id
   AND c.produktion_id IS NULL;

UPDATE public.strategie s
   SET produktion_id = p.id
  FROM public.produktion p
 WHERE s.kampagne_id = p.kampagne_id
   AND s.produktion_id IS NULL;

UPDATE public.skripte s
   SET produktion_id = p.id
  FROM public.produktion p
 WHERE s.kampagne_id = p.kampagne_id
   AND s.produktion_id IS NULL;

UPDATE public.vertraege v
   SET produktion_id = p.id
  FROM public.produktion p
 WHERE v.kampagne_id = p.kampagne_id
   AND v.produktion_id IS NULL;

UPDATE public.kooperationen k
   SET produktion_id = p.id
  FROM public.produktion p
 WHERE k.kampagne_id = p.kampagne_id
   AND k.produktion_id IS NULL;

CREATE OR REPLACE FUNCTION public.sync_kampagne_id_from_produktion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_kampagne uuid;
BEGIN
  IF NEW.produktion_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT kampagne_id INTO v_kampagne
    FROM public.produktion
   WHERE id = NEW.produktion_id;
  IF v_kampagne IS NOT NULL THEN
    NEW.kampagne_id := v_kampagne;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS creator_auswahl_sync_kampagne ON public.creator_auswahl;
CREATE TRIGGER creator_auswahl_sync_kampagne
  BEFORE INSERT OR UPDATE OF produktion_id ON public.creator_auswahl
  FOR EACH ROW EXECUTE FUNCTION public.sync_kampagne_id_from_produktion();

DROP TRIGGER IF EXISTS strategie_sync_kampagne ON public.strategie;
CREATE TRIGGER strategie_sync_kampagne
  BEFORE INSERT OR UPDATE OF produktion_id ON public.strategie
  FOR EACH ROW EXECUTE FUNCTION public.sync_kampagne_id_from_produktion();

DROP TRIGGER IF EXISTS skripte_sync_kampagne ON public.skripte;
CREATE TRIGGER skripte_sync_kampagne
  BEFORE INSERT OR UPDATE OF produktion_id ON public.skripte
  FOR EACH ROW EXECUTE FUNCTION public.sync_kampagne_id_from_produktion();

DROP TRIGGER IF EXISTS vertraege_sync_kampagne ON public.vertraege;
CREATE TRIGGER vertraege_sync_kampagne
  BEFORE INSERT OR UPDATE OF produktion_id ON public.vertraege
  FOR EACH ROW EXECUTE FUNCTION public.sync_kampagne_id_from_produktion();

DROP TRIGGER IF EXISTS kooperationen_sync_kampagne ON public.kooperationen;
CREATE TRIGGER kooperationen_sync_kampagne
  BEFORE INSERT OR UPDATE OF produktion_id ON public.kooperationen
  FOR EACH ROW EXECUTE FUNCTION public.sync_kampagne_id_from_produktion();

CREATE OR REPLACE FUNCTION public.sync_produktion_line_names()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.aktivierung_name IS NOT DISTINCT FROM OLD.aktivierung_name THEN
    RETURN NEW;
  END IF;

  UPDATE public.produktion
     SET name = COALESCE(NEW.aktivierung_name, '')
   WHERE briefing_id = NEW.id;

  UPDATE public.creator_auswahl
     SET name = NEW.aktivierung_name || ' Casting'
   WHERE briefing_id = NEW.id
     AND produktion_id IS NOT NULL;

  UPDATE public.strategie
     SET name = NEW.aktivierung_name || ' Konzept'
   WHERE briefing_id = NEW.id
     AND produktion_id IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_briefings_sync_line_names ON public.campaign_briefings;
CREATE TRIGGER campaign_briefings_sync_line_names
  AFTER UPDATE OF aktivierung_name ON public.campaign_briefings
  FOR EACH ROW EXECUTE FUNCTION public.sync_produktion_line_names();

ALTER TABLE public.produktion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produktion_select ON public.produktion;
CREATE POLICY produktion_select ON public.produktion
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.kampagne k WHERE k.id = produktion.kampagne_id)
  );

DROP POLICY IF EXISTS produktion_insert ON public.produktion;
CREATE POLICY produktion_insert ON public.produktion
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produktion_update ON public.produktion;
CREATE POLICY produktion_update ON public.produktion
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS produktion_delete ON public.produktion;
CREATE POLICY produktion_delete ON public.produktion
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produktion TO authenticated, service_role;

COMMIT;
