-- Job-Tabelle fuer die Webseiten-Extraktion (site-extract-background).
-- Muster wie skript_generation_jobs: Client legt die Zeile an und pollt sie,
-- die Background Function (Service Role) schreibt Fortschritt und Ergebnis.
create table public.extract_jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  entity_type text not null,
  status varchar not null default 'pending',
  progress_step varchar,
  result jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.extract_jobs is 'Jobs der Webseiten-Extraktion (site-extract-background). Client legt an und pollt, Netlify Function (Service Role) schreibt Status, Fortschritt und Ergebnis. Alte Jobs raeumt cleanup-temp-produktbilder taeglich ab.';

create trigger extract_jobs_updated_at
  before update on public.extract_jobs
  for each row execute function update_updated_at_column();

alter table public.extract_jobs enable row level security;

-- Anlegen: nur Mitarbeiter/Admin, und nur im eigenen Namen
create policy extract_jobs_insert on public.extract_jobs
  for insert with check (
    (select is_admin_or_mitarbeiter()) and created_by = (select auth.uid())
  );

-- Lesen: nur die eigenen Jobs
create policy extract_jobs_select on public.extract_jobs
  for select using (created_by = (select auth.uid()));

-- Kein UPDATE/DELETE fuer Clients: schreibt ausschliesslich die Function (Service Role)
