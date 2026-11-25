-- Custom Columns: neuer Feldtyp 'comment' (Kommentarfeld, mehrzeilig mit Autosave).
--
-- Rollback (nur wenn keine Spalte mit Typ 'comment' existiert):
--   ALTER TABLE public.custom_columns DROP CONSTRAINT custom_columns_field_type_check;
--   ALTER TABLE public.custom_columns ADD CONSTRAINT custom_columns_field_type_check
--     CHECK (field_type = ANY (ARRAY['text','link','date','boolean','dropdown','number','upload']));

ALTER TABLE public.custom_columns DROP CONSTRAINT IF EXISTS custom_columns_field_type_check;
ALTER TABLE public.custom_columns ADD CONSTRAINT custom_columns_field_type_check
  CHECK (field_type = ANY (ARRAY['text','comment','link','date','boolean','dropdown','number','upload']));
