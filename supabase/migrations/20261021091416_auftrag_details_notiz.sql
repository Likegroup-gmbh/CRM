-- Eine gemeinsame Arbeitsnotiz pro Auftragsdetails.
-- Liegt nicht auf auftrag_details, damit die Investor-Leserechte sie nicht mit ausliefern.
-- Zugriff: Admin und Mitarbeiter, ohne die Klasse Finanzen. Investor, Agent und Kunden haben keine Policy.

CREATE SCHEMA IF NOT EXISTS private;

-- private gibt es auf der Datenbank schon mit weiteren Helfern.
-- Usage ergänzen, bestehende Schema-Rechte nicht entziehen.
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.can_use_auftrag_details_notiz()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.benutzer b
    LEFT JOIN public.mitarbeiter_klasse k ON k.id = b.mitarbeiter_klasse_id
    WHERE b.auth_user_id = auth.uid()
      AND (
        b.rolle = 'admin'
        OR (
          b.rolle = 'mitarbeiter'
          AND lower(coalesce(k.name, '')) <> 'finanzen'
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION private.can_use_auftrag_details_notiz() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_use_auftrag_details_notiz() TO authenticated;

CREATE OR REPLACE FUNCTION public.stamp_auftrag_details_notiz()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.auftrag_details_id IS DISTINCT FROM OLD.auftrag_details_id THEN
    RAISE EXCEPTION 'auftrag_details_id ist unveraenderlich';
  END IF;
  NEW.aktualisiert_am := now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.auftrag_details_notiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auftrag_details_id uuid NOT NULL UNIQUE REFERENCES public.auftrag_details(id) ON DELETE CASCADE,
  notiz text NOT NULL,
  aktualisiert_von uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  aktualisiert_am timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auftrag_details_notiz_text_chk CHECK (
    char_length(btrim(notiz)) >= 1
    AND char_length(notiz) <= 10000
  )
);

CREATE TRIGGER auftrag_details_notiz_stamp
  BEFORE INSERT OR UPDATE ON public.auftrag_details_notiz
  FOR EACH ROW
  EXECUTE FUNCTION public.stamp_auftrag_details_notiz();

ALTER TABLE public.auftrag_details_notiz ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.auftrag_details_notiz FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.auftrag_details_notiz TO authenticated;

CREATE POLICY auftrag_details_notiz_select
  ON public.auftrag_details_notiz
  FOR SELECT
  TO authenticated
  USING ((SELECT private.can_use_auftrag_details_notiz()));

CREATE POLICY auftrag_details_notiz_insert
  ON public.auftrag_details_notiz
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT private.can_use_auftrag_details_notiz())
    AND aktualisiert_von = (SELECT b.id FROM public.benutzer b WHERE b.auth_user_id = auth.uid())
  );

CREATE POLICY auftrag_details_notiz_update
  ON public.auftrag_details_notiz
  FOR UPDATE
  TO authenticated
  USING ((SELECT private.can_use_auftrag_details_notiz()))
  WITH CHECK (
    (SELECT private.can_use_auftrag_details_notiz())
    AND aktualisiert_von = (SELECT b.id FROM public.benutzer b WHERE b.auth_user_id = auth.uid())
  );

CREATE POLICY auftrag_details_notiz_delete
  ON public.auftrag_details_notiz
  FOR DELETE
  TO authenticated
  USING ((SELECT private.can_use_auftrag_details_notiz()));

COMMENT ON TABLE public.auftrag_details_notiz IS
  'Eine gemeinsame Arbeitsnotiz pro Auftragsdetails. Nur Admin und Mitarbeiter, ohne Klasse Finanzen.';

NOTIFY pgrst, 'reload schema';
