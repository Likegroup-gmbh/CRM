-- Altbestand-Linien (ADR 0058): Ausfuehrung der Migration ohne Service-Role-Key.
--
-- scripts/legacy-linien-migration.js plant offline (Snapshot) und schreibt je Kampagne einen
-- Aufruf private.legacy_linien_anwenden('<plan-json>'). Die Funktion macht dieselben Schritte
-- wie wendeKampagneAn() im Skript: Backup in legacy_linien_backup, Aenderung, Vorher/Nachher-
-- Vergleich. Weicht etwas ab, wirft sie eine Exception und Postgres rollt die Kampagne zurueck
-- (jeder Aufruf ist eine Transaktion). Rollback eines abgeschlossenen Laufs:
-- scripts/legacy-linien/rollback.sql.
--
-- Rein additiv, nur im Schema private (nicht ueber die API erreichbar), nur fuer postgres/
-- service_role. Nach dem Cutover wieder entfernen (drop function private.legacy_linien_*).

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

-- Messwerte einer Kampagne. Alles, was die Migration nicht aendern darf, steckt als Hash drin.
CREATE OR REPLACE FUNCTION private.legacy_linien_messung(
  k uuid, pk uuid[], vv uuid[], pv uuid[], prodvor uuid[]
) RETURNS jsonb
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'koops_n', (SELECT count(*) FROM kooperationen WHERE kampagne_id = k),
    'koops_hash', (SELECT md5(coalesce(string_agg(row(t.id, t.kampagne_id, t.verkaufspreis_netto, t.einkaufspreis_netto,
        t.status, t.status_id, t.vertrag_unterschrieben, t.videoanzahl)::text, ',' ORDER BY t.id), ''))
      FROM kooperationen t WHERE t.kampagne_id = k),
    'koops_aussen', (SELECT md5(coalesce(string_agg(row(t.id, t.briefing_id, t.produktion_id)::text, ',' ORDER BY t.id), ''))
      FROM kooperationen t WHERE t.kampagne_id = k AND t.id <> ALL (pk)),
    'videos_n', (SELECT count(*) FROM kooperation_videos WHERE kooperation_id IN (SELECT id FROM kooperationen WHERE kampagne_id = k)),
    'videos_hash', (SELECT md5(coalesce(string_agg(row(v.id, v.kooperation_id, v.verkaufspreis_netto, v.einkaufspreis_netto)::text, ',' ORDER BY v.id), ''))
      FROM kooperation_videos v WHERE v.kooperation_id IN (SELECT id FROM kooperationen WHERE kampagne_id = k)),
    'rechnung_hash', (SELECT md5(coalesce(string_agg(row(r.id, r.auftrag_id, r.netto, r.vertrag_id)::text, ',' ORDER BY r.id), ''))
      FROM rechnung r WHERE r.kampagne_id = k),
    'vertraege_hash', (SELECT md5(coalesce(string_agg(row(v.id, v.kampagne_id, v.kooperation_id, v.status, v.typ)::text, ',' ORDER BY v.id), ''))
      FROM vertraege v WHERE v.id = ANY (vv)),
    'vertraege_aussen', (SELECT md5(coalesce(string_agg(row(v.id, v.produktion_id)::text, ',' ORDER BY v.id), ''))
      FROM vertraege v WHERE v.id = ANY (vv) AND v.id <> ALL (pv)),
    'vertrag_koop_n', (SELECT count(*) FROM vertrag_kooperation WHERE kooperation_id IN (SELECT id FROM kooperationen WHERE kampagne_id = k)),
    'produktion_hash', (SELECT md5(coalesce(string_agg(row(p.id, p.budget)::text, ',' ORDER BY p.id), ''))
      FROM produktion p WHERE p.id = ANY (prodvor)),
    'kampagne', (SELECT row(ka.volumen, ka.creator_budget, ka.is_completed)::text FROM kampagne ka WHERE ka.id = k)
  );
$$;

