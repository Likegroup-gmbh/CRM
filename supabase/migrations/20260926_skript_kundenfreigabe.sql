-- Kundenfreigabe: Gast mit Bearbeiten-Recht setzt ein finales Skript auf
-- 'freigegeben' und hakt die Checkbox an allen verknüpften Kooperationsvideos.
-- Final bleibt der interne Status (darf an den Kunden).

ALTER TABLE skripte DROP CONSTRAINT IF EXISTS skripte_status_check;
ALTER TABLE skripte ADD CONSTRAINT skripte_status_check
  CHECK (status IN ('entwurf', 'feedback_gegeben', 'final', 'archiviert', 'fragen', 'freigegeben'));

CREATE OR REPLACE FUNCTION public.freigeben_skript_gast(p_skript_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF (SELECT can_gast_access_skript(p_skript_id, true)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Kein Schreibzugriff auf dieses Skript';
  END IF;

  SELECT status INTO v_status FROM public.skripte WHERE id = p_skript_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skript nicht gefunden';
  END IF;
  IF v_status IS DISTINCT FROM 'final' THEN
    RAISE EXCEPTION 'Nur Skripte mit Status Final können freigegeben werden';
  END IF;

  UPDATE public.skripte
  SET status = 'freigegeben'
  WHERE id = p_skript_id;

  UPDATE public.kooperation_videos
  SET skript_freigegeben = true
  WHERE skript_id = p_skript_id;
END;
$$;

REVOKE ALL ON FUNCTION public.freigeben_skript_gast(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.freigeben_skript_gast(uuid) TO anon;
