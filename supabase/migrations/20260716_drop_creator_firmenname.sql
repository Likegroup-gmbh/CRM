begin;

-- Rueckbau: firmenname wird nicht mehr als Freitextfeld am Creator gefuehrt,
-- sondern ueber die eigene Entity "firma" (creator_firma) abgebildet.
alter table public.creator
  drop column if exists firmenname;

commit;
