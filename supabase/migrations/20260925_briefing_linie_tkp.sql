-- Briefing merkt sich Kampagne, das eine Produkt und den Influencer-TKP.
-- Paid und Organic lassen tkp leer. Bestehende Casting-Listen dürfen tkp
-- deshalb auch leer lassen, statt auf den Default 25 zu fallen.

ALTER TABLE public.campaign_briefings
  ADD COLUMN IF NOT EXISTS tkp numeric,
  ADD COLUMN IF NOT EXISTS kampagne_id uuid REFERENCES public.kampagne(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS produkt_id uuid REFERENCES public.produkt(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.campaign_briefings.tkp IS
  'Preis pro 1.000 Views. Nur Influencer-Briefings. Paid und Organic lassen ihn leer.';
COMMENT ON COLUMN public.campaign_briefings.produkt_id IS
  'Das eine Produkt der Produktion. Persona-Fits schreiben kein weiteres Produkt dazu.';
COMMENT ON COLUMN public.campaign_briefings.kampagne_id IS
  'Kampagne, unter der das Finalisieren die Produktion anlegt.';

CREATE INDEX IF NOT EXISTS campaign_briefings_kampagne_id_idx
  ON public.campaign_briefings (kampagne_id);

ALTER TABLE public.creator_auswahl
  ALTER COLUMN tkp DROP NOT NULL;
