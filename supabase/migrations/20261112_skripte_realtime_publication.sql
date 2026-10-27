-- skripte in die Realtime-Publication aufnehmen.
-- KampagneDetail._initSkripteRealtime hoert auf UPDATE von skripte (gefiltert
-- nach kampagne_id), damit Kundenfreigabe und Status-Wechsel live ankommen.
-- Die Tabelle war nicht in der Publication: der Channel lief in CHANNEL_ERROR
-- und wurde alle 5 s neu aufgebaut, ohne je ein Event zu liefern.
-- Volumen gering (ca. 230 Updates insgesamt).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'skripte'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.skripte;
  END IF;
END $$;
