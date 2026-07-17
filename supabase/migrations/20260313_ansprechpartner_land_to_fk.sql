-- ============================================================
-- Migration: Ansprechpartner "land" Freitext -> FK auf eu_laender
-- ============================================================

-- 1. Nicht-EU-Länder in eu_laender einfügen (sort_order ab 100)
INSERT INTO eu_laender (name, name_de, iso_code, vorwahl, sort_order)
VALUES
  ('Switzerland', 'Schweiz', 'ch', '+41', 100),
  ('United Kingdom', 'Vereinigtes Königreich', 'gb', '+44', 101),
  ('Norway', 'Norwegen', 'no', '+47', 102),
  ('Iceland', 'Island', 'is', '+354', 103),
  ('Liechtenstein', 'Liechtenstein', 'li', '+423', 104),
  ('United States', 'USA', 'us', '+1', 105),
  ('Canada', 'Kanada', 'ca', '+1', 106),
  ('Turkey', 'Türkei', 'tr', '+90', 107),
  ('Australia', 'Australien', 'au', '+61', 108),
  ('New Zealand', 'Neuseeland', 'nz', '+64', 109),
  ('Japan', 'Japan', 'jp', '+81', 110),
  ('South Korea', 'Südkorea', 'kr', '+82', 111),
  ('China', 'China', 'cn', '+86', 112),
  ('India', 'Indien', 'in', '+91', 113),
  ('Brazil', 'Brasilien', 'br', '+55', 114),
  ('Mexico', 'Mexiko', 'mx', '+52', 115),
  ('Israel', 'Israel', 'il', '+972', 116),
  ('United Arab Emirates', 'Vereinigte Arabische Emirate', 'ae', '+971', 117),
  ('South Africa', 'Südafrika', 'za', '+27', 118),
  ('Singapore', 'Singapur', 'sg', '+65', 119),
  ('Ukraine', 'Ukraine', 'ua', '+380', 120),
  ('Serbia', 'Serbien', 'rs', '+381', 121),
  ('Bosnia and Herzegovina', 'Bosnien und Herzegowina', 'ba', '+387', 122),
  ('Albania', 'Albanien', 'al', '+355', 123),
  ('North Macedonia', 'Nordmazedonien', 'mk', '+389', 124),
  ('Montenegro', 'Montenegro', 'me', '+382', 125),
  ('Moldova', 'Moldawien', 'md', '+373', 126),
  ('Georgia', 'Georgien', 'ge', '+995', 127),
  ('Thailand', 'Thailand', 'th', '+66', 128),
  ('Indonesia', 'Indonesien', 'id', '+62', 129),
  ('Argentina', 'Argentinien', 'ar', '+54', 130),
  ('Colombia', 'Kolumbien', 'co', '+57', 131)
ON CONFLICT (iso_code) DO NOTHING;

-- 2. Neue Spalte land_id als FK auf eu_laender
ALTER TABLE ansprechpartner
  ADD COLUMN IF NOT EXISTS land_id uuid REFERENCES eu_laender(id);

-- 3. Bestehende Freitext-Werte migrieren
UPDATE ansprechpartner
SET land_id = el.id
FROM eu_laender el
WHERE (
  (LOWER(TRIM(ansprechpartner.land)) IN ('deutschland', 'de', 'ger', 'germany', 'frankfurt') AND el.iso_code = 'de')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('österreich', 'oesterreich', 'at', 'austria') AND el.iso_code = 'at')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('schweiz', 'ch', 'switzerland') AND el.iso_code = 'ch')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('niederlande', 'nl', 'netherlands', 'holland') AND el.iso_code = 'nl')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('usa', 'us', 'united states', 'vereinigte staaten') AND el.iso_code = 'us')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('frankreich', 'fr', 'france') AND el.iso_code = 'fr')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('italien', 'it', 'italy') AND el.iso_code = 'it')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('spanien', 'es', 'spain') AND el.iso_code = 'es')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('uk', 'gb', 'großbritannien', 'england', 'united kingdom') AND el.iso_code = 'gb')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('polen', 'pl', 'poland') AND el.iso_code = 'pl')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('schweden', 'se', 'sweden') AND el.iso_code = 'se')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('dänemark', 'dk', 'denmark') AND el.iso_code = 'dk')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('norwegen', 'no', 'norway') AND el.iso_code = 'no')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('finnland', 'fi', 'finland') AND el.iso_code = 'fi')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('belgien', 'be', 'belgium') AND el.iso_code = 'be')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('portugal', 'pt', 'portugal') AND el.iso_code = 'pt')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('irland', 'ie', 'ireland') AND el.iso_code = 'ie')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('luxemburg', 'lu', 'luxembourg') AND el.iso_code = 'lu')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('tschechien', 'cz', 'czech republic') AND el.iso_code = 'cz')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('ungarn', 'hu', 'hungary') AND el.iso_code = 'hu')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('rumänien', 'ro', 'romania') AND el.iso_code = 'ro')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('griechenland', 'gr', 'greece') AND el.iso_code = 'gr')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('kroatien', 'hr', 'croatia') AND el.iso_code = 'hr')
  OR (LOWER(TRIM(ansprechpartner.land)) IN ('türkei', 'tr', 'turkey') AND el.iso_code = 'tr')
)
AND ansprechpartner.land IS NOT NULL
AND ansprechpartner.land != ''
AND ansprechpartner.land_id IS NULL;

-- 4. Index auf land_id für Performance
CREATE INDEX IF NOT EXISTS idx_ansprechpartner_land_id ON ansprechpartner(land_id);
