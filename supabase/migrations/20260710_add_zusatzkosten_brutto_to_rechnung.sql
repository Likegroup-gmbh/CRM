begin;

alter table public.rechnung
  add column if not exists zusatzkosten_brutto boolean not null default false;

commit;
