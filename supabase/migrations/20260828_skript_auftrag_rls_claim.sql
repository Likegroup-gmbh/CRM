-- Skript-Auftrag: Job-Sichtbarkeit, Insert-Scope, serverseitige Autorisierung.
--
-- Drei Luecken aus der Architektur-Review:
-- 1. createJob schreibt nur created_by, skript_generation_jobs_select haengt
--    aber am Parent-Skript (EXISTS skript_id). Bei skript_id IS NULL (Generate
--    waehrend des Laufs, Distill permanent) ist der Job fuer Mitarbeiter
--    unsichtbar - pollJob liefert null, Realtime bleibt still.
-- 2. INSERT auf skript_chat_messages / skript_versionen / skript_feedback
--    pruefte nur is_admin_or_mitarbeiter(), nicht den Parent-Scope. Ein
--    interner Nutzer konnte eine pending Assistant-Row auf eine fremde
--    skript_id legen - die Background-Function (Service Role) schreibt das
--    Skript dann um.
-- 3. Die Functions laufen mit Service Role und konnten den Mitarbeiter-Scope
--    nicht pruefen (auth.uid() ist dort null). Dafuer gibt es jetzt
--    can_auth_user_access_skript als RPC.

-- ============================================================
-- Scope-Funktion parametrisierbar machen (auth.uid() bleibt Default)
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_mitarbeiter_access_skript_for(
  p_auth_user_id uuid,
  p_unternehmen_id uuid,
  p_marke_id uuid,
  p_kampagne_id uuid,
  p_created_by uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM benutzer b
      WHERE b.auth_user_id = p_auth_user_id AND b.rolle = 'admin'
    )
    OR p_created_by = p_auth_user_id
    OR EXISTS (
      SELECT 1 FROM benutzer b
      WHERE b.auth_user_id = p_auth_user_id
        AND b.rolle = 'mitarbeiter'
        AND (
          (p_kampagne_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM kampagne k
             WHERE k.id = p_kampagne_id
               AND (
                 EXISTS (SELECT 1 FROM kampagne_mitarbeiter km WHERE km.kampagne_id = k.id AND km.mitarbeiter_id = b.id)
                 OR EXISTS (SELECT 1 FROM marke_mitarbeiter mm WHERE mm.marke_id = k.marke_id AND mm.mitarbeiter_id = b.id)
                 OR EXISTS (SELECT 1 FROM mitarbeiter_unternehmen mu WHERE mu.unternehmen_id = k.unternehmen_id AND mu.mitarbeiter_id = b.id)
               )
          ))
          OR (p_kampagne_id IS NULL AND p_marke_id IS NOT NULL AND (
            EXISTS (SELECT 1 FROM marke_mitarbeiter mm WHERE mm.marke_id = p_marke_id AND mm.mitarbeiter_id = b.id)
            OR EXISTS (
              SELECT 1 FROM marke m
                JOIN mitarbeiter_unternehmen mu ON mu.unternehmen_id = m.unternehmen_id
               WHERE m.id = p_marke_id AND mu.mitarbeiter_id = b.id
            )
          ))
          OR (p_kampagne_id IS NULL AND p_marke_id IS NULL AND p_unternehmen_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM mitarbeiter_unternehmen mu WHERE mu.unternehmen_id = p_unternehmen_id AND mu.mitarbeiter_id = b.id
          ))
        )
    );
$$;

