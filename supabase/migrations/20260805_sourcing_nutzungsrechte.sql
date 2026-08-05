-- Sourcing: eigene Spalte fuer die Nutzungsrechte.
--
-- Die Nutzungsrechte wurden bisher in die Kurzbeschreibung oder in den Preis
-- geschrieben. Als eigenes Freitextfeld hinter dem Status stehen sie beim
-- Verhandeln direkt neben Status und Preisen.
--
-- Freitext, weil hier Laufzeiten, Kanaele und Sonderabsprachen in einem Satz
-- stehen ("6 Monate Paid Social, IG + TikTok").

alter table public.creator_auswahl_items
  add column if not exists nutzungsrechte text;

comment on column public.creator_auswahl_items.nutzungsrechte is
  'Vereinbarte Nutzungsrechte als Freitext, z. B. Laufzeit und Kanaele.';
