-- DA Direkt: Marken sind keine Marken, sondern Teilbereiche -> nur noch das Unternehmen.
-- Alle Marken von DA Direkt werden entfernt, Auftraege/Kampagnen/Strategien etc. bleiben
-- am Unternehmen haengen.
--
-- Wichtig: strategie, creator_auswahl, marke_kickoff, skript_dna haben ON DELETE CASCADE auf
-- marke_id -> marke_id wird dort VOR dem Loeschen auf NULL gesetzt, sonst waeren die Zeilen weg.
-- auftrag, kampagne, skripte, campaign_briefings, einladung haben ON DELETE SET NULL.

DO $$
DECLARE
  v_da CONSTANT uuid := 'd7bf052e-8533-49ea-95a5-722152d9a0a8';
  v_marken uuid[];
  n_auftrag int; n_kampagne int; n_skripte int; n_strategie int; n_creator int; n_briefing int;
  n_persona int; n_produkt int;
  a_auftrag int; a_kampagne int; a_skripte int; a_strategie int; a_creator int; a_briefing int;
  a_persona int; a_produkt int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM unternehmen WHERE id = v_da) THEN
    RAISE NOTICE 'Unternehmen DA Direkt nicht vorhanden - Migration uebersprungen';
    RETURN;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO v_marken FROM marke WHERE unternehmen_id = v_da;
  IF cardinality(v_marken) = 0 THEN
    RAISE NOTICE 'Keine Marken bei DA Direkt - nichts zu tun';
    RETURN;
  END IF;

  -- Zaehlstaende vorher (alles ueber Unternehmen, damit der Vergleich nach dem Loeschen stimmt)
  SELECT count(*) INTO n_auftrag   FROM auftrag   WHERE unternehmen_id = v_da;
  SELECT count(*) INTO n_kampagne  FROM kampagne  WHERE unternehmen_id = v_da;
  SELECT count(*) INTO n_skripte   FROM skripte   WHERE unternehmen_id = v_da;
  SELECT count(*) INTO n_strategie FROM strategie WHERE unternehmen_id = v_da;
  SELECT count(*) INTO n_creator   FROM creator_auswahl WHERE unternehmen_id = v_da;
  SELECT count(*) INTO n_briefing  FROM campaign_briefings WHERE unternehmen_id = v_da OR marke_id = ANY (v_marken);
  SELECT count(*) INTO n_persona   FROM personas  WHERE unternehmen_id = v_da;
  SELECT count(*) INTO n_produkt   FROM produkt   WHERE unternehmen_id = v_da;

  -- 1. Mitarbeiter-Zugriff: Marken-Zuordnung auf Unternehmensebene heben
  INSERT INTO mitarbeiter_unternehmen (mitarbeiter_id, unternehmen_id, role)
  SELECT DISTINCT mm.mitarbeiter_id, v_da, mm.role
  FROM marke_mitarbeiter mm
  WHERE mm.marke_id = ANY (v_marken)
  ON CONFLICT DO NOTHING;

  -- 2. Branche auf das Unternehmen uebernehmen (falls dort leer)
  UPDATE unternehmen u
  SET branche_id = (
    SELECT mb.branche_id FROM marke_branchen mb
    WHERE mb.marke_id = ANY (v_marken)
    ORDER BY mb.branche_id LIMIT 1
  )
  WHERE u.id = v_da
    AND u.branche_id IS NULL
    AND EXISTS (SELECT 1 FROM marke_branchen mb WHERE mb.marke_id = ANY (v_marken));

  -- 3. Besitzer (unternehmen_id) sicherstellen, bevor marke_id wegfaellt
  UPDATE auftrag            SET unternehmen_id = v_da WHERE marke_id = ANY (v_marken) AND unternehmen_id IS NULL;
  UPDATE kampagne           SET unternehmen_id = v_da WHERE marke_id = ANY (v_marken) AND unternehmen_id IS NULL;
  UPDATE skripte            SET unternehmen_id = v_da WHERE marke_id = ANY (v_marken) AND unternehmen_id IS NULL;
  UPDATE strategie          SET unternehmen_id = v_da WHERE marke_id = ANY (v_marken) AND unternehmen_id IS NULL;
  UPDATE creator_auswahl    SET unternehmen_id = v_da WHERE marke_id = ANY (v_marken) AND unternehmen_id IS NULL;
  UPDATE campaign_briefings SET unternehmen_id = v_da WHERE marke_id = ANY (v_marken) AND unternehmen_id IS NULL;
  UPDATE marke_kickoff      SET unternehmen_id = v_da WHERE marke_id = ANY (v_marken) AND unternehmen_id IS NULL;
  -- 4. CASCADE-Tabellen entkoppeln (sonst werden die Zeilen mit der Marke geloescht)
  UPDATE strategie       SET marke_id = NULL WHERE marke_id = ANY (v_marken);
  UPDATE creator_auswahl SET marke_id = NULL WHERE marke_id = ANY (v_marken);
  UPDATE marke_kickoff   SET marke_id = NULL WHERE marke_id = ANY (v_marken);
  UPDATE skript_dna      SET marke_id = NULL WHERE marke_id = ANY (v_marken);

  -- 5. Polymorphe Verweise ohne FK auf das Unternehmen umhaengen
  UPDATE entity_dokumente
  SET entity_type = 'unternehmen', entity_id = v_da
  WHERE entity_type = 'marke' AND entity_id = ANY (v_marken)
    AND NOT EXISTS (
      SELECT 1 FROM entity_dokumente x WHERE x.entity_type = 'unternehmen' AND x.entity_id = v_da
    )
    AND id = (
      SELECT id FROM entity_dokumente
      WHERE entity_type = 'marke' AND entity_id = ANY (v_marken)
      ORDER BY updated_at DESC NULLS LAST LIMIT 1
    );
  -- Restliche Marken-Dokumente (bei Unique-Konflikt) wuerden verwaisen -> bewusst entfernen
  DELETE FROM entity_dokumente WHERE entity_type = 'marke' AND entity_id = ANY (v_marken);

  UPDATE kundenbriefings
  SET entity_type = 'unternehmen', entity_id = v_da
  WHERE entity_type = 'marke' AND entity_id = ANY (v_marken);

  -- Weitere polymorphe Tabellen: nur aufraeumen, was auf die Marken zeigt
  DELETE FROM user_entity_assignments WHERE entity_type = 'marke' AND entity_id = ANY (v_marken);
  DELETE FROM list_shares             WHERE entity_type = 'marke' AND entity_id = ANY (v_marken);

  -- 6. Marken loeschen (SET NULL / CASCADE raeumen den Rest auf)
  DELETE FROM marke WHERE id = ANY (v_marken);

  -- 7. Sanity-Checks: nichts darf verloren gegangen sein
  SELECT count(*) INTO a_auftrag   FROM auftrag   WHERE unternehmen_id = v_da;
  SELECT count(*) INTO a_kampagne  FROM kampagne  WHERE unternehmen_id = v_da;
  SELECT count(*) INTO a_skripte   FROM skripte   WHERE unternehmen_id = v_da;
  SELECT count(*) INTO a_strategie FROM strategie WHERE unternehmen_id = v_da;
  SELECT count(*) INTO a_creator   FROM creator_auswahl WHERE unternehmen_id = v_da;
  SELECT count(*) INTO a_briefing  FROM campaign_briefings WHERE unternehmen_id = v_da;
  SELECT count(*) INTO a_persona   FROM personas  WHERE unternehmen_id = v_da;
  SELECT count(*) INTO a_produkt   FROM produkt   WHERE unternehmen_id = v_da;

  IF (a_auftrag, a_kampagne, a_skripte, a_strategie, a_creator, a_briefing, a_persona, a_produkt)
     IS DISTINCT FROM (n_auftrag, n_kampagne, n_skripte, n_strategie, n_creator, n_briefing, n_persona, n_produkt) THEN
    RAISE EXCEPTION 'Zaehlstaende weichen ab: auftrag % -> %, kampagne % -> %, skripte % -> %, strategie % -> %, creator_auswahl % -> %, briefings % -> %, personas % -> %, produkt % -> %',
      n_auftrag, a_auftrag, n_kampagne, a_kampagne, n_skripte, a_skripte, n_strategie, a_strategie,
      n_creator, a_creator, n_briefing, a_briefing, n_persona, a_persona, n_produkt, a_produkt;
  END IF;

  IF EXISTS (SELECT 1 FROM marke WHERE unternehmen_id = v_da) THEN
    RAISE EXCEPTION 'Es existieren noch Marken bei DA Direkt';
  END IF;
END $$;
