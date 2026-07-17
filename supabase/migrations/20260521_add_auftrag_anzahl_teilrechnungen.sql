begin;

alter table public.auftrag
  add column if not exists anzahl_teilrechnungen integer not null default 1;

alter table public.auftrag
  drop constraint if exists auftrag_anzahl_teilrechnungen_positive;

alter table public.auftrag
  add constraint auftrag_anzahl_teilrechnungen_positive
  check (anzahl_teilrechnungen >= 1);

comment on column public.auftrag.anzahl_teilrechnungen is
  'Anzahl geplanter Rechnungen/Teilrechnungen (Projekt-erstellen-Wizard)';

commit;
