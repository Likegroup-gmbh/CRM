-- Gäste einer geteilten Kampagne sehen deren Produktionen (Übersicht und /produktion/:id).
-- produktion_select gilt nur für authenticated, das Gast-JWT läuft als anon und bekam
-- deshalb 0 Zeilen: Übersicht zeigte "Noch keine Produktion".
--
-- campaign_briefings bleibt für Gäste zu. Die Produktion lädt dann ohne Linien und die
-- Kooperationen-Tabelle zeigt alle Kooperationen der Produktion.
--
-- ROLLBACK:
--   DROP POLICY IF EXISTS produktion_gast_select ON public.produktion;

DROP POLICY IF EXISTS produktion_gast_select ON public.produktion;
CREATE POLICY produktion_gast_select ON public.produktion
  FOR SELECT
  USING ((SELECT public.current_role_is_gast()) AND public.gast_has_share('kampagne'::text, kampagne_id, false));
