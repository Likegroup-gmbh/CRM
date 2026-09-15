-- Videoidee-Vorschlaege im Konzept (ADR 0015)
--
-- Flag auf strategie_items statt zweiter Tabelle: der Vorschlag IST die
-- Videoidee. Jobs analog casting_vorschlag_jobs (Client legt an und pollt,
-- die Function schreibt per Service Role und inseriert Flag-Zeilen).

BEGIN;

-- ============================================================
-- 1. Flag an der Videoidee
-- ============================================================

ALTER TABLE public.strategie_items
  ADD COLUMN IF NOT EXISTS ist_vorschlag boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.strategie_items.ist_vorschlag IS
  'Videoidee-Vorschlag: KI-generiert, noch nicht übernommen. false = normale Videoidee.';

CREATE INDEX IF NOT EXISTS strategie_items_ist_vorschlag_idx
  ON public.strategie_items (strategie_id)
  WHERE ist_vorschlag;

-- ============================================================
-- 2. Jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.strategie_idee_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategie_id uuid NOT NULL REFERENCES public.strategie(id) ON DELETE CASCADE,
  status varchar NOT NULL DEFAULT 'pending',
  progress_step varchar,
  progress_steps jsonb,
  input jsonb,
  result jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS strategie_idee_jobs_strategie_idx ON public.strategie_idee_jobs(strategie_id);
CREATE INDEX IF NOT EXISTS strategie_idee_jobs_created_by_idx ON public.strategie_idee_jobs(created_by);

COMMENT ON TABLE public.strategie_idee_jobs IS
  'Jobs der Konzept-Videoideen (strategie-idee-background). Client legt an und pollt, die Function schreibt Status, Fortschritt und Ergebnis.';

CREATE TRIGGER strategie_idee_jobs_updated_at
  BEFORE UPDATE ON public.strategie_idee_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. RLS
--    Jobs: nur Staff legt an und liest die eigenen Zeilen.
--    Vorschlags-Zeilen: restriktiv unsichtbar fuer Kunde/Gast
--    (Staff und Investor sehen sie; Gast-Select zusaetzlich gehaertet).
-- ============================================================

ALTER TABLE public.strategie_idee_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY strategie_idee_jobs_insert ON public.strategie_idee_jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid()));

CREATE POLICY strategie_idee_jobs_select ON public.strategie_idee_jobs
  FOR SELECT TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- Kein UPDATE/DELETE fuer Clients: schreibt ausschliesslich die Function (Service Role)

DROP POLICY IF EXISTS strategie_items_hide_vorschlag ON public.strategie_items;
CREATE POLICY strategie_items_hide_vorschlag ON public.strategie_items
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR (SELECT is_investor())
    OR coalesce(ist_vorschlag, false) = false
  );

DROP POLICY IF EXISTS strategie_items_gast_select ON public.strategie_items;
CREATE POLICY strategie_items_gast_select ON public.strategie_items
  FOR SELECT USING (
    gast_has_share('strategie', strategie_id, false)
    AND coalesce(ist_vorschlag, false) = false
  );

DROP POLICY IF EXISTS strategie_items_gast_update ON public.strategie_items;
CREATE POLICY strategie_items_gast_update ON public.strategie_items
  FOR UPDATE
  USING (
    gast_has_share('strategie', strategie_id, true)
    AND coalesce(ist_vorschlag, false) = false
  )
  WITH CHECK (
    gast_has_share('strategie', strategie_id, true)
    AND coalesce(ist_vorschlag, false) = false
  );

COMMIT;
