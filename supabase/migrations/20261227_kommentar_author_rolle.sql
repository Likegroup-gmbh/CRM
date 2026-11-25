-- Rolle des Autors an den Video-Kommentaren (Notizen, Zeitkommentare, Bild-Notizen).
--
-- Das Team trägt Feedback der Kundenseite oft selbst in den Slot „Kunde“ ein. Gespeichert ist dann
-- der Name des Mitarbeiters, angezeigt werden soll der Ansprechpartner der Kampagne. Dafür muss der
-- Client wissen, ob ein Mitarbeiter geschrieben hat. Kunden dürfen fremde benutzer-Zeilen per RLS
-- nicht lesen, deshalb steht die Rolle auf der Zeile. Der Trigger setzt sie bei jedem Schreiben aus
-- benutzer, ein Client-Wert wird überschrieben.
--
-- Nachgetragen wird nur Kunden-Feedback, das Admin oder Mitarbeiter eingetragen haben (nur dort
-- ändert sich die Anzeige). Alle drei Tabellen hängen an supabase_realtime, jede nachgetragene Zeile
-- ist ein Event bei offenen Clients. Übrige ältere Zeilen bleiben NULL = unbekannt.
-- updated_at bleibt stehen, die Kommentare gelten nicht als frisch bearbeitet.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_kommentar_author_rolle ON public.kooperation_video_comment;
--   DROP TRIGGER IF EXISTS trg_kommentar_author_rolle ON public.kooperation_video_zeitkommentar;
--   DROP TRIGGER IF EXISTS trg_kommentar_author_rolle ON public.kooperation_still_comment;
--   DROP FUNCTION IF EXISTS public.set_kommentar_author_rolle();
--   ALTER TABLE public.kooperation_video_comment DROP COLUMN IF EXISTS author_rolle;
--   ALTER TABLE public.kooperation_video_zeitkommentar DROP COLUMN IF EXISTS author_rolle;
--   ALTER TABLE public.kooperation_still_comment DROP COLUMN IF EXISTS author_rolle;

BEGIN;

ALTER TABLE public.kooperation_video_comment ADD COLUMN IF NOT EXISTS author_rolle text;
ALTER TABLE public.kooperation_video_zeitkommentar ADD COLUMN IF NOT EXISTS author_rolle text;
ALTER TABLE public.kooperation_still_comment ADD COLUMN IF NOT EXISTS author_rolle text;

COMMENT ON COLUMN public.kooperation_video_comment.author_rolle IS 'benutzer.rolle des Autors beim letzten Schreiben (Trigger). NULL = Gast oder unbekannt.';
COMMENT ON COLUMN public.kooperation_video_zeitkommentar.author_rolle IS 'benutzer.rolle des Autors beim letzten Schreiben (Trigger). NULL = Gast oder unbekannt.';
COMMENT ON COLUMN public.kooperation_still_comment.author_rolle IS 'benutzer.rolle des Autors beim letzten Schreiben (Trigger). NULL = Gast oder unbekannt.';

CREATE OR REPLACE FUNCTION public.set_kommentar_author_rolle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.author_rolle := (SELECT b.rolle FROM public.benutzer b WHERE b.id = NEW.author_benutzer_id);
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_kommentar_author_rolle() FROM PUBLIC, anon, authenticated;

-- Name sortiert nach gast_column_guard: BEFORE-Trigger laufen alphabetisch, der Guard muss die
-- Gast-Änderung prüfen, bevor hier author_rolle gesetzt wird.
DROP TRIGGER IF EXISTS trg_kommentar_author_rolle ON public.kooperation_video_comment;
CREATE TRIGGER trg_kommentar_author_rolle
  BEFORE INSERT OR UPDATE ON public.kooperation_video_comment
  FOR EACH ROW EXECUTE FUNCTION public.set_kommentar_author_rolle();

DROP TRIGGER IF EXISTS trg_kommentar_author_rolle ON public.kooperation_video_zeitkommentar;
CREATE TRIGGER trg_kommentar_author_rolle
  BEFORE INSERT OR UPDATE ON public.kooperation_video_zeitkommentar
  FOR EACH ROW EXECUTE FUNCTION public.set_kommentar_author_rolle();

DROP TRIGGER IF EXISTS trg_kommentar_author_rolle ON public.kooperation_still_comment;
CREATE TRIGGER trg_kommentar_author_rolle
  BEFORE INSERT OR UPDATE ON public.kooperation_still_comment
  FOR EACH ROW EXECUTE FUNCTION public.set_kommentar_author_rolle();

ALTER TABLE public.kooperation_video_comment DISABLE TRIGGER trg_koop_video_comment_updated_at;

UPDATE public.kooperation_video_comment c
SET author_rolle = b.rolle
FROM public.benutzer b
WHERE b.id = c.author_benutzer_id
  AND c.feedback_typ = 'kunde'
  AND b.rolle IN ('admin', 'mitarbeiter')
  AND c.author_rolle IS NULL;

ALTER TABLE public.kooperation_video_comment ENABLE TRIGGER trg_koop_video_comment_updated_at;

UPDATE public.kooperation_video_zeitkommentar c
SET author_rolle = b.rolle
FROM public.benutzer b
WHERE b.id = c.author_benutzer_id
  AND c.feedback_typ = 'kunde'
  AND b.rolle IN ('admin', 'mitarbeiter')
  AND c.author_rolle IS NULL;

UPDATE public.kooperation_still_comment c
SET author_rolle = b.rolle
FROM public.benutzer b
WHERE b.id = c.author_benutzer_id
  AND c.feedback_typ = 'kunde'
  AND b.rolle IN ('admin', 'mitarbeiter')
  AND c.author_rolle IS NULL;

COMMIT;