-- Backup der alten Werte (Spalten aus cols) fuer die Zeilen ids in tabelle.
CREATE OR REPLACE FUNCTION private.legacy_linien_backup_alt(
  lauf uuid, k uuid, tabelle text, ids uuid[], cols text[], regel text
) RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  obj text;
BEGIN
  IF ids IS NULL OR cardinality(ids) = 0 THEN RETURN; END IF;
  SELECT string_agg(format('%L, t.%I', c, c), ', ') INTO obj FROM unnest(cols) c;
  EXECUTE format(
    'INSERT INTO legacy_linien_backup (lauf_id, kampagne_id, tabelle, zeilen_id, aktion, alt, regel)
     SELECT $1, $2, %L, t.id, ''geaendert'', jsonb_build_object(%s), $3 FROM public.%I t WHERE t.id = ANY ($4)',
    tabelle, obj, tabelle)
  USING lauf, k, regel, ids;
END;
$$;

CREATE OR REPLACE FUNCTION private.legacy_linien_backup_neu(
  lauf uuid, k uuid, tabelle text, zeile uuid, regel text
) RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $$
  INSERT INTO legacy_linien_backup (lauf_id, kampagne_id, tabelle, zeilen_id, aktion, alt, regel)
  VALUES (lauf, k, tabelle, zeile, 'angelegt', '{}'::jsonb, regel);
$$;

CREATE OR REPLACE FUNCTION private.legacy_linien_uuids(j jsonb) RETURNS uuid[]
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE WHEN j IS NULL OR jsonb_typeof(j) <> 'array' THEN NULL
              ELSE coalesce((SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(j) x), '{}') END;
$$;

-- Plan einer Kampagne anwenden (siehe scripts/legacy-linien/sql.cjs fuer das Plan-Format).
CREATE OR REPLACE FUNCTION private.legacy_linien_anwenden(p jsonb) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  k uuid := (p->>'k')::uuid;
  lauf uuid := (p->>'lauf')::uuid;
  unt uuid := nullif(p->>'unternehmen', '')::uuid;
  mar uuid := nullif(p->>'marke', '')::uuid;
  d jsonb := p->'drift';
  pk uuid[];
  vv uuid[];
  pv uuid[] := '{}';
  prodvor uuid[];
  koops_ohne uuid[] := coalesce(private.legacy_linien_uuids(p->'koopsOhne'), '{}');
  vor jsonb;
  nach jsonb;
  g jsonb;
  linie jsonb;
  ids uuid[];
  listed uuid[];
  listed_v uuid[] := '{}';
  ausser uuid[];
  n int;
  summe int;
