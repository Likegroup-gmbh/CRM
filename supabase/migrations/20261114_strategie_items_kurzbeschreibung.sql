-- Kurzbeschreibung an der Videoidee: der Text der Tabellenspalte "Beschreibung".
-- Getrennt von der strukturierten Beschreibung im Drawer (beschreibung / beschreibung_struktur:
-- Titel, Angle, Hook ...), die Skript und Liky lesen. Beide waren bisher dieselbe Spalte,
-- dadurch ueberschrieb der Drawer den Tabellentext.

alter table public.strategie_items
  add column if not exists kurzbeschreibung text;

comment on column public.strategie_items.kurzbeschreibung is
  'Text der Tabellenspalte Beschreibung. Unabhaengig von beschreibung/beschreibung_struktur (Drawer-Analyse).';

-- Bestand: nur Ideen (ohne Videolink, kein Vorschlag, keine Struktur) uebernehmen ihren Freitext.
-- beschreibung bleibt unveraendert, Skript-Kontext und Picker lesen sie weiter.
update public.strategie_items
set kurzbeschreibung = beschreibung
where kurzbeschreibung is null
  and video_link is null
  and coalesce(ist_vorschlag, false) = false
  and beschreibung_struktur is null
  and nullif(btrim(beschreibung), '') is not null;

-- Videoidee-Vorschlag uebernehmen: die Spalte Beschreibung soll danach nicht leer sein.
-- Atomar in der Datenbank statt im Client, damit auch "Alle uebernehmen" ohne Einzel-Updates klappt.
create or replace function public.strategie_items_kurzbeschreibung_bei_uebernahme()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(old.ist_vorschlag, false) = true
     and coalesce(new.ist_vorschlag, false) = false
     and nullif(btrim(new.kurzbeschreibung), '') is null
     and new.video_link is null then
    new.kurzbeschreibung := new.beschreibung;
  end if;
  return new;
end;
$$;

drop trigger if exists strategie_items_kurzbeschreibung_uebernahme on public.strategie_items;
create trigger strategie_items_kurzbeschreibung_uebernahme
  before update of ist_vorschlag on public.strategie_items
  for each row
  execute function public.strategie_items_kurzbeschreibung_bei_uebernahme();
