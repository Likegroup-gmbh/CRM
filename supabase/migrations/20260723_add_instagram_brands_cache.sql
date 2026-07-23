-- Brand-Cache fuer Kooperations-Bubbles auf /instagram
-- Loest brand_mentions-Handles (aus instagram_creators) einmalig via Business
-- Discovery auf: Name + Profilbild. Befuellt durch Netlify Functions (Service Role).
-- Angewendet auf Prod: 2026-07-23 (via MCP apply_migration "add_instagram_brands_cache")

create table if not exists public.instagram_brands (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  name text,
  profile_picture_url text,
  followers_count bigint,
  lookup_error text,
  last_fetched_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.instagram_brands is 'Cache fuer Brand-Profile (Logo + Name) zu brand_mentions aus instagram_creators. Instagram-CDN-Bildlinks laufen ab, daher Refresh via last_fetched_at.';

alter table public.instagram_brands enable row level security;

create policy "instagram_brands_select" on public.instagram_brands
  for select to authenticated using (true);
