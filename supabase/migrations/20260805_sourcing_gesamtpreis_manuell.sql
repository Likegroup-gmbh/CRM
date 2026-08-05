-- Sourcing: der Gesamtpreis wird von Hand gepflegt statt gerechnet.
--
-- Bisher war die Spalte eine reine Anzeige aus preis_reels + preis_story und
-- lag nirgends in der Datenbank. In der Praxis steht im Gesamtpreis aber ein
-- verhandelter Betrag, der nicht der Summe der Einzelpreise entspricht -
-- deshalb jetzt ein eigenes Feld, das leer startet und von den Mitarbeitern
-- gefuellt wird.
--
-- Freitext wie preis_reels und preis_story, weil hier auch Spannen und
-- Zusaetze stehen. Kein Backfill: die alte Summe war nie gespeichert.

alter table public.creator_auswahl_items
  add column if not exists gesamtpreis text;

comment on column public.creator_auswahl_items.gesamtpreis is
  'Manuell gepflegter Gesamtpreis. Freitext, wird nicht aus preis_reels + preis_story berechnet.';
