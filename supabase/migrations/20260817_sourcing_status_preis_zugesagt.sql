-- Sourcing: "Preis zugesagt" als Status zwischen Verhandlung und Zusage.
--
-- Bisher sprang ein Creator von "In Verhandlung" direkt auf "Zusage". Dazwischen
-- fehlte die Etappe, in der der Preis steht, die vollstaendige Zusage aber noch
-- nicht.
--
-- Wie die anderen Status ein eigenes Boolean plus Zeitstempel, damit der
-- Statusfilter darauf zugreifen kann und unter dem Select ein Datum steht.

alter table public.creator_auswahl_items
  add column if not exists preis_zugesagt boolean not null default false,
  add column if not exists preis_zugesagt_am timestamptz;

comment on column public.creator_auswahl_items.preis_zugesagt is
  'Creator hat den Preis bestaetigt, die vollstaendige Zusage steht noch aus.';
