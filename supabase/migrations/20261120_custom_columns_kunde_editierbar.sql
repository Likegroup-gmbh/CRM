-- Custom Columns: Kunde darf Werte einer Spalte selbst bearbeiten (z.B. "Feedback Konzept Kunde").
--
-- Bisher: custom_column_values_modify sperrt Kunden komplett (nur SELECT).
-- Neu: Flag editable_by_kunden auf der Spalte + Policies, die Kunden INSERT/UPDATE erlauben, wenn
--   * die Spalte editable_by_kunden UND visible_for_kunden ist,
--   * der Spaltentyp nicht 'upload' ist (Uploads laufen ueber eigene Jobs),
--   * die Zeile (Kooperation bzw. Video je nach entity_type) zu den Kooperationen des Kunden gehoert
--     (gleiche Zugriffslogik wie kooperation_videos_select via private.rls_my_kooperation_ids()).
-- Kein DELETE fuer Kunden.
--
-- Rollback:
--   DROP POLICY custom_column_values_kunde_insert ON public.custom_column_values;
--   DROP POLICY custom_column_values_kunde_update ON public.custom_column_values;
--   ALTER TABLE public.custom_columns DROP COLUMN editable_by_kunden;

ALTER TABLE public.custom_columns
  ADD COLUMN IF NOT EXISTS editable_by_kunden BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS custom_column_values_kunde_insert ON public.custom_column_values;
CREATE POLICY custom_column_values_kunde_insert ON public.custom_column_values
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_columns cc
      WHERE cc.id = custom_column_values.custom_column_id
        AND cc.editable_by_kunden
        AND cc.visible_for_kunden
        AND cc.field_type <> 'upload'
        AND (
          (cc.entity_type = 'kooperation'
            AND custom_column_values.entity_id IN (SELECT private.rls_my_kooperation_ids()))
          OR
          (cc.entity_type = 'video'
            AND custom_column_values.entity_id IN (
              SELECT kv.id FROM public.kooperation_videos kv
              WHERE kv.kooperation_id IN (SELECT private.rls_my_kooperation_ids())
            ))
        )
    )
  );

DROP POLICY IF EXISTS custom_column_values_kunde_update ON public.custom_column_values;
CREATE POLICY custom_column_values_kunde_update ON public.custom_column_values
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.custom_columns cc
      WHERE cc.id = custom_column_values.custom_column_id
        AND cc.editable_by_kunden
        AND cc.visible_for_kunden
        AND cc.field_type <> 'upload'
        AND (
          (cc.entity_type = 'kooperation'
            AND custom_column_values.entity_id IN (SELECT private.rls_my_kooperation_ids()))
          OR
          (cc.entity_type = 'video'
            AND custom_column_values.entity_id IN (
              SELECT kv.id FROM public.kooperation_videos kv
              WHERE kv.kooperation_id IN (SELECT private.rls_my_kooperation_ids())
            ))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.custom_columns cc
      WHERE cc.id = custom_column_values.custom_column_id
        AND cc.editable_by_kunden
        AND cc.visible_for_kunden
        AND cc.field_type <> 'upload'
        AND (
          (cc.entity_type = 'kooperation'
            AND custom_column_values.entity_id IN (SELECT private.rls_my_kooperation_ids()))
          OR
          (cc.entity_type = 'video'
            AND custom_column_values.entity_id IN (
              SELECT kv.id FROM public.kooperation_videos kv
              WHERE kv.kooperation_id IN (SELECT private.rls_my_kooperation_ids())
            ))
        )
    )
  );
