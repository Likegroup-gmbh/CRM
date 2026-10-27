-- Produkt-Einladung kann an einer Linie hängen (ADR 0057)
-- Geht die Einladung vom Produkte-Tab einer Linie aus, merkt sie sich die Linie
-- (campaign_briefings). Anlegen übernimmt das Produkt dann dort.
-- Fällt die Linie weg, bleibt es eine Marken-Einladung (SET NULL).

BEGIN;

ALTER TABLE public.einladung
  ADD COLUMN IF NOT EXISTS briefing_id uuid REFERENCES public.campaign_briefings(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.einladung.briefing_id IS
  'Nur Produkt-Einladung: die Linie, von deren Produkte-Tab sie ausging. Anlegen übernimmt das Produkt dort.';

ALTER TABLE public.einladung DROP CONSTRAINT IF EXISTS einladung_art_felder;
ALTER TABLE public.einladung ADD CONSTRAINT einladung_art_felder CHECK (
  (art = 'briefing' AND produktion_id IS NOT NULL AND briefing_typ IS NOT NULL AND briefing_id IS NULL)
  OR
  (art = 'produkt' AND produktion_id IS NULL AND briefing_typ IS NULL)
);

CREATE INDEX IF NOT EXISTS einladung_briefing_idx
  ON public.einladung (briefing_id) WHERE briefing_id IS NOT NULL;

-- Spaltenweise Grants: die neue Spalte muss lesbar sein.
GRANT SELECT (briefing_id) ON public.einladung TO authenticated;

COMMIT;
