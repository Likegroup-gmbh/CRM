begin;

alter table public.vertraege
  add column if not exists mehrere_rechnungen_erlaubt boolean not null default false;

commit;
