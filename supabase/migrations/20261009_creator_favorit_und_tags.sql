-- Favorit: eine Zeile pro Person und Creator. Die Person setzt user_id,
-- der Client kann sich nicht als jemand anders eintragen.
-- Creator-Tag: eigene Liste, höchstens sieben pro Creator.
-- Buchungshäufigkeit: Anzahl der Kooperationen ab einem Zeitpunkt.

begin;

create table if not exists public.creator_favoriten (
  creator_id uuid not null references public.creator(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (creator_id, user_id)
);

create index if not exists idx_creator_favoriten_user
  on public.creator_favoriten (user_id);

create table if not exists public.creator_tag_typen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  constraint creator_tag_typen_name_unique unique (name)
);

create table if not exists public.creator_tags (
  creator_id uuid not null references public.creator(id) on delete cascade,
  tag_id uuid not null references public.creator_tag_typen(id) on delete cascade,
  primary key (creator_id, tag_id)
);

create index if not exists idx_creator_tags_tag
  on public.creator_tags (tag_id);

create index if not exists idx_kooperationen_creator_created
  on public.kooperationen (creator_id, created_at);

create or replace function private.creator_favorit_stamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'Nicht angemeldet';
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists creator_favorit_stamp on public.creator_favoriten;
create trigger creator_favorit_stamp
  before insert on public.creator_favoriten
  for each row execute function private.creator_favorit_stamp();

create or replace function private.creator_tag_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  vorhandene integer;
begin
  select count(*) into vorhandene
  from public.creator_tags
  where creator_id = new.creator_id;
  if vorhandene >= 7 then
    raise exception 'Höchstens sieben Creator-Tags';
  end if;
  return new;
end;
$$;

drop trigger if exists creator_tag_limit on public.creator_tags;
create trigger creator_tag_limit
  before insert on public.creator_tags
  for each row execute function private.creator_tag_limit();

create or replace function public.creator_buchung_anzahl(seit timestamptz)
returns table (creator_id uuid, anzahl integer)
language sql
stable
security invoker
set search_path = public
as $$
  select k.creator_id, count(*)::integer
  from public.kooperationen k
  where k.creator_id is not null
    and k.created_at >= seit
  group by k.creator_id;
$$;

alter table public.creator_favoriten enable row level security;
alter table public.creator_tag_typen enable row level security;
alter table public.creator_tags enable row level security;

drop policy if exists creator_favoriten_select on public.creator_favoriten;
create policy creator_favoriten_select on public.creator_favoriten
  for select to authenticated
  using ((select is_admin_or_mitarbeiter()));

drop policy if exists creator_favoriten_insert on public.creator_favoriten;
create policy creator_favoriten_insert on public.creator_favoriten
  for insert to authenticated
  with check ((select is_admin_or_mitarbeiter()));

drop policy if exists creator_favoriten_delete on public.creator_favoriten;
create policy creator_favoriten_delete on public.creator_favoriten
  for delete to authenticated
  using (
    (select is_admin_or_mitarbeiter())
    and user_id = (select auth.uid())
  );

drop policy if exists creator_tag_typen_all on public.creator_tag_typen;
create policy creator_tag_typen_all on public.creator_tag_typen
  for all to authenticated
  using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));

drop policy if exists creator_tags_all on public.creator_tags;
create policy creator_tags_all on public.creator_tags
  for all to authenticated
  using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));

revoke all on table public.creator_favoriten from public, anon, authenticated;
grant select, insert, delete on table public.creator_favoriten to authenticated;
grant select, insert, update, delete on table public.creator_favoriten to service_role;

revoke all on table public.creator_tag_typen from public, anon, authenticated;
grant select, insert, update, delete on table public.creator_tag_typen to authenticated;
grant select, insert, update, delete on table public.creator_tag_typen to service_role;

revoke all on table public.creator_tags from public, anon, authenticated;
grant select, insert, update, delete on table public.creator_tags to authenticated;
grant select, insert, update, delete on table public.creator_tags to service_role;

revoke all on function public.creator_buchung_anzahl(timestamptz) from public, anon;
grant execute on function public.creator_buchung_anzahl(timestamptz) to authenticated, service_role;

revoke all on function private.creator_favorit_stamp() from public, anon, authenticated;
revoke all on function private.creator_tag_limit() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.creator_favorit_stamp() to authenticated;
grant execute on function private.creator_tag_limit() to authenticated;

commit;
