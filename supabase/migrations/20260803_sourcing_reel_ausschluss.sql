-- Manueller Reel-Ausschluss fuer die CPM-Berechnung.
-- Business Discovery kennzeichnet Nur-Reels-Tab-Videos nicht (is_shared_to_feed
-- wird abgelehnt), deshalb lassen sich Testvideos pro Creator von Hand
-- ausschliessen. Die Liste haengt am Pool und wirkt in allen Sourcing-Listen.

alter table public.sourcing_creator
  add column if not exists ig_excluded_media jsonb not null default '[]'::jsonb;

comment on column public.sourcing_creator.ig_excluded_media is
  'Reel-Permalinks, die die CPM-Rechnung dauerhaft ignoriert (manuell ausgeschlossene Testvideos).';
