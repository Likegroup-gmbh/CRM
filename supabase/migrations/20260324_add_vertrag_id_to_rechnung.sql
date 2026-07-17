ALTER TABLE public.rechnung
  ADD COLUMN vertrag_id uuid REFERENCES public.vertraege(id);
