-- Manueller Reel-Ausschluss wird nicht weiter verwendet.
-- Die Spalte wurde bereits auf Staging angelegt und wird deshalb per
-- Vorwärtsmigration entfernt, statt die historische Migration umzuschreiben.

alter table public.sourcing_creator
  drop column if exists ig_excluded_media;
