-- Strukturierte Post-Metadaten fuer das Transcribe-Feature:
-- Autor + Engagement-Zahlen werden getrennt von der Caption gespeichert,
-- damit die Caption nur noch den reinen Text enthaelt.

begin;

alter table if exists public.transcription_jobs
  add column if not exists author_name text,
  add column if not exists author_url text,
  add column if not exists posted_at timestamptz,
  add column if not exists likes_count bigint,
  add column if not exists comments_count bigint,
  add column if not exists shares_count bigint,
  add column if not exists saves_count bigint;

commit;
