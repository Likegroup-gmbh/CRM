-- Migration: instagram_creators-Pool in die creator-Tabelle mergen, danach Pool-Tabellen droppen.
-- Alle 490 Pool-Eintraege waren per crm_creator_id verknuepft -> reiner Merge, keine Neuanlagen.
-- Thumbnails werden NICHT migriert (Meta-CDN-URLs sind abgelaufen); sie entstehen beim ersten
-- Connect-/Refresh-Klick. Transiente Fehler (Rate Limit) werden nicht uebernommen.

-- 1) Profile MIT Daten: IG-Felder mergen, ig_connected_at setzen
update public.creator c
set
  ig_username = ic.username,
  ig_biography = ic.biography,
  ig_media_count = ic.media_count,
  ig_engagement_rate = ic.engagement_rate,
  ig_brand_mentions = coalesce(to_jsonb(ic.brand_mentions), '[]'::jsonb),
  ig_recent_posts = coalesce((
    select jsonb_agg(jsonb_build_object(
      'caption', m.value->>'caption',
      'media_type', m.value->>'media_type',
      'permalink', m.value->>'permalink',
      'like_count', m.value->'like_count',
      'comments_count', m.value->'comments_count',
      'timestamp', m.value->>'timestamp',
      'thumbnail_path', null
    ) order by m.ord)
    from jsonb_array_elements(ic.recent_media) with ordinality m(value, ord)
    where m.ord <= 5
  ), '[]'::jsonb),
  instagram_follower = coalesce(ic.followers_count::integer, c.instagram_follower),
  ig_connected_at = ic.last_enriched_at,
  ig_last_error = null,
  -- KI-Schaetzwerte nur uebernehmen, wenn beim Creator nichts gepflegt ist
  alter_min = case
    when c.alter_min is null and c.alter_max is null and c.alter_jahre is null
      and ic.estimated_age_range ~ '^[0-9]+'
    then (substring(ic.estimated_age_range from '^[0-9]+'))::integer
    else c.alter_min
  end,
  alter_max = case
    when c.alter_min is null and c.alter_max is null and c.alter_jahre is null
      and ic.estimated_age_range ~ '-[0-9]+$'
    then (substring(ic.estimated_age_range from '-([0-9]+)$'))::integer
    else c.alter_max
  end,
  geschlecht = case
    when (c.geschlecht is null or c.geschlecht = '') and ic.estimated_gender = 'weiblich' then 'weiblich'
    when (c.geschlecht is null or c.geschlecht = '') and ic.estimated_gender = 'maennlich' then 'männlich'
    else c.geschlecht
  end
from public.instagram_creators ic
where ic.crm_creator_id = c.id
  and ic.followers_count is not null;

-- 2) Profile OHNE Daten: nur Username + letzten Fehler vermerken (Refresh via Connect-Button)
update public.creator c
set
  ig_username = ic.username,
  ig_last_error = ic.enrich_error
from public.instagram_creators ic
where ic.crm_creator_id = c.id
  and ic.followers_count is null;

-- 3) Pool-Tabellen entfernen (Discovery-Feature /instagram wurde abgebaut)
drop table if exists public.instagram_harvest_runs;
drop table if exists public.instagram_hashtag_seeds;
drop table if exists public.instagram_brands;
drop table if exists public.instagram_creators;
