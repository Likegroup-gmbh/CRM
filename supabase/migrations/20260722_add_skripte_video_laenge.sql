-- Video-Gesamtlaenge als Vorgabe fuer die Skript-Generierung.
-- Wert ist die gewaehlte Sekunden-Spanne als String, z.B. '30-45'
-- (15-Sekunden-Schritte von 0-15 bis 165-180). NULL = keine Vorgabe.
ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS video_laenge varchar;