BEGIN
  -- Drift-Schutz: Altbestand muss noch so gross sein wie im Snapshot.
  IF (SELECT count(*) FROM kooperationen WHERE kampagne_id = k AND briefing_id IS NULL) <> (d->>'koops')::int
     OR (SELECT count(*) FROM creator_auswahl WHERE kampagne_id = k AND briefing_id IS NULL) <> (d->>'castings')::int
     OR (SELECT count(*) FROM strategie WHERE kampagne_id = k AND briefing_id IS NULL) <> (d->>'konzepte')::int
     OR (SELECT count(*) FROM skripte WHERE kampagne_id = k AND briefing_id IS NULL) <> (d->>'skripte')::int
  THEN
    RAISE EXCEPTION 'Drift: Altbestand von % weicht vom Snapshot ab, neu snapshotten', k;
  END IF;

  SELECT coalesce(array_agg(id), '{}') INTO pk FROM kooperationen WHERE kampagne_id = k AND briefing_id IS NULL;
  SELECT coalesce(array_agg(id), '{}') INTO prodvor FROM produktion WHERE kampagne_id = k;
  SELECT coalesce(array_agg(DISTINCT id), '{}') INTO vv FROM (
    SELECT id FROM vertraege WHERE kooperation_id IN (SELECT id FROM kooperationen WHERE kampagne_id = k)
    UNION SELECT vertrag_id FROM vertrag_kooperation WHERE kooperation_id IN (SELECT id FROM kooperationen WHERE kampagne_id = k)
  ) x;

  -- Vertraege, die sich aendern, vorab bestimmen (fuer die Messung).
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'vertraege', '[]')) LOOP
    IF jsonb_typeof(g->'ids') = 'array' THEN
      listed_v := listed_v || private.legacy_linien_uuids(g->'ids');
    END IF;
  END LOOP;
  ausser := coalesce(private.legacy_linien_uuids(p->'vertraegeAusser'), '{}');
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'vertraege', '[]')) LOOP
    IF jsonb_typeof(g->'ids') = 'array' THEN
      pv := pv || private.legacy_linien_uuids(g->'ids');
    ELSE
      pv := pv || coalesce((SELECT array_agg(id) FROM unnest(vv) id WHERE id <> ALL (listed_v) AND id <> ALL (ausser)), '{}');
    END IF;
  END LOOP;

  vor := private.legacy_linien_messung(k, pk, vv, pv, prodvor);

  -- 1. Produktionen
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'produktionen', '[]')) LOOP
    IF (g->>'neu')::boolean THEN
      PERFORM private.legacy_linien_backup_neu(lauf, k, 'produktion', (g->>'id')::uuid, 'neue_produktion');
      INSERT INTO produktion (id, kampagne_id, name, budget) VALUES ((g->>'id')::uuid, k, g->>'name', NULL);
    ELSIF (g->>'umbenennen')::boolean THEN
      PERFORM private.legacy_linien_backup_alt(lauf, k, 'produktion', ARRAY[(g->>'id')::uuid], ARRAY['name'], 'huelle_umbenannt');
      UPDATE produktion SET name = g->>'name' WHERE id = (g->>'id')::uuid;
    END IF;
  END LOOP;

  -- 2. Linien, Castings, Konzepte
  FOR linie IN SELECT * FROM jsonb_array_elements(coalesce(p->'linien', '[]')) LOOP
    IF NOT (linie->>'bestehend')::boolean THEN
      PERFORM private.legacy_linien_backup_neu(lauf, k, 'campaign_briefings', (linie->>'id')::uuid, 'altbestand_linie');
      INSERT INTO campaign_briefings (id, unternehmen_id, marke_id, kampagne_id, produktion_id, bereich, aktivierung_name, is_draft, ist_altbestand)
      VALUES ((linie->>'id')::uuid, unt, mar, k, (linie->>'p')::uuid, linie->>'bereich', linie->>'titel', false, true);
    END IF;

    ids := coalesce(private.legacy_linien_uuids(linie->'castings'), '{}');
    IF cardinality(ids) > 0 THEN
      PERFORM private.legacy_linien_backup_alt(lauf, k, 'creator_auswahl', ids, ARRAY['briefing_id', 'produktion_id', 'strategie_id', 'name'], 'casting_zu_linie');
      UPDATE creator_auswahl SET briefing_id = (linie->>'id')::uuid, produktion_id = (linie->>'p')::uuid
        WHERE id = ANY (ids) AND briefing_id IS NULL;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> cardinality(ids) THEN RAISE EXCEPTION 'Casting-Zuordnung unvollstaendig (%): % von %', k, n, cardinality(ids); END IF;
    END IF;

    IF linie->>'konzept' IS NOT NULL THEN
      PERFORM private.legacy_linien_backup_alt(lauf, k, 'strategie', ARRAY[(linie->>'konzept')::uuid], ARRAY['briefing_id', 'produktion_id', 'creator_auswahl_id', 'name'], 'konzept_zu_linie');
      UPDATE strategie SET briefing_id = (linie->>'id')::uuid, produktion_id = (linie->>'p')::uuid
        WHERE id = (linie->>'konzept')::uuid AND briefing_id IS NULL;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> 1 THEN RAISE EXCEPTION 'Konzept-Zuordnung fehlgeschlagen (%)', k; END IF;
    END IF;

    IF linie->>'neuCasting' IS NOT NULL THEN
      PERFORM private.legacy_linien_backup_neu(lauf, k, 'creator_auswahl', (linie->>'neuCasting')::uuid, 'leeres_casting');
      INSERT INTO creator_auswahl (id, name, briefing_id, produktion_id, kampagne_id, unternehmen_id, marke_id)
      VALUES ((linie->>'neuCasting')::uuid, (linie->>'titel') || ' Casting', (linie->>'id')::uuid, (linie->>'p')::uuid, k, unt, mar);
    END IF;
    IF linie->>'neuKonzept' IS NOT NULL THEN
      PERFORM private.legacy_linien_backup_neu(lauf, k, 'strategie', (linie->>'neuKonzept')::uuid, 'leeres_konzept');
      INSERT INTO strategie (id, name, briefing_id, produktion_id, kampagne_id, unternehmen_id, marke_id)
      VALUES ((linie->>'neuKonzept')::uuid, (linie->>'titel') || ' Konzept', (linie->>'id')::uuid, (linie->>'p')::uuid, k, unt, mar);
    END IF;
  END LOOP;

  -- Casting <-> Konzept verknuepfen ([castingId, konzeptId])
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'verknuepfen', '[]')) LOOP
    UPDATE strategie SET creator_auswahl_id = (g->>0)::uuid WHERE id = (g->>1)::uuid;
    UPDATE creator_auswahl SET strategie_id = (g->>1)::uuid WHERE id = (g->>0)::uuid;
  END LOOP;

  -- Castings/Konzepte, die an bestehende Linien anschliessen
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'castingZu', '[]')) LOOP
    PERFORM private.legacy_linien_backup_alt(lauf, k, 'creator_auswahl', ARRAY[(g->>'id')::uuid], ARRAY['briefing_id', 'produktion_id', 'strategie_id', 'name'], 'casting_paar_bestehend');
    UPDATE creator_auswahl SET briefing_id = (g->>'b')::uuid, produktion_id = (g->>'p')::uuid WHERE id = (g->>'id')::uuid AND briefing_id IS NULL;
  END LOOP;
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'konzeptZu', '[]')) LOOP
    PERFORM private.legacy_linien_backup_alt(lauf, k, 'strategie', ARRAY[(g->>'id')::uuid], ARRAY['briefing_id', 'produktion_id', 'creator_auswahl_id', 'name'], 'konzept_paar_bestehend');
    UPDATE strategie SET briefing_id = (g->>'b')::uuid, produktion_id = (g->>'p')::uuid WHERE id = (g->>'id')::uuid AND briefing_id IS NULL;
  END LOOP;

  -- 3. Kooperationen (briefing_id und produktion_id zusammen). Eine Gruppe ohne ids = alle uebrigen.
  listed := koops_ohne;
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'koops', '[]')) LOOP
    IF jsonb_typeof(g->'ids') = 'array' THEN listed := listed || private.legacy_linien_uuids(g->'ids'); END IF;
  END LOOP;
  summe := 0;
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'koops', '[]')) LOOP
    IF jsonb_typeof(g->'ids') = 'array' THEN
      ids := private.legacy_linien_uuids(g->'ids');
    ELSE
      SELECT coalesce(array_agg(id), '{}') INTO ids FROM kooperationen
        WHERE kampagne_id = k AND briefing_id IS NULL AND id <> ALL (listed);
    END IF;
    IF cardinality(ids) = 0 THEN CONTINUE; END IF;
    PERFORM private.legacy_linien_backup_alt(lauf, k, 'kooperationen', ids, ARRAY['briefing_id', 'produktion_id'], g->>'regel');
    UPDATE kooperationen SET briefing_id = (g->>'b')::uuid, produktion_id = (g->>'p')::uuid
      WHERE id = ANY (ids) AND briefing_id IS NULL;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> cardinality(ids) THEN RAISE EXCEPTION 'Kooperations-Zuordnung unvollstaendig (%): % von %', k, n, cardinality(ids); END IF;
    summe := summe + n;
  END LOOP;
  IF summe <> (p->>'koopsAnzahl')::int THEN
    RAISE EXCEPTION 'Kooperationen: % zugeordnet, % geplant (%)', summe, (p->>'koopsAnzahl')::int, k;
  END IF;

  -- 4. Skripte
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'skripte', '[]')) LOOP
    PERFORM private.legacy_linien_backup_alt(lauf, k, 'skripte', ARRAY[(g->>'id')::uuid], ARRAY['briefing_id', 'produktion_id'], g->>'regel');
    UPDATE skripte SET briefing_id = (g->>'b')::uuid, produktion_id = (g->>'p')::uuid WHERE id = (g->>'id')::uuid AND briefing_id IS NULL;
  END LOOP;

  -- 5. Vertraege folgen der Erzeuger-Kooperation (nur produktion_id)
  summe := 0;
  FOR g IN SELECT * FROM jsonb_array_elements(coalesce(p->'vertraege', '[]')) LOOP
    IF jsonb_typeof(g->'ids') = 'array' THEN
      ids := private.legacy_linien_uuids(g->'ids');
    ELSE
      SELECT coalesce(array_agg(id), '{}') INTO ids FROM unnest(vv) id WHERE id <> ALL (listed_v) AND id <> ALL (ausser);
    END IF;
    IF cardinality(ids) = 0 THEN CONTINUE; END IF;
    PERFORM private.legacy_linien_backup_alt(lauf, k, 'vertraege', ids, ARRAY['produktion_id', 'kampagne_id'], 'vertrag_folgt_koop');
    UPDATE vertraege SET produktion_id = (g->>'p')::uuid WHERE id = ANY (ids);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> cardinality(ids) THEN RAISE EXCEPTION 'Vertrags-Zuordnung unvollstaendig (%): % von %', k, n, cardinality(ids); END IF;
    summe := summe + n;
  END LOOP;
  IF summe <> coalesce((p->>'vertraegeAnzahl')::int, 0) THEN
    RAISE EXCEPTION 'Vertraege: % zugeordnet, % geplant (%)', summe, coalesce((p->>'vertraegeAnzahl')::int, 0), k;
  END IF;

  -- 6. Vorher/Nachher
  nach := private.legacy_linien_messung(k, pk, vv, pv, prodvor);
  IF vor IS DISTINCT FROM nach THEN
    RAISE EXCEPTION 'Validierung fehlgeschlagen fuer %: vorher % nachher %', k, vor, nach;
  END IF;
  IF (SELECT count(*) FROM kooperationen WHERE kampagne_id = k AND briefing_id IS NULL) <> cardinality(koops_ohne) THEN
    RAISE EXCEPTION 'Kooperationen ohne Linie uebrig (%)', k;
  END IF;
  IF EXISTS (SELECT 1 FROM kooperationen WHERE id = ANY (pk) AND id <> ALL (koops_ohne) AND (briefing_id IS NULL OR produktion_id IS NULL)) THEN
    RAISE EXCEPTION 'Kooperation ohne Linie oder Produktion (%)', k;
  END IF;
  FOR linie IN SELECT * FROM jsonb_array_elements(coalesce(p->'linien', '[]')) LOOP
    IF NOT (linie->>'bestehend')::boolean
       AND (SELECT count(*) FROM kooperationen WHERE briefing_id = (linie->>'id')::uuid) <> (linie->>'koopsN')::int THEN
      RAISE EXCEPTION 'Linie % hat nicht die geplanten Kooperationen (%)', linie->>'id', k;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM produktion WHERE kampagne_id = k) <> cardinality(prodvor) + (p->>'produktionenNeu')::int
     OR EXISTS (SELECT 1 FROM produktion WHERE kampagne_id = k AND id <> ALL (prodvor) AND budget IS NOT NULL) THEN
    RAISE EXCEPTION 'Produktionen nicht wie geplant (%)', k;
  END IF;

  RETURN jsonb_build_object('k', k, 'koops', (p->>'koopsAnzahl')::int, 'vertraege', coalesce((p->>'vertraegeAnzahl')::int, 0),
                            'linienNeu', (SELECT count(*) FROM jsonb_array_elements(coalesce(p->'linien', '[]')) l WHERE NOT (l->>'bestehend')::boolean));
