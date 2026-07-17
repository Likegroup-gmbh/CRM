begin;

-- Vertrag: gewähltes Management als FK + Schalter "nur Management-Adresse"
alter table public.vertraege
  add column if not exists management_id uuid references public.management(id);

alter table public.vertraege
  add column if not exists nur_management_adresse boolean default false;

-- Creator <-> Management: echtes n:m, Duplikate verhindern
alter table public.creator_management
  add constraint creator_management_creator_management_unique
  unique (creator_id, management_id);

commit;
