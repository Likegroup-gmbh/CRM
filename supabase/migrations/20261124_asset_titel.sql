-- Anzeigetitel einer Datei im Videos-Tab (Spaltenbrowser), im Detail inline editierbar.
-- Eigene Spalte statt file_name: file_name ist der echte Dateiname und wird fuer
-- Download-Namen und die Duplikatpruefung beim Upload gelesen. Ein Umbenennen
-- darf weder Dropbox-Pfad noch Download-Namen veraendern.
-- null = Titel aus Dateiname bzw. Variante ableiten (Altbestand bleibt unveraendert).
-- Schreibrechte kommen aus den vorhandenen UPDATE-Policies (Admin/Mitarbeiter).
-- Rollback: die vier Spalten droppen.

BEGIN;

ALTER TABLE public.kooperation_video_asset ADD COLUMN IF NOT EXISTS titel text;
ALTER TABLE public.kooperation_story_asset ADD COLUMN IF NOT EXISTS titel text;
ALTER TABLE public.kooperation_bilder_asset ADD COLUMN IF NOT EXISTS titel text;
ALTER TABLE public.kooperation_rohmaterial_asset ADD COLUMN IF NOT EXISTS titel text;

COMMIT;
