-- Fix: Magic Link Registrierung erstellt keine Verknüpfungen
-- Root Cause: Nach signUp() mit Email-Confirm ist der Client "anon",
-- auth.uid() ist NULL, RLS blockiert alle Inserts in Junction-Tabellen.
-- Lösung: SECURITY DEFINER Funktion die RLS umgeht.

CREATE OR REPLACE FUNCTION public.link_kunde_from_magic_link(
  p_kunde_id uuid,
  p_ansprechpartner_id uuid,
  p_magic_link_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unternehmen_count int := 0;
  v_marke_count int := 0;
BEGIN
  IF p_kunde_id IS NULL OR p_ansprechpartner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'kunde_id und ansprechpartner_id sind erforderlich');
  END IF;

  -- 1. kunde_ansprechpartner verknuepfen
  INSERT INTO public.kunde_ansprechpartner (kunde_id, ansprechpartner_id)
  VALUES (p_kunde_id, p_ansprechpartner_id)
  ON CONFLICT (kunde_id, ansprechpartner_id) DO NOTHING;

  -- 2. Unternehmen vom Ansprechpartner auf den Kunden kopieren
  WITH inserted AS ( s
    INSERT INTO public.kunde_unternehmen (kunde_id, unternehmen_id)
    SELECT p_kunde_id, au.unternehmen_id
    FROM public.ansprechpartner_unternehmen au
    WHERE au.ansprechpartner_id = p_ansprechpartner_id
    ON CONFLICT (kunde_id, unternehmen_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_unternehmen_count FROM inserted;

  -- 3. Marken vom Ansprechpartner auf den Kunden kopieren
  WITH inserted AS (
    INSERT INTO public.kunde_marke (kunde_id, marke_id)
    SELECT p_kunde_id, am.marke_id
    FROM public.ansprechpartner_marke am
    WHERE am.ansprechpartner_id = p_ansprechpartner_id
    ON CONFLICT (kunde_id, marke_id) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_marke_count FROM inserted;

  -- 4. Magic Link als verwendet markieren (falls ID uebergeben)
  IF p_magic_link_id IS NOT NULL THEN
    UPDATE public.magic_links
    SET used_at = now()
    WHERE id = p_magic_link_id
      AND used_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'kunde_id', p_kunde_id,
    'ansprechpartner_id', p_ansprechpartner_id,
    'unternehmen_linked', v_unternehmen_count,
    'marken_linked', v_marke_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_kunde_from_magic_link(uuid, uuid, uuid) TO anon, authenticated;
