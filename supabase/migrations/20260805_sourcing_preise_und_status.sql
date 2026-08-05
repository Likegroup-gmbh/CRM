-- Sourcing: zwei Reels-Preise statt vier, neuer manueller Reel-Preis, Status
-- ersetzt die Checkbox-Spalten Anfragen und Rueckmeldung.
--
-- 1) Die "_clean"-Spalten fallen weg. ig_views_8 und ig_views_30 sind ab jetzt
--    selbst bereinigt: die Ausreisser-Regel laeuft immer, eine ungefilterte
--    Variante gibt es in der UI nicht mehr. Alles rein abgeleitete Werte, die
--    beim naechsten Instagram-Abruf neu entstehen - den stossen die Zeilen
--    selbst an, sobald ig_stats.calc_version veraltet ist (jetzt 3).
--
-- 2) preis_reels ist wie preis_story und reichweite_story Freitext: die Preise
--    werden verhandelt und stehen oft als Spanne oder mit Zusatz in der Zelle.
--    Der Gesamtpreis wird daraus im Frontend gerechnet und nicht gespeichert,
--    sonst wuerde er auseinanderlaufen, sobald einer der beiden sich aendert.
--
-- 3) in_verhandlung ist neu, angefragt gab es schon: die Checkbox-Spalte
--    "Anfragen" hat es geschrieben, jetzt macht es die Status-Option. Deshalb
--    keine Datenmigration fuer bestehende Anfragen.
--
-- rueckmeldung_creator bleibt als Spalte liegen, obwohl die Tabellenspalte
-- verschwindet: die Daten zu loeschen waere nicht rueckholbar, eine unbenutzte
-- boolean-Spalte kostet nichts.

alter table public.creator_auswahl_items
  add column if not exists preis_reels text,
  add column if not exists in_verhandlung boolean not null default false,
  add column if not exists in_verhandlung_am timestamptz;

comment on column public.creator_auswahl_items.preis_reels is
  'Manuell gepflegter Reel-Preis. Freitext, weil hier auch Spannen und Zusaetze stehen.';
comment on column public.creator_auswahl_items.in_verhandlung is
  'Status-Stufe zwischen Angefragt und Buchen. Wird ueber das Status-Select gesetzt.';

alter table public.creator_auswahl_items
  drop column if exists ig_views_8_clean,
  drop column if exists ig_views_30_clean,
  drop column if exists cpm_ig_8_clean,
  drop column if exists cpm_ig_30_clean;

alter table public.sourcing_creator
  drop column if exists ig_views_8_clean,
  drop column if exists ig_views_30_clean,
  drop column if exists cpm_ig_8_clean,
  drop column if exists cpm_ig_30_clean;

comment on column public.creator_auswahl_items.ig_views_8 is
  'Views-Schnitt der letzten 8 Feed-Reels, ohne Werbe-Reels und ohne Ausreisser.';
comment on column public.creator_auswahl_items.ig_views_30 is
  'Views-Schnitt der letzten 30 Feed-Reels, ohne Werbe-Reels und ohne Ausreisser.';
comment on column public.sourcing_creator.ig_views_8 is
  'Views-Schnitt der letzten 8 Feed-Reels, ohne Werbe-Reels und ohne Ausreisser.';
comment on column public.sourcing_creator.ig_views_30 is
  'Views-Schnitt der letzten 30 Feed-Reels, ohne Werbe-Reels und ohne Ausreisser.';

-- Weggefallene Spalten aus gespeicherten hidden_columns raeumen, damit der
-- Sichtbarkeits-Drawer keine Leichen mitfuehrt.
update public.creator_auswahl
set hidden_columns = (
  select coalesce(jsonb_agg(spalte), '[]'::jsonb)
  from jsonb_array_elements(hidden_columns) as spalte
  where spalte not in (
    '"cp-col-cpm-ig-8-clean"'::jsonb,
    '"cp-col-cpm-ig-30-clean"'::jsonb,
    '"cp-col-anfragen"'::jsonb,
    '"cp-col-check"'::jsonb
  )
)
where hidden_columns ?| array[
  'cp-col-cpm-ig-8-clean',
  'cp-col-cpm-ig-30-clean',
  'cp-col-anfragen',
  'cp-col-check'
];
