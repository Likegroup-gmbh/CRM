-- Masterliste optional einem Unternehmen zuordnen (ADR 0076).
-- Ohne Zuordnung bleibt die Liste ein Pool der Agentur.

alter table public.creator_list
  add column if not exists unternehmen_id uuid
    references public.unternehmen(id) on delete set null;

create index if not exists creator_list_unternehmen_id_idx
  on public.creator_list (unternehmen_id);

comment on column public.creator_list.unternehmen_id is
  'Optional: Unternehmen, in dessen Ordner die Masterliste liegt. Leer = Pool der Agentur.';
