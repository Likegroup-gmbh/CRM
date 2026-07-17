-- Model-Vertrag: Neue Spalten für die vertraege-Tabelle

-- Produktion & Einsatz
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_produktionsart text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_shooting_von date;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_shooting_bis date;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_call_time text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_drehbeginn text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_produktionsende text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_max_tagesstunden numeric;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_einsatzort_art text[];
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_einsatzort_adresse text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_optionstage text;

-- Produktionsrahmen
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_anzahl_foto_motive integer;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_anzahl_video_sequenzen integer;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_rolle text[];
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_rolle_sonstiges text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_styling text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_fitting_datum date;

-- Nutzungsrechte
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_nutzungsarten text[];
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_territorium text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_territorium_beschraenkt text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_nutzungsdauer text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_nutzungsbeginn date;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_exklusivitaet_art text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_exklusivitaet_dauer integer;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_ki_nutzung text[];

-- Vergütung
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_honorar_art text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_buyout_inklusiv boolean DEFAULT false;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_buyout_betrag numeric;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_reisekosten text;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_reisepauschale numeric;

-- Absage & Ausfall
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_wetterabhaengig boolean DEFAULT false;
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_absage_regelung text[];
ALTER TABLE vertraege ADD COLUMN IF NOT EXISTS model_absage_individuell text;
