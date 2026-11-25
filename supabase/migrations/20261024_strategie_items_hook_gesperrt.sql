-- Hook-Sperre (ADR 0054): der gesprochene Hook einer Videoreferenz ist vom Kunden
-- freigegeben. Liky uebernimmt ihn woertlich ins Skript und aendert ihn nie.
-- Eigene Spalte statt Feld in beschreibung_struktur: "Neu analysieren" und
-- Freitext-Aenderungen setzen die Struktur zurueck und wuerden das Flag mitnehmen.
-- Der Hook-Text selbst bleibt in beschreibung_struktur.hook.

alter table public.strategie_items
  add column if not exists hook_gesperrt boolean not null default false;

comment on column public.strategie_items.hook_gesperrt is
  'true = gesprochener Hook (beschreibung_struktur.hook) ist vom Kunden freigegeben; Liky aendert ihn nicht. Nur mit gefuelltem Hook.';
