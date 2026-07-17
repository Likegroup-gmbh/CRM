-- Migration: Duplikat-Indexes entfernen + Partial-Index fuer Magic-Link-Checks

BEGIN;

-- ============================================================
-- 1. Duplikat-Indexes droppen
--    kunde_marke_pkey und ux_kunde_marke_kunde_marke sind identisch (beide auf (kunde_id, marke_id))
--    kunde_unternehmen_pkey und ux_kunde_unternehmen_kunde_unternehmen ebenso
-- ============================================================

DROP INDEX IF EXISTS public.ux_kunde_marke_kunde_marke;
DROP INDEX IF EXISTS public.ux_kunde_unternehmen_kunde_unternehmen;

-- ============================================================
-- 2. Partial-Index fuer aktive Magic-Links
--    Beschleunigt marke_select und unternehmen_select Magic-Link-Branches:
--    WHERE magic_links.used_at IS NULL AND magic_links.expires_at > now()
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_magic_links_active
  ON public.magic_links(ansprechpartner_id)
  WHERE used_at IS NULL;

COMMIT;
