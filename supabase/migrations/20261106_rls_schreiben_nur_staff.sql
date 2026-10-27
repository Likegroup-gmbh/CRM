-- Schreibrechte nur fuer Admin/Mitarbeiter.
--
-- Bisher: 27 Tabellen mit "Authenticated users full access" (FOR ALL, nur
-- "eingeloggt"). Damit konnte jedes Konto (kunde, pending, investor) dort
-- schreiben und loeschen. Ausserdem:
--   * skript_versionen / skript_feedback / skript_chat_messages: UPDATE/DELETE
--     fuer jeden, der das Skript sieht (auch Kunden im Kunden-Scope)
--   * Storage-Buckets ansprechpartner-images / creator-profile-images:
--     Schreiben fuer jedes eingeloggte Konto
--
-- Lesen bleibt unveraendert (nur eingeloggt). Die RESTRICTIVE-Policies
-- (*_no_gast, agent_nur_lesen_*, testunternehmen_hide) bleiben bestehen.
-- Die History-Trigger sind SECURITY DEFINER und schreiben weiter.

BEGIN;

-- ============================================================
-- 1. "Authenticated users full access" ersetzen
-- ============================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname = 'Authenticated users full access'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users full access" ON public.%I', r.tablename);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_select_authenticated', r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL)',
      r.tablename || '_select_authenticated', r.tablename);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_staff_insert', r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()))',
      r.tablename || '_staff_insert', r.tablename);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_staff_update', r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.is_admin_or_mitarbeiter())) WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()))',
      r.tablename || '_staff_update', r.tablename);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.tablename || '_staff_delete', r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_mitarbeiter()))',
      r.tablename || '_staff_delete', r.tablename);
  END LOOP;
END $$;

-- grid_documents: INSERT nicht fuer jedes eingeloggte Konto
DROP POLICY IF EXISTS "Mitarbeiter können Grid-Dokumente erstellen" ON public.grid_documents;
CREATE POLICY "Mitarbeiter können Grid-Dokumente erstellen" ON public.grid_documents
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));

-- ============================================================
-- 2. Skript-Kindtabellen: UPDATE/DELETE nur Staff (+ Parent sichtbar)
--    Muster wie die INSERT-Policies aus 20260828_skript_auftrag_rls_claim.sql
-- ============================================================

DROP POLICY IF EXISTS skript_versionen_update ON public.skript_versionen;
CREATE POLICY skript_versionen_update ON public.skript_versionen
  FOR UPDATE
  USING (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_versionen.skript_id))
  )
  WITH CHECK (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_versionen.skript_id))
  );

DROP POLICY IF EXISTS skript_versionen_delete ON public.skript_versionen;
CREATE POLICY skript_versionen_delete ON public.skript_versionen
  FOR DELETE
  USING (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_versionen.skript_id))
  );

DROP POLICY IF EXISTS skript_feedback_update ON public.skript_feedback;
CREATE POLICY skript_feedback_update ON public.skript_feedback
  FOR UPDATE
  USING (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_feedback.skript_id))
  )
  WITH CHECK (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_feedback.skript_id))
  );

DROP POLICY IF EXISTS skript_feedback_delete ON public.skript_feedback;
CREATE POLICY skript_feedback_delete ON public.skript_feedback
  FOR DELETE
  USING (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_feedback.skript_id))
  );

DROP POLICY IF EXISTS skript_chat_messages_update ON public.skript_chat_messages;
CREATE POLICY skript_chat_messages_update ON public.skript_chat_messages
  FOR UPDATE
  USING (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_chat_messages.skript_id))
  )
  WITH CHECK (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_chat_messages.skript_id))
  );

DROP POLICY IF EXISTS skript_chat_messages_delete ON public.skript_chat_messages;
CREATE POLICY skript_chat_messages_delete ON public.skript_chat_messages
  FOR DELETE
  USING (
    (SELECT is_admin())
    OR ((SELECT is_admin_or_mitarbeiter())
        AND EXISTS (SELECT 1 FROM skripte s WHERE s.id = skript_chat_messages.skript_id))
  );

-- ============================================================
-- 3. Storage: Schreiben nur Staff (Lesen bleibt oeffentlich)
-- ============================================================

DROP POLICY IF EXISTS "Allow authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload creator profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update creator profile images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete creator profile images" ON storage.objects;

DROP POLICY IF EXISTS ansprechpartner_images_staff_insert ON storage.objects;
CREATE POLICY ansprechpartner_images_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ansprechpartner-images' AND (SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS ansprechpartner_images_staff_update ON storage.objects;
CREATE POLICY ansprechpartner_images_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ansprechpartner-images' AND (SELECT public.is_admin_or_mitarbeiter()))
  WITH CHECK (bucket_id = 'ansprechpartner-images' AND (SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS ansprechpartner_images_staff_delete ON storage.objects;
CREATE POLICY ansprechpartner_images_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ansprechpartner-images' AND (SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS creator_profile_images_staff_insert ON storage.objects;
CREATE POLICY creator_profile_images_staff_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'creator-profile-images' AND (SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS creator_profile_images_staff_update ON storage.objects;
CREATE POLICY creator_profile_images_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'creator-profile-images' AND (SELECT public.is_admin_or_mitarbeiter()))
  WITH CHECK (bucket_id = 'creator-profile-images' AND (SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS creator_profile_images_staff_delete ON storage.objects;
CREATE POLICY creator_profile_images_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'creator-profile-images' AND (SELECT public.is_admin_or_mitarbeiter()));

-- ============================================================
-- 4. Repo-Drift: kampagne_mitarbeiter / marke_mitarbeiter
--    Live schon Staff-only; die aelteren Migrationen (20250220, 20260424)
--    setzen USING (true). Idempotent auf den Live-Stand bringen.
-- ============================================================

DROP POLICY IF EXISTS kampagne_mitarbeiter_insert ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_insert ON public.kampagne_mitarbeiter
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));
DROP POLICY IF EXISTS kampagne_mitarbeiter_update ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_update ON public.kampagne_mitarbeiter
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));
DROP POLICY IF EXISTS kampagne_mitarbeiter_delete ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_delete ON public.kampagne_mitarbeiter
  FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS marke_mitarbeiter_insert ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_insert ON public.marke_mitarbeiter
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));
DROP POLICY IF EXISTS marke_mitarbeiter_update ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_update ON public.marke_mitarbeiter
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));
DROP POLICY IF EXISTS marke_mitarbeiter_delete ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_delete ON public.marke_mitarbeiter
  FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_mitarbeiter()));

COMMIT;
