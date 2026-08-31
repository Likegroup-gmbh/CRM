-- Feedback-Panel im Skript-Editor: Kommentar-Threads an markierten Textstellen.
-- Ein Thread ist eine Root-Zeile (parent_id IS NULL), Antworten haengen per
-- parent_id daran (eine Ebene). Anders als skript_chat_messages (staff-only,
-- AI-Jobs) duerfen Kunden hier lesen UND schreiben.

CREATE TABLE IF NOT EXISTS public.skript_kommentare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skript_id uuid NOT NULL REFERENCES skripte(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.skript_kommentare(id) ON DELETE CASCADE,
  sektion varchar CHECK (sektion IN ('hook','hauptteil','cta','gesamt')),
  ist_visuell boolean NOT NULL DEFAULT false,
  selektion_text text,
  inhalt text NOT NULL,
  erledigt_at timestamptz,
  erledigt_von uuid REFERENCES benutzer(id) ON DELETE SET NULL,
  created_by uuid REFERENCES benutzer(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skript_kommentare_skript
  ON public.skript_kommentare (skript_id, created_at);
CREATE INDEX IF NOT EXISTS idx_skript_kommentare_parent
  ON public.skript_kommentare (parent_id);

CREATE TRIGGER skript_kommentare_updated_at
  BEFORE UPDATE ON public.skript_kommentare
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- RLS: Sichtbarkeit erbt vom Parent-Skript. Dessen eigene SELECT-Policy
-- bildet den Kunden-Scope (Unternehmen/Marke/Kampagne) bereits ab, der
-- EXISTS-Check laeuft also automatisch dagegen - wie bei skript_versionen.
-- =====================================================================
ALTER TABLE public.skript_kommentare ENABLE ROW LEVEL SECURITY;

CREATE POLICY skript_kommentare_select ON public.skript_kommentare
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_kommentare.skript_id)
  );

CREATE POLICY skript_kommentare_insert ON public.skript_kommentare
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT get_current_benutzer_id())
    AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_kommentare.skript_id)
  );

CREATE POLICY skript_kommentare_update ON public.skript_kommentare
  FOR UPDATE TO authenticated
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR created_by = (SELECT get_current_benutzer_id())
  )
  WITH CHECK (
    (SELECT is_admin_or_mitarbeiter())
    OR created_by = (SELECT get_current_benutzer_id())
  );

CREATE POLICY skript_kommentare_delete ON public.skript_kommentare
  FOR DELETE TO authenticated
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR created_by = (SELECT get_current_benutzer_id())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.skript_kommentare;

-- =====================================================================
-- Erledigt-Toggle: bewusst als RPC statt ueber die UPDATE-Policy, damit
-- "nur intern" serverseitig gilt - der Kunde darf seinen eigenen Kommentar
-- bearbeiten, aber nichts abhaken.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_skript_kommentar_erledigt(
  p_id uuid,
  p_erledigt boolean
) RETURNS public.skript_kommentare
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.skript_kommentare;
BEGIN
  IF NOT (SELECT is_admin_or_mitarbeiter()) THEN
    RAISE EXCEPTION 'Nur Mitarbeiter duerfen Feedback als erledigt markieren';
  END IF;

  UPDATE public.skript_kommentare
     SET erledigt_at = CASE WHEN p_erledigt THEN now() ELSE NULL END,
         erledigt_von = CASE WHEN p_erledigt THEN (SELECT get_current_benutzer_id()) ELSE NULL END
   WHERE id = p_id
     AND parent_id IS NULL
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Kommentar nicht gefunden oder keine Thread-Wurzel';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_skript_kommentar_erledigt(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_skript_kommentar_erledigt(uuid, boolean) TO authenticated;
