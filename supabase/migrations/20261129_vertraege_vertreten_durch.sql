-- Entwurf der Management-Vertretung: gewählter Ansprechpartner oder noch nicht angelegte Person.
-- Der Vertrag schreibt dieses Feld schon; die Spalte fehlte in den Migrationen.

alter table public.vertraege
  add column if not exists vertreten_durch jsonb;

comment on column public.vertraege.vertreten_durch is
  'Ansprechpartner der Management-Vertretung. Vor dem Finalisieren kann die Person noch nur als Name, E-Mail und Telefon vorliegen.';
