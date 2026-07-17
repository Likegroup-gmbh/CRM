begin;

alter table public.auftrag
  add column if not exists kurzbeschreibung text;

comment on column public.auftrag.kurzbeschreibung is
  'Kurze interne Beschreibung des Auftrags, wird in Auftrag und Auftragsdetails-Uebersicht angezeigt.';

commit;
