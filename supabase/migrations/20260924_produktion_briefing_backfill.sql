-- Bestand: produktion.briefing_id und produkt_id aus den Kindern nachziehen.
-- Eine Produktion bekommt das Briefing nur, wenn alle Kinder dieselbe briefing_id
-- tragen und kein anderer Lauf sie schon hält. Produkt nur bei genau einem
-- Eintrag in campaign_briefing_produkt.

BEGIN;

WITH child_briefings AS (
  SELECT produktion_id, briefing_id
    FROM public.creator_auswahl
   WHERE produktion_id IS NOT NULL AND briefing_id IS NOT NULL
  UNION ALL
  SELECT produktion_id, briefing_id
    FROM public.strategie
   WHERE produktion_id IS NOT NULL AND briefing_id IS NOT NULL
  UNION ALL
  SELECT produktion_id, briefing_id
    FROM public.skripte
   WHERE produktion_id IS NOT NULL AND briefing_id IS NOT NULL
  UNION ALL
  SELECT produktion_id, briefing_id
    FROM public.kooperationen
   WHERE produktion_id IS NOT NULL AND briefing_id IS NOT NULL
),
unique_briefing AS (
  SELECT produktion_id, (array_agg(DISTINCT briefing_id))[1] AS briefing_id
    FROM child_briefings
   GROUP BY produktion_id
  HAVING count(DISTINCT briefing_id) = 1
),
unique_owner AS (
  SELECT DISTINCT ON (u.briefing_id)
         u.produktion_id,
         u.briefing_id
    FROM unique_briefing u
    JOIN public.produktion p ON p.id = u.produktion_id
   WHERE p.briefing_id IS NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.produktion other
        WHERE other.briefing_id = u.briefing_id
     )
   ORDER BY u.briefing_id, p.created_at ASC, p.id ASC
)
UPDATE public.produktion p
   SET briefing_id = o.briefing_id,
       name = COALESCE(NULLIF(btrim(b.aktivierung_name), ''), p.name)
  FROM unique_owner o
  JOIN public.campaign_briefings b ON b.id = o.briefing_id
 WHERE p.id = o.produktion_id
   AND p.briefing_id IS NULL;

WITH single_produkt AS (
  SELECT briefing_id, (array_agg(produkt_id))[1] AS produkt_id
    FROM public.campaign_briefing_produkt
   GROUP BY briefing_id
  HAVING count(*) = 1
)
UPDATE public.produktion p
   SET produkt_id = sp.produkt_id
  FROM single_produkt sp
 WHERE p.briefing_id = sp.briefing_id
   AND p.produkt_id IS NULL;

COMMIT;
