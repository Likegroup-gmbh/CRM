begin;

alter table public.creator
  add column if not exists geburtsdatum date;

alter table public.creator
  add column if not exists hauptplattform text;

alter table public.creator
  drop constraint if exists creator_hauptplattform_check;

alter table public.creator
  add constraint creator_hauptplattform_check
  check (hauptplattform is null or hauptplattform in ('instagram', 'tiktok'));

alter table public.creator
  add column if not exists stilbeschreibung text;

alter table public.creator
  add column if not exists telefon_nicht_vorhanden boolean not null default false;

alter table public.creator
  add column if not exists groesse text;

comment on column public.creator.geburtsdatum is
  'Quelle für Alter und Generation einer einzelnen Person. Paar, Familie und Tier-Account haben keins.';
comment on column public.creator.hauptplattform is
  'Manuelle Hauptplattform. Leer heißt: die Plattform mit den meisten Followern, bei Gleichstand Instagram.';
comment on column public.creator.stilbeschreibung is
  'Kurzer Satz, wie der Creator wirkt. Nicht die Instagram-Bio und nicht die Notiz.';
comment on column public.creator.groesse is
  'Abgeleitete Reichweitenklasse. Wird vom Trigger gesetzt, nicht von Hand gepflegt.';

create or replace function public.creator_groesse_label(ig numeric, tt numeric, plattform text)
returns text
language plpgsql
immutable
as $$
declare
  basis numeric;
begin
  if plattform = 'tiktok' then
    basis := tt;
  elsif plattform = 'instagram' then
    basis := ig;
  elsif tt is not null and (ig is null or tt > ig) then
    basis := tt;
  else
    basis := ig;
  end if;

  if basis is null or basis < 0 then
    return null;
  elsif basis < 10000 then
    return 'Nano';
  elsif basis < 100000 then
    return 'Micro';
  elsif basis < 500000 then
    return 'Mid-Tier';
  elsif basis < 1000000 then
    return 'Macro';
  else
    return 'Hero';
  end if;
end;
$$;

create or replace function public.creator_set_groesse()
returns trigger
language plpgsql
as $$
begin
  new.groesse := public.creator_groesse_label(new.instagram_follower, new.tiktok_follower, new.hauptplattform);
  return new;
end;
$$;

drop trigger if exists trigger_creator_set_groesse on public.creator;
create trigger trigger_creator_set_groesse
  before insert or update of instagram_follower, tiktok_follower, hauptplattform
  on public.creator
  for each row execute function public.creator_set_groesse();

update public.creator
set groesse = public.creator_groesse_label(instagram_follower, tiktok_follower, hauptplattform);

create table if not exists public.besitz (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now(),
  constraint besitz_name_unique unique (name)
);

create table if not exists public.creator_besitz (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator(id) on delete cascade,
  besitz_id uuid not null references public.besitz(id) on delete cascade,
  created_at timestamptz default now(),
  constraint creator_besitz_unique unique (creator_id, besitz_id)
);

create index if not exists idx_creator_besitz_creator on public.creator_besitz (creator_id);
create index if not exists idx_creator_besitz_besitz on public.creator_besitz (besitz_id);

create table if not exists public.creator_ansprechpartner (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator(id) on delete cascade,
  ansprechpartner_id uuid not null references public.ansprechpartner(id) on delete cascade,
  created_at timestamptz default now(),
  constraint creator_ansprechpartner_unique unique (creator_id, ansprechpartner_id)
);

create index if not exists idx_creator_ansprechpartner_creator on public.creator_ansprechpartner (creator_id);

alter table public.besitz enable row level security;
alter table public.creator_besitz enable row level security;
alter table public.creator_ansprechpartner enable row level security;

drop policy if exists besitz_select on public.besitz;
create policy besitz_select on public.besitz
  for select to authenticated using (true);
drop policy if exists besitz_insert on public.besitz;
create policy besitz_insert on public.besitz
  for insert with check ((select is_admin_or_mitarbeiter()));
drop policy if exists besitz_update on public.besitz;
create policy besitz_update on public.besitz
  for update using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));
drop policy if exists besitz_delete on public.besitz;
create policy besitz_delete on public.besitz
  for delete using ((select is_admin_or_mitarbeiter()));

drop policy if exists creator_besitz_select on public.creator_besitz;
create policy creator_besitz_select on public.creator_besitz
  for select to authenticated using (true);
drop policy if exists creator_besitz_insert on public.creator_besitz;
create policy creator_besitz_insert on public.creator_besitz
  for insert with check ((select is_admin_or_mitarbeiter()));
drop policy if exists creator_besitz_delete on public.creator_besitz;
create policy creator_besitz_delete on public.creator_besitz
  for delete using ((select is_admin_or_mitarbeiter()));

drop policy if exists creator_ansprechpartner_select on public.creator_ansprechpartner;
create policy creator_ansprechpartner_select on public.creator_ansprechpartner
  for select to authenticated using (true);
drop policy if exists creator_ansprechpartner_insert on public.creator_ansprechpartner;
create policy creator_ansprechpartner_insert on public.creator_ansprechpartner
  for insert with check ((select is_admin_or_mitarbeiter()));
drop policy if exists creator_ansprechpartner_delete on public.creator_ansprechpartner;
create policy creator_ansprechpartner_delete on public.creator_ansprechpartner
  for delete using ((select is_admin_or_mitarbeiter()));

grant select, insert, update, delete on public.besitz to anon, authenticated, service_role;
grant select, insert, update, delete on public.creator_besitz to anon, authenticated, service_role;
grant select, insert, update, delete on public.creator_ansprechpartner to anon, authenticated, service_role;

commit;
