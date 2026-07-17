-- Projekt-Erstellen-Wizard: Mengen pro aktueller Kampagnenart speichern.

ALTER TABLE public.auftrag_details
  ADD COLUMN IF NOT EXISTS ugc_paid_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_paid_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_organic_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_organic_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS story_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS story_creator_anzahl integer;

ALTER TABLE public.kampagne
  ADD COLUMN IF NOT EXISTS ugc_paid_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_paid_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_organic_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_organic_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS story_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS story_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS influencer_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS influencer_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS vor_ort_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS vor_ort_creator_anzahl integer;
