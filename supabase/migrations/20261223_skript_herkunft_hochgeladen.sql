-- ADR 0073: hochgeladene Skripte sind weder generiert noch historisch.

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  WHERE con.conrelid = 'public.skripte'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%herkunft%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.skripte DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.skripte
  ADD CONSTRAINT skripte_herkunft_check
  CHECK (herkunft IN ('generiert', 'historisch', 'hochgeladen'));
