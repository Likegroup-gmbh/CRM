begin;

create table if not exists public.delete_logs (
  id uuid default gen_random_uuid() primary key,
  deleted_entity_type text not null,
  deleted_entity_id uuid not null,
  failed_step text not null,
  failed_entity_id uuid,
  error_message text not null,
  created_at timestamptz default now() not null,
  created_by uuid references public.benutzer(id) on delete set null
);

comment on table public.delete_logs is
  'Protokolliert fehlgeschlagene Löschschritte bei der DSGVO-konformen Kaskadenlöschung.';

alter table public.delete_logs enable row level security;

create policy "Admins können delete_logs lesen"
  on public.delete_logs for select
  using (true);

create policy "Authenticated können delete_logs einfügen"
  on public.delete_logs for insert
  with check (true);

commit;
