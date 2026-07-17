-- Fix: Duplikat-Indizes entfernen (Performance Advisor)
-- Behalte jeweils einen Index pro Spalte(n), entferne identische Duplikate

DROP INDEX IF EXISTS public.kampagne_mitarbeiter_kid_mid_role_idx;
DROP INDEX IF EXISTS public.idx_kooperation_versand_kooperation;
DROP INDEX IF EXISTS public.idx_video_asset_current;
DROP INDEX IF EXISTS public.idx_kunde_marke_kunde;
DROP INDEX IF EXISTS public.idx_kunde_marke_marke;
DROP INDEX IF EXISTS public.idx_kunde_unternehmen_kunde;
DROP INDEX IF EXISTS public.idx_kunde_unternehmen_unternehmen;
DROP INDEX IF EXISTS public.idx_strategie_kampagne;
DROP INDEX IF EXISTS public.idx_strategie_marke;
DROP INDEX IF EXISTS public.idx_strategie_unternehmen;
