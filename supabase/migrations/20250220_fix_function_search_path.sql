-- Fix: function_search_path_mutable - Funktionen mit festem search_path
-- Verhindert search_path-Manipulation als Sicherheitsrisiko

ALTER FUNCTION public.update_education_updated_at() SET search_path = public;
ALTER FUNCTION public.update_produkt_updated_at() SET search_path = public;
ALTER FUNCTION public.generate_angebotsnummer() SET search_path = public;
ALTER FUNCTION public.increment_po_counter() SET search_path = public;
ALTER FUNCTION public.update_marke_kickoff_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.check_unternehmen_duplicate(text, uuid) SET search_path = public;
ALTER FUNCTION public.check_marke_duplicate(text, uuid) SET search_path = public;
ALTER FUNCTION public.check_creator_duplicate(text, text, uuid) SET search_path = public;
ALTER FUNCTION public.update_feedback_updated_at() SET search_path = public;
