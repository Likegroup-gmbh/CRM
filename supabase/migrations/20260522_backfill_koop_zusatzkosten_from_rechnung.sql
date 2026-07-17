-- Backfill: rechnung.zusatzkosten -> kooperationen (EK + VK)
--
-- Schreibt Zusatzkosten aus der neuesten Rechnung in die Kooperation zurueck.
-- Rechnung = Source of Truth: EK und VK werden immer ueberschrieben.
-- Bei mehreren Rechnungen pro Kooperation gewinnt die neueste (DISTINCT ON + ORDER BY).
--
-- Dry-Run:
-- SELECT k.id,
--        k.einkaufspreis_zusatzkosten, k.verkaufspreis_zusatzkosten,
--        r.zusatzkosten AS rechnung_zusatzkosten
-- FROM kooperationen k
-- JOIN rechnung r ON r.kooperation_id = k.id
--   AND r.zusatzkosten IS NOT NULL AND r.zusatzkosten > 0;

WITH latest_rechnung AS (
  SELECT DISTINCT ON (kooperation_id)
    kooperation_id,
    zusatzkosten,
    ust_prozent
  FROM rechnung
  WHERE kooperation_id IS NOT NULL
    AND zusatzkosten IS NOT NULL
    AND zusatzkosten > 0
  ORDER BY kooperation_id, created_at DESC NULLS LAST
),
with_rate AS (
  SELECT
    lr.kooperation_id,
    lr.zusatzkosten,
    COALESCE(
      lr.ust_prozent,
      CASE
        WHEN NULLIF(k.einkaufspreis_netto, 0) IS NOT NULL
             AND k.einkaufspreis_ust IS NOT NULL
          THEN ROUND(k.einkaufspreis_ust / k.einkaufspreis_netto * 100)
        ELSE 19
      END
    ) AS ek_ust_rate,
    CASE
      WHEN NULLIF(k.verkaufspreis_netto, 0) IS NOT NULL
           AND k.verkaufspreis_ust IS NOT NULL
        THEN ROUND(k.verkaufspreis_ust / k.verkaufspreis_netto * 100)
      ELSE 19
    END AS vk_ust_rate
  FROM latest_rechnung lr
  JOIN kooperationen k ON k.id = lr.kooperation_id
)
UPDATE kooperationen k
SET
  einkaufspreis_zusatzkosten = wr.zusatzkosten,
  einkaufspreis_ust = ROUND(
    (COALESCE(k.einkaufspreis_netto, 0) + wr.zusatzkosten) * (wr.ek_ust_rate / 100.0),
    2
  ),
  einkaufspreis_gesamt = ROUND(
    (COALESCE(k.einkaufspreis_netto, 0) + wr.zusatzkosten) * (1 + wr.ek_ust_rate / 100.0),
    2
  ),
  verkaufspreis_zusatzkosten = wr.zusatzkosten,
  verkaufspreis_ust = ROUND(
    (COALESCE(k.verkaufspreis_netto, 0) + wr.zusatzkosten) * (wr.vk_ust_rate / 100.0),
    2
  ),
  verkaufspreis_gesamt = ROUND(
    (COALESCE(k.verkaufspreis_netto, 0) + wr.zusatzkosten) * (1 + wr.vk_ust_rate / 100.0),
    2
  )
FROM with_rate wr
WHERE k.id = wr.kooperation_id;
