-- Mitarbeiter Firmenhandy
-- Adds company mobile number + country reference to benutzer.

ALTER TABLE public.benutzer
ADD COLUMN IF NOT EXISTS telefonnummer_firmenhandy text;

ALTER TABLE public.benutzer
ADD COLUMN IF NOT EXISTS telefonnummer_firmenhandy_land_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'benutzer_telefonnummer_firmenhandy_land_id_fkey'
      AND conrelid = 'public.benutzer'::regclass
  ) THEN
    ALTER TABLE public.benutzer
      ADD CONSTRAINT benutzer_telefonnummer_firmenhandy_land_id_fkey
      FOREIGN KEY (telefonnummer_firmenhandy_land_id)
      REFERENCES public.eu_laender (id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_benutzer_firmenhandy_land_id
  ON public.benutzer (telefonnummer_firmenhandy_land_id);

NOTIFY pgrst, 'reload schema';
