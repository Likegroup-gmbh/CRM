-- =====================================================================
-- Campaign Briefing Generator: neue Tabelle campaign_briefings
-- Ersetzt das alte Briefing-Modul (briefings / briefing_documents).
--
-- Datenanker: unternehmen_id (Pflicht) + marke_id (optional).
-- Bewusst KEINE FKs auf auftrag/kampagne/produkt/persona (v1):
-- das Briefing ist ein eigenstaendiges Dokument, Content beginnt ab
-- "0. Campaign Master".
--
-- Spalten-Layout im Vertragsgenerator-Stil (flach):
--   - Master-Felder ohne Prefix
--   - Modul-Felder mit Prefix im_* (Influencer Marketing),
--     pa_* (Paid Creator Ads), os_* (Owned Social)
--   - Multi-Selects als text[], Repeatables/Gruppen als jsonb
-- =====================================================================

CREATE TABLE IF NOT EXISTS campaign_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Anker
  unternehmen_id uuid REFERENCES unternehmen(id) ON DELETE CASCADE,
  marke_id uuid REFERENCES marke(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES benutzer(id) ON DELETE SET NULL,

  -- Meta
  bereich text NOT NULL CHECK (bereich IN ('influencer_marketing', 'paid_creator_ads', 'owned_social')),
  is_draft boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- ---------------------------------------------------------
  -- 0. CAMPAIGN MASTER
  -- ---------------------------------------------------------
  -- 0.1 Wie heisst die Aktivierung?
  aktivierung_name text,

  -- 0.3 Kampagne oder Always-on
  ansatz text CHECK (ansatz IN ('kampagne', 'always_on')),
  kampagne_thema text,                -- Worum geht es in der Kampagne?
  kampagnentypen text[],              -- Produktlaunch, Saisonaler Anlass, ...
  always_on_thema text,               -- Worum geht es im Always-on-Ansatz?
  always_on_bestehend text CHECK (always_on_bestehend IN ('fortfuehren', 'weiterentwickeln', 'neu')),

  -- 0.4 Rolle der Creator
  creator_rolle text,
  creator_rolle_offen boolean NOT NULL DEFAULT false, -- "Noch offen / Agenturempfehlung"

  -- 0.5 Markt & Sprache
  maerkte text[],
  sprachen text[],
  zusaetzliche_sprachen boolean NOT NULL DEFAULT false,
  weitere_sprachen text[],
  sprachadaption text[],              -- Untertitel, On-Screen-Text, Voice-over, ...

  -- 0.6 Zentrale Termine
  content_deadline date,
  go_live date,
  embargo date,
  weitere_deadline date,
  weitere_deadline_bezeichnung text,

  -- ---------------------------------------------------------
  -- 1. INFLUENCER MARKETING (im_*)
  -- ---------------------------------------------------------
  -- 1.1 Ziele
  im_funnel_stufen text[],            -- upper, mid, lower
  im_kpis jsonb,                      -- [{ kpi, zielwert }]
  im_keine_benchmarks boolean NOT NULL DEFAULT false,

  -- 1.2 Creator-Anforderungen
  im_creator_groessen text[],         -- nano, micro, mid_tier, macro, hero, keine_vorgabe
  im_nischen text[],
  im_creator_merkmale jsonb,          -- { alter, geschlecht, standort, expertise, sonstiges }
  im_voraussetzungen text[],
  im_voraussetzungen_custom text,

  -- 1.3 Channels & Formate
  im_channels jsonb,                  -- { instagram: [], tiktok: [], youtube: [], weitere: '' }
  im_formatvorgaben jsonb,            -- { videolaenge, ratios, technische_anforderungen }

  -- 1.4 Learnings
  im_learnings_vorhanden boolean NOT NULL DEFAULT false,
  im_learnings_text text,
  im_beispiele jsonb,                 -- [{ typ: 'url'|'upload', value, label? }]

  -- 1.5 Ideen
  im_ideen_status text CHECK (im_ideen_status IN ('ja', 'teilweise', 'nein')),
  im_ideen_text text,
  im_referenzen jsonb,
  im_ideen_verantwortlich text[],     -- kunde, agentur, creator, gemeinsam

  -- 1.6 Konkrete Umsetzung
  im_umsetzung text,
  im_umsetzung_offen boolean NOT NULL DEFAULT false,
  im_situationen text,

  -- 1.7 Produktion
  im_production_setup text[],
  im_vorort jsonb,                    -- { ort, zeitraum, infos }
  im_versand_anforderungen text,

  -- 1.8 Veroeffentlichung & Nutzung
  im_veroeffentlichung text[],        -- creator_channel, co_author, keine
  im_zusaetzliche_nutzung text[],     -- paid_amplification, whitelisting, brand_nutzung, ...
  im_nutzungslogik text,

  -- 1.9 Traffic & Conversion
  im_tracking text[],                 -- landingpage, pdp, shop, app, tracking_link, ...
  im_ziel_url text,
  im_code text,
  im_code_spaeter boolean NOT NULL DEFAULT false,

  -- ---------------------------------------------------------
  -- 2. PAID CREATOR ADS (pa_*)
  -- ---------------------------------------------------------
  -- 2.1 Ziele
  pa_funnel_stufen text[],
  pa_objectives text[],               -- awareness, traffic, video_views, ...
  pa_kpis jsonb,
  pa_keine_benchmarks boolean NOT NULL DEFAULT false,

  -- 2.2 Creator-Anforderungen
  pa_creator_groessen text[],         -- ugc_creator, nano, micro, ...
  pa_nischen text[],
  pa_creator_merkmale jsonb,
  pa_voraussetzungen text[],
  pa_voraussetzungen_custom text,

  -- 2.3 Paid Channels
  pa_channels jsonb,                  -- { meta: [], tiktok: bool, youtube: [], google: [], pinterest: bool, linkedin: bool, sonstiges: '' }

  -- 2.4 Learnings
  pa_learnings_vorhanden boolean NOT NULL DEFAULT false,
  pa_learnings_text text,
  pa_beispiele jsonb,
  pa_reporting jsonb,                 -- Performance-Daten / bestehendes Reporting

  -- 2.5 Ideen
  pa_ideen_status text CHECK (pa_ideen_status IN ('ja', 'teilweise', 'nein')),
  pa_ideen_text text,
  pa_referenzen jsonb,
  pa_ideen_verantwortlich text[],

  -- 2.6 Konkrete Umsetzung
  pa_umsetzung text,
  pa_umsetzung_offen boolean NOT NULL DEFAULT false,
  pa_situationen text,

  -- 2.7 Produktion
  pa_production_setup text[],
  pa_vorort jsonb,
  pa_versand_anforderungen text,

  -- 2.8 Deliverables
  pa_videolaengen text[],             -- 6s, 10s, 15s, 20s, 30s, 60s, individuell, agenturempfehlung
  pa_ratios text[],                   -- 9:16, 4:5, 1:1, 16:9, sonstiges
  pa_zusaetzliche_versionen text,

  -- 2.9 Destination
  pa_destination text[],              -- website, pdp, shop, lead_form, app_store, deep_link, social_profile, sonstiges
  pa_ziel_url text,

  -- ---------------------------------------------------------
  -- 3. OWNED SOCIAL (os_*)
  -- ---------------------------------------------------------
  -- 3.1 Ziele
  os_content_ziele text[],            -- reichweite, watch_time, retention, engagement, ...
  os_kpis jsonb,
  os_keine_benchmarks boolean NOT NULL DEFAULT false,

  -- 3.2 Creator-Anforderungen
  os_creator_groessen text[],
  os_nischen text[],
  os_creator_merkmale jsonb,
  os_voraussetzungen text[],
  os_voraussetzungen_custom text,

  -- 3.3 Brand Channels & Formate
  os_channels jsonb,                  -- { instagram: [], tiktok: bool, youtube: [], facebook: bool, linkedin: bool, pinterest: bool, sonstiges: '' }
  os_formatvorgaben jsonb,

  -- 3.4 Learnings
  os_learnings_vorhanden boolean NOT NULL DEFAULT false,
  os_learnings_text text,
  os_beispiele jsonb,
  os_reporting jsonb,

  -- 3.5 Ideen
  os_ideen_status text CHECK (os_ideen_status IN ('ja', 'teilweise', 'nein')),
  os_ideen_text text,
  os_referenzen jsonb,
  os_ideen_verantwortlich text[],

  -- 3.6 Umsetzung & Content-System
  os_umsetzung text,
  os_umsetzung_offen boolean NOT NULL DEFAULT false,
  os_situationen text,
  os_content_ansatz text[],           -- wiederkehrend, unterschiedliche_ideen, pillars, mischung, offen (nur Always-on)
  os_content_pillars jsonb,           -- ["Pillar 1", "Pillar 2", ...]

  -- 3.7 Produktion
  os_production_setup text[],
  os_vorort jsonb,
  os_versand_anforderungen text,

  -- 3.8 Zusaetzliche Assets
  os_zusatz_assets text CHECK (os_zusatz_assets IN ('nein', 'ja', 'offen')),
  os_assets text[],                   -- produktaufnahmen, closeups, b_roll, stills, mood, grafik, cutdowns, sonstiges
  os_assets_anforderungen text
);

