-- Strategie-/Notiz-Dokument pro Entitaet (Unternehmen, Marke, spaeter weitere).
-- Eine Row je Entity; Sektionen liegen als jsonb, damit neue Seiten ohne Schema-Aenderung andocken.

CREATE TABLE public.entity_dokumente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('unternehmen', 'marke')),
  entity_id uuid NOT NULL,
  sektionen jsonb NOT NULL DEFAULT '{}'::jsonb,
  ki_stand timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX idx_entity_dokumente_entity ON public.entity_dokumente (entity_type, entity_id);

CREATE TRIGGER entity_dokumente_updated_at
  BEFORE UPDATE ON public.entity_dokumente
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.entity_dokumente ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_dokumente_select ON public.entity_dokumente
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY entity_dokumente_insert ON public.entity_dokumente
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY entity_dokumente_update ON public.entity_dokumente
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY entity_dokumente_delete ON public.entity_dokumente
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.entity_dokumente;

-- Atomarer Patch einer Sektion, damit KI-Upsert und manuelles Edit nicht das ganze jsonb ueberschreiben.
CREATE OR REPLACE FUNCTION public.patch_entity_dokument_sektion(
  p_entity_type text,
  p_entity_id uuid,
  p_feld text,
  p_text text
) RETURNS public.entity_dokumente
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result public.entity_dokumente;
BEGIN
  IF p_entity_type NOT IN ('unternehmen', 'marke') THEN
    RAISE EXCEPTION 'Ungueltiger entity_type';
  END IF;
  IF p_feld NOT IN ('kampagnenstrategie', 'todos', 'offene_punkte', 'empfehlungen', 'notizen') THEN
    RAISE EXCEPTION 'Ungueltiges Feld';
  END IF;

  INSERT INTO public.entity_dokumente (entity_type, entity_id, sektionen, updated_by)
  VALUES (
    p_entity_type,
    p_entity_id,
    jsonb_build_object(p_feld, COALESCE(p_text, '')),
    auth.uid()
  )
  ON CONFLICT (entity_type, entity_id) DO UPDATE
    SET sektionen = COALESCE(entity_dokumente.sektionen, '{}'::jsonb)
                    || jsonb_build_object(p_feld, COALESCE(p_text, '')),
        updated_by = auth.uid()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.patch_entity_dokument_sektion(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.patch_entity_dokument_sektion(text, uuid, text, text) TO authenticated;
