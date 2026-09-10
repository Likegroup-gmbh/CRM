-- Ausdrueckliche Skript-Freigabe an der Videoidee. Gate nur fuer Neuanlage;
-- bestehende Skripte bleiben unberuehrt. Voraussetzung (Casting-Eintrag,
-- nicht "Nicht umsetzen") sitzt im Service, nicht als DB-Trigger.
--
-- Namensabgrenzung: kooperation_videos.skript_freigegeben meint die
-- Freigabe des fertigen Skripts am Video, nicht dieses Flag.

ALTER TABLE strategie_items
  ADD COLUMN IF NOT EXISTS skript_freigabe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skript_freigabe_am timestamptz,
  ADD COLUMN IF NOT EXISTS skript_freigabe_von uuid;

CREATE INDEX IF NOT EXISTS strategie_items_skript_freigabe_idx
  ON strategie_items (strategie_id)
  WHERE skript_freigabe;
