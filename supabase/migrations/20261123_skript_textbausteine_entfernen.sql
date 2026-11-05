-- Textbausteine im Skript-Editor entfernt (Funktion wird nicht gebraucht).
-- Die Tabelle aus 20261122_skript_dokument_bloecke.sql faellt weg, inkl. Policies und Trigger.
-- Rollback: Tabelle samt Policies aus 20261122_skript_dokument_bloecke.sql neu anlegen (Inhalt ist weg).

BEGIN;

DROP TABLE IF EXISTS public.skript_textbausteine;

COMMIT;
