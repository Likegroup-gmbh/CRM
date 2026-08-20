-- Nachschuss zu 20260817_merge_kampagnenarten: igc_* Legacy-Spalten in auftrag_details
-- waren nicht Bestandteil der ersten Migration. IGC Kampagnen -> UGC Organic (Merge-Map B4).
-- Befund: 119 Zeilen mit igc_* IS NOT NULL, davon genau 1 mit echten Werten
-- (igc_video_anzahl=5, igc_creator_anzahl=3, igc_budget_info), Rest nur 0.
-- Strategie wie gehabt: merge_sum in ugc_organic_*, danach Quell-Spalten NULLen
-- (DROP der Spalten erst in spaeterem Cleanup, sobald Code-Referenzen weg sind).

BEGIN;

UPDATE auftrag_details
SET
  ugc_organic_video_anzahl = CASE
    WHEN ugc_organic_video_anzahl IS NOT NULL OR igc_video_anzahl IS NOT NULL
    THEN COALESCE(ugc_organic_video_anzahl, 0) + COALESCE(igc_video_anzahl, 0)
  END,
  ugc_organic_creator_anzahl = CASE
    WHEN ugc_organic_creator_anzahl IS NOT NULL OR igc_creator_anzahl IS NOT NULL
    THEN COALESCE(ugc_organic_creator_anzahl, 0) + COALESCE(igc_creator_anzahl, 0)
  END,
  ugc_organic_budget_info = CASE
    WHEN NULLIF(btrim(COALESCE(igc_budget_info, '')), '') IS NULL THEN ugc_organic_budget_info
    WHEN NULLIF(btrim(COALESCE(ugc_organic_budget_info, '')), '') IS NULL THEN igc_budget_info
    ELSE ugc_organic_budget_info || E'\n\n' || igc_budget_info
  END
WHERE igc_video_anzahl IS NOT NULL
   OR igc_creator_anzahl IS NOT NULL
   OR NULLIF(btrim(COALESCE(igc_budget_info, '')), '') IS NOT NULL;

UPDATE auftrag_details
SET
  igc_video_anzahl = NULL,
  igc_bilder_anzahl = NULL,
  igc_creator_anzahl = NULL,
  igc_budget_info = NULL,
  igc_einkaufspreis_netto = NULL,
  igc_einkaufspreis_netto_von = NULL,
  igc_einkaufspreis_netto_bis = NULL,
  igc_verkaufspreis_netto = NULL,
  igc_verkaufspreis_netto_von = NULL,
  igc_verkaufspreis_netto_bis = NULL;

COMMIT;
