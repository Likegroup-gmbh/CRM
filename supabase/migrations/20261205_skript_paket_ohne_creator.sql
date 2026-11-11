-- Kampagnen-Paket: ein Skript-Zugang ohne Creator, z. B. für Kunden-Feedback.
-- Creator-Pakete bleiben über UNIQUE (kampagne_id, creator_id) eindeutig.
-- NULL zählt dort nicht als gleich, deshalb ein eigener Index für das Paket ohne Creator.
--
-- ROLLBACK:
--   DELETE FROM public.skript_pakete WHERE creator_id IS NULL;
--   DROP INDEX IF EXISTS public.uq_skript_pakete_kampagne_ohne_creator;
--   ALTER TABLE public.skript_pakete ALTER COLUMN creator_id SET NOT NULL;

ALTER TABLE public.skript_pakete
  ALTER COLUMN creator_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_skript_pakete_kampagne_ohne_creator
  ON public.skript_pakete (kampagne_id)
  WHERE creator_id IS NULL;
