-- Listen-Sharing per E-Mail (Gast-Zugang ohne Account)
-- Neue Tabelle list_shares, Rolle 'gast' (kein Constraint nötig),
-- Gast-RLS-Policies (additiv) und Feedback-Attribution für Sourcing/Strategie.

-- =====================================================================
-- 1) Tabelle list_shares
-- =====================================================================

create table if not exists public.list_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  entity_type text not null check (entity_type in ('kampagne', 'sourcing', 'strategie')),
  entity_id uuid not null,
  email text not null,
  rechte text not null default 'ansehen' check (rechte in ('ansehen', 'feedback')),
  gast_benutzer_id uuid references public.benutzer(id) on delete cascade,
  created_by uuid references public.benutzer(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_access_at timestamptz
);

create index if not exists idx_list_shares_gast on public.list_shares (gast_benutzer_id) where revoked_at is null;
create index if not exists idx_list_shares_entity on public.list_shares (entity_type, entity_id);
-- Pro E-Mail und Entität max. ein aktiver Share
create unique index if not exists uq_list_shares_active
  on public.list_shares (entity_type, entity_id, lower(email))
  where revoked_at is null;

alter table public.list_shares enable row level security;

-- Lesen: Staff sieht alles, Gäste nur ihre eigenen aktiven Shares
drop policy if exists list_shares_select on public.list_shares;
create policy list_shares_select on public.list_shares
  for select using (
    (select is_admin_or_mitarbeiter())
    or (gast_benutzer_id = (select get_current_benutzer_id()) and revoked_at is null)
  );

-- Ändern (Widerruf, Rechte): nur Staff
drop policy if exists list_shares_update on public.list_shares;
create policy list_shares_update on public.list_shares
  for update using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));

drop policy if exists list_shares_delete on public.list_shares;
create policy list_shares_delete on public.list_shares
  for delete using ((select is_admin()));

-- INSERT absichtlich ohne Policy: Anlegen läuft ausschließlich über die
-- Edge Function share-list (Service Key umgeht RLS).

-- =====================================================================
-- 2) Gast-Helper (SECURITY DEFINER, umgehen RLS der Untertabellen)
-- =====================================================================

create or replace function public.gast_has_share(p_entity_type text, p_entity_id uuid, p_write boolean default false)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from list_shares ls
    join benutzer b on b.id = ls.gast_benutzer_id
    where b.auth_user_id = (select auth.uid())
      and b.rolle = 'gast'
      and ls.entity_type = p_entity_type
      and ls.entity_id = p_entity_id
      and ls.revoked_at is null
      and (not p_write or ls.rechte = 'feedback')
  );
$$;

create or replace function public.gast_can_access_kooperation(p_kooperation_id uuid, p_write boolean default false)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from kooperationen k
    where k.id = p_kooperation_id
      and gast_has_share('kampagne', k.kampagne_id, p_write)
  );
$$;

create or replace function public.gast_can_access_video(p_video_id uuid, p_write boolean default false)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
    from kooperation_videos v
    join kooperationen k on k.id = v.kooperation_id
    where v.id = p_video_id
      and gast_has_share('kampagne', k.kampagne_id, p_write)
  );
$$;

create or replace function public.gast_can_see_creator(p_creator_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from kooperationen k
    where k.creator_id = p_creator_id
      and gast_has_share('kampagne', k.kampagne_id, false)
  );
$$;

