-- RLS-Rekursion zwischen produkt und produkt_marke aufloesen.
--
-- 20260728_persona_produkt_unternehmen.sql hat zwei Policies gebaut, die sich
-- gegenseitig referenzieren:
--   produkt_select_policy  -> EXISTS (... FROM produkt_marke ...)
--   produkt_marke_select   -> EXISTS (... FROM produkt ...)
-- RLS gilt auch fuer Tabellen in Policy-Ausdruecken, damit ist der Zyklus
-- geschlossen. Postgres erkennt ihn beim Planen, also schlaegt JEDER Select auf
-- produkt fehl ("infinite recursion detected in policy for relation produkt") -
-- auch fuer Admins. Betroffen war damit u.a. der Skript-Detail-Select, der
-- produkt(name) embeddet.
--
-- Fix: die Junction prueft nicht mehr den Datensatz, sondern die Marke - ueber
-- einen SECURITY DEFINER Helper, in dem keine RLS mehr greift. Damit bleibt die
-- Kette auch bei kuenftigen Aenderungen an produkt_select_policy zyklenfrei.

BEGIN;

-- ============================================================
-- 1. Helper: Zugriff auf eine Marke (Stil wie can_access_kampagne)
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_access_marke(p_marke_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT is_admin_or_mitarbeiter())
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
    );
$$;

COMMENT ON FUNCTION public.can_access_marke(uuid) IS
  'Darf der aktuelle Benutzer diese Marke sehen? SECURITY DEFINER, damit die '
  'Funktion in RLS-Policies ohne Rekursionsgefahr verwendet werden kann.';

-- ============================================================
-- 2. produkt_marke: kein Rueckgriff auf produkt mehr
-- ============================================================

DROP POLICY IF EXISTS produkt_marke_select ON produkt_marke;
CREATE POLICY produkt_marke_select ON produkt_marke
  FOR SELECT TO authenticated
  USING ((SELECT can_access_marke(produkt_marke.marke_id)));

-- ============================================================
-- 3. persona_marke: gleiche Bauform, gleiche Falle
--    Bisher EXISTS auf personas - noch nicht rekursiv, aber Kunden sahen die
--    Junction dadurch gar nicht.
-- ============================================================

DROP POLICY IF EXISTS persona_marke_select ON persona_marke;
CREATE POLICY persona_marke_select ON persona_marke
  FOR SELECT TO authenticated
  USING ((SELECT can_access_marke(persona_marke.marke_id)));

COMMIT;
