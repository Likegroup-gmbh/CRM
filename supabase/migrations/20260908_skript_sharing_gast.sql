-- Skript-Sharing für Gäste: Skripte werden als entity_type 'skript' über
-- list_shares teilbar. Gäste (Gast-JWT, Rolle anon, kein benutzer-Eintrag)
-- lesen das Skript; mit rechte='feedback' duerfen sie kommentieren und die
-- Content-Zellen direkt aendern (Vorher/Nachher-Info-Zeile wie beim Kunden).
-- Muster wie 20260713_listen_sharing_gast.sql: additive *_gast_* Policies,
-- kein Umbau der bestehenden Staff/Kunden-Policies.

-- =====================================================================
-- 1) entity_type 'skript' in list_shares
-- =====================================================================

ALTER TABLE public.list_shares
  DROP CONSTRAINT IF EXISTS list_shares_entity_type_check;
ALTER TABLE public.list_shares
  ADD CONSTRAINT list_shares_entity_type_check
  CHECK (entity_type IN ('kampagne', 'sourcing', 'strategie', 'skript'));

-- ends_with_kampagne braucht die Kampagne-Aufloesung auch fuer Skripte
CREATE OR REPLACE FUNCTION public.share_resolved_kampagne_id(p_entity_type text, p_entity_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE p_entity_type
    WHEN 'kampagne' THEN p_entity_id
    WHEN 'sourcing' THEN (SELECT kampagne_id FROM creator_auswahl WHERE id = p_entity_id)
    WHEN 'strategie' THEN (SELECT kampagne_id FROM strategie WHERE id = p_entity_id)
    WHEN 'skript' THEN (SELECT kampagne_id FROM skripte WHERE id = p_entity_id)
    ELSE NULL
  END;
$$;

-- =====================================================================
-- 2) Zugriffs-Helper
-- =====================================================================

