-- custom_column_assets: Lesen nur noch über die Kooperation bzw. das Kooperationsvideo.
--
-- Live stand custom_column_assets_select auf USING (true): jeder eingeloggte Nutzer (auch
-- jeder Kunde) konnte alle Zeilen lesen und über dropbox-proxy (canReadAssetPath prüft unter
-- RLS) für jede Datei einen Temp-Link holen, mandantenübergreifend.
--
-- Neu, gleiche Logik wie custom_column_values_kunde_update:
--   Admin und Investor lesen alles (wie bisher).
--   Sonst: entity_id ist eine zugängliche Kooperation (entity_type 'kooperation') bzw. ein
--   Kooperationsvideo einer zugänglichen Kooperation (entity_type 'video'), über
--   private.rls_my_kooperation_ids() (Mitarbeiter nach Zuordnung, Kunde nach kunde_marke /
--   kunde_unternehmen). Kunden zusätzlich nur bei visible_for_kunden.
--
-- Rollback:
--   DROP POLICY custom_column_assets_select ON public.custom_column_assets;
--   CREATE POLICY custom_column_assets_select ON public.custom_column_assets
--     FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS custom_column_assets_select ON public.custom_column_assets;

CREATE POLICY custom_column_assets_select ON public.custom_column_assets
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR (SELECT public.is_investor())
    OR EXISTS (
      SELECT 1
      FROM public.custom_columns cc
      WHERE cc.id = custom_column_assets.custom_column_id
        AND (cc.visible_for_kunden OR (SELECT public.is_admin_or_mitarbeiter()))
        AND (
          (cc.entity_type = 'kooperation'
            AND custom_column_assets.entity_id IN (SELECT private.rls_my_kooperation_ids()))
          OR (cc.entity_type = 'video'
            AND custom_column_assets.entity_id IN (
              SELECT kv.id
              FROM public.kooperation_videos kv
              WHERE kv.kooperation_id IN (SELECT private.rls_my_kooperation_ids())
            ))
        )
    )
  );

-- Die Repo-Migration 20260527 hatte "authenticated_all" FOR ALL USING (true) angelegt. Live
-- existiert sie nicht (dort gibt es die staff_*-Policies). Falls eine Umgebung sie noch hat,
-- wird sie durch Schreib-Policies nur für Staff ersetzt, sonst bliebe das Leck offen.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'custom_column_assets' AND policyname = 'authenticated_all'
  ) THEN
    DROP POLICY "authenticated_all" ON public.custom_column_assets;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_column_assets' AND policyname = 'custom_column_assets_staff_insert') THEN
      CREATE POLICY custom_column_assets_staff_insert ON public.custom_column_assets
        FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin_or_mitarbeiter()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_column_assets' AND policyname = 'custom_column_assets_staff_update') THEN
      CREATE POLICY custom_column_assets_staff_update ON public.custom_column_assets
        FOR UPDATE TO authenticated USING ((SELECT public.is_admin_or_mitarbeiter()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'custom_column_assets' AND policyname = 'custom_column_assets_staff_delete') THEN
      CREATE POLICY custom_column_assets_staff_delete ON public.custom_column_assets
        FOR DELETE TO authenticated USING ((SELECT public.is_admin_or_mitarbeiter()));
    END IF;
  END IF;
END $$;
