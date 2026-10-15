-- Rolle agent: Konto fuer automatische Screenshots (Morgen-Update).
-- Liest ueber is_investor() alles, was investor liest. Schreiben sperren die
-- restriktiven agent_nur_lesen_*-Regeln unten, weil viele Tabellen
-- "Authenticated users full access" haben.

create or replace function public.is_investor()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from benutzer
    where auth_user_id = (select auth.uid())
      and rolle in ('investor', 'agent')
  );
$function$;

-- Agent-Konten sehen nur Admins (und das Konto sich selbst), damit sie in
-- Zuständigkeits-Dropdowns, Mitarbeiterlisten und Geburtstagen nicht auftauchen.
drop policy if exists benutzer_agent_nur_admins on public.benutzer;
create policy benutzer_agent_nur_admins on public.benutzer
  as restrictive
  for select
  to public
  using (
    rolle is distinct from 'agent'
    or auth_user_id = (select auth.uid())
    or (select public.is_admin())
  );

create or replace function public.is_agent()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from benutzer
    where auth_user_id = (select auth.uid())
      and rolle = 'agent'
  );
$function$;

-- Gilt nur fuer Tabellen, die beim Anwenden existieren. Neue Tabellen brauchen
-- die drei Regeln ebenfalls, sonst kann agent dort schreiben.
do $do$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relrowsecurity
  loop
    execute format('drop policy if exists agent_nur_lesen_insert on public.%I', t.relname);
    execute format('drop policy if exists agent_nur_lesen_update on public.%I', t.relname);
    execute format('drop policy if exists agent_nur_lesen_delete on public.%I', t.relname);
    execute format('create policy agent_nur_lesen_insert on public.%I as restrictive for insert to public with check (not (select public.is_agent()))', t.relname);
    execute format('create policy agent_nur_lesen_update on public.%I as restrictive for update to public using (not (select public.is_agent()))', t.relname);
    execute format('create policy agent_nur_lesen_delete on public.%I as restrictive for delete to public using (not (select public.is_agent()))', t.relname);
  end loop;
end
$do$;

drop policy if exists agent_nur_lesen_insert on storage.objects;
drop policy if exists agent_nur_lesen_update on storage.objects;
drop policy if exists agent_nur_lesen_delete on storage.objects;
create policy agent_nur_lesen_insert on storage.objects as restrictive for insert to public with check (not (select public.is_agent()));
create policy agent_nur_lesen_update on storage.objects as restrictive for update to public using (not (select public.is_agent()));
create policy agent_nur_lesen_delete on storage.objects as restrictive for delete to public using (not (select public.is_agent()));
