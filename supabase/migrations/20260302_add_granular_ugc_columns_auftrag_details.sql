-- Hybrid-Auftragsdetails: neue granulare UGC-Felder fuer auftrag_details
-- Alte Felder (ugc_*/igc_*) bleiben fuer Rueckwaertskompatibilitaet bestehen.

ALTER TABLE public.auftrag_details
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_bilder_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_budget_info text,
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_einkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_einkaufspreis_netto_bis numeric,
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_verkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_pro_paid_verkaufspreis_netto_bis numeric,

  ADD COLUMN IF NOT EXISTS ugc_pro_organic_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_pro_organic_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_pro_organic_bilder_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_pro_organic_budget_info text,
  ADD COLUMN IF NOT EXISTS ugc_pro_organic_einkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_pro_organic_einkaufspreis_netto_bis numeric,
  ADD COLUMN IF NOT EXISTS ugc_pro_organic_verkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_pro_organic_verkaufspreis_netto_bis numeric,

  ADD COLUMN IF NOT EXISTS ugc_video_paid_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_video_paid_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_video_paid_bilder_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_video_paid_budget_info text,
  ADD COLUMN IF NOT EXISTS ugc_video_paid_einkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_video_paid_einkaufspreis_netto_bis numeric,
  ADD COLUMN IF NOT EXISTS ugc_video_paid_verkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_video_paid_verkaufspreis_netto_bis numeric,

  ADD COLUMN IF NOT EXISTS ugc_video_organic_video_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_video_organic_creator_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_video_organic_bilder_anzahl integer,
  ADD COLUMN IF NOT EXISTS ugc_video_organic_budget_info text,
  ADD COLUMN IF NOT EXISTS ugc_video_organic_einkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_video_organic_einkaufspreis_netto_bis numeric,
  ADD COLUMN IF NOT EXISTS ugc_video_organic_verkaufspreis_netto_von numeric,
  ADD COLUMN IF NOT EXISTS ugc_video_organic_verkaufspreis_netto_bis numeric;
