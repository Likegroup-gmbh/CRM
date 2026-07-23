-- Baseline + RLS-Angleichung fuer transcription_jobs.
--
-- Kontext: Die Tabelle wurde urspruenglich ohne Repo-Migration angelegt
-- (nur die Metadaten-Spalten liegen in 20260710_add_transcription_jobs_metadata.sql).
-- Mit der Einbindung ins Skript-Generator-Formular (Videovorlage als Pflicht)
-- wird sie von allen internen Mitarbeitern genutzt:
--   1. Baseline dokumentieren (CREATE TABLE IF NOT EXISTS, Realtime).
--   2. RLS an den internen Skript-Zugriff angleichen (is_admin_or_mitarbeiter()
--      wie bei skripte/skript_generation_jobs) statt SELECT fuer ALLE
--      authentifizierten Nutzer.
-- Writes (Status/Ergebnis) laufen weiterhin ausschliesslich ueber die
-- Service-Role in der Netlify Function - kein Client-UPDATE noetig.

begin;

-- 1. Baseline (idempotent - Tabelle existiert live bereits)
create table if not exists public.transcription_jobs (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  platform text,
  status text default 'pending',
  progress_step text,
  transcript text,
  transcript_source text,
  description text,
  caption text,
  duration_seconds numeric,
  author_name text,
  author_url text,
  posted_at timestamptz,
  likes_count bigint,
  comments_count bigint,
  shares_count bigint,
  saves_count bigint,
  logs jsonb default '[]'::jsonb,
  error_message text,
  created_by uuid,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.transcription_jobs enable row level security;

-- Realtime (idempotent): UI lauscht auf UPDATEs der eigenen Job-Zeile
do $$
begin
  alter publication supabase_realtime add table public.transcription_jobs;
exception
  when duplicate_object then null;
end $$;

-- 2. RLS angleichen: interne Mitarbeiter statt "alle authentifizierten"
drop policy if exists transcription_jobs_select_authenticated on public.transcription_jobs;
drop policy if exists transcription_jobs_insert_authenticated on public.transcription_jobs;
drop policy if exists transcription_jobs_select on public.transcription_jobs;
drop policy if exists transcription_jobs_insert on public.transcription_jobs;

create policy transcription_jobs_select on public.transcription_jobs
  for select to authenticated
  using ((select is_admin_or_mitarbeiter()));

create policy transcription_jobs_insert on public.transcription_jobs
  for insert to authenticated
  with check ((select is_admin_or_mitarbeiter()) and created_by = auth.uid());

commit;
