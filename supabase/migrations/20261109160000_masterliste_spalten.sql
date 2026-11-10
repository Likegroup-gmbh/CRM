-- Masterliste: Beschreibung, Autor, ausgeblendete Spalten, eigene Spaltenfolge,
-- und die gezogene Reihenfolge der Creator.

alter table public.creator_list
  add column if not exists beschreibung text,
  add column if not exists created_by uuid references public.benutzer(id) on delete set null,
  add column if not exists hidden_columns jsonb,
  add column if not exists custom_column_order jsonb;

alter table public.creator_list_member
  add column if not exists position integer;

comment on table public.creator_list is
  'Masterliste: wiederverwendbare Sammlung von CRM-Creatorn, gemeinsam fuer die Agentur.';

comment on column public.creator_list.beschreibung is
  'Wofuer das Team die Masterliste pflegt.';

comment on column public.creator_list.created_by is
  'Benutzer, der die Masterliste angelegt hat.';

comment on column public.creator_list.hidden_columns is
  'Ausgeblendete Standard- und eigenen Spalten. Null heisst Startset.';

comment on column public.creator_list.custom_column_order is
  'Reihenfolge und Anker der eigenen Spalten.';

comment on column public.creator_list_member.position is
  'Gezogene Reihenfolge in der Masterliste. Null steht hinten.';
