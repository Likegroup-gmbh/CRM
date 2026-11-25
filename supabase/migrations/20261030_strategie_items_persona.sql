-- Persona an der Videoidee: Source of Truth fuer das Skript.
-- Das Briefing nennt die Personas der Linie (persona_ids), die Videoidee hat genau eine.
-- Sie schlaegt die Persona des Casting-Eintrags; leer = Fallback auf das Casting (Altbestand).

alter table public.strategie_items
  add column if not exists persona_id uuid references public.personas(id) on delete set null;

create index if not exists strategie_items_persona_id_idx
  on public.strategie_items (persona_id)
  where persona_id is not null;

comment on column public.strategie_items.persona_id is
  'Persona der Videoidee (aus den Personas des Briefings). Source of Truth fuers Skript, schlaegt die Casting-Persona; leer = Fallback auf creator_auswahl_item.persona_id.';
