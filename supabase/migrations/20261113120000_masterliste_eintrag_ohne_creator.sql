-- Masterliste: Eintraege ohne Creator-Datensatz, per Instagram-Link oder von Hand.
-- Mit Instagram-Handle kommen Bild, Follower und Kontakt live aus dem
-- Creator-Pool (sourcing_creator). Was von Hand eingetragen wurde, liegt an der
-- Zeile; ein Creator-Datensatz ersetzt beides.

alter table public.creator_list_member
  alter column creator_id drop not null;

alter table public.creator_list_member
  add column if not exists ig_username text,
  add column if not exists sourcing_creator_id uuid
    references public.sourcing_creator(id) on delete set null,
  add column if not exists name text,
  add column if not exists typ text,
  add column if not exists follower_instagram integer,
  add column if not exists link_tiktok text,
  add column if not exists follower_tiktok integer,
  add column if not exists wohnort text,
  add column if not exists email text,
  add column if not exists telefon text;

alter table public.creator_list_member
  drop constraint if exists creator_list_member_creator_oder_handle;
alter table public.creator_list_member
  add constraint creator_list_member_creator_oder_handle
    check (creator_id is not null or ig_username is not null or nullif(trim(name), '') is not null);

create unique index if not exists creator_list_member_list_handle_offen
  on public.creator_list_member (list_id, ig_username)
  where creator_id is null;

create index if not exists idx_creator_list_member_sourcing_creator
  on public.creator_list_member (sourcing_creator_id);

comment on column public.creator_list_member.creator_id is
  'CRM-Creator der Zeile. Leer, solange der Eintrag keinen Datensatz hat.';

comment on column public.creator_list_member.ig_username is
  'Normalisierter Instagram-Handle (lowercase, ohne @ und URL) fuer Eintraege ohne Creator.';

comment on column public.creator_list_member.sourcing_creator_id is
  'Creator-Pool-Eintrag zum Handle. Liefert Bild, Follower und Kontaktdaten, solange creator_id leer ist.';

comment on column public.creator_list_member.name is
  'Von Hand eingetragener Name eines Eintrags ohne Creator. Geht vor dem Namen aus dem Pool.';

comment on column public.creator_list_member.typ is
  'Creator Art eines Eintrags ohne Creator (Werte wie im Casting).';
