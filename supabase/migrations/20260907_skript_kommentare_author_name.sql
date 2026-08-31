-- Anzeigename des Kommentar-Autors denormalisiert auf der Zeile.
-- Kunden duerfen fremde benutzer-Zeilen per RLS nicht lesen, der Join auf
-- created_by bliebe fuer sie leer und der Renderer zeigte "Unbekannt".
-- Der Trigger setzt den Namen serverseitig, ein Client-Wert wird ignoriert.

ALTER TABLE public.skript_kommentare
  ADD COLUMN IF NOT EXISTS author_name text;

CREATE OR REPLACE FUNCTION public.set_skript_kommentar_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT COALESCE(
    NULLIF(b.name, ''),
    NULLIF(trim(concat_ws(' ', b.vorname, b.nachname)), '')
  ) INTO NEW.author_name
  FROM public.benutzer b
  WHERE b.id = NEW.created_by;
  RETURN NEW;
END;
$$;

CREATE TRIGGER skript_kommentare_author_name
  BEFORE INSERT ON public.skript_kommentare
  FOR EACH ROW EXECUTE FUNCTION public.set_skript_kommentar_author_name();

UPDATE public.skript_kommentare k
SET author_name = COALESCE(
  NULLIF(b.name, ''),
  NULLIF(trim(concat_ws(' ', b.vorname, b.nachname)), '')
)
FROM public.benutzer b
WHERE b.id = k.created_by
  AND k.author_name IS NULL;
