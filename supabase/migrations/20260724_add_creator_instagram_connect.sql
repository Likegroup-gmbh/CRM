-- Instagram Connect: IG-Daten direkt am Creator + Storage-Bucket fuer Thumbnails
-- Befuellt durch Netlify Function instagram-connect (Service Role)

alter table public.creator
  add column if not exists ig_username text,
  add column if not exists ig_biography text,
  add column if not exists ig_media_count integer,
  add column if not exists ig_engagement_rate numeric,
  add column if not exists ig_brand_mentions jsonb not null default '[]'::jsonb,
  add column if not exists ig_recent_posts jsonb not null default '[]'::jsonb,
  add column if not exists profilbild_url text,
  add column if not exists ig_connected_at timestamptz,
  add column if not exists ig_last_error text;

comment on column public.creator.ig_username is 'Normalisierter Instagram-Username (aus creator.instagram abgeleitet beim Connect)';
comment on column public.creator.ig_brand_mentions is 'Array von Brand-Handles aus werbe-gekennzeichneten Captions (#werbung/#ad Heuristik)';
comment on column public.creator.ig_recent_posts is 'Letzte 5 Posts/Reels: caption, media_type, permalink, like_count, comments_count, timestamp, thumbnail_path';
comment on column public.creator.ig_connected_at is 'Zeitpunkt des letzten erfolgreichen Instagram-Connect/Refresh';

-- Storage-Bucket fuer komprimierte Profilbilder + Post-Thumbnails (WebP)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'instagram-media',
  'instagram-media',
  true,
  2097152, -- 2 MB
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Lesen fuer alle (public bucket); Schreiben ausschliesslich via Service Role (bypassed RLS)
create policy "Public read access for instagram media"
on storage.objects for select
to public
using (bucket_id = 'instagram-media');
