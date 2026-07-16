begin;

-- Firmen als eigene Entity (analog management), verknuepft mit Creators via creator_firma
create table if not exists public.firma (
  id uuid primary key default gen_random_uuid(),
  firmenname text not null,
  strasse text,
  hausnummer text,
  plz text,
  stadt text,
  land text default 'Deutschland',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.creator_firma (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator(id) on delete cascade,
  firma_id uuid not null references public.firma(id) on delete cascade,
  ist_aktiv boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint creator_firma_creator_firma_unique unique (creator_id, firma_id)
);

create index if not exists idx_creator_firma_creator_id on public.creator_firma (creator_id);
create index if not exists idx_creator_firma_firma_id on public.creator_firma (firma_id);

-- updated_at Trigger (generische Funktion existiert bereits)
create trigger trigger_firma_updated_at
  before update on public.firma
  for each row execute function update_updated_at_column();

create trigger trigger_creator_firma_updated_at
  before update on public.creator_firma
  for each row execute function update_updated_at_column();

-- RLS analog zu management / creator_management
alter table public.firma enable row level security;
alter table public.creator_firma enable row level security;

create policy firma_select on public.firma
  for select to authenticated using (true);
create policy firma_insert on public.firma
  for insert with check ((select is_admin_or_mitarbeiter()));
create policy firma_update on public.firma
  for update using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));
create policy firma_delete on public.firma
  for delete using ((select is_admin_or_mitarbeiter()));
create policy firma_no_gast on public.firma
  for all using (not current_role_is_gast())
  with check (not current_role_is_gast());

create policy creator_firma_select on public.creator_firma
  for select to authenticated using (true);
create policy creator_firma_insert on public.creator_firma
  for insert with check ((select is_admin_or_mitarbeiter()));
create policy creator_firma_update on public.creator_firma
  for update using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));
create policy creator_firma_delete on public.creator_firma
  for delete using ((select is_admin_or_mitarbeiter()));
create policy creator_firma_no_gast on public.creator_firma
  for all using (not current_role_is_gast())
  with check (not current_role_is_gast());

commit;
