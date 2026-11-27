-- TikTok-Profilabruf im Casting (ADR 0083): Follower, Engagement und die Views-Schnitte
-- der letzten 8 bzw. 30 Videos kommen ueber Apify (clockworks/tiktok-scraper).
--
-- creator_auswahl_items bekommt die tt_*-Spalten als Gegenstueck zu ig_*. Die Follower
-- landen im bestehenden follower_tiktok.
--
-- sourcing_creator_tiktok ist der Pool vor Apify, wie sourcing_creator vor Meta: ein
-- Eintrag je TikTok-Handle, geteilt ueber alle Listen. Eigene Tabelle, weil
-- sourcing_creator.ig_username NOT NULL ist und sich Instagram- und TikTok-Handle
-- desselben Creators nicht verlaesslich zuordnen lassen.
-- Geschrieben wird ausschliesslich von netlify/functions/tiktok-profil.js mit der Service Role.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS public.sourcing_creator_tiktok;
--   ALTER TABLE public.creator_auswahl_items DROP COLUMN IF EXISTS tt_views_8,
--     DROP COLUMN IF EXISTS tt_views_30, DROP COLUMN IF EXISTS tt_stats,
--     DROP COLUMN IF EXISTS tt_fetched_at, DROP COLUMN IF EXISTS tt_fetch_error;

BEGIN;

ALTER TABLE public.creator_auswahl_items
  ADD COLUMN IF NOT EXISTS tt_views_8 integer,
  ADD COLUMN IF NOT EXISTS tt_views_30 integer,
  ADD COLUMN IF NOT EXISTS tt_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tt_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS tt_fetch_error text;

CREATE TABLE IF NOT EXISTS public.sourcing_creator_tiktok (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tt_username text NOT NULL UNIQUE,
  link_tiktok text,
  name text,
  profile_image_url text,
  profile_image_thumb_url text,
  follower_tiktok integer,
  tt_views_8 integer,
  tt_views_30 integer,
  tt_stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  email text,
  telefon text,
  wohnort text,
  tt_fetched_at timestamptz,
  tt_fetch_error text,
  created_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sourcing_creator_tiktok IS
  'Creator-Pool fuer TikTok: ein Eintrag pro TikTok-Handle (lowercase). Cache vor Apify, damit derselbe Creator in mehreren Listen nur einmal abgerufen wird.';

-- Lesen nur Admin/Mitarbeiter und Investor, Schreiben nur Service Role. Der Pool haelt
-- email, telefon und wohnort, Kunden und Gaeste duerfen ihn nicht sehen.
ALTER TABLE public.sourcing_creator_tiktok ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sourcing_creator_tiktok_select ON public.sourcing_creator_tiktok;
CREATE POLICY sourcing_creator_tiktok_select ON public.sourcing_creator_tiktok
  FOR SELECT TO authenticated USING ((SELECT public.is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS investor_select ON public.sourcing_creator_tiktok;
CREATE POLICY investor_select ON public.sourcing_creator_tiktok
  FOR SELECT TO authenticated USING ((SELECT public.is_investor()));

REVOKE ALL ON TABLE public.sourcing_creator_tiktok FROM public, anon;
GRANT SELECT ON TABLE public.sourcing_creator_tiktok TO authenticated;
GRANT ALL ON TABLE public.sourcing_creator_tiktok TO service_role;

COMMIT;
