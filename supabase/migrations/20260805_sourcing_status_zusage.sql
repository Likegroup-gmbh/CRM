-- Sourcing: "Zusage" als Status zwischen Verhandlung und Buchung.
--
-- Bisher sprang ein Creator von "In Verhandlung" direkt auf "Buchen". Dazwischen
-- fehlte die Etappe, in der er zugesagt hat, die Buchung aber noch nicht steht.
--
-- Wie die anderen Status ein eigenes Boolean plus Zeitstempel, damit der
-- Statusfilter darauf zugreifen kann und unter dem Select ein Datum steht.

alter table public.creator_auswahl_items
  add column if not exists zusage boolean not null default false,
  add column if not exists zusage_am timestamptz;

comment on column public.creator_auswahl_items.zusage is
  'Creator hat zugesagt, die Buchung steht aber noch aus.';
