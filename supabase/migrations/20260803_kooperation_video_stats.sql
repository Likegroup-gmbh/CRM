-- Live-Performance je Kampagnen-Video.
--
-- Hinter "Posting Datum" bekommt die Kooperationen-Video-Tabelle eine Spalte
-- fuer den Link zum veroeffentlichten Reel plus Views, Likes und Kommentare.
-- Gefuellt wird ueber den Haekchen-Button und
-- netlify/functions/kooperation-video-stats.js (Meta Business Discovery,
-- gleiches Muster wie der Instagram-Abruf im Sourcing).
--
-- Saves fehlen bewusst: Metas Insights-Endpoint liefert "saved" nur fuer Medien
-- auf Accounts, fuer die wir einen Page-Token haben - fremde Creator-Profile
-- sind darueber nicht abrufbar. Die drei Zahlen bleiben von Hand editierbar,
-- damit ein fehlgeschlagener Abruf (kein Business-Account, Collab-Post unter
-- dem Brand-Handle) niemanden blockiert.

alter table public.kooperation_videos
  add column if not exists link_live text,
  add column if not exists stats_views integer,
  add column if not exists stats_likes integer,
  add column if not exists stats_comments integer,
  add column if not exists stats_fetched_at timestamptz,
  add column if not exists stats_error text,
  add column if not exists stats_raw jsonb;

comment on column public.kooperation_videos.link_live is
  'Link zum veroeffentlichten Video (Instagram Reel/Post). Basis fuer den Stats-Abruf.';
comment on column public.kooperation_videos.stats_views is
  'Views des veroeffentlichten Videos (Meta view_count) oder von Hand gepflegt.';
comment on column public.kooperation_videos.stats_likes is
  'Likes des veroeffentlichten Videos (Meta like_count) oder von Hand gepflegt.';
comment on column public.kooperation_videos.stats_comments is
  'Kommentare des veroeffentlichten Videos (Meta comments_count) oder von Hand gepflegt.';
comment on column public.kooperation_videos.stats_fetched_at is
  'Zeitpunkt des letzten erfolgreichen Abrufs; steuert den Refresh-Zustand des Buttons.';
comment on column public.kooperation_videos.stats_error is
  'Grund des letzten fehlgeschlagenen Abrufs; setzt den Button auf den Fehlerzustand.';
comment on column public.kooperation_videos.stats_raw is
  'Rohdaten des gematchten Media-Eintrags (id, media_type, permalink, timestamp) zur Nachvollziehbarkeit.';
