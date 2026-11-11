-- Neue, geänderte und gelöschte Medien ohne Neuladen anzeigen (Videotabelle, Video-Browser).
--
-- Die Asset-Tabellen selbst kommen nicht in die Realtime-Publikation: sie haben keine
-- kampagne_id (kein Serverfilter möglich), jede Datei erzeugt mehrere Writes (Insert,
-- is_current, Echo nach dem Verschieben) und RLS samt testunternehmen_hide liefe pro Event
-- und Abonnent. Stattdessen setzt ein Trigger je Kooperation einen Zeitstempel; der Client
-- abonniert diese eine Zeile gefiltert nach Kampagne und lädt die Medien der Kooperation nach.
--
-- Pro Transaktion höchstens ein Write je Kooperation (geaendert_at = now() ist der
-- Transaktionsbeginn). Reine is_current-Wechsel lösen nichts aus: der Client leitet die
-- aktuelle Version selbst ab, und die Flags kommen zusammen mit dem eigentlichen Write.
--
-- Deploy: erst diese Migration, dann der Client. Ein Abo auf eine Tabelle außerhalb der
-- Publikation lässt den ganzen Kampagnen-Channel scheitern.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_kooperation_medien_stand ON public.kooperation_video_asset;
--   DROP TRIGGER IF EXISTS trg_kooperation_medien_stand ON public.kooperation_story_asset;
--   DROP TRIGGER IF EXISTS trg_kooperation_medien_stand ON public.kooperation_bilder_asset;
--   DROP TRIGGER IF EXISTS trg_kooperation_medien_stand ON public.kooperation_rohmaterial_asset;
--   DROP TRIGGER IF EXISTS trg_kooperation_medien_stand ON public.kooperation_story;
--   DROP FUNCTION IF EXISTS public.kooperation_medien_stand_setzen();
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.kooperation_medien_stand;
--   DROP TABLE IF EXISTS public.kooperation_medien_stand;

BEGIN;

CREATE TABLE IF NOT EXISTS public.kooperation_medien_stand (
  kooperation_id uuid PRIMARY KEY REFERENCES public.kooperationen(id) ON DELETE CASCADE,
  kampagne_id uuid NOT NULL,
  geaendert_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kooperation_medien_stand ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.kooperation_medien_stand FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.kooperation_medien_stand TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kooperation_medien_stand TO service_role;

-- Sichtbar, wer die Kooperation sieht (deren RLS greift im Unterselect)
DROP POLICY IF EXISTS kooperation_medien_stand_select ON public.kooperation_medien_stand;
CREATE POLICY kooperation_medien_stand_select ON public.kooperation_medien_stand
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.kooperationen k WHERE k.id = kooperation_medien_stand.kooperation_id));

-- Kooperation aus der Zeile: direkt (Bilder, Rohmaterial) oder über das Video (Video, Story,
-- Story-Slot). Bei einem Update mit Wechsel des Videos oder der Kooperation beide Seiten.
CREATE OR REPLACE FUNCTION public.kooperation_medien_stand_setzen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_zeilen jsonb[] := '{}';
  v_zeile jsonb;
  v_koop uuid;
  v_koops uuid[] := '{}';
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) - 'is_current') = (to_jsonb(NEW) - 'is_current') THEN
    RETURN NULL;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    v_zeilen := array_append(v_zeilen, to_jsonb(OLD));
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_zeilen := array_append(v_zeilen, to_jsonb(NEW));
  END IF;

  FOREACH v_zeile IN ARRAY v_zeilen LOOP
    v_koop := (v_zeile->>'kooperation_id')::uuid;
    IF v_koop IS NULL AND v_zeile->>'video_id' IS NOT NULL THEN
      SELECT v.kooperation_id INTO v_koop
      FROM public.kooperation_videos v
      WHERE v.id = (v_zeile->>'video_id')::uuid;
    END IF;
    IF v_koop IS NOT NULL AND NOT (v_koop = ANY (v_koops)) THEN
      v_koops := array_append(v_koops, v_koop);
    END IF;
  END LOOP;

  IF cardinality(v_koops) = 0 THEN
    RETURN NULL;
  END IF;

  -- Kaskaden (Kooperation/Video gelöscht) finden die Eltern nicht mehr und schreiben nichts
  INSERT INTO public.kooperation_medien_stand AS s (kooperation_id, kampagne_id, geaendert_at)
  SELECT k.id, k.kampagne_id, now()
  FROM public.kooperationen k
  WHERE k.id = ANY (v_koops) AND k.kampagne_id IS NOT NULL
  ON CONFLICT (kooperation_id) DO UPDATE
    SET kampagne_id = EXCLUDED.kampagne_id, geaendert_at = EXCLUDED.geaendert_at
    WHERE s.geaendert_at IS DISTINCT FROM EXCLUDED.geaendert_at
       OR s.kampagne_id IS DISTINCT FROM EXCLUDED.kampagne_id;

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.kooperation_medien_stand_setzen() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'kooperation_video_asset',
    'kooperation_story_asset',
    'kooperation_bilder_asset',
    'kooperation_rohmaterial_asset',
    'kooperation_story'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_kooperation_medien_stand ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_kooperation_medien_stand AFTER INSERT OR UPDATE OR DELETE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.kooperation_medien_stand_setzen()', t);
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kooperation_medien_stand'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kooperation_medien_stand;
  END IF;
END $$;

COMMIT;
