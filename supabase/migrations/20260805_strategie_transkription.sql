-- Transkription in die Strategie-Items integrieren.
--
-- Bisher liefen Screenshot (netlify/functions/screenshot.js, synchron) und
-- Transkription (netlify/functions/transcribe-background.js, nur ueber die
-- Testseite /transcribe) getrennt. Kuenftig erledigt strategie-item-background
-- beides in einem Chromium-Lauf und schreibt die Ergebnisse direkt hierher.
--
-- Aufgabenteilung der Tabellen:
--   transcription_jobs -> Job-Protokoll (logs, Engagement, Autor, Fehler)
--   strategie_items    -> die redaktionell weiter bearbeitbaren Endergebnisse

begin;

alter table public.strategie_items
  add column if not exists transkript text,
  add column if not exists transkript_quelle text,
  add column if not exists caption text,
  add column if not exists beschreibung_quelle text,
  add column if not exists transcription_job_id uuid,
  add column if not exists verarbeitung_status text,
  add column if not exists verarbeitung_step text,
  add column if not exists verarbeitung_fehler text;

alter table public.strategie_items
  drop constraint if exists strategie_items_transkript_quelle_check;
alter table public.strategie_items
  add constraint strategie_items_transkript_quelle_check
  check (transkript_quelle is null or transkript_quelle in ('whisper', 'native_captions'));

-- NULL steht fuer den Altbestand und fuer von Hand gepflegte Beschreibungen ohne
-- Kennzeichnung. Nur 'ki' bekommt in der Tabelle einen Tag.
alter table public.strategie_items
  drop constraint if exists strategie_items_beschreibung_quelle_check;
alter table public.strategie_items
  add constraint strategie_items_beschreibung_quelle_check
  check (beschreibung_quelle is null or beschreibung_quelle in ('ki', 'user'));

alter table public.strategie_items
  drop constraint if exists strategie_items_verarbeitung_status_check;
alter table public.strategie_items
  add constraint strategie_items_verarbeitung_status_check
  check (verarbeitung_status is null or verarbeitung_status in ('pending', 'processing', 'done', 'error'));

alter table public.strategie_items
  drop constraint if exists strategie_items_transcription_job_id_fkey;
alter table public.strategie_items
  add constraint strategie_items_transcription_job_id_fkey
  foreign key (transcription_job_id) references public.transcription_jobs(id) on delete set null;

comment on column public.strategie_items.transkript is 'Volltext-Transkript des Videos (Whisper oder native Captions)';
comment on column public.strategie_items.transkript_quelle is 'whisper oder native_captions';
comment on column public.strategie_items.caption is 'Original-Caption des Posts, beim Scrapen mitgenommen';
comment on column public.strategie_items.beschreibung_quelle is 'ki = von Llama erzeugt, user = von Hand gepflegt, NULL = Altbestand';
comment on column public.strategie_items.verarbeitung_status is 'Lauf von strategie-item-background: pending/processing/done/error';
comment on column public.strategie_items.verarbeitung_step is 'Aktueller Schritt fuer die Fortschrittsanzeige in der Tabelle';

-- Die Function sucht sich den naechsten offenen Job derselben Strategie selbst
-- (Self-Chaining, begrenzt die Zahl paralleler Chromium-Instanzen).
create index if not exists strategie_items_verarbeitung_offen_idx
  on public.strategie_items (strategie_id, sortierung)
  where verarbeitung_status = 'pending';

alter table public.transcription_jobs
  add column if not exists strategie_item_id uuid;

alter table public.transcription_jobs
  drop constraint if exists transcription_jobs_strategie_item_id_fkey;
alter table public.transcription_jobs
  add constraint transcription_jobs_strategie_item_id_fkey
  foreign key (strategie_item_id) references public.strategie_items(id) on delete set null;

create index if not exists transcription_jobs_strategie_item_id_idx
  on public.transcription_jobs (strategie_item_id)
  where strategie_item_id is not null;

comment on column public.transcription_jobs.strategie_item_id
  is 'Gesetzt, wenn der Job aus einer Strategie heraus laeuft statt aus der Testseite';

-- Live-Fortschritt in der Strategie-Tabelle: die UI lauscht auf UPDATEs der
-- Items ihrer Strategie. Writes kommen ausschliesslich von der Service-Role in
-- der Netlify Function, die vorhandenen RLS-Policies bleiben unangetastet.
do $$
begin
  alter publication supabase_realtime add table public.strategie_items;
exception
  when duplicate_object then null;
end $$;

commit;
