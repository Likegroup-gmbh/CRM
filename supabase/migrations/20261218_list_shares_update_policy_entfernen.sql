-- list_shares wird nur noch über die Edge Function share-list geändert (Service Role,
-- Actions revoke, update, rotate_code). Die Policy erlaubte Mitarbeitern per Browser-Konsole
-- jede Spalte zu ändern, auch code_hash, token und entity_id.
--
-- ERST AUSSPIELEN, WENN DAS FRONTEND MIT shareApi LIVE IST: ältere Frontends widerrufen und
-- ändern Rechte noch direkt per UPDATE und würden danach still 0 Zeilen treffen.
--
-- ROLLBACK:
--   CREATE POLICY list_shares_update ON public.list_shares
--     FOR UPDATE USING ((SELECT is_admin_or_mitarbeiter()))
--     WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS list_shares_update ON public.list_shares;
