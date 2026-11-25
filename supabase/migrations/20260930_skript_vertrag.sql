-- Vertrag am Skript: Festlegungen, festgezogene Zellen, Prüfung.
-- Neue Editor-Aktion neue_geschichte.

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS festlegungen jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS festgezogen text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pruefung jsonb;

ALTER TABLE skript_chat_messages DROP CONSTRAINT IF EXISTS skript_chat_messages_aktion_check;
ALTER TABLE skript_chat_messages ADD CONSTRAINT skript_chat_messages_aktion_check
  CHECK (aktion IN (
    'neu_schreiben', 'neue_geschichte', 'kuerzen', 'laenger', 'anderer_ton',
    'chat', 'feedback', 'rueckfrage', 'visuell'
  ));
