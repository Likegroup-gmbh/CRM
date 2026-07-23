-- Geschaetztes Geschlecht des Creators (LLM-Schaetzung aus Name/Bio/Captions).
-- Werte: 'weiblich' | 'maennlich' | null (unklar, Paar- oder Brand-Account).
alter table public.instagram_creators
  add column if not exists estimated_gender text
  check (estimated_gender in ('weiblich', 'maennlich'));
