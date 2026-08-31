-- Kunden-Edits am Skript-Dokument: Kunden duerfen die Content-Zellen
-- (Hook/Hauptteil/CTA + Visual-Spalte) selbst bearbeiten. Jede Speicherung
-- legt atomar eine Info-Zeile (typ='aenderung') in skript_kommentare an -
-- kein Thread, kein Erledigt, nur Autor + Sektion + Timestamp + Zitat.
--
-- Der Update laeuft bewusst ueber RPC statt offener UPDATE-Policy auf
-- skripte: RLS kann keine Spalten-Whitelist (WITH CHECK ist zeilenbasiert)
-- und Column-Grants laufen ins Leere, weil authenticated ohnehin
-- Table-Level-UPDATE hat. Gleiches Muster wie set_skript_kommentar_erledigt.

-- =====================================================================
-- Kunden-Scope als Funktion: lag bisher inline in skripte_select, wird
-- jetzt auch vom RPC gebraucht -> eine Quelle statt Kopie. SECURITY
-- DEFINER, weil der RPC-Kontext RLS auf skripte umgeht und der Scope
-- deshalb explizit geprueft werden muss (wie can_mitarbeiter_access_skript).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.can_kunde_access_skript(
  p_unternehmen_id uuid,
  p_marke_id uuid,
  p_kampagne_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT get_current_user_rolle()) = ANY (ARRAY['kunde'::text, 'kunde_editor'::text])
    AND (
      EXISTS (
        SELECT 1 FROM kunde_unternehmen ku
         WHERE ku.unternehmen_id = p_unternehmen_id
           AND ku.kunde_id = (SELECT get_current_benutzer_id())
      )
      OR EXISTS (
        SELECT 1 FROM kunde_marke km
         WHERE km.marke_id = p_marke_id
           AND km.kunde_id = (SELECT get_current_benutzer_id())
      )
      OR EXISTS (
        SELECT 1 FROM marke m
          JOIN kunde_unternehmen ku ON ku.unternehmen_id = m.unternehmen_id
         WHERE m.id = p_marke_id
           AND ku.kunde_id = (SELECT get_current_benutzer_id())
      )
      OR EXISTS (
        SELECT 1 FROM kampagne k
         WHERE k.id = p_kampagne_id
           AND (
             EXISTS (
               SELECT 1 FROM kunde_unternehmen ku
                WHERE ku.unternehmen_id = k.unternehmen_id
                  AND ku.kunde_id = (SELECT get_current_benutzer_id())
             )
             OR EXISTS (
               SELECT 1 FROM kunde_marke km
                WHERE km.marke_id = k.marke_id
                  AND km.kunde_id = (SELECT get_current_benutzer_id())
             )
             OR EXISTS (
               SELECT 1 FROM marke m
                 JOIN kunde_unternehmen ku ON ku.unternehmen_id = m.unternehmen_id
                WHERE m.id = k.marke_id
                  AND ku.kunde_id = (SELECT get_current_benutzer_id())
             )
           )
      )
    ),
    false
  )
$$;

-- skripte_select: Kunden-Teil durch die Funktion ersetzt, Semantik identisch
DROP POLICY IF EXISTS skripte_select ON skripte;
CREATE POLICY skripte_select ON skripte
  FOR SELECT
  USING (
    (SELECT can_mitarbeiter_access_skript(unternehmen_id, marke_id, kampagne_id, created_by))
    OR (SELECT can_kunde_access_skript(unternehmen_id, marke_id, kampagne_id))
  );

-- =====================================================================
-- typ-Spalte: 'kommentar' (Thread, bisheriges Verhalten) | 'aenderung'
-- (Info-Zeile aus einem Kunden-Edit)
-- =====================================================================

ALTER TABLE public.skript_kommentare
  ADD COLUMN IF NOT EXISTS typ varchar NOT NULL DEFAULT 'kommentar';

ALTER TABLE public.skript_kommentare
  DROP CONSTRAINT IF EXISTS skript_kommentare_typ_check;
ALTER TABLE public.skript_kommentare
  ADD CONSTRAINT skript_kommentare_typ_check CHECK (typ IN ('kommentar', 'aenderung'));

-- Erledigt-RPC: Info-Zeilen sind nicht abhakbar (nur Threads)
CREATE OR REPLACE FUNCTION public.set_skript_kommentar_erledigt(
  p_id uuid,
  p_erledigt boolean
) RETURNS public.skript_kommentare
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.skript_kommentare;
BEGIN
  IF NOT (SELECT is_admin_or_mitarbeiter()) THEN
    RAISE EXCEPTION 'Nur Mitarbeiter duerfen Feedback als erledigt markieren';
  END IF;

  UPDATE public.skript_kommentare
     SET erledigt_at = CASE WHEN p_erledigt THEN now() ELSE NULL END,
         erledigt_von = CASE WHEN p_erledigt THEN (SELECT get_current_benutzer_id()) ELSE NULL END
   WHERE id = p_id
     AND parent_id IS NULL
     AND typ = 'kommentar'
  RETURNING * INTO result;

  IF result.id IS NULL THEN
    RAISE EXCEPTION 'Kommentar nicht gefunden oder keine Thread-Wurzel';
  END IF;

  RETURN result;
END;
$$;

-- =====================================================================
-- Kunden-Speicherweg: Feld-Update + Info-Zeile in einer Transaktion.
-- Gibt die ID der angelegten Kommentar-Zeile zurueck (Client laedt sie
-- danach mit Autor-Join nach). Keine Version - die Versionshistorie
-- bleibt der interne Changelog, Kunden-Idle-Saves wuerden ihn zumuellen.
-- =====================================================================

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

  v_ist_visuell := right(p_feld, 8) = '_visuell';
  v_sektion := replace(p_feld, '_visuell', '');
  v_label := CASE v_sektion
    WHEN 'hook' THEN 'Hook'
    WHEN 'hauptteil' THEN 'Hauptteil'
    WHEN 'cta' THEN 'CTA'
  END || CASE WHEN v_ist_visuell THEN ' Visual' ELSE '' END || ' geändert';

  -- %I ist durch die Whitelist oben abgesichert
  EXECUTE format('UPDATE public.skripte SET %I = $1 WHERE id = $2', p_feld)
  USING p_wert, p_skript_id;

  INSERT INTO public.skript_kommentare (
    skript_id, parent_id, sektion, ist_visuell, selektion_text, inhalt, typ, created_by
  ) VALUES (
    p_skript_id,
    NULL,
    v_sektion,
    v_ist_visuell,
    NULLIF(left(COALESCE(p_wert, ''), 140), ''),
    v_label,
    'aenderung',
    (SELECT get_current_benutzer_id())
  )
  RETURNING id INTO v_kommentar_id;

  RETURN v_kommentar_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_skript_kunde_aenderung(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_skript_kunde_aenderung(uuid, text, text) TO authenticated;
