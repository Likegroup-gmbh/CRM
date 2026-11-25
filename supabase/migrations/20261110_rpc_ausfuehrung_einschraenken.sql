-- Haertung: SECURITY-DEFINER-Funktionen nicht fuer jeden aufrufbar.
--
-- Befund (Advisor + Pruefung der Bodies): Diese RPCs laufen als Owner (umgehen RLS)
-- und waren fuer `anon` ausfuehrbar, also mit dem oeffentlichen Anon-Key ohne Login:
--   increment_po_counter()                -> schreibt po_counter
--   replace_audience_situation_seeds()    -> loescht/schreibt audience_situation
--   check_creator_duplicate()             -> liest Creator-Name, Instagram, Mail
--   check_marke_duplicate(), check_unternehmen_duplicate()
--   get_unternehmen_folders(), get_vertrag_filter_options() -> Firmen-/Vertragsdaten
--
-- Wichtig: Gast-JWTs (share-list) tragen role='anon'. Alle Gast-RPCs
-- (save_skript_gast_aenderung, freigeben_skript_gast, skript_creator_anzeige, ...)
-- und magic_link_vorschau (Registrierung vor dem Login) bleiben deshalb unveraendert.
--
-- Trigger-Funktionen muessen nicht ueber die API erreichbar sein; Trigger feuern
-- unabhaengig vom EXECUTE-Recht (das wird nur beim CREATE TRIGGER geprueft).
--
-- ROLLBACK:
--   GRANT EXECUTE ON FUNCTION public.<name>(<args>) TO anon, authenticated;

-- 1) Nur eingeloggte Nutzer (Staff-Formulare/-Listen).
REVOKE EXECUTE ON FUNCTION public.increment_po_counter() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_creator_duplicate(text, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_marke_duplicate(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_unternehmen_duplicate(text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_unternehmen_folders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_vertrag_filter_options() FROM PUBLIC, anon;

-- 2) Nur Service-Role (Netlify audience-situation-background nutzt SUPABASE_SERVICE_KEY).
REVOKE EXECUTE ON FUNCTION public.replace_audience_situation_seeds(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_audience_situation_seeds(uuid, jsonb) TO service_role;

-- 3) Trigger-Funktionen: nicht ueber /rest/v1/rpc erreichbar machen.
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END
$do$;
