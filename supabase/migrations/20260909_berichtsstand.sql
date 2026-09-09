-- Berichtsstände fuer die Stakeholder-Finanzuebersicht (PRD Schritt 7,
-- ADR 0006).
--
-- Die Monatsauswertung rechnet immer live; weil nachlaufende
-- Creatorrechnungen vergangene Monate rueckwirkend aendern, wird zu jedem
-- verschickten (Investoren-)Update ein Snapshot dessen gespeichert, worauf
-- das Update beruhte. Monate einzufrieren wurde verworfen, weil das
-- Nachzuegler in falsche Monate verschieben wuerde.
--
--   berichtsstand    eine Zeile pro gesichertem Stand. daten enthaelt das
--                    eingefrorene Ergebnis (Monatsauswertung beider Sichten
--                    + Zahlungsstand) als JSONB, versioniert ueber
--                    daten->>'version'.
--
-- Bewusst kein UPDATE/DELETE: ein Berichtsstand ist ein Beleg. Fehlerhafte
-- Staende werden nicht korrigiert, sondern durch einen neuen Stand ersetzt.

BEGIN;

CREATE TABLE IF NOT EXISTS berichtsstand (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- auth.users-ID (wie created_by in den uebrigen Tabellen)
  created_by uuid,
  -- Freitext, z. B. "Investorenupdate September 2026"
  label text NOT NULL,
  -- { version: 1, monatsauswertung: {...}, zahlungsstand: {...} }
  daten jsonb NOT NULL
);

-- Liste im UI: neueste zuerst
CREATE INDEX IF NOT EXISTS berichtsstand_zeit_idx
  ON berichtsstand (created_at DESC);

COMMENT ON TABLE berichtsstand IS 'Eingefrorene Finanzstaende der Stakeholder-Uebersicht (PRD Schritt 7, ADR 0006). Die Ansicht rechnet live; der Stand belegt, worauf ein verschicktes Update beruhte.';

-- ============================================================
-- RLS: nur Admins lesen und sichern (die Seite /stakeholder ist
-- admin-only). Kein UPDATE/DELETE — Belegcharakter.
-- ============================================================

ALTER TABLE berichtsstand ENABLE ROW LEVEL SECURITY;

CREATE POLICY berichtsstand_select ON berichtsstand
  FOR SELECT TO authenticated
  USING ((SELECT is_admin()));

CREATE POLICY berichtsstand_insert ON berichtsstand
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()));

COMMIT;
