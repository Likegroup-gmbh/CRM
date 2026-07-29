-- Sourcing: TKP pro Liste + Story-Spalten
--
-- tkp         = Preis pro 1.000 Views, Basis fuer Preis 8/30/Ø Reels.
--               Der Preis wird ab jetzt im Frontend aus ig_views_* x tkp
--               gerechnet; cpm_ig_* bleiben als Referenzwert bei 25 EUR.
-- liste_typ   = UGC / Influencer / Mix, steuert beim Anlegen die hidden_columns.
-- plattformen = Komma-Liste (instagram, tiktok), nur bei liste_typ = influencer.
-- ig_formate  = Komma-Liste (reel, story), nur wenn Instagram gewaehlt ist.
--
-- reichweite_story / preis_story sind vorerst Freitext (wie reichweite_tiktok).
-- Eine automatische Story-Reichweite braucht einen verbundenen Account mit
-- instagram_manage_insights, Business Discovery liefert das nicht.

begin;

alter table public.creator_auswahl
  add column if not exists tkp numeric not null default 25,
  add column if not exists liste_typ text,
  add column if not exists plattformen text,
  add column if not exists ig_formate text;

alter table public.creator_auswahl
  drop constraint if exists creator_auswahl_liste_typ_check;

alter table public.creator_auswahl
  add constraint creator_auswahl_liste_typ_check
  check (liste_typ is null or liste_typ in ('ugc', 'influencer', 'mix'));

alter table public.creator_auswahl_items
  add column if not exists reichweite_story text,
  add column if not exists preis_story text;

commit;
