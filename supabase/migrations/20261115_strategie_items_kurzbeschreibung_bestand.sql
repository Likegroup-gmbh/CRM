-- Bestand nachziehen: der bisherige Text der Tabellenspalte Beschreibung (beschreibung) wandert
-- auch bei Videoreferenzen in kurzbeschreibung, damit nichts verloren geht.
-- Ausgenommen: Vorschlaege (zeigen weiter beschreibung) und Items mit Struktur
-- (deren Text steht in beschreibung_struktur im Drawer). beschreibung bleibt unveraendert.
update public.strategie_items
set kurzbeschreibung = beschreibung
where kurzbeschreibung is null
  and coalesce(ist_vorschlag, false) = false
  and beschreibung_struktur is null
  and nullif(btrim(beschreibung), '') is not null;
