-- Eine Rezension pro Kooperation. Der Creator-Schnitt liegt auf creator,
-- damit die Übersicht danach filtern kann, ohne die Liste der Rezensionen
-- in die Paginierung zu ziehen. Der Mittelwert bleibt ungerundet.
-- Gelöscht wird eine Rezension nicht: authenticated bekommt kein DELETE.

begin;

create schema if not exists private;

alter table public.creator
  add column if not exists rezension_schnitt numeric;

create table if not exists public.rezensionen (
  id uuid primary key default gen_random_uuid(),
  kooperation_id uuid not null references public.kooperationen(id) on delete cascade,
  creator_id uuid not null references public.creator(id) on delete cascade,
  produktionsqualitaet smallint not null check (produktionsqualitaet between 1 and 5),
  kommunikation_verlaesslichkeit smallint not null check (kommunikation_verlaesslichkeit between 1 and 5),
  kommentar text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rezensionen_eine_pro_kooperation unique (kooperation_id)
);

create index if not exists idx_rezensionen_creator on public.rezensionen (creator_id);
create index if not exists idx_creator_rezension_schnitt
  on public.creator (rezension_schnitt)
  where rezension_schnitt is not null;

-- Autor und Creator setzt die Datenbank, nicht der Client.
create or replace function private.rezension_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  if tg_op = 'INSERT' then
    select k.creator_id into owner
    from public.kooperationen k
    where k.id = new.kooperation_id;
    if owner is null then
      raise exception 'Die Kooperation hat keinen Creator';
    end if;
    new.creator_id := owner;
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  new.id := old.id;
  new.kooperation_id := old.kooperation_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if current_setting('app.rezension_move', true) = '1' then
    new.updated_by := old.updated_by;
    new.updated_at := old.updated_at;
  else
    new.creator_id := old.creator_id;
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function private.refresh_rezension_schnitt(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target is null then
    return;
  end if;
  perform set_config('app.rezension_schnitt', '1', true);
  update public.creator
  set rezension_schnitt = (
    select avg((r.produktionsqualitaet + r.kommunikation_verlaesslichkeit)::numeric / 2)
    from public.rezensionen r
    where r.creator_id = target
  )
  where id = target;
end;
$$;

create or replace function private.rezension_refresh()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.creator_id, old.creator_id);
  perform private.refresh_rezension_schnitt(target);
  if tg_op = 'UPDATE' and old.creator_id is distinct from new.creator_id then
    perform private.refresh_rezension_schnitt(old.creator_id);
  end if;
  return null;
end;
$$;

-- Client-Schreibzugriffe dürfen den Schnitt nicht selbst setzen.
create or replace function private.creator_keep_rezension_schnitt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.rezension_schnitt', true) = '1' then
    return new;
  end if;
  new.rezension_schnitt := old.rezension_schnitt;
  return new;
end;
$$;

create or replace function private.kooperation_rezension_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.creator_id is not distinct from old.creator_id then
    return new;
  end if;
  perform set_config('app.rezension_move', '1', true);
  update public.rezensionen
  set creator_id = new.creator_id
  where kooperation_id = new.id;
  return new;
end;
$$;

drop trigger if exists rezension_stamp on public.rezensionen;
create trigger rezension_stamp
  before insert or update on public.rezensionen
  for each row execute function private.rezension_stamp();

drop trigger if exists rezension_refresh on public.rezensionen;
create constraint trigger rezension_refresh
  after insert or update or delete on public.rezensionen
  deferrable initially deferred
  for each row
  execute function private.rezension_refresh();

drop trigger if exists creator_keep_rezension_schnitt on public.creator;
create trigger creator_keep_rezension_schnitt
  before update on public.creator
  for each row execute function private.creator_keep_rezension_schnitt();

drop trigger if exists kooperation_rezension_creator on public.kooperationen;
create trigger kooperation_rezension_creator
  after update of creator_id on public.kooperationen
  for each row execute function private.kooperation_rezension_creator();

alter table public.rezensionen enable row level security;

drop policy if exists rezensionen_select on public.rezensionen;
create policy rezensionen_select on public.rezensionen
  for select to authenticated
  using ((select is_admin_or_mitarbeiter()));

drop policy if exists rezensionen_insert on public.rezensionen;
create policy rezensionen_insert on public.rezensionen
  for insert to authenticated
  with check ((select is_admin_or_mitarbeiter()));

drop policy if exists rezensionen_update on public.rezensionen;
create policy rezensionen_update on public.rezensionen
  for update to authenticated
  using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));

revoke all on table public.rezensionen from public, anon, authenticated;
grant select, insert, update on table public.rezensionen to authenticated;
grant select, insert, update, delete on table public.rezensionen to service_role;

revoke all on function private.rezension_stamp() from public, anon, authenticated;
revoke all on function private.rezension_refresh() from public, anon, authenticated;
revoke all on function private.refresh_rezension_schnitt(uuid) from public, anon, authenticated;
revoke all on function private.creator_keep_rezension_schnitt() from public, anon, authenticated;
revoke all on function private.kooperation_rezension_creator() from public, anon, authenticated;

-- Trigger laufen als auslösende Rolle und brauchen EXECUTE. Das Schema
-- private liegt nicht in der Data API, der Schnitt lässt sich so nicht setzen.
grant usage on schema private to authenticated;
grant execute on function private.rezension_stamp() to authenticated;
grant execute on function private.rezension_refresh() to authenticated;
grant execute on function private.creator_keep_rezension_schnitt() to authenticated;
grant execute on function private.kooperation_rezension_creator() to authenticated;

commit;
