-- Advisor function_search_path_mutable: 10 Funktionen in public hatten keinen festen
-- search_path. Keine nutzt Extension-, auth- oder Helper-Funktionen (Body geprueft),
-- `public` ist verhaltensgleich zum bisherigen Standardpfad.
--
-- ROLLBACK: ALTER FUNCTION public.<name>(<args>) RESET search_path;

DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname IN (
        'campaign_briefings_touch_updated_at', 'creator_groesse_label', 'creator_set_groesse',
        'guard_produktion_budget_floor', 'guard_produktion_mit_briefing', 'guard_video_verkaufspreis',
        'sync_kampagne_id_from_produktion', 'sync_produktion_line_names',
        'unternehmen_ist_test_freeze', 'videolaenge_funnel_gueltig'
      )
      AND (p.proconfig IS NULL
           OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
  END LOOP;
END
$do$;
