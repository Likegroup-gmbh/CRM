begin;

alter table public.marke
  add column if not exists beschreibung text;

alter table public.unternehmen
  add column if not exists beschreibung text;

comment on column public.marke.beschreibung is
  'Kurzbeschreibung der Marke, wird beim Webseiten-Auslesen von der KI vorgeschlagen.';

comment on column public.unternehmen.beschreibung is
  'Kurzbeschreibung des Unternehmens, wird beim Webseiten-Auslesen von der KI vorgeschlagen. Getrennt von notiz (interne Notizen).';

commit;