CREATE OR REPLACE FUNCTION public.can_gast_access_skript(
  p_skript_id uuid,
  p_write boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT share_claim_has_access('skript', p_skript_id, p_write);
$$;

GRANT EXECUTE ON FUNCTION public.can_gast_access_skript(uuid, boolean) TO anon, authenticated, service_role;

-- Unternehmen/Marke im Editor-Kopf (Logo, Name) auch bei reinem
-- Skript-Share: die bestehenden Sichtbarkeits-Helper bekommen den
-- Skript-Fall als weitere additive Bedingung.
CREATE OR REPLACE FUNCTION public.gast_can_see_unternehmen(p_unternehmen_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM kampagne k
      WHERE k.unternehmen_id = p_unternehmen_id
        AND gast_has_share('kampagne', k.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM creator_auswahl ca
      WHERE ca.unternehmen_id = p_unternehmen_id
        AND gast_has_share('sourcing', ca.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM strategie s
      WHERE s.unternehmen_id = p_unternehmen_id
        AND gast_has_share('strategie', s.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM skripte sk
      WHERE sk.unternehmen_id = p_unternehmen_id
        AND gast_has_share('skript', sk.id, false)
    );
$$;

CREATE OR REPLACE FUNCTION public.gast_can_see_marke(p_marke_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM kampagne k
      WHERE k.marke_id = p_marke_id
        AND gast_has_share('kampagne', k.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM creator_auswahl ca
      WHERE ca.marke_id = p_marke_id
        AND gast_has_share('sourcing', ca.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM strategie s
      WHERE s.marke_id = p_marke_id
        AND gast_has_share('strategie', s.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM skripte sk
      WHERE sk.marke_id = p_marke_id
        AND gast_has_share('skript', sk.id, false)
    );
$$;

-- =====================================================================
-- 3) skripte: Gast-SELECT (additiv; skripte_select bleibt unangetastet)
-- =====================================================================

DROP POLICY IF EXISTS skripte_gast_select ON public.skripte;
CREATE POLICY skripte_gast_select ON public.skripte
  FOR SELECT TO anon
  USING ((SELECT can_gast_access_skript(id, false)));

-- =====================================================================
-- 4) skript_kommentare: Gast-Autor + Policies
-- =====================================================================

ALTER TABLE public.skript_kommentare
  ADD COLUMN IF NOT EXISTS guest_participant_id uuid
    REFERENCES public.share_participants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_skript_kommentare_guest
  ON public.skript_kommentare (guest_participant_id)
  WHERE guest_participant_id IS NOT NULL;

-- author_name-Trigger: bei Gaesten (created_by IS NULL) kommen
-- guest_participant_id und Anzeigename aus dem JWT-Claim bzw.
-- share_participants - ein vom Client gesetzter Wert wird verworfen.
CREATE OR REPLACE FUNCTION public.set_skript_kommentar_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    NEW.guest_participant_id := NULL;
    SELECT COALESCE(
      NULLIF(b.name, ''),
      NULLIF(trim(concat_ws(' ', b.vorname, b.nachname)), '')
    ) INTO NEW.author_name
    FROM public.benutzer b
    WHERE b.id = NEW.created_by;
  ELSE
    NEW.guest_participant_id := NULLIF(auth.jwt() ->> 'participant_id', '')::uuid;
    SELECT NULLIF(sp.name, '') INTO NEW.author_name
    FROM public.share_participants sp
    WHERE sp.id = NEW.guest_participant_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Lesen: jeder Gast mit Zugriff aufs Skript (auch 'ansehen' sieht Feedback)
DROP POLICY IF EXISTS skript_kommentare_gast_select ON public.skript_kommentare;
CREATE POLICY skript_kommentare_gast_select ON public.skript_kommentare
  FOR SELECT TO anon
  USING ((SELECT can_gast_access_skript(skript_id, false)));

-- Schreiben: nur mit Feedback-Recht. guest_participant_id wird per Trigger
-- aus dem JWT gesetzt, der WITH CHECK laeuft danach und verifiziert sie.
DROP POLICY IF EXISTS skript_kommentare_gast_insert ON public.skript_kommentare;
CREATE POLICY skript_kommentare_gast_insert ON public.skript_kommentare
  FOR INSERT TO anon
  WITH CHECK (
    (SELECT can_gast_access_skript(skript_id, true))
    AND created_by IS NULL
    AND guest_participant_id = NULLIF(auth.jwt() ->> 'participant_id', '')::uuid
  );

-- Eigene Kommentare bearbeiten/loeschen (Erledigt bleibt intern ueber RPC)
DROP POLICY IF EXISTS skript_kommentare_gast_update ON public.skript_kommentare;
CREATE POLICY skript_kommentare_gast_update ON public.skript_kommentare
  FOR UPDATE TO anon
  USING (
    guest_participant_id = NULLIF(auth.jwt() ->> 'participant_id', '')::uuid
    AND (SELECT can_gast_access_skript(skript_id, true))
  )
  WITH CHECK (
    guest_participant_id = NULLIF(auth.jwt() ->> 'participant_id', '')::uuid
    AND (SELECT can_gast_access_skript(skript_id, true))
  );

DROP POLICY IF EXISTS skript_kommentare_gast_delete ON public.skript_kommentare;
CREATE POLICY skript_kommentare_gast_delete ON public.skript_kommentare
  FOR DELETE TO anon
  USING (
    guest_participant_id = NULLIF(auth.jwt() ->> 'participant_id', '')::uuid
    AND (SELECT can_gast_access_skript(skript_id, true))
  );

-- =====================================================================
-- 5) Gast-Speicherweg fuer Textaenderungen (Spiegel von
--    save_skript_kunde_aenderung inkl. Vorher/Nachher). SECURITY DEFINER,
--    weil Gaeste kein UPDATE auf skripte bekommen (Spalten-Whitelist).
-- =====================================================================

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
  IF p_feld NOT IN ('hook', 'hauptteil', 'cta', 'hook_visuell', 'hauptteil_visuell', 'cta_visuell') THEN
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

REVOKE ALL ON FUNCTION public.save_skript_gast_aenderung(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_skript_gast_aenderung(uuid, text, text) TO anon;
