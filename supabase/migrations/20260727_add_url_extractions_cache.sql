-- Cache fuer die Webseiten-Extraktion (Netlify Function "site-extract")
-- Derselbe Link im Erstellungsformular soll nicht jedes Mal einen erneuten
-- Crawl plus Claude-Aufruf kosten. TTL wird beim Lesen geprueft (30 Tage).
-- spec_version kommt aus netlify/functions/_shared/extract-specs.js: aendert
-- sich die Feldspezifikation, greifen alte Eintraege nicht mehr.

create table if not exists public.url_extractions (
  id uuid primary key default gen_random_uuid(),
  url_hash text not null,
  url text not null,
  entity_type text not null,
  spec_version integer not null default 1,
  source text,
  result jsonb not null,
  created_at timestamptz not null default now()
);

comment on table public.url_extractions is 'Cache der site-extract-Ergebnisse pro URL, Entitaet und Spec-Version. Wird ausschliesslich von Netlify Functions (Service Role) geschrieben.';

create unique index if not exists url_extractions_key_idx
  on public.url_extractions (url_hash, entity_type, spec_version);

create index if not exists url_extractions_created_at_idx
  on public.url_extractions (created_at desc);

alter table public.url_extractions enable row level security;

-- Kein Policy fuer authenticated: der Zugriff laeuft nur ueber die Function
-- mit Service-Key, das Frontend spricht die Tabelle nie direkt an.
