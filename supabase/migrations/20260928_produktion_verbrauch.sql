-- Verbrauch je Produktion für die globale Liste.
-- Eine Zeile pro Produktion statt aller Video-Zeilen im Client.
-- security_invoker: RLS von kooperationen und kooperation_videos gilt.

CREATE INDEX IF NOT EXISTS kooperation_videos_koop_preis_idx
  ON public.kooperation_videos (kooperation_id) INCLUDE (verkaufspreis_netto);

CREATE OR REPLACE VIEW public.produktion_verbrauch
WITH (security_invoker = true) AS
SELECT
  ko.produktion_id,
  SUM(kv.verkaufspreis_netto) AS budget_used
FROM public.kooperationen ko
JOIN public.kooperation_videos kv ON kv.kooperation_id = ko.id
WHERE ko.produktion_id IS NOT NULL
GROUP BY ko.produktion_id;

GRANT SELECT ON public.produktion_verbrauch TO authenticated, service_role;