CREATE INDEX IF NOT EXISTS idx_campaign_briefings_unternehmen ON campaign_briefings(unternehmen_id);
CREATE INDEX IF NOT EXISTS idx_campaign_briefings_marke ON campaign_briefings(marke_id);
CREATE INDEX IF NOT EXISTS idx_campaign_briefings_bereich ON campaign_briefings(bereich);
CREATE INDEX IF NOT EXISTS idx_campaign_briefings_draft ON campaign_briefings(is_draft);

-- updated_at automatisch pflegen
CREATE OR REPLACE FUNCTION campaign_briefings_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_briefings_updated_at ON campaign_briefings;
CREATE TRIGGER trg_campaign_briefings_updated_at
  BEFORE UPDATE ON campaign_briefings
  FOR EACH ROW EXECUTE FUNCTION campaign_briefings_touch_updated_at();

-- ---------------------------------------------------------
-- RLS: internes Tool (v1) — Admins + Mitarbeiter voll, Kunden kein Zugriff
-- ---------------------------------------------------------
ALTER TABLE campaign_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY campaign_briefings_select ON campaign_briefings
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY campaign_briefings_insert ON campaign_briefings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY campaign_briefings_update ON campaign_briefings
  FOR UPDATE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

CREATE POLICY campaign_briefings_delete ON campaign_briefings
  FOR DELETE TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()));

