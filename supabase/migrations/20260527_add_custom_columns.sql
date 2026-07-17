-- Custom Columns: Benutzerdefinierte Spalten pro Kampagne fuer die Kooperationstabelle

-- Spaltendefinitionen
CREATE TABLE IF NOT EXISTS public.custom_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kampagne_id UUID NOT NULL REFERENCES public.kampagne(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'link', 'date', 'boolean', 'dropdown', 'number')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('kooperation', 'video')),
  position INTEGER NOT NULL DEFAULT 0,
  visible_for_kunden BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_columns_kampagne ON public.custom_columns(kampagne_id);

-- Werte (generisch als Text)
CREATE TABLE IF NOT EXISTS public.custom_column_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_column_id UUID NOT NULL REFERENCES public.custom_columns(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(custom_column_id, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_column_values_column ON public.custom_column_values(custom_column_id);
CREATE INDEX IF NOT EXISTS idx_custom_column_values_entity ON public.custom_column_values(entity_id);

-- Dynamische Dropdown-Optionen
CREATE TABLE IF NOT EXISTS public.custom_column_dropdown_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_column_id UUID NOT NULL REFERENCES public.custom_columns(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_column_dropdown_opts_column ON public.custom_column_dropdown_options(custom_column_id);

-- Spaltenreihenfolge auf Kampagne
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'kampagne' AND column_name = 'column_order'
  ) THEN
    ALTER TABLE public.kampagne ADD COLUMN column_order JSONB DEFAULT NULL;
  END IF;
END $$;

-- RLS
ALTER TABLE public.custom_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_column_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_column_dropdown_options ENABLE ROW LEVEL SECURITY;

-- custom_columns: SELECT fuer alle authentifizierten User
CREATE POLICY custom_columns_select ON public.custom_columns
  FOR SELECT TO authenticated USING (true);

-- custom_columns: INSERT/UPDATE/DELETE fuer nicht-Kunden
CREATE POLICY custom_columns_modify ON public.custom_columns
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
        AND LOWER(TRIM(benutzer.rolle)) = 'kunde'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
        AND LOWER(TRIM(benutzer.rolle)) = 'kunde'
    )
  );

-- custom_column_values: SELECT fuer alle
CREATE POLICY custom_column_values_select ON public.custom_column_values
  FOR SELECT TO authenticated USING (true);

-- custom_column_values: INSERT/UPDATE fuer nicht-Kunden
CREATE POLICY custom_column_values_modify ON public.custom_column_values
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
        AND LOWER(TRIM(benutzer.rolle)) = 'kunde'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
        AND LOWER(TRIM(benutzer.rolle)) = 'kunde'
    )
  );

-- custom_column_dropdown_options: SELECT fuer alle
CREATE POLICY custom_column_dropdown_options_select ON public.custom_column_dropdown_options
  FOR SELECT TO authenticated USING (true);

-- custom_column_dropdown_options: Modify fuer nicht-Kunden
CREATE POLICY custom_column_dropdown_options_modify ON public.custom_column_dropdown_options
  FOR ALL TO authenticated
  USING (
    NOT EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
        AND LOWER(TRIM(benutzer.rolle)) = 'kunde'
    )
  )
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.benutzer
      WHERE benutzer.auth_user_id = auth.uid()
        AND LOWER(TRIM(benutzer.rolle)) = 'kunde'
    )
  );
