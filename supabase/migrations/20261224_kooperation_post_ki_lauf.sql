-- KI-Lauf am Post sichtbar machen (ADR 0078, „Ablauf des KI-Laufs“).
--
-- ki_gestartet_at  Start des aktuellen Laufs. Zugleich das Token des Laufs: die Function schreibt
--                  nur, solange es gleich ist. Ein Abbruch oder ein neuer Screenshot setzt einen
--                  neuen Lauf, ein spätes Ergebnis des alten fällt dann weg.
-- ki_schritt       Wo der Lauf steht: wartet (angefordert, Function hat sich noch nicht gemeldet),
--                  gestartet, bilder, ki, speichern. Bleibt bei einem Fehler stehen, damit man sieht,
--                  wo er gescheitert ist.
--
-- Ein neuer Lauf beginnt, wenn ki_status auf 'laeuft' wechselt, sich dabei die Screenshots ändern
-- oder der Client ki_gestartet_at leert (Erneut versuchen auf einem Post, der noch auf 'laeuft'
-- steht, weil die Function nie geschrieben hat).
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS kooperation_post_ki_lauf ON public.kooperation_post;
--   DROP FUNCTION IF EXISTS public.kooperation_post_ki_lauf();
--   ALTER TABLE public.kooperation_post DROP COLUMN IF EXISTS ki_schritt, DROP COLUMN IF EXISTS ki_gestartet_at;

BEGIN;

ALTER TABLE public.kooperation_post
  ADD COLUMN IF NOT EXISTS ki_schritt text,
  ADD COLUMN IF NOT EXISTS ki_gestartet_at timestamptz;

-- Den Start setzt die Datenbank, nicht der Client: eine Uhr, ein Token.
CREATE OR REPLACE FUNCTION public.kooperation_post_ki_lauf()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ki_status = 'laeuft' AND (
    TG_OP = 'INSERT'
    OR OLD.ki_status IS DISTINCT FROM 'laeuft'
    OR NEW.screenshot_pfade IS DISTINCT FROM OLD.screenshot_pfade
    OR NEW.ki_gestartet_at IS NULL
  ) THEN
    NEW.ki_gestartet_at := now();
    NEW.ki_schritt := 'wartet';
  ELSIF NEW.ki_status IS NULL THEN
    NEW.ki_schritt := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kooperation_post_ki_lauf ON public.kooperation_post;
CREATE TRIGGER kooperation_post_ki_lauf
  BEFORE INSERT OR UPDATE ON public.kooperation_post
  FOR EACH ROW EXECUTE FUNCTION public.kooperation_post_ki_lauf();

REVOKE EXECUTE ON FUNCTION public.kooperation_post_ki_lauf() FROM PUBLIC, anon, authenticated;

COMMIT;
