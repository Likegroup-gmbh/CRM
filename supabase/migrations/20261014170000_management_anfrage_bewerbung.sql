-- Management-Anfrage: ein Link pro Mail, Bewerbungen unsichtbar fuer den Kunden.
-- Anon und Kunden haben keinen Zugriff. Eintraege legt nur die Service-Role an.

create table if not exists public.management_anfrage_link (
  id uuid primary key default gen_random_uuid(),
  creator_auswahl_id uuid not null references public.creator_auswahl(id) on delete cascade,
  management_id uuid not null references public.management(id),
  ansprechpartner_id uuid references public.ansprechpartner(id),
  email text not null,
  token_hash text not null unique,
  betreff text,
  body text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists management_anfrage_link_casting_idx
  on public.management_anfrage_link (creator_auswahl_id);

create table if not exists public.bewerbung (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.management_anfrage_link(id) on delete cascade,
  creator_auswahl_id uuid not null references public.creator_auswahl(id) on delete cascade,
  management_id uuid not null references public.management(id),
  ansprechpartner_id uuid references public.ansprechpartner(id),
  vorname text not null,
  nachname text not null,
  link_instagram text,
  link_tiktok text,
  created_at timestamptz not null default now(),
  constraint bewerbung_profil_link check (
    coalesce(btrim(link_instagram), '') <> ''
    or coalesce(btrim(link_tiktok), '') <> ''
  )
);

create index if not exists bewerbung_casting_idx on public.bewerbung (creator_auswahl_id);
create index if not exists bewerbung_link_idx on public.bewerbung (link_id);

alter table public.creator_auswahl_items
  add column if not exists management_id uuid references public.management(id),
  add column if not exists ansprechpartner_id uuid references public.ansprechpartner(id);

alter table public.management_anfrage_link enable row level security;
alter table public.bewerbung enable row level security;

drop policy if exists management_anfrage_link_insert on public.management_anfrage_link;
create policy management_anfrage_link_insert on public.management_anfrage_link
  for insert to authenticated
  with check ((select is_admin_or_mitarbeiter()));

drop policy if exists bewerbung_select on public.bewerbung;
create policy bewerbung_select on public.bewerbung
  for select to authenticated
  using ((select is_admin_or_mitarbeiter()));

drop policy if exists bewerbung_delete on public.bewerbung;
create policy bewerbung_delete on public.bewerbung
  for delete to authenticated
  using ((select is_admin_or_mitarbeiter()));