-- ---------------------------------------------------------
-- kooperationen.briefing_id auf campaign_briefings umhaengen.
-- Constraint-Name ist im Repo nicht bekannt (Alt-Schema), daher dynamisch.
-- ---------------------------------------------------------
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'kooperationen'
    AND con.contype = 'f'
    AND att.attname = 'briefing_id';

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE kooperationen DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE kooperationen
  ADD CONSTRAINT kooperationen_briefing_id_fkey
  FOREIGN KEY (briefing_id) REFERENCES campaign_briefings(id) ON DELETE SET NULL;

-- ---------------------------------------------------------
-- Alt-Daten retten: Huelle der produktiven Rows uebernehmen
-- (Freitext-Felder des Alt-Moduls haben keine Entsprechung im
-- neuen Schema und werden bewusst nicht migriert).
-- ---------------------------------------------------------
INSERT INTO campaign_briefings (unternehmen_id, marke_id, bereich, aktivierung_name, is_draft, created_at)
SELECT unternehmen_id, marke_id, 'influencer_marketing', product_service_offer || ' (migriert)', true, created_at
FROM briefings
WHERE unternehmen_id IS NOT NULL;

-- ---------------------------------------------------------
-- Alt-Modul entfernen.
-- Die Storage-Policy documents_select_staff_kunde referenziert
-- briefing_documents/briefings (Kunden-Lesezugriff auf Briefing-Docs).
-- Kunden-Zweig entfaellt mit dem Alt-Modul → Policy Staff-only neu anlegen.
-- ---------------------------------------------------------
DROP POLICY IF EXISTS documents_select_staff_kunde ON storage.objects;
CREATE POLICY documents_select_staff_kunde ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (SELECT is_admin_or_mitarbeiter()));

DROP TABLE IF EXISTS briefing_example_videos; -- leeres Relikt, im Code unreferenziert
DROP TABLE IF EXISTS briefing_documents;
DROP TABLE IF EXISTS briefings;
