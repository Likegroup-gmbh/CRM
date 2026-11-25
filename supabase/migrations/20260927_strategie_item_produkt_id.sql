-- Videoidee merkt sich das eine Produkt aus dem Briefing der Produktion.
-- ON DELETE SET NULL: loeschen des Produkts loest die Zuordnung, die Idee bleibt.

ALTER TABLE public.strategie_items
  ADD COLUMN IF NOT EXISTS produkt_id uuid
  REFERENCES public.produkt(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS strategie_items_produkt_id_idx
  ON public.strategie_items(produkt_id);

COMMENT ON COLUMN public.strategie_items.produkt_id IS
  'Produkt dieser Videoidee, aus den Produkten des Briefings. Skript-Generierung nimmt genau diese ID.';
