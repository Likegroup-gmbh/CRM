-- Sourcing-CPM: vier Kennzahlen statt drei.
--
-- Bisher: Schnitt der letzten 8 Reels, Schnitt der letzten 30 Reels und ein
-- getrimmter Schnitt, bei dem pauschal 10% oben und unten weggefallen sind -
-- also auch dann, wenn es gar keine Ausreisser gab.
--
-- Jetzt: 8er- und 30er-Schnitt jeweils mit und ohne Ausreisser. Als Ausreisser
-- zaehlt nur noch, was per modifiziertem Z-Score (Median/MAD auf log10)
-- auffaellt UND mindestens Faktor 2.5 ueber bzw. unter dem Median liegt,
-- siehe netlify/functions/_shared/instagram-cpm.js.
--
-- ig_views_trimmed und cpm_ig_trimmed fallen ersatzlos weg. Beides sind rein
-- abgeleitete Werte, die beim naechsten Instagram-Abruf ohnehin neu entstehen -
-- den stossen die Zeilen selbst an, sobald ig_stats.calc_version veraltet ist.

alter table public.creator_auswahl_items
  add column if not exists ig_views_8_clean integer,
  add column if not exists ig_views_30_clean integer,
  add column if not exists cpm_ig_8_clean numeric,
  add column if not exists cpm_ig_30_clean numeric;

alter table public.sourcing_creator
  add column if not exists ig_views_8_clean integer,
  add column if not exists ig_views_30_clean integer,
  add column if not exists cpm_ig_8_clean numeric,
  add column if not exists cpm_ig_30_clean numeric;

comment on column public.creator_auswahl_items.ig_views_8_clean is
  'Views-Schnitt der letzten 8 Feed-Reels ohne erkannte Ausreisser.';
comment on column public.creator_auswahl_items.ig_views_30_clean is
  'Views-Schnitt der letzten 30 Feed-Reels ohne erkannte Ausreisser.';
comment on column public.sourcing_creator.ig_views_8_clean is
  'Views-Schnitt der letzten 8 Feed-Reels ohne erkannte Ausreisser.';
comment on column public.sourcing_creator.ig_views_30_clean is
  'Views-Schnitt der letzten 30 Feed-Reels ohne erkannte Ausreisser.';

alter table public.creator_auswahl_items
  drop column if exists ig_views_trimmed,
  drop column if exists cpm_ig_trimmed;

alter table public.sourcing_creator
  drop column if exists ig_views_trimmed,
  drop column if exists cpm_ig_trimmed;

-- Die Spalte "Preis Ø Reels" gibt es nicht mehr: aus gespeicherten
-- hidden_columns raeumen, damit der Sichtbarkeits-Drawer keine Leiche mitfuehrt.
update public.creator_auswahl
set hidden_columns = (
  select coalesce(jsonb_agg(spalte), '[]'::jsonb)
  from jsonb_array_elements(hidden_columns) as spalte
  where spalte <> '"cp-col-cpm-ig-trimmed"'::jsonb
)
where hidden_columns @> '["cp-col-cpm-ig-trimmed"]'::jsonb;
