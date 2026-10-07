-- Creator-Tausch mit gedeckten Kooperationen (ADR 0047).
-- Ersetzt creator_tausch aus 20261009.
--
-- Ein Vertrag kann mehrere Kooperationen decken (vertrag_kooperation). Daraus folgt:
--   * Ein unterschriebener Vertrag sperrt den Tausch auf jeder Kooperation, die er deckt.
--   * Ein nicht unterschriebener Vertrag wird nur Abgelehnt, wenn er nach dem Tausch keine
--     Kooperation mehr deckt. Deckt er noch eine andere, bleibt er und verliert nur die
--     getauschte Kooperation.
--   * Rechnungen anderer gedeckter Kooperationen sperren den Tausch nicht.
--
-- Sperrgruende (Exception 'tausch_gesperrt:<grund>') bleiben wie in 20261009.

CREATE OR REPLACE FUNCTION creator_tausch(
  p_alter_item uuid,
  p_ersatz_item uuid,
  p_grund text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_alt creator_auswahl_items%ROWTYPE;
  v_neu creator_auswahl_items%ROWTYPE;
  v_produktion uuid;
  v_briefing uuid;
  v_kampagne uuid;
  v_koops uuid[] := '{}';
  v_vertraege uuid[] := '{}';
  v_ganz uuid[] := '{}';
  v_teil uuid[] := '{}';
  v_teil_n integer := 0;
  v_rest uuid;
  v_vid uuid;
  v_ideen uuid[] := '{}';
  v_skripte uuid[] := '{}';
  v_ersatz_koop uuid;
  v_koop uuid;
  v_offset integer;
  v_alt_name text;
  v_neu_name text;
  v_ideen_n integer := 0;
  v_vertraege_n integer := 0;
  v_koops_n integer := 0;
BEGIN
  IF NOT is_admin_or_mitarbeiter() THEN
    RAISE EXCEPTION 'Keine Berechtigung fuer den Creator-Tausch' USING ERRCODE = '42501';
  END IF;

  IF p_alter_item = p_ersatz_item THEN
    RAISE EXCEPTION 'tausch_gesperrt:gleicher_eintrag';
  END IF;

  SELECT * INTO v_alt FROM creator_auswahl_items WHERE id = p_alter_item FOR UPDATE;
  SELECT * INTO v_neu FROM creator_auswahl_items WHERE id = p_ersatz_item FOR UPDATE;
  IF v_alt.id IS NULL OR v_neu.id IS NULL THEN
    RAISE EXCEPTION 'Casting-Eintrag nicht gefunden';
  END IF;

  IF v_alt.creator_auswahl_id IS DISTINCT FROM v_neu.creator_auswahl_id THEN
    RAISE EXCEPTION 'tausch_gesperrt:andere_liste';
  END IF;
  IF v_alt.creator_id IS NULL THEN
    RAISE EXCEPTION 'tausch_gesperrt:alter_ohne_creator';
  END IF;
  IF v_neu.creator_id IS NULL THEN
    RAISE EXCEPTION 'tausch_gesperrt:ersatz_ohne_creator';
  END IF;
  IF v_neu.creator_id = v_alt.creator_id THEN
    RAISE EXCEPTION 'tausch_gesperrt:gleicher_creator';
  END IF;
  IF COALESCE(v_neu.absage, false) THEN
    RAISE EXCEPTION 'tausch_gesperrt:ersatz_abgesagt';
  END IF;
  IF NOT ((COALESCE(v_neu.prio_1, false) OR COALESCE(v_neu.prio_2, false))
      AND (COALESCE(v_neu.zusage, false) OR COALESCE(v_neu.gebucht, false))) THEN
    RAISE EXCEPTION 'tausch_gesperrt:ersatz_gate';
  END IF;

  SELECT produktion_id, kampagne_id, briefing_id INTO v_produktion, v_kampagne, v_briefing
    FROM creator_auswahl WHERE id = v_alt.creator_auswahl_id;

  IF v_produktion IS NOT NULL THEN
    SELECT COALESCE(array_agg(id), '{}') INTO v_koops
      FROM kooperationen
      WHERE creator_id = v_alt.creator_id AND produktion_id = v_produktion
        AND (v_briefing IS NULL OR briefing_id IS NULL OR briefing_id = v_briefing);
  END IF;

  SELECT COALESCE(array_agg(DISTINCT id), '{}') INTO v_vertraege
    FROM vertraege
    WHERE kooperation_id = ANY (v_koops)
       OR id IN (SELECT vertrag_id FROM vertrag_kooperation WHERE kooperation_id = ANY (v_koops))
       -- Vertraege ohne Kooperation kennen keine Linie: nur bei einer einzigen Linie eindeutig
       OR (v_produktion IS NOT NULL AND kooperation_id IS NULL
           AND creator_id = v_alt.creator_id AND produktion_id = v_produktion
           AND (SELECT count(*) FROM campaign_briefings WHERE produktion_id = v_produktion) <= 1);

  -- Sperrgruende: unterschrieben, Rechnung, Upload
  IF EXISTS (
    SELECT 1 FROM vertraege
    WHERE id = ANY (v_vertraege)
      AND (status = 'unterschrieben'
           OR COALESCE(dropbox_file_url, '') <> ''
           OR COALESCE(unterschriebener_vertrag_url, '') <> '')
  ) THEN
    RAISE EXCEPTION 'tausch_gesperrt:vertrag_unterschrieben';
  END IF;

  -- Ganz abgelehnt wird nur, was nach dem Tausch keine andere Kooperation mehr deckt
  SELECT COALESCE(array_agg(v.id), '{}') INTO v_teil
    FROM unnest(v_vertraege) AS v(id)
    WHERE EXISTS (
      SELECT 1 FROM vertrag_kooperation vk
      WHERE vk.vertrag_id = v.id AND NOT (vk.kooperation_id = ANY (v_koops))
    );
  SELECT COALESCE(array_agg(v.id), '{}') INTO v_ganz
    FROM unnest(v_vertraege) AS v(id)
    WHERE NOT (v.id = ANY (v_teil));

  IF EXISTS (
    SELECT 1 FROM rechnung
    WHERE kooperation_id = ANY (v_koops) OR vertrag_id = ANY (v_ganz)
  ) THEN
    RAISE EXCEPTION 'tausch_gesperrt:rechnung';
  END IF;

  IF EXISTS (
    SELECT 1 FROM kooperation_videos
    WHERE kooperation_id = ANY (v_koops) AND COALESCE(asset_url, '') <> ''
  ) THEN
    RAISE EXCEPTION 'tausch_gesperrt:upload';
  END IF;

  SELECT COALESCE(NULLIF(trim(COALESCE(vorname, '') || ' ' || COALESCE(nachname, '')), ''), 'Creator')
    INTO v_alt_name FROM creator WHERE id = v_alt.creator_id;
  SELECT COALESCE(NULLIF(trim(COALESCE(vorname, '') || ' ' || COALESCE(nachname, '')), ''), 'Creator')
    INTO v_neu_name FROM creator WHERE id = v_neu.creator_id;

  -- Betroffene Skripte vor dem Umhaengen einsammeln (Idee und Kooperationsvideo)
  SELECT COALESCE(array_agg(id), '{}') INTO v_ideen
    FROM strategie_items WHERE creator_auswahl_item_id = v_alt.id;

  SELECT COALESCE(array_agg(DISTINCT sid), '{}') INTO v_skripte FROM (
    SELECT id AS sid FROM skripte WHERE strategie_item_id = ANY (v_ideen)
    UNION
    SELECT skript_id FROM kooperation_videos
      WHERE kooperation_id = ANY (v_koops) AND skript_id IS NOT NULL
  ) s;

  -- 1) Videoideen umhaengen (Umsetzen und Skript-Freigabe bleiben)
  UPDATE strategie_items SET creator_auswahl_item_id = v_neu.id
    WHERE creator_auswahl_item_id = v_alt.id;
  GET DIAGNOSTICS v_ideen_n = ROW_COUNT;

  -- 2) Nicht unterschriebene Vertraege des Abspringers: Historie, von der Kooperation geloest
  UPDATE vertraege SET status = 'abgelehnt', kooperation_id = NULL
    WHERE id = ANY (v_ganz);
  GET DIAGNOSTICS v_vertraege_n = ROW_COUNT;

  -- 2b) Vertraege, die noch andere Kooperationen decken, bleiben: nur die getauschte Kooperation geht
  IF array_length(v_teil, 1) IS NOT NULL THEN
    DELETE FROM vertrag_kooperation
      WHERE vertrag_id = ANY (v_teil) AND kooperation_id = ANY (v_koops);
    GET DIAGNOSTICS v_teil_n = ROW_COUNT;

    -- Erzeuger-Kooperation nachziehen, falls sie gerade geloest wurde
    FOREACH v_vid IN ARRAY v_teil LOOP
      IF EXISTS (SELECT 1 FROM vertraege WHERE id = v_vid AND kooperation_id = ANY (v_koops)) THEN
        SELECT kooperation_id INTO v_rest FROM vertrag_kooperation
          WHERE vertrag_id = v_vid ORDER BY created_at LIMIT 1;
        UPDATE vertraege SET kooperation_id = v_rest WHERE id = v_vid;
      END IF;
    END LOOP;
  END IF;

  -- 3) Kooperation: creator_id wechselt, oder Videos in die bestehende des Ersatzes
  IF v_produktion IS NOT NULL THEN
    SELECT id INTO v_ersatz_koop FROM kooperationen
      WHERE creator_id = v_neu.creator_id AND produktion_id = v_produktion
        AND (v_briefing IS NULL OR briefing_id IS NULL OR briefing_id = v_briefing)
      ORDER BY created_at LIMIT 1;
  END IF;

  FOREACH v_koop IN ARRAY v_koops LOOP
    v_koops_n := v_koops_n + 1;
    IF v_ersatz_koop IS NULL THEN
      UPDATE kooperationen SET creator_id = v_neu.creator_id WHERE id = v_koop;
      v_ersatz_koop := v_koop;
    ELSE
      SELECT COALESCE(max(position), 0) INTO v_offset
        FROM kooperation_videos WHERE kooperation_id = v_ersatz_koop;
      UPDATE kooperation_videos
        SET kooperation_id = v_ersatz_koop, position = COALESCE(position, 0) + v_offset
        WHERE kooperation_id = v_koop;
      DELETE FROM kooperationen WHERE id = v_koop;
    END IF;
  END LOOP;

  -- 4) Upload-Link des Abspringers entwerten, wenn er in der Kampagne nichts mehr hat
  IF v_kampagne IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM kooperationen
    WHERE creator_id = v_alt.creator_id AND kampagne_id = v_kampagne
  ) THEN
    UPDATE creator_upload_token SET revoked_at = now()
      WHERE creator_id = v_alt.creator_id AND kampagne_id = v_kampagne AND revoked_at IS NULL;
  END IF;

  -- 5) Skripte: Banner-Vermerk plus Festlegung zur Besetzung
  UPDATE skripte SET
    creator_tausch = jsonb_build_object(
      'vorher_creator_id', v_alt.creator_id, 'vorher_name', v_alt_name,
      'jetzt_creator_id', v_neu.creator_id, 'jetzt_name', v_neu_name,
      'am', now(), 'quittiert', false),
    festlegungen = COALESCE(festlegungen, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'text', 'Besetzung: ' || v_neu_name || ' (vorher ' || v_alt_name || ')',
      'quelle', 'creator_tausch', 'am', now()))
    WHERE id = ANY (v_skripte);

  -- 6) Alter Eintrag: Abgesagt (wie buildSourcingStatusUpdates), erst nach dem Umhaengen
  UPDATE creator_auswahl_items SET
    angefragt = false, in_verhandlung = false, preis_zugesagt = false, zusage = false,
    on_hold = false, on_hold_am = NULL, gebucht = false,
    absage = true, absage_am = now(),
    absage_grund = NULLIF(trim(COALESCE(p_grund, '')), '')
    WHERE id = v_alt.id;

  RETURN jsonb_build_object(
    'videoideen', v_ideen_n,
    'kooperationen', v_koops_n,
    'vertraege', v_vertraege_n,
    'vertraege_geloest', v_teil_n,
    'skripte', COALESCE(array_length(v_skripte, 1), 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION creator_tausch(uuid, uuid, text) TO authenticated;
