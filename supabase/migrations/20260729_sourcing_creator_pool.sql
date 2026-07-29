-- Sourcing Creator Pool: ein Datensatz pro Instagram-Handle, geteilt ueber alle
-- Sourcing-Listen hinweg.
--
-- Hintergrund: derselbe Creator landet in vielen Listen. Bisher hat jeder
-- Haekchen-Button einen eigenen Meta-Abruf ausgeloest und die Daten
-- denormalisiert in die Zeile geschrieben - gleicher Creator, n-mal Quota,
-- keine Verbindung zwischen den Zeilen. Der Pool ist der Cache davor:
-- ist der Handle bekannt, werden die Werte aus dem Pool in die Zeile kopiert,
-- ein Meta-Abruf passiert nur beim Erstkontakt oder auf ausdruecklichen
-- Refresh (force) hin.
--
-- Die Zeilen in creator_auswahl_items behalten ihre eigenen Kopien: Preise,
-- Notizen, Feedback und Status sind listenspezifisch und duerfen sich nicht
-- gegenseitig ueberschreiben.
--
-- Geschrieben wird ausschliesslich von netlify/functions/sourcing-instagram-stats.js
-- mit der Service Role.

create table if not exists public.sourcing_creator (
  id uuid primary key default gen_random_uuid(),
  ig_username text not null unique,
  link_instagram text,
  name text,
  profile_image_url text,
  follower_instagram integer,
  reichweite_instagram text,
  email text,
  telefon text,
  wohnort text,
  ig_views_8 integer,
  ig_views_30 integer,
  ig_views_trimmed integer,
  cpm_ig_8 numeric,
  cpm_ig_30 numeric,
  cpm_ig_trimmed numeric,
  ig_stats jsonb not null default '{}'::jsonb,
  ig_fetched_at timestamptz,
  ig_fetch_error text,
  crm_creator_id uuid references public.creator(id) on delete set null,
  created_by uuid references public.benutzer(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sourcing_creator is
  'Creator-Pool fuer das Sourcing: ein Eintrag pro Instagram-Handle (normalisiert, lowercase). Cache vor der Meta Business Discovery, damit derselbe Creator in mehreren Listen nur einmal abgerufen wird.';
comment on column public.sourcing_creator.ig_username is
  'Normalisierter Handle (lowercase, ohne @ und URL-Reste) - Dedupe-Schluessel.';
comment on column public.sourcing_creator.crm_creator_id is
  'Optionale Verknuepfung zum CRM-Creator. Aktuell nur vorbereitet, wird noch nicht gepflegt.';

alter table public.creator_auswahl_items
  add column if not exists sourcing_creator_id uuid
    references public.sourcing_creator(id) on delete set null;

create index if not exists idx_cai_sourcing_creator
  on public.creator_auswahl_items (sourcing_creator_id);

-- RLS: Lesen nur Admin/Mitarbeiter, Schreiben nur Service Role (bypassed RLS).
-- Wichtig: der Pool haelt email, telefon und wohnort - genau die Felder, die in
-- der Tabelle als NUR_INTERN gelten. Ein "to authenticated using (true)" waere
-- hier ein Leck, weil Kunden und Gaeste ebenfalls authenticated sind.
alter table public.sourcing_creator enable row level security;

drop policy if exists "sourcing_creator_select" on public.sourcing_creator;
create policy "sourcing_creator_select" on public.sourcing_creator
  for select to authenticated using (public.is_admin_or_mitarbeiter());

-- Backfill: bereits abgerufene Zeilen in den Pool heben. Pro Handle gewinnt
-- der juengste Abruf. Die Handle-Normalisierung entspricht normalizeUsername()
-- aus netlify/functions/_shared/instagram-graph.js.
insert into public.sourcing_creator (
  ig_username, link_instagram, name, profile_image_url, follower_instagram,
  reichweite_instagram, email, telefon, wohnort,
  ig_views_8, ig_views_30, ig_views_trimmed,
  cpm_ig_8, cpm_ig_30, cpm_ig_trimmed,
  ig_stats, ig_fetched_at, created_by
)
select distinct on (u.username)
  u.username,
  'https://www.instagram.com/' || u.username || '/',
  nullif(btrim(coalesce(i.name, '')), ''),
  i.profile_image_url,
  i.follower_instagram,
  i.reichweite_instagram,
  nullif(btrim(coalesce(i.email, '')), ''),
  nullif(btrim(coalesce(i.telefon, '')), ''),
  nullif(btrim(coalesce(i.wohnort, '')), ''),
  i.ig_views_8, i.ig_views_30, i.ig_views_trimmed,
  i.cpm_ig_8, i.cpm_ig_30, i.cpm_ig_trimmed,
  coalesce(i.ig_stats, '{}'::jsonb),
  i.ig_fetched_at,
  i.created_by
from public.creator_auswahl_items i
cross join lateral (
  select lower(regexp_replace(
    regexp_replace(coalesce(i.link_instagram, ''), '^https?://(www\.)?instagram\.com/', '', 'i'),
    '[/?#].*$', ''
  )) as username
) u
where i.ig_fetched_at is not null
  and i.ig_fetch_error is null
  and u.username ~ '^[a-z0-9._]{1,30}$'
order by u.username, i.ig_fetched_at desc
on conflict (ig_username) do nothing;

-- Alle Zeilen mit passendem Handle verknuepfen, auch die noch nie abgerufenen.
update public.creator_auswahl_items i
set sourcing_creator_id = sc.id
from public.sourcing_creator sc
where i.sourcing_creator_id is null
  and sc.ig_username = lower(regexp_replace(
    regexp_replace(coalesce(i.link_instagram, ''), '^https?://(www\.)?instagram\.com/', '', 'i'),
    '[/?#].*$', ''
  ));
