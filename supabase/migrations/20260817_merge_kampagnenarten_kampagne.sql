-- Migration: Kampagnenarten-Zusammenführung – kampagne-Tabelle
-- Analog zu auftrag_details (20260817_merge_kampagnenarten):
-- ugc_paid_*   += ugc_pro_paid_* + ugc_video_paid_*
-- ugc_organic_* += ugc_pro_organic_* + ugc_video_organic_* + ugc_* + igc_*
-- kampagne hat pro Prefix nur video/creator/bilder_anzahl (keine Budgets/Preise).
-- bilder_anzahl der Pro/Video/Legacy-Varianten entfällt (Ziel-Modell ohne Bilder-Spalte).

UPDATE kampagne SET
  ugc_paid_video_anzahl = CASE
    WHEN ugc_paid_video_anzahl IS NOT NULL OR ugc_pro_paid_video_anzahl IS NOT NULL OR ugc_video_paid_video_anzahl IS NOT NULL
    THEN COALESCE(ugc_paid_video_anzahl, 0) + COALESCE(ugc_pro_paid_video_anzahl, 0) + COALESCE(ugc_video_paid_video_anzahl, 0) END,
  ugc_paid_creator_anzahl = CASE
    WHEN ugc_paid_creator_anzahl IS NOT NULL OR ugc_pro_paid_creator_anzahl IS NOT NULL OR ugc_video_paid_creator_anzahl IS NOT NULL
    THEN COALESCE(ugc_paid_creator_anzahl, 0) + COALESCE(ugc_pro_paid_creator_anzahl, 0) + COALESCE(ugc_video_paid_creator_anzahl, 0) END;

UPDATE kampagne SET
  ugc_organic_video_anzahl = CASE
    WHEN ugc_organic_video_anzahl IS NOT NULL OR ugc_pro_organic_video_anzahl IS NOT NULL OR ugc_video_organic_video_anzahl IS NOT NULL OR ugc_video_anzahl IS NOT NULL OR igc_video_anzahl IS NOT NULL
    THEN COALESCE(ugc_organic_video_anzahl, 0) + COALESCE(ugc_pro_organic_video_anzahl, 0) + COALESCE(ugc_video_organic_video_anzahl, 0) + COALESCE(ugc_video_anzahl, 0) + COALESCE(igc_video_anzahl, 0) END,
  ugc_organic_creator_anzahl = CASE
    WHEN ugc_organic_creator_anzahl IS NOT NULL OR ugc_pro_organic_creator_anzahl IS NOT NULL OR ugc_video_organic_creator_anzahl IS NOT NULL OR ugc_creator_anzahl IS NOT NULL OR igc_creator_anzahl IS NOT NULL
    THEN COALESCE(ugc_organic_creator_anzahl, 0) + COALESCE(ugc_pro_organic_creator_anzahl, 0) + COALESCE(ugc_video_organic_creator_anzahl, 0) + COALESCE(ugc_creator_anzahl, 0) + COALESCE(igc_creator_anzahl, 0) END;

-- Quell-Spalten leeren (DROP erst in spaeterem Cleanup)
UPDATE kampagne SET
  ugc_pro_paid_video_anzahl = NULL, ugc_pro_paid_creator_anzahl = NULL, ugc_pro_paid_bilder_anzahl = NULL,
  ugc_video_paid_video_anzahl = NULL, ugc_video_paid_creator_anzahl = NULL, ugc_video_paid_bilder_anzahl = NULL,
  ugc_pro_organic_video_anzahl = NULL, ugc_pro_organic_creator_anzahl = NULL, ugc_pro_organic_bilder_anzahl = NULL,
  ugc_video_organic_video_anzahl = NULL, ugc_video_organic_creator_anzahl = NULL, ugc_video_organic_bilder_anzahl = NULL,
  ugc_video_anzahl = NULL, ugc_creator_anzahl = NULL, ugc_bilder_anzahl = NULL,
  igc_video_anzahl = NULL, igc_creator_anzahl = NULL, igc_bilder_anzahl = NULL;
