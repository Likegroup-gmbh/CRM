-- Edit-Auftrag mit Umfang: freier Chat kann mehrere Zellen auf einmal liefern.
-- aenderungen: [{ sektion, spalte, vorschlag_text }], ein Eintrag pro Zelle.

ALTER TABLE skript_chat_messages
  ADD COLUMN IF NOT EXISTS aenderungen jsonb;
