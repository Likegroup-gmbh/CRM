-- Performance: kooperation_videos (Ø 3 bis 6 s bei Voll-Ladungen) und Gast-Policies.
--
-- 1) kooperation_videos_select rief pro Zeile can_access_kooperation_video(kooperation_id) auf
--    (SECURITY DEFINER, mehrere EXISTS über kooperationen/kampagne/...). Jetzt: einmal pro
--    Statement die Menge der zugänglichen Kooperations-IDs holen (hashed SubPlan).
--    Semantik identisch zu can_access_kooperation_video():
--      Admin
--      ODER Mitarbeiter: Kampagne direkt zugeordnet, über Marke, über Unternehmen,
--                        oder Unternehmen der Marke der Kampagne
--      ODER Kunde: kunde_marke der Kampagnen-Marke ODER kunde_unternehmen des Kampagnen-Unternehmens
--
-- 2) Gast-Policies (gast_has_share / gast_can_access_kooperation) liefen für ALLE Nutzer pro Zeile.
--    share_claim_has_access() ist ohne JWT-Claim share_id immer false, d.h. nur Gäste können
--    jemals true werden. Guard: (SELECT current_role_is_gast()) AND <alte Bedingung>.
--    current_role_is_gast() = COALESCE(auth.jwt()->>'share_id','') <> ''  (gleiche Quelle wie
--    share_claim_has_access: NULLIF(auth.jwt()->>'share_id','')), Ergebnis für Gäste unverändert.
--
-- Rollback:
--   ALTER POLICY kooperation_videos_select ON public.kooperation_videos
--     USING ((SELECT public.can_access_kooperation_video(kooperation_videos.kooperation_id)));
--   ALTER POLICY kooperation_videos_gast_select ON public.kooperation_videos
--     USING (public.gast_can_access_kooperation(kooperation_id, false));
--   ALTER POLICY kooperationen_gast_select ON public.kooperationen
--     USING (public.gast_has_share('kampagne'::text, kampagne_id, false));
--   ALTER POLICY kampagne_gast_select ON public.kampagne
--     USING (public.gast_has_share('kampagne'::text, id, false));
--   ALTER POLICY strategie_gast_select ON public.strategie
--     USING (public.gast_has_share('strategie'::text, id, false));
--   ALTER POLICY strategie_items_gast_select ON public.strategie_items
--     USING (public.gast_has_share('strategie'::text, strategie_id, false) AND (COALESCE(ist_vorschlag, false) = false));
--   ALTER POLICY creator_auswahl_gast_select ON public.creator_auswahl
--     USING (public.gast_has_share('sourcing'::text, id, false));
--   ALTER POLICY creator_auswahl_items_gast_select ON public.creator_auswahl_items
--     USING (public.gast_has_share('sourcing'::text, creator_auswahl_id, false));

CREATE OR REPLACE FUNCTION private.rls_my_kooperation_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $$
  WITH me AS (
    SELECT b.id, b.rolle FROM public.benutzer b WHERE b.auth_user_id = auth.uid()
  ),
  my_kampagne AS (
    SELECT km.kampagne_id AS id
    FROM public.kampagne_mitarbeiter km
    JOIN me ON me.id = km.mitarbeiter_id AND me.rolle = 'mitarbeiter'
  ),
  my_marke AS (
    SELECT mm.marke_id AS id
    FROM public.marke_mitarbeiter mm
    JOIN me ON me.id = mm.mitarbeiter_id AND me.rolle = 'mitarbeiter'
    UNION
    SELECT m.id
    FROM public.marke m
    JOIN public.mitarbeiter_unternehmen mu ON mu.unternehmen_id = m.unternehmen_id
    JOIN me ON me.id = mu.mitarbeiter_id AND me.rolle = 'mitarbeiter'
    UNION
    SELECT kma.marke_id
    FROM public.kunde_marke kma
    JOIN me ON me.id = kma.kunde_id
  ),
  my_unternehmen AS (
    SELECT mu.unternehmen_id AS id
    FROM public.mitarbeiter_unternehmen mu
    JOIN me ON me.id = mu.mitarbeiter_id AND me.rolle = 'mitarbeiter'
    UNION
    SELECT ku.unternehmen_id
    FROM public.kunde_unternehmen ku
    JOIN me ON me.id = ku.kunde_id
  )
  SELECT k.id
  FROM public.kooperationen k
  JOIN public.kampagne ka ON ka.id = k.kampagne_id
  WHERE ka.id IN (SELECT id FROM my_kampagne)
     OR ka.marke_id IN (SELECT id FROM my_marke)
     OR ka.unternehmen_id IN (SELECT id FROM my_unternehmen);
$$;

REVOKE ALL ON FUNCTION private.rls_my_kooperation_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.rls_my_kooperation_ids() TO authenticated, anon;

ALTER POLICY kooperation_videos_select ON public.kooperation_videos
  USING (
    (SELECT public.is_admin())
    OR kooperation_id IN (SELECT private.rls_my_kooperation_ids())
  );

-- Gast-Guard (nur SELECT-Policies; Update/Insert-Policies sind für die Leselast nicht relevant)
ALTER POLICY kooperation_videos_gast_select ON public.kooperation_videos
  USING ((SELECT public.current_role_is_gast()) AND public.gast_can_access_kooperation(kooperation_id, false));

ALTER POLICY kooperationen_gast_select ON public.kooperationen
  USING ((SELECT public.current_role_is_gast()) AND public.gast_has_share('kampagne'::text, kampagne_id, false));

ALTER POLICY kampagne_gast_select ON public.kampagne
  USING ((SELECT public.current_role_is_gast()) AND public.gast_has_share('kampagne'::text, id, false));

ALTER POLICY strategie_gast_select ON public.strategie
  USING ((SELECT public.current_role_is_gast()) AND public.gast_has_share('strategie'::text, id, false));

ALTER POLICY strategie_items_gast_select ON public.strategie_items
  USING ((SELECT public.current_role_is_gast()) AND public.gast_has_share('strategie'::text, strategie_id, false) AND (COALESCE(ist_vorschlag, false) = false));

ALTER POLICY creator_auswahl_gast_select ON public.creator_auswahl
  USING ((SELECT public.current_role_is_gast()) AND public.gast_has_share('sourcing'::text, id, false));

ALTER POLICY creator_auswahl_items_gast_select ON public.creator_auswahl_items
  USING ((SELECT public.current_role_is_gast()) AND public.gast_has_share('sourcing'::text, creator_auswahl_id, false));
