ALTER TABLE creator_auswahl_items
  ADD COLUMN IF NOT EXISTS reichweite_instagram text,
  ADD COLUMN IF NOT EXISTS reichweite_tiktok text,
  ADD COLUMN IF NOT EXISTS reichweite_garantie text,
  ADD COLUMN IF NOT EXISTS cpm_instagram numeric,
  ADD COLUMN IF NOT EXISTS cpm_tiktok numeric,
  ADD COLUMN IF NOT EXISTS preis_ek numeric,
  ADD COLUMN IF NOT EXISTS preis_vk numeric;
