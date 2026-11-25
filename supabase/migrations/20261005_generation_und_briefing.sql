-- Gesetzte Generation am Creator (sonst aus dem Geburtsdatum) und
-- die gesuchten Generationen am Briefing.

alter table public.creator
  add column if not exists generation_override text;

alter table public.campaign_briefings
  add column if not exists generationen text[],
  add column if not exists im_generationen text[],
  add column if not exists pa_generationen text[],
  add column if not exists os_generationen text[];
