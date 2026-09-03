-- Briefing <-> Produkt (M:N). Ein Briefing kann ein oder mehrere Produkte
-- haben. Anker bleibt unternehmen/marke; die Junction haengt am Briefing.

CREATE TABLE IF NOT EXISTS campaign_briefing_produkt (
  briefing_id uuid NOT NULL REFERENCES campaign_briefings(id) ON DELETE CASCADE,
  produkt_id uuid NOT NULL REFERENCES produkt(id) ON DELETE CASCADE,
  PRIMARY KEY (briefing_id, produkt_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_briefing_produkt_produkt
  ON campaign_briefing_produkt(produkt_id);

COMMENT ON TABLE campaign_briefing_produkt IS
  'Produkte, die einem Campaign-Briefing zugeordnet sind.';

ALTER TABLE campaign_briefing_produkt ENABLE ROW LEVEL SECURITY;

-- Staff: voller Zugriff. Kunden: lesen, wenn sie das Briefing sehen duerfen.
CREATE POLICY campaign_briefing_produkt_select ON campaign_briefing_produkt
  FOR SELECT TO authenticated
  USING (
    (SELECT is_admin_or_mitarbeiter())
    OR EXISTS (
      SELECT 1 FROM campaign_briefings cb
      WHERE cb.id = campaign_briefing_produkt.briefing_id
    )
  );

CREATE POLICY campaign_briefing_produkt_insert ON campaign_briefing_produkt
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY campaign_briefing_produkt_update ON campaign_briefing_produkt
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY campaign_briefing_produkt_delete ON campaign_briefing_produkt
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));
