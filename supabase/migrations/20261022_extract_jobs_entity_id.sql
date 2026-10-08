-- Management-Connect: Jobs ohne URL (die Function sucht die Homepage selbst)
-- und mit Verweis auf den Datensatz, aus dem Name und Creator geladen werden.
-- Alle bestehenden Jobs haben eine URL, die Aenderung ist rueckwaertskompatibel.

alter table public.extract_jobs
  alter column url drop not null;

alter table public.extract_jobs
  add column if not exists entity_id uuid;

comment on column public.extract_jobs.entity_id is
  'Optional: Datensatz, zu dem der Job gehoert (z.B. management.id). Gesetzt, wenn die URL erst von der Function gesucht wird.';
