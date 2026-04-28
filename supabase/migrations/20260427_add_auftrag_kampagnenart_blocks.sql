begin;

create table if not exists public.auftrag_kampagnenart_blocks (
  id uuid primary key default gen_random_uuid(),
  auftrag_id uuid not null references public.auftrag(id) on delete cascade,
  kampagne_id uuid references public.kampagne(id) on delete cascade,
  kampagne_art_id uuid references public.kampagne_art_typen(id) on delete set null,
  campaign_type text not null,
  campaign_type_label text not null,
  sort_order integer not null default 0,
  video_anzahl integer,
  creator_anzahl integer,
  einkaufspreis_netto_von numeric,
  einkaufspreis_netto_bis numeric,
  verkaufspreis_netto_von numeric,
  verkaufspreis_netto_bis numeric,
  budget_info text,
  kooperations_deadline date,
  status text not null default 'offen',
  created_by_id uuid references public.benutzer(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auftrag_kampagnenart_blocks_video_nonnegative
    check (video_anzahl is null or video_anzahl >= 0),
  constraint auftrag_kampagnenart_blocks_creator_nonnegative
    check (creator_anzahl is null or creator_anzahl >= 0),
  constraint auftrag_kampagnenart_blocks_prices_nonnegative
    check (
      (einkaufspreis_netto_von is null or einkaufspreis_netto_von >= 0)
      and (einkaufspreis_netto_bis is null or einkaufspreis_netto_bis >= 0)
      and (verkaufspreis_netto_von is null or verkaufspreis_netto_von >= 0)
      and (verkaufspreis_netto_bis is null or verkaufspreis_netto_bis >= 0)
    )
);

create index if not exists idx_auftrag_kampagnenart_blocks_auftrag_id
  on public.auftrag_kampagnenart_blocks(auftrag_id, sort_order);

create index if not exists idx_auftrag_kampagnenart_blocks_kampagne_id
  on public.auftrag_kampagnenart_blocks(kampagne_id, sort_order);

create index if not exists idx_auftrag_kampagnenart_blocks_art_id
  on public.auftrag_kampagnenart_blocks(kampagne_art_id);

alter table public.auftrag_kampagnenart_blocks enable row level security;

drop policy if exists auftrag_kampagnenart_blocks_select on public.auftrag_kampagnenart_blocks;
create policy auftrag_kampagnenart_blocks_select
  on public.auftrag_kampagnenart_blocks
  for select
  to authenticated
  using (true);

drop policy if exists auftrag_kampagnenart_blocks_insert on public.auftrag_kampagnenart_blocks;
create policy auftrag_kampagnenart_blocks_insert
  on public.auftrag_kampagnenart_blocks
  for insert
  to authenticated
  with check (true);

drop policy if exists auftrag_kampagnenart_blocks_update on public.auftrag_kampagnenart_blocks;
create policy auftrag_kampagnenart_blocks_update
  on public.auftrag_kampagnenart_blocks
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists auftrag_kampagnenart_blocks_delete on public.auftrag_kampagnenart_blocks;
create policy auftrag_kampagnenart_blocks_delete
  on public.auftrag_kampagnenart_blocks
  for delete
  to authenticated
  using (true);

grant select, insert, update, delete on public.auftrag_kampagnenart_blocks to authenticated;

commit;
