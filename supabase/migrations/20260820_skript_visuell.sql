-- "Was zu sehen ist" pro Sektion (Hook / Hauptteil / CTA)
--   skripte + skript_versionen bekommen je drei Visual-Felder
--   skript_chat_messages.aktion um 'visuell' erweitert (Button in der Visual-Zelle)

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS hook_visuell text,
  ADD COLUMN IF NOT EXISTS hauptteil_visuell text,
  ADD COLUMN IF NOT EXISTS cta_visuell text;

ALTER TABLE skript_versionen
  ADD COLUMN IF NOT EXISTS hook_visuell text,
  ADD COLUMN IF NOT EXISTS hauptteil_visuell text,
  ADD COLUMN IF NOT EXISTS cta_visuell text;

ALTER TABLE skript_chat_messages DROP CONSTRAINT IF EXISTS skript_chat_messages_aktion_check;
ALTER TABLE skript_chat_messages ADD CONSTRAINT skript_chat_messages_aktion_check
  CHECK (aktion IN ('neu_schreiben', 'kuerzen', 'laenger', 'anderer_ton', 'chat', 'feedback', 'rueckfrage', 'visuell'));
