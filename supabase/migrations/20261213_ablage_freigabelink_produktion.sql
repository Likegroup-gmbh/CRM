-- Medienablage: Kunden-Leselink auf den Produktions-Ordner (ADR 0071).
-- Ein Link hängt an einer Kooperation (Videos-Ordner, ordner_art = 'videos') oder an einer
-- Produktion (Produktions-Ordner, ordner_art = 'produktion'). Fällt die Produktion weg, bleibt
-- die Zeile ohne Bezug stehen, damit der Link bei SharePoint noch widerrufen werden kann.
--
-- ROLLBACK (Produktions-Links gehen dabei verloren, vorher bei SharePoint widerrufen):
--   DELETE FROM public.ablage_freigabelink WHERE kooperation_id IS NULL;
--   ALTER TABLE public.ablage_freigabelink ALTER COLUMN kooperation_id SET NOT NULL;
--   DROP INDEX IF EXISTS public.idx_ablage_freigabelink_produktion;
--   ALTER TABLE public.ablage_freigabelink DROP COLUMN produktion_id;
--   Policy ablage_freigabelink_select wie in 20261201_medienablage.sql neu setzen.

BEGIN;

ALTER TABLE public.ablage_freigabelink
  ADD COLUMN IF NOT EXISTS produktion_id uuid REFERENCES public.produktion(id) ON DELETE SET NULL;
ALTER TABLE public.ablage_freigabelink ALTER COLUMN kooperation_id DROP NOT NULL;
COMMENT ON COLUMN public.ablage_freigabelink.produktion_id IS
  'Link auf den Produktions-Ordner (ordner_art = produktion). Sonst kooperation_id (Videos-Ordner).';

CREATE INDEX IF NOT EXISTS idx_ablage_freigabelink_produktion
  ON public.ablage_freigabelink (produktion_id) WHERE widerrufen_at IS NULL;

-- Angelegt und gelesen wird über ablage-freigabe (Service-Client); die Policy gilt für direkte Abfragen.
DROP POLICY IF EXISTS ablage_freigabelink_select ON public.ablage_freigabelink;
CREATE POLICY ablage_freigabelink_select ON public.ablage_freigabelink
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_admin())
    OR kooperation_id IN (SELECT private.rls_my_kooperation_ids())
    OR ((SELECT public.is_admin_or_mitarbeiter()) AND produktion_id IN (SELECT p.id FROM public.produktion p))
  );

COMMIT;
