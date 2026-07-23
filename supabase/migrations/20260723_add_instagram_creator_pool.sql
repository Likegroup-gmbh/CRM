-- Instagram Creator Pool: Basis fuer KI-Discovery (/instagram)
-- Befuellt durch CRM-Backfill + naechtlichen Hashtag-Harvester (Netlify Functions, Service Role)
-- Angewendet auf Prod: 2026-07-23 (via MCP apply_migration "add_instagram_creator_pool")

create table if not exists public.instagram_creators (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  ig_id text,
  name text,
  biography text,
  website text,
  followers_count bigint,
  media_count integer,
  engagement_rate numeric,
  topics text[] not null default '{}',
  brand_mentions text[] not null default '{}',
  estimated_age_range text,
  profile_picture_url text,
  recent_media jsonb not null default '[]'::jsonb,
  source text not null default 'crm' check (source in ('crm','harvest','manual')),
  crm_creator_id uuid references public.creator(id) on delete set null,
  found_via_hashtag text,
  enrich_error text,
  last_enriched_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.instagram_creators is 'Instagram-Profil-Pool fuer Creator Discovery. Angereichert via Meta Business Discovery + Claude-Tagging. estimated_age_range ist eine LLM-Schaetzung.';

create index if not exists idx_instagram_creators_followers on public.instagram_creators (followers_count desc nulls last);
create index if not exists idx_instagram_creators_engagement on public.instagram_creators (engagement_rate desc nulls last);
create index if not exists idx_instagram_creators_topics on public.instagram_creators using gin (topics);
create index if not exists idx_instagram_creators_brands on public.instagram_creators using gin (brand_mentions);

create table if not exists public.instagram_hashtag_seeds (
  id uuid primary key default gen_random_uuid(),
  hashtag text not null unique,
  aktiv boolean not null default true,
  last_run_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

comment on table public.instagram_hashtag_seeds is 'Hashtags, die der naechtliche Harvester abgrast (Rotation ueber last_run_at, max 30 unique Hashtags/Woche laut Meta-Limit).';

create table if not exists public.instagram_harvest_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running','done','error')),
  trigger_type text not null default 'schedule' check (trigger_type in ('schedule','manual','backfill')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

comment on table public.instagram_harvest_runs is 'Log pro Harvest-/Backfill-Lauf fuer die Admin-Anzeige auf /instagram.';

-- RLS: Lesen fuer eingeloggte User, Schreiben nur Service Role (bypassed RLS)
alter table public.instagram_creators enable row level security;
alter table public.instagram_hashtag_seeds enable row level security;
alter table public.instagram_harvest_runs enable row level security;

create policy "instagram_creators_select" on public.instagram_creators
  for select to authenticated using (true);

create policy "instagram_hashtag_seeds_select" on public.instagram_hashtag_seeds
  for select to authenticated using (true);

create policy "instagram_harvest_runs_select" on public.instagram_harvest_runs
  for select to authenticated using (true);