create or replace function public.gast_can_see_unternehmen(p_unternehmen_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    exists (
      select 1 from kampagne k
      where k.unternehmen_id = p_unternehmen_id
        and gast_has_share('kampagne', k.id, false)
    )
    or exists (
      select 1 from creator_auswahl ca
      where ca.unternehmen_id = p_unternehmen_id
        and gast_has_share('sourcing', ca.id, false)
    )
    or exists (
      select 1 from strategie s
      where s.unternehmen_id = p_unternehmen_id
        and gast_has_share('strategie', s.id, false)
    );
$$;

create or replace function public.gast_can_see_marke(p_marke_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select
    exists (
      select 1 from kampagne k
      where k.marke_id = p_marke_id
        and gast_has_share('kampagne', k.id, false)
    )
    or exists (
      select 1 from creator_auswahl ca
      where ca.marke_id = p_marke_id
        and gast_has_share('sourcing', ca.id, false)
    )
    or exists (
      select 1 from strategie s
      where s.marke_id = p_marke_id
        and gast_has_share('strategie', s.id, false)
    );
$$;

-- last_access_at aktualisieren (Gast darf list_shares nicht direkt updaten)
create or replace function public.touch_list_share(p_token text)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update list_shares
  set last_access_at = now()
  where token = p_token
    and gast_benutzer_id = (select get_current_benutzer_id())
    and revoked_at is null;
$$;

-- =====================================================================
-- 3) Gast-Policies (additiv zu bestehenden Policies)
-- =====================================================================

-- Kampagne
drop policy if exists kampagne_gast_select on public.kampagne;
create policy kampagne_gast_select on public.kampagne
  for select using (gast_has_share('kampagne', id, false));

-- Kooperationen der geteilten Kampagne
drop policy if exists kooperationen_gast_select on public.kooperationen;
create policy kooperationen_gast_select on public.kooperationen
  for select using (gast_has_share('kampagne', kampagne_id, false));

-- Videos (Lesen immer, Schreiben nur mit Feedback-Recht — analog Kunde heute)
drop policy if exists kooperation_videos_gast_select on public.kooperation_videos;
create policy kooperation_videos_gast_select on public.kooperation_videos
  for select using (gast_can_access_kooperation(kooperation_id, false));

drop policy if exists kooperation_videos_gast_update on public.kooperation_videos;
create policy kooperation_videos_gast_update on public.kooperation_videos
  for update using (gast_can_access_kooperation(kooperation_id, true))
  with check (gast_can_access_kooperation(kooperation_id, true));

-- Video-Kommentare
drop policy if exists kooperation_video_comment_gast_select on public.kooperation_video_comment;
create policy kooperation_video_comment_gast_select on public.kooperation_video_comment
  for select using (gast_can_access_video(video_id, false));

drop policy if exists kooperation_video_comment_gast_insert on public.kooperation_video_comment;
create policy kooperation_video_comment_gast_insert on public.kooperation_video_comment
  for insert with check (gast_can_access_video(video_id, true));

drop policy if exists kooperation_video_comment_gast_update on public.kooperation_video_comment;
create policy kooperation_video_comment_gast_update on public.kooperation_video_comment
  for update using (gast_can_access_video(video_id, true))
  with check (gast_can_access_video(video_id, true));

-- Creator-Stammdaten (Anzeige in der Video-Tabelle)
drop policy if exists creator_gast_select on public.creator;
create policy creator_gast_select on public.creator
  for select using (gast_can_see_creator(id));

-- Unternehmen/Marke (Header/Breadcrumb der geteilten Liste)
drop policy if exists unternehmen_gast_select on public.unternehmen;
create policy unternehmen_gast_select on public.unternehmen
  for select using (gast_can_see_unternehmen(id));

drop policy if exists marke_gast_select on public.marke;
create policy marke_gast_select on public.marke
  for select using (gast_can_see_marke(id));

-- Sourcing (creator_auswahl + Items)
drop policy if exists creator_auswahl_gast_select on public.creator_auswahl;
create policy creator_auswahl_gast_select on public.creator_auswahl
  for select using (gast_has_share('sourcing', id, false));

drop policy if exists creator_auswahl_items_gast_select on public.creator_auswahl_items;
create policy creator_auswahl_items_gast_select on public.creator_auswahl_items
  for select using (gast_has_share('sourcing', creator_auswahl_id, false));

drop policy if exists creator_auswahl_items_gast_update on public.creator_auswahl_items;
create policy creator_auswahl_items_gast_update on public.creator_auswahl_items
  for update using (gast_has_share('sourcing', creator_auswahl_id, true))
  with check (gast_has_share('sourcing', creator_auswahl_id, true));

-- Strategie (strategie + Items)
drop policy if exists strategie_gast_select on public.strategie;
create policy strategie_gast_select on public.strategie
  for select using (gast_has_share('strategie', id, false));

drop policy if exists strategie_items_gast_select on public.strategie_items;
create policy strategie_items_gast_select on public.strategie_items
  for select using (gast_has_share('strategie', strategie_id, false));

drop policy if exists strategie_items_gast_update on public.strategie_items;
create policy strategie_items_gast_update on public.strategie_items
  for update using (gast_has_share('strategie', strategie_id, true))
  with check (gast_has_share('strategie', strategie_id, true));

-- =====================================================================
-- 4) Feedback-Attribution nachrüsten (gilt auch für normale Kunden)
-- =====================================================================

alter table public.creator_auswahl_items
  add column if not exists feedback_kunde_author_name text,
  add column if not exists feedback_kunde_updated_at timestamptz;

alter table public.strategie_items
  add column if not exists kunde_anmerkung_author_name text,
  add column if not exists kunde_anmerkung_updated_at timestamptz;
