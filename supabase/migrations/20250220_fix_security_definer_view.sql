-- Fix: v_kampagne_mitarbeiter_aggregated als SECURITY DEFINER
-- View soll mit Rechten des aufrufenden Users laufen, nicht des View-Erstellers

ALTER VIEW public.v_kampagne_mitarbeiter_aggregated SET (security_invoker = true);
