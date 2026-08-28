begin;

alter table public.creator
  add column if not exists hauptadresse_quelle text not null default 'creator';

alter table public.creator
  drop constraint if exists creator_hauptadresse_quelle_check;

alter table public.creator
  add constraint creator_hauptadresse_quelle_check
  check (hauptadresse_quelle in ('creator', 'management', 'firma'));

comment on column public.creator.hauptadresse_quelle
  is 'Welche Adresse als Vertrags-Hauptadresse gilt: creator, management oder firma';

commit;
