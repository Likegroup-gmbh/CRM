begin;

alter table public.kooperation_videos
  add column if not exists folder_url text;

comment on column public.kooperation_videos.folder_url is
  'Dropbox Shared Link auf den Video-Ordner (statt einzelne Datei).';

commit;
