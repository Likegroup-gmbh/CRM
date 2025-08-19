-- Migration: Kampagne Art Typen und Format Anpassung Tabellen
-- Datum: $(date)

-- =============================================
-- 1. Kampagne Art Typen Tabelle
-- =============================================

-- Erstelle Tabelle für Kampagnenarten
CREATE TABLE IF NOT EXISTS kampagne_art_typen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  beschreibung TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Füge die vorgegebenen Kampagnenarten ein
INSERT INTO kampagne_art_typen (name, beschreibung, sort_order) VALUES
('Influencer Kampagne', 'Kampagne mit Influencern', 1),
('UGC-Kampagne', 'User Generated Content Kampagne', 2),
('Vor Ort Produktionen', 'Produktionen vor Ort beim Kunden', 3),
('IGC Kampagnen', 'Intern Generated Content Kampagnen', 4)
ON CONFLICT (name) DO NOTHING;

-- Erstelle Verknüpfungstabelle für Auftrag-Kampagnenarten (Many-to-Many)
CREATE TABLE IF NOT EXISTS auftrag_kampagne_art (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auftrag_id UUID NOT NULL REFERENCES auftrag(id) ON DELETE CASCADE,
  kampagne_art_id UUID NOT NULL REFERENCES kampagne_art_typen(id) ON DELETE CASCADE,
  hinzugefuegt_am TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auftrag_id, kampagne_art_id)
);

-- =============================================
-- 2. Format Anpassung Typen Tabelle
-- =============================================

-- Erstelle Tabelle für Format-Anpassungen
CREATE TABLE IF NOT EXISTS format_anpassung_typen (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  beschreibung TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Füge Standard Format-Anpassungen ein (diese können später erweitert werden)
INSERT INTO format_anpassung_typen (name, beschreibung, sort_order) VALUES
('9:16 (Stories)', 'Hochformat für Instagram/TikTok Stories', 1),
('16:9 (Landscape)', 'Querformat für YouTube/LinkedIn', 2),
('1:1 (Square)', 'Quadratisches Format für Instagram Feed', 3),
('4:5 (Portrait)', 'Hochformat für Instagram Feed', 4),
('Kurze Version (30s)', 'Gekürzte Version für Ads', 5),
('Lange Version (60s+)', 'Vollversion für organischen Content', 6)
ON CONFLICT (name) DO NOTHING;

-- Erstelle Verknüpfungstabelle für Auftrag-Format-Anpassungen (Many-to-Many)
CREATE TABLE IF NOT EXISTS auftrag_format_anpassung (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auftrag_id UUID NOT NULL REFERENCES auftrag(id) ON DELETE CASCADE,
  format_anpassung_id UUID NOT NULL REFERENCES format_anpassung_typen(id) ON DELETE CASCADE,
  hinzugefuegt_am TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(auftrag_id, format_anpassung_id)
);

-- =============================================
-- 3. Indizes für bessere Performance
-- =============================================

-- Indizes für Kampagne Art Verknüpfungen
CREATE INDEX IF NOT EXISTS idx_auftrag_kampagne_art_auftrag_id ON auftrag_kampagne_art(auftrag_id);
CREATE INDEX IF NOT EXISTS idx_auftrag_kampagne_art_kampagne_art_id ON auftrag_kampagne_art(kampagne_art_id);

-- Indizes für Format Anpassung Verknüpfungen
CREATE INDEX IF NOT EXISTS idx_auftrag_format_anpassung_auftrag_id ON auftrag_format_anpassung(auftrag_id);
CREATE INDEX IF NOT EXISTS idx_auftrag_format_anpassung_format_id ON auftrag_format_anpassung(format_anpassung_id);

-- =============================================
-- 4. Update Trigger für updated_at Felder
-- =============================================

-- Trigger für kampagne_art_typen
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_kampagne_art_typen_updated_at 
  BEFORE UPDATE ON kampagne_art_typen 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_format_anpassung_typen_updated_at 
  BEFORE UPDATE ON format_anpassung_typen 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();