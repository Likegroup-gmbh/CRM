-- Briefing-Produkte nur noch ueber accepted Persona-Fits (ADR 0021).
-- Membership bleibt campaign_briefings.persona_ids; die Junction ist Projektion.

DELETE FROM public.campaign_briefing_produkt;

INSERT INTO public.campaign_briefing_produkt (briefing_id, produkt_id)
SELECT DISTINCT cb.id, v.produkt_id
FROM public.campaign_briefings cb
CROSS JOIN LATERAL unnest(COALESCE(cb.persona_ids, ARRAY[]::uuid[])) AS pid
JOIN public.produkt_persona_vorschlag v
  ON v.persona_id = pid
 AND v.status = 'accepted'
WHERE v.produkt_id IS NOT NULL
ON CONFLICT (briefing_id, produkt_id) DO NOTHING;