END;
$$;

-- Mehrere Kampagnen in einem Aufruf. Jede laeuft in einer eigenen Subtransaktion: scheitert eine,
-- wird nur sie zurueckgerollt, die Fehlermeldung steht im Ergebnis.
CREATE OR REPLACE FUNCTION private.legacy_linien_batch(plaene jsonb) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  pl jsonb;
  res jsonb := '[]'::jsonb;
BEGIN
  FOR pl IN SELECT * FROM jsonb_array_elements(plaene) LOOP
    BEGIN
      res := res || jsonb_build_array(jsonb_build_object('k', pl->>'k', 'ok', true, 'info', private.legacy_linien_anwenden(pl)));
    EXCEPTION WHEN OTHERS THEN
      res := res || jsonb_build_array(jsonb_build_object('k', pl->>'k', 'ok', false, 'fehler', left(SQLERRM, 600)));
    END;
  END LOOP;
  RETURN res;
END;
$$;

REVOKE ALL ON FUNCTION private.legacy_linien_batch(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.legacy_linien_messung(uuid, uuid[], uuid[], uuid[], uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.legacy_linien_backup_alt(uuid, uuid, text, uuid[], text[], text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.legacy_linien_backup_neu(uuid, uuid, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.legacy_linien_uuids(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.legacy_linien_anwenden(jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
