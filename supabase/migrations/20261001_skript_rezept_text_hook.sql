-- Aufbau-Optionen der Skript-Generierung:
--   rezept    - Rezept-Block unter dem CTA (volle Breite, Inhalt aus der
--               Caption der Videovorlage), nur wenn mit_rezept im Payload.
--   text_hook - On-Screen-Text-Hook im Hook (Texteinblendung), nur wenn
--               mit_text_hook im Payload.
-- Eigene Felder analog hook/cta/*_visuell, damit sie inline editierbar
-- sind und in Versionen ueberleben.

ALTER TABLE public.skripte
  ADD COLUMN IF NOT EXISTS rezept text,
  ADD COLUMN IF NOT EXISTS text_hook text;

ALTER TABLE public.skript_versionen
  ADD COLUMN IF NOT EXISTS rezept text,
  ADD COLUMN IF NOT EXISTS text_hook text;

-- skript_kommentare.sektion nimmt die neuen Felder auf (die Aenderungs-
-- RPCs schreiben v_sektion dorthin).
ALTER TABLE public.skript_kommentare
  DROP CONSTRAINT IF EXISTS skript_kommentare_sektion_check;
ALTER TABLE public.skript_kommentare
  ADD CONSTRAINT skript_kommentare_sektion_check
  CHECK (sektion IN ('hook','hauptteil','cta','gesamt','rezept','text_hook'));

-- Feld-Whitelists der Kunden-/Gast-Speicherwege erweitern. Die Rumpfe
-- entsprechen dem aktuellen Stand (20260907_skript_aenderung_vorher_nachher
-- bzw. 20260908_skript_sharing_gast), nur Whitelist + Label-CASE sind neu.
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
  IF p_feld NOT IN ('hook', 'hauptteil', 'cta', 'hook_visuell', 'hauptteil_visuell', 'cta_visuell', 'rezept', 'text_hook') THEN
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
    WHEN 'rezept' THEN 'Rezept'
    WHEN 'text_hook' THEN 'Text-Hook'
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

CREATE OR REPLACE FUNCTION public.save_skript_gast_aenderung(
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
  IF (SELECT can_gast_access_skript(p_skript_id, true)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Kein Schreibzugriff auf dieses Skript';
  END IF;

  -- Feld-Whitelist: nur die Content-Zellen des Dokuments
  IF p_feld NOT IN ('hook', 'hauptteil', 'cta', 'hook_visuell', 'hauptteil_visuell', 'cta_visuell', 'rezept', 'text_hook') THEN
    RAISE EXCEPTION 'Feld nicht editierbar: %', p_feld;
  END IF;

  SELECT * INTO v_skript FROM public.skripte WHERE id = p_skript_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Skript nicht gefunden';
  END IF;

  -- Alt-Wert VOR dem Update lesen (%I durch die Whitelist abgesichert)
  EXECUTE format('SELECT ($1).%I', p_feld) INTO v_alt USING v_skript;

  v_ist_visuell := right(p_feld, 8) = '_visuell';
  v_sektion := replace(p_feld, '_visuell', '');

  v_art := CASE
    WHEN NULLIF(btrim(COALESCE(v_alt, '')), '') IS NULL THEN 'hinzugefügt'
    WHEN NULLIF(btrim(COALESCE(p_wert, '')), '') IS NULL THEN 'entfernt'
    ELSE 'bearbeitet'
  END;

  v_label := CASE v_sektion
    WHEN 'hook' THEN 'Hook'
    WHEN 'hauptteil' THEN 'Hauptteil'
    WHEN 'cta' THEN 'CTA'
    WHEN 'rezept' THEN 'Rezept'
    WHEN 'text_hook' THEN 'Text-Hook'
  END || CASE WHEN v_ist_visuell THEN ' Visual' ELSE '' END || ' ' || v_art;

  EXECUTE format('UPDATE public.skripte SET %I = $1 WHERE id = $2', p_feld)
  USING p_wert, p_skript_id;

  -- created_by bleibt NULL: der Trigger setzt guest_participant_id und
  -- author_name aus dem Gast-JWT.
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
    NULL
  )
  RETURNING id INTO v_kommentar_id;

  RETURN v_kommentar_id;
END;
$$;