-- Bestehende Function wird zur Delegation - die RLS-Policies aus
-- 20260819 laufen unveraendert weiter.
CREATE OR REPLACE FUNCTION public.can_mitarbeiter_access_skript(
  p_unternehmen_id uuid,
  p_marke_id uuid,
  p_kampagne_id uuid,
  p_created_by uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT can_mitarbeiter_access_skript_for(
    (SELECT auth.uid()), p_unternehmen_id, p_marke_id, p_kampagne_id, p_created_by
  );
$$;

-- Fuer Background-Functions (Service Role): darf dieser Auth-User dieses
-- Skript sehen/aendern? Kunden-Scope absichtlich nicht enthalten - die
-- Functions sind ohnehin intern-only (requireInternal).
CREATE OR REPLACE FUNCTION public.can_auth_user_access_skript(
  p_auth_user_id uuid,
  p_skript_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM skripte s
     WHERE s.id = p_skript_id
       AND can_mitarbeiter_access_skript_for(
         p_auth_user_id, s.unternehmen_id, s.marke_id, s.kampagne_id, s.created_by
       )
  );
$$;

-- ============================================================
-- Abbruch: Auftraege koennen vom Erzeuger storniert werden.
-- Functions pruefen den Status vor dem Claude-Call und verwerfen
-- das Ergebnis, wenn der Auftrag unterwegs storniert wurde.
-- ============================================================

ALTER TABLE skript_generation_jobs
  DROP CONSTRAINT IF EXISTS skript_generation_jobs_status_check;
ALTER TABLE skript_generation_jobs
  ADD CONSTRAINT skript_generation_jobs_status_check
  CHECK (status IN ('pending','running','done','error','cancelled'));

ALTER TABLE skript_chat_messages
  DROP CONSTRAINT IF EXISTS skript_chat_messages_status_check;
ALTER TABLE skript_chat_messages
  ADD CONSTRAINT skript_chat_messages_status_check
  CHECK (status IN ('pending','running','vorschlag','angenommen','abgelehnt','fertig','error','cancelled'));

-- ============================================================
-- skript_generation_jobs: Erzeuger sieht seinen Job sofort
-- ============================================================

DROP POLICY IF EXISTS skript_generation_jobs_select ON skript_generation_jobs;
CREATE POLICY skript_generation_jobs_select ON skript_generation_jobs
  FOR SELECT
  USING (
    (SELECT is_admin())
    OR created_by = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM skripte s
       WHERE s.id = skript_generation_jobs.skript_id
    )
  );

DROP POLICY IF EXISTS skript_generation_jobs_update ON skript_generation_jobs;
CREATE POLICY skript_generation_jobs_update ON skript_generation_jobs
  FOR UPDATE
  USING (
    (SELECT is_admin())
    OR created_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_generation_jobs.skript_id)
  )
  WITH CHECK (
    (SELECT is_admin())
    OR created_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_generation_jobs.skript_id)
  );

DROP POLICY IF EXISTS skript_generation_jobs_insert ON skript_generation_jobs;
CREATE POLICY skript_generation_jobs_insert ON skript_generation_jobs
  FOR INSERT
  WITH CHECK (
    (SELECT is_admin_or_mitarbeiter())
    AND created_by = (SELECT auth.uid())
  );

-- ============================================================
-- Kindtabellen: INSERT nur noch auf sichtbares Parent-Skript.
-- Die EXISTS-Subquery auf skripte unterliegt selbst der
-- skripte_select-Policy (Mitarbeiter-Scope ODER Kunden-Scope).
-- ============================================================

DROP POLICY IF EXISTS skript_chat_messages_insert ON skript_chat_messages;
CREATE POLICY skript_chat_messages_insert ON skript_chat_messages
  FOR INSERT
  WITH CHECK (
    (SELECT is_admin())
    OR (
      (SELECT is_admin_or_mitarbeiter())
      AND EXISTS (
        SELECT 1 FROM skripte s
         WHERE s.id = skript_chat_messages.skript_id
      )
    )
  );

DROP POLICY IF EXISTS skript_versionen_insert ON skript_versionen;
CREATE POLICY skript_versionen_insert ON skript_versionen
  FOR INSERT
  WITH CHECK (
    (SELECT is_admin())
    OR (
      (SELECT is_admin_or_mitarbeiter())
      AND EXISTS (
        SELECT 1 FROM skripte s
         WHERE s.id = skript_versionen.skript_id
      )
    )
  );

DROP POLICY IF EXISTS skript_feedback_insert ON skript_feedback;
CREATE POLICY skript_feedback_insert ON skript_feedback
  FOR INSERT
  WITH CHECK (
    (SELECT is_admin())
    OR (
      (SELECT is_admin_or_mitarbeiter())
      AND EXISTS (
        SELECT 1 FROM skripte s
         WHERE s.id = skript_feedback.skript_id
      )
    )
  );
