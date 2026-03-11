begin;

alter table public.vertraege
  add column if not exists vertragssprache text not null default 'de';

comment on column public.vertraege.vertragssprache is
  'Persistierte Vertragssprache fuer PDF-Generierung (de oder en).';

commit;
