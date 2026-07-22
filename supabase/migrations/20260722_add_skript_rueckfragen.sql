-- Rueckfragen-Phase (Slot-Filling) vor der Skript-Generierung:
--   skripte.status 'fragen'            - Stub, der noch auf Antworten wartet
--   skript_chat_messages.aktion 'rueckfrage' - Frage/Antwort-Runden vor der Generierung

ALTER TABLE skript_chat_messages DROP CONSTRAINT IF EXISTS skript_chat_messages_aktion_check;
ALTER TABLE skript_chat_messages ADD CONSTRAINT skript_chat_messages_aktion_check
  CHECK (aktion IN ('neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton', 'chat', 'feedback', 'rueckfrage'));

ALTER TABLE skripte DROP CONSTRAINT IF EXISTS skripte_status_check;
ALTER TABLE skripte ADD CONSTRAINT skripte_status_check
  CHECK (status IN ('entwurf', 'feedback_gegeben', 'final', 'archiviert', 'fragen'));
