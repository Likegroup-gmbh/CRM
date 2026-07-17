begin;

-- vertraege.kampagne_id: NO ACTION → SET NULL (sonst blockiert ein Vertrag das Kampagnen-Löschen)
alter table public.vertraege
  drop constraint vertraege_kampagne_id_fkey;
alter table public.vertraege
  add constraint vertraege_kampagne_id_fkey
  foreign key (kampagne_id) references public.kampagne(id) on delete set null;

-- rechnung hat zwei FKs auf kampagne_id: rechnung_kampagne_fk (NO ACTION) und rechnung_kampagne_id_fkey (CASCADE).
-- Der NO ACTION-Constraint blockiert das Löschen – wir entfernen den redundanten.
alter table public.rechnung
  drop constraint if exists rechnung_kampagne_fk;

commit;
