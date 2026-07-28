-- UVP / Retail-Preis fuer Produkte und Varianten.
--
-- preis_von bleibt der Preis, den der Kunde zahlt. Ist das Angebot reduziert,
-- steht der regulaere Preis daneben (durchgestrichen im Shop, "compare_at_price"
-- in den Varianten-Rohdaten). Fuer Skripte und Briefings ist die Differenz
-- zwischen beiden die eigentliche Aussage ("399 statt 200").

BEGIN;

ALTER TABLE produkt
  ADD COLUMN IF NOT EXISTS preis_uvp numeric(10, 2);

ALTER TABLE produkt_variante
  ADD COLUMN IF NOT EXISTS uvp numeric(10, 2);

COMMENT ON COLUMN produkt.preis_uvp IS 'Regulaerer Preis / UVP der Kollektion. Nur gesetzt, wenn das Angebot reduziert ist - sonst NULL. Immer >= preis_von.';
COMMENT ON COLUMN produkt_variante.uvp IS 'Streichpreis dieser Variante. Nur setzen, wenn er vom UVP der Kollektion abweicht.';

COMMIT;
