ALTER TABLE ansprechpartner
  ADD COLUMN IF NOT EXISTS ist_rechnungsverantwortlich boolean DEFAULT false;
