begin;

-- FK zu Kooperationen (nullable — bestehende Vertraege bleiben ohne Zuordnung)
alter table public.vertraege
  add column if not exists kooperation_id uuid references public.kooperationen(id);

-- Dropbox-Felder fuer unterschriebene Vertraege
alter table public.vertraege
  add column if not exists dropbox_file_url text,
  add column if not exists dropbox_file_path text;

-- Index fuer schnelle Lookups nach Kooperation
create index if not exists idx_vertraege_kooperation_id
  on public.vertraege(kooperation_id);

comment on column public.vertraege.kooperation_id is
  'Optionale Verknuepfung zu einer Kooperation (Creator + Kampagne).';
comment on column public.vertraege.dropbox_file_url is
  'Shared Link des unterschriebenen Vertrags in Dropbox.';
comment on column public.vertraege.dropbox_file_path is
  'Dateipfad in Dropbox fuer Loeschen/Ersetzen.';

commit;
