-- Info-Zeilen zu Kunden-Edits bekommen Vorher/Nachher: der RPC liest den
-- alten Feldwert, bevor er schreibt, klassifiziert die Aenderung
-- (hinzugefuegt / bearbeitet / entfernt) und speichert beide Volltexte.
-- selektion_text bleibt den Kommentar-Threads vorbehalten; aenderung-Zeilen
-- nutzen vorher_text / nachher_text.

ALTER TABLE public.skript_kommentare
  ADD COLUMN IF NOT EXISTS vorher_text text,
  ADD COLUMN IF NOT EXISTS nachher_text text;

CREATE OR REPLACE FUNCTION public.save_skript_kunde_aenderung(
  p_skript_id uuid,
  p_feld text,
  p_wert text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skript public.skripte%ROWTYPE;
  v_ist_visuell boolean;
  v_sektion text;
  v_alt text;
  v_art text;
  v_label text;
  v_kommentar_id uuid;
BEGIN
  -- Nur Kunden; Staff speichert ueber updateSkript + Version.
  -- IS NOT TRUE statt NOT IN: faengt NULL-Rollen (z.B. Gast ohne
  -- benutzer-Row) ab, statt sie durchzuwinken.
  IF ((SELECT get_current_user_rolle()) = ANY (ARRAY['kunde'::text, 'kunde_editor'::text])) IS NOT TRUE THEN
    RAISE EXCEPTION 'Nur Kunden speichern ueber diesen Weg';
  END IF;

  -- Feld-Whitelist: nur die Content-Zellen des Dokuments
  IF p_feld NOT IN ('hook', 'hauptteil', 'cta', 'hook_visuell', 'hauptteil_visuell', 'cta_visuell') THEN
    RAISE EXCEPTION 'Feld nicht editierbar: %', p_feld;
  END IF;

  SELECT * INTO v_skript FROM public.skripte WHERE id = p_skript_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skript nicht gefunden';
  END IF;

  IF (SELECT can_kunde_access_skript(v_skript.unternehmen_id, v_skript.marke_id, v_skript.kampagne_id)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Kein Zugriff auf dieses Skript';
  END IF;

  -- Alt-Wert VOR dem Update lesen (%I durch die Whitelist abgesichert)
  EXECUTE format('SELECT ($1).%I', p_feld) INTO v_alt USING v_skript;

  v_ist_visuell := right(p_feld, 8) = '_visuell';
  v_sektion := replace(p_feld, '_visuell', '');

  -- Aenderungsart: leer -> gefuellt = hinzugefuegt, gefuellt -> leer = entfernt
  v_art := CASE
    WHEN NULLIF(btrim(COALESCE(v_alt, '')), '') IS NULL THEN 'hinzugefügt'
    WHEN NULLIF(btrim(COALESCE(p_wert, '')), '') IS NULL THEN 'entfernt'
    ELSE 'bearbeitet'
  END;

  v_label := CASE v_sektion
    WHEN 'hook' THEN 'Hook'
    WHEN 'hauptteil' THEN 'Hauptteil'
    WHEN 'cta' THEN 'CTA'
  END || CASE WHEN v_ist_visuell THEN ' Visual' ELSE '' END || ' ' || v_art;

  EXECUTE format('UPDATE public.skripte SET %I = $1 WHERE id = $2', p_feld)
  USING p_wert, p_skript_id;

  INSERT INTO public.skript_kommentare (
    skript_id, parent_id, sektion, ist_visuell, inhalt, typ, vorher_text, nachher_text, created_by
  ) VALUES (
    p_skript_id,
    NULL,
    v_sektion,
    v_ist_visuell,
    v_label,
    'aenderung',
    NULLIF(v_alt, ''),
    NULLIF(p_wert, ''),
    (SELECT get_current_benutzer_id())
  )
  RETURNING id INTO v_kommentar_id;

  RETURN v_kommentar_id;
END;
$$;
