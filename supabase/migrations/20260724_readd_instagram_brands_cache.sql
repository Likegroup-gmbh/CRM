-- Brand-Cache erneut anlegen: wurde in 20260724_migrate_instagram_pool_to_creator
-- zusammen mit dem instagram_creators-Pool gedroppt. Fuer die Creator-Grid-Karten
-- (Kooperations-Bubbles) loesen wir Instagram-Werbepartner-Handles jetzt direkt beim
-- Connect/Refresh eines Creators auf (netlify/functions/instagram-connect.js) und
-- cachen Name + Profilbild hier. Befuellt durch Netlify Functions (Service Role).

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

comment on table public.instagram_brands is 'Cache fuer Brand-Profile (Logo + Name) zu ig_brand_mentions. Instagram-CDN-Bildlinks laufen ab; Logos werden als WebP in Storage (brands/{username}.webp) kopiert. Refresh via last_fetched_at.';

alter table public.instagram_brands enable row level security;

drop policy if exists "instagram_brands_select" on public.instagram_brands;
create policy "instagram_brands_select" on public.instagram_brands
  for select to authenticated using (true);
