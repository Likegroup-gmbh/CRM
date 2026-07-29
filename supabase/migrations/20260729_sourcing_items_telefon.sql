-- Kontaktdaten im Sourcing: Telefonnummer neben der bereits vorhandenen email.
--
-- Beide Spalten werden beim Instagram-Fetch aus der Bio angereichert
-- (siehe netlify/functions/_shared/bio-extract.js) und sind in der Tabelle
-- nur intern sichtbar - Kunden und Gaeste bekommen sie nie zu sehen.

ALTER TABLE creator_auswahl_items
  ADD COLUMN IF NOT EXISTS telefon text;
