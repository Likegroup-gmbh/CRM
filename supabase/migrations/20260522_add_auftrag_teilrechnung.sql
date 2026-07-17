begin;

create table if not exists public.auftrag_teilrechnung (
  id uuid primary key default gen_random_uuid(),
  auftrag_id uuid not null references public.auftrag(id) on delete cascade,
  position integer not null,
  nettobetrag numeric default 0,
  ust_prozent numeric default 19,
  ust_betrag numeric,
  bruttobetrag numeric,
  re_nr varchar,
  externe_po text,
  rechnung_gestellt boolean default false,
  rechnung_gestellt_am timestamptz,
  re_faelligkeit date,
  ueberwiesen boolean default false,
  ueberwiesen_am timestamptz,
  erwarteter_monat_zahlungseingang date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auftrag_teilrechnung_position_positive
    check (position >= 1),
  constraint auftrag_teilrechnung_unique_position
    unique (auftrag_id, position)
);

create index if not exists idx_auftrag_teilrechnung_auftrag_id
  on public.auftrag_teilrechnung(auftrag_id, position);

alter table public.auftrag_teilrechnung enable row level security;

drop policy if exists auftrag_teilrechnung_select on public.auftrag_teilrechnung;
create policy auftrag_teilrechnung_select
  on public.auftrag_teilrechnung
  for select
  to authenticated
  using (true);

drop policy if exists auftrag_teilrechnung_insert on public.auftrag_teilrechnung;
create policy auftrag_teilrechnung_insert
  on public.auftrag_teilrechnung
  for insert
  to authenticated
  with check (true);

drop policy if exists auftrag_teilrechnung_update on public.auftrag_teilrechnung;
create policy auftrag_teilrechnung_update
  on public.auftrag_teilrechnung
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists auftrag_teilrechnung_delete on public.auftrag_teilrechnung;
create policy auftrag_teilrechnung_delete
  on public.auftrag_teilrechnung
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.auftrag_teilrechnung to authenticated;

commit;
