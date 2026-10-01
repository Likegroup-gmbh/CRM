-- Konzept-Chat: Feedback an Videoidee-Vorschlaege (ADR 0036)
--
-- Ein Faden pro Mitarbeiter, nicht pro Konzept wie bei briefing_chat_messages:
-- "die" und "nochmal" binden an die Vorschlaege, die Liky in der letzten
-- eigenen Antwort gemeint hat (bezug_ids). Ein geteilter Faden wuerde "die"
-- an den letzten Turn einer anderen Person binden.
--
-- Client legt die User-Message an und pollt; die Function schreibt
-- Fortschritt und Antwort per Service Role. Muster wie skript_chat_messages.

BEGIN;

CREATE TABLE IF NOT EXISTS public.konzept_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strategie_id uuid NOT NULL REFERENCES public.strategie(id) ON DELETE CASCADE,
  rolle varchar NOT NULL CHECK (rolle IN ('user', 'assistant')),
  inhalt text,
  status varchar NOT NULL DEFAULT 'fertig'
    CHECK (status IN ('pending', 'running', 'fertig', 'error')),
  error_message text,
  progress_steps jsonb,
  bezug_ids uuid[],
  braucht_anzahl boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS konzept_chat_messages_faden_idx
  ON public.konzept_chat_messages (strategie_id, created_by, created_at);

COMMENT ON TABLE public.konzept_chat_messages IS
  'Liky-Chat am Konzept (konzept-chat-background). Ein Faden pro Mitarbeiter; bezug_ids haelt die Vorschlaege, auf die sich "die" bezieht.';

COMMENT ON COLUMN public.konzept_chat_messages.bezug_ids IS
  'strategie_items-IDs der Videoidee-Vorschlaege, die die Nachricht meint. Der naechste Turn loest "die" dagegen auf.';

COMMENT ON COLUMN public.konzept_chat_messages.braucht_anzahl IS
  'neu ohne Zahl im Text: der Client stellt danach die Anzahl-Karte und schickt die Zahl als eigene Nachricht.';

CREATE TRIGGER konzept_chat_messages_updated_at
  BEFORE UPDATE ON public.konzept_chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: nur Staff, und jeder sieht nur den eigenen Faden.
-- Die Function laeuft als Service Role und schreibt die Assistant-Message
-- mit created_by des Fragestellers, damit sie im selben Faden landet.

ALTER TABLE public.konzept_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY konzept_chat_messages_select ON public.konzept_chat_messages
  FOR SELECT TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()) AND created_by = (SELECT auth.uid()));

CREATE POLICY konzept_chat_messages_insert ON public.konzept_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT is_admin_or_mitarbeiter())
    AND created_by = (SELECT auth.uid())
    AND rolle = 'user'
    AND status = 'pending'
  );

-- Kein UPDATE/DELETE fuer Clients: schreibt ausschliesslich die Function (Service Role)

ALTER PUBLICATION supabase_realtime ADD TABLE public.konzept_chat_messages;

COMMIT;
