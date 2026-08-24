-- Thinking-Schritte: Jobs schreiben [{step, label}], die UI zeigt die Liste.
-- Letztes Item ist aktiv, solange der Job pending|running ist.

alter table public.skript_chat_messages
  add column if not exists progress_steps jsonb not null default '[]'::jsonb;

alter table public.skript_generation_jobs
  add column if not exists progress_steps jsonb not null default '[]'::jsonb;

alter table public.extract_jobs
  add column if not exists progress_steps jsonb not null default '[]'::jsonb;

comment on column public.skript_chat_messages.progress_steps is
  'Thinking-Schritte [{step, label}]. Sichtbar nur solange status pending|running.';
comment on column public.skript_generation_jobs.progress_steps is
  'Thinking-Schritte [{step, label}] fuer die Generierungs-Bubble.';
comment on column public.extract_jobs.progress_steps is
  'Thinking-Schritte [{step, label}] der Webseiten-Extraktion.';
