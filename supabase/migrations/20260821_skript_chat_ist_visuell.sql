-- Markierungs-Rewrites auf "Was zu sehen ist" vom Spoken-Pfad trennen
--   skript_chat_messages.ist_visuell: Selection/Accept landet in *_visuell

ALTER TABLE skript_chat_messages
  ADD COLUMN IF NOT EXISTS ist_visuell boolean NOT NULL DEFAULT false;
