-- Exklusivitäts-Einheit (Monate/Wochen/Tage) für flexible Zeiträume
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS exklusivitaet_einheit text DEFAULT 'monate';

-- Sonstige Plattform (Freitext bei "Sonstige" Checkbox)
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS plattformen_sonstige text;
