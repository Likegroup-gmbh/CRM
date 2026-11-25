-- Strukturierte Beschreibung einer Videoreferenz (KI-Analyse aus Transkript/Caption).
-- Felder: titel, angle, hook, visual_hook, hauptteil, cta (alle Text).
-- beschreibung bleibt der abgeleitete Fliesstext (Erstzeile = Titel) fuer Picker,
-- Konzept-Chat und Ausschluss-Liste. NULL = Altbestand, Idee oder Vorschlag.

alter table public.strategie_items
  add column if not exists beschreibung_struktur jsonb;

alter table public.strategie_items
  drop constraint if exists strategie_items_beschreibung_struktur_check;
alter table public.strategie_items
  add constraint strategie_items_beschreibung_struktur_check
  check (beschreibung_struktur is null or jsonb_typeof(beschreibung_struktur) = 'object');

comment on column public.strategie_items.beschreibung_struktur is
  'Videoreferenz-Analyse als Objekt {titel, angle, hook, visual_hook, hauptteil, cta}. NULL = nur Fliesstext in beschreibung.';
