-- Katalog für selbst angelegte Nutzungsdauern am Briefing.
-- Die sechs Vorgaben (1/3/6/12/24/90 Monate) stehen im Client und werden hier nicht gesät.
-- campaign_briefings.nutzungsdauer bleibt das gewählte Label, kein FK.

CREATE TABLE public.nutzungsdauer_optionen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  label_norm text GENERATED ALWAYS AS (lower(btrim(label))) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT nutzungsdauer_optionen_label_not_blank CHECK (btrim(label) <> ''),
  CONSTRAINT nutzungsdauer_optionen_label_norm_key UNIQUE (label_norm)
);

COMMENT ON TABLE public.nutzungsdauer_optionen IS
  'Selbst angelegte Nutzungsdauer-Labels. Vorgaben liegen im Client.';
COMMENT ON COLUMN public.nutzungsdauer_optionen.label IS
  'Anzeige, so wie sie angelegt wurde.';
COMMENT ON COLUMN public.nutzungsdauer_optionen.label_norm IS
  'lower(btrim(label)), eindeutig ohne Groß/Klein-Unterschied.';

ALTER TABLE public.nutzungsdauer_optionen ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.nutzungsdauer_optionen FROM PUBLIC, anon;

DROP POLICY IF EXISTS nutzungsdauer_optionen_select ON public.nutzungsdauer_optionen;
CREATE POLICY nutzungsdauer_optionen_select ON public.nutzungsdauer_optionen
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS nutzungsdauer_optionen_insert ON public.nutzungsdauer_optionen;
CREATE POLICY nutzungsdauer_optionen_insert ON public.nutzungsdauer_optionen
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

GRANT SELECT, INSERT ON public.nutzungsdauer_optionen TO authenticated, service_role;
