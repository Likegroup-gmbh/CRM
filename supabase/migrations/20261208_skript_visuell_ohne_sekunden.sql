-- „Was zu sehen ist“ traegt keine Sekunden mehr. Entfernt die gestempelten
-- Zeitmarker („Sek. 0–3:“, „0:00–0:03“) aus den Visual-Zellen der aktuellen
-- Skripte. Marker mitten im Absatz (altes, gepacktes Format) werden zum
-- Absatzwechsel. Die Versionshistorie (skript_versionen) bleibt unveraendert.
-- updated_at bleibt stehen, damit die Skripte nicht als frisch bearbeitet gelten.

BEGIN;

CREATE FUNCTION pg_temp.ohne_zeitmarker(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
           regexp_replace(
             regexp_replace(
               regexp_replace(t,
                 '[ \t]+Sek\.[ \t]*\d+[ \t]*[–-][ \t]*\d+[ \t]*:[ \t]*', E'\n\n', 'gi'),
               '(^|\n)[ \t]*Sek\.[ \t]*\d+[ \t]*[–-][ \t]*\d+[ \t]*:[ \t]*', '\1', 'gi'),
             '(^|\n[ \t]*\n)[ \t]*\d+[ \t]*[–-][ \t]*\d+[ \t]*:[ \t]*', '\1', 'g'),
           '(^|\n[ \t]*\n)[ \t]*\d{1,2}:\d{2}[ \t]*[–-][ \t]*\d{1,2}:\d{2}[ \t]*', '\1', 'g')
$$;

ALTER TABLE public.skripte DISABLE TRIGGER skripte_updated_at;

UPDATE public.skripte
SET hook_visuell = pg_temp.ohne_zeitmarker(hook_visuell),
    hauptteil_visuell = pg_temp.ohne_zeitmarker(hauptteil_visuell),
    cta_visuell = pg_temp.ohne_zeitmarker(cta_visuell)
WHERE pg_temp.ohne_zeitmarker(hook_visuell) IS DISTINCT FROM hook_visuell
   OR pg_temp.ohne_zeitmarker(hauptteil_visuell) IS DISTINCT FROM hauptteil_visuell
   OR pg_temp.ohne_zeitmarker(cta_visuell) IS DISTINCT FROM cta_visuell;

ALTER TABLE public.skripte ENABLE TRIGGER skripte_updated_at;

COMMIT;
