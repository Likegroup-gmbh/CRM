-- Materialize kampagne.is_completed so list/calendar/RLS/edge function
-- read a column instead of per-row scans over kooperationen + videos.
-- Semantics unchanged: >=1 koop AND every koop has >=1 video AND all videos freigabe = true.

ALTER TABLE public.kampagne
  ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.kampagne.is_completed IS
  'Derived: true iff the campaign has >=1 Kooperation, every Kooperation has >=1 Video, and every Video has freigabe = true. Maintained by triggers.';

-- Backfill with the existing function (still the correlated implementation at this point).
UPDATE public.kampagne k
SET is_completed = public.kampagne_is_completed(k.id);

CREATE OR REPLACE FUNCTION public.refresh_kampagne_is_completed(p_kampagne_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_kampagne_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE kampagne k
  SET is_completed = (
    EXISTS (SELECT 1 FROM kooperationen ko WHERE ko.kampagne_id = p_kampagne_id)
    AND NOT EXISTS (
      SELECT 1
      FROM kooperationen ko
      WHERE ko.kampagne_id = p_kampagne_id
        AND (
          NOT EXISTS (
            SELECT 1 FROM kooperation_videos kv WHERE kv.kooperation_id = ko.id
          )
          OR EXISTS (
            SELECT 1
            FROM kooperation_videos kv
            WHERE kv.kooperation_id = ko.id
              AND kv.freigabe IS NOT TRUE
          )
        )
    )
  )
  WHERE k.id = p_kampagne_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_kampagne_is_completed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_kampagne_is_completed(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_kampagne_is_completed(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_kooperationen_refresh_kampagne_is_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM refresh_kampagne_is_completed(NEW.kampagne_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM refresh_kampagne_is_completed(OLD.kampagne_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_kampagne_is_completed(NEW.kampagne_id);
    IF OLD.kampagne_id IS DISTINCT FROM NEW.kampagne_id THEN
      PERFORM refresh_kampagne_is_completed(OLD.kampagne_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_kooperation_videos_refresh_kampagne_is_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new uuid;
  v_old uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT ko.kampagne_id INTO v_new FROM kooperationen ko WHERE ko.id = NEW.kooperation_id;
    PERFORM refresh_kampagne_is_completed(v_new);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT ko.kampagne_id INTO v_old FROM kooperationen ko WHERE ko.id = OLD.kooperation_id;
    PERFORM refresh_kampagne_is_completed(v_old);
    RETURN OLD;
  ELSE
    SELECT ko.kampagne_id INTO v_new FROM kooperationen ko WHERE ko.id = NEW.kooperation_id;
    PERFORM refresh_kampagne_is_completed(v_new);
    IF NEW.kooperation_id IS DISTINCT FROM OLD.kooperation_id THEN
      SELECT ko.kampagne_id INTO v_old FROM kooperationen ko WHERE ko.id = OLD.kooperation_id;
      IF v_old IS DISTINCT FROM v_new THEN
        PERFORM refresh_kampagne_is_completed(v_old);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_kooperationen_refresh_kampagne_is_completed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_kooperation_videos_refresh_kampagne_is_completed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_kooperationen_refresh_kampagne_is_completed ON public.kooperationen;
CREATE TRIGGER trg_kooperationen_refresh_kampagne_is_completed
  AFTER INSERT OR DELETE OR UPDATE OF kampagne_id
  ON public.kooperationen
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kooperationen_refresh_kampagne_is_completed();

DROP TRIGGER IF EXISTS trg_kooperation_videos_refresh_kampagne_is_completed ON public.kooperation_videos;
CREATE TRIGGER trg_kooperation_videos_refresh_kampagne_is_completed
  AFTER INSERT OR DELETE OR UPDATE OF freigabe, kooperation_id
  ON public.kooperation_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_kooperation_videos_refresh_kampagne_is_completed();

-- Existing signatures stay: callers (list RPC, calendar, share RLS, edge function) unchanged.
CREATE OR REPLACE FUNCTION public.kampagne_is_completed(p_kampagne_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT k.is_completed FROM kampagne k WHERE k.id = p_kampagne_id),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_completed_kampagne_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  FROM kampagne
  WHERE is_completed;
$$;

CREATE OR REPLACE FUNCTION public.get_kampagnen_list(p_page integer DEFAULT 1, p_limit integer DEFAULT 25, p_search text DEFAULT NULL::text, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET plan_cache_mode TO 'force_custom_plan'
 SET search_path TO 'public'
AS $function$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_rows JSONB;
BEGIN
  v_offset := (p_page - 1) * p_limit;

  SELECT COUNT(*) INTO v_total
  FROM kampagne k
  LEFT JOIN unternehmen u ON u.id = k.unternehmen_id
  LEFT JOIN marke m ON m.id = k.marke_id
  WHERE
    (p_search IS NULL OR p_search = '' OR k.kampagnenname ILIKE '%' || p_search || '%' OR k.eigener_name ILIKE '%' || p_search || '%' OR u.firmenname ILIKE '%' || p_search || '%' OR m.markenname ILIKE '%' || p_search || '%')
    AND (NOT p_filters ? 'unternehmen_id' OR k.unternehmen_id = (p_filters->>'unternehmen_id')::uuid)
    AND (NOT p_filters ? 'marke_id' OR k.marke_id = (p_filters->>'marke_id')::uuid)
    AND (NOT p_filters ? 'art_der_kampagne' OR k.art_der_kampagne && ARRAY(SELECT jsonb_array_elements_text(p_filters->'art_der_kampagne')))
    AND (NOT p_filters ? 'start_from' OR k.start >= (p_filters->>'start_from')::date)
    AND (NOT p_filters ? 'start_to' OR k.start <= (p_filters->>'start_to')::date)
    AND (NOT p_filters ? 'deadline_from' OR k.deadline_post_produktion >= (p_filters->>'deadline_from')::date)
    AND (NOT p_filters ? 'deadline_to' OR k.deadline_post_produktion <= (p_filters->>'deadline_to')::date)
    AND (NOT p_filters ? 'is_overdue' OR (p_filters->>'is_overdue')::boolean = false OR k.deadline_post_produktion < CURRENT_DATE)
    AND (NOT p_filters ? 'has_briefing' OR CASE WHEN (p_filters->>'has_briefing')::boolean THEN k.briefing_id IS NOT NULL ELSE k.briefing_id IS NULL END)
    AND (NOT p_filters ? 'hide_completed' OR (p_filters->>'hide_completed')::boolean = false OR NOT k.is_completed);

  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT jsonb_build_object(
      'id', k.id,
      'kampagnenname', k.kampagnenname,
      'eigener_name', k.eigener_name,
      'start', k.start,
      'deadline_strategie', k.deadline_strategie,
      'deadline_creator_sourcing', k.deadline_creator_sourcing,
      'deadline_video_produktion', k.deadline_video_produktion,
      'deadline_post_produktion', k.deadline_post_produktion,
      'creatoranzahl', k.creatoranzahl,
      'videoanzahl', k.videoanzahl,
      'art_der_kampagne', k.art_der_kampagne,
      'kampagne_typ', k.kampagne_typ,
      'created_at', k.created_at,
      'unternehmen_id', k.unternehmen_id,
      'marke_id', k.marke_id,
      'auftrag_id', k.auftrag_id,
      'unternehmen', CASE WHEN u.id IS NOT NULL THEN jsonb_build_object('id', u.id, 'firmenname', u.firmenname, 'internes_kuerzel', u.internes_kuerzel, 'logo_url', u.logo_url) ELSE NULL END,
      'marke', CASE WHEN m.id IS NOT NULL THEN jsonb_build_object('id', m.id, 'markenname', m.markenname, 'logo_url', m.logo_url) ELSE NULL END,
      'auftrag', CASE WHEN a.id IS NOT NULL THEN jsonb_build_object('id', a.id, 'auftragsname', a.auftragsname, 'creator_budget', a.creator_budget, 'gesamt_budget', a.gesamt_budget, 'bruttobetrag', a.bruttobetrag, 'nettobetrag', a.nettobetrag) ELSE NULL END,
      'mitarbeiter', COALESCE((
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'id', b.id,
          'name', b.name,
          'rolle', b.rolle,
          'profile_image_url', b.profile_image_url,
          'zuordnungsart', CASE
            WHEN EXISTS (SELECT 1 FROM kampagne_mitarbeiter km WHERE km.kampagne_id = k.id AND km.mitarbeiter_id = b.id) THEN 'direkt'
            WHEN EXISTS (SELECT 1 FROM marke_mitarbeiter mm WHERE mm.marke_id = k.marke_id AND mm.mitarbeiter_id = b.id) THEN 'marke'
            WHEN EXISTS (SELECT 1 FROM mitarbeiter_unternehmen mu WHERE mu.unternehmen_id = k.unternehmen_id AND mu.mitarbeiter_id = b.id) THEN 'unternehmen'
          END
        ))
        FROM benutzer b
        WHERE b.rolle IN ('admin', 'mitarbeiter')
          AND (
            EXISTS (SELECT 1 FROM kampagne_mitarbeiter km WHERE km.kampagne_id = k.id AND km.mitarbeiter_id = b.id)
            OR (k.marke_id IS NOT NULL AND EXISTS (SELECT 1 FROM marke_mitarbeiter mm WHERE mm.marke_id = k.marke_id AND mm.mitarbeiter_id = b.id))
            OR (k.unternehmen_id IS NOT NULL AND EXISTS (SELECT 1 FROM mitarbeiter_unternehmen mu WHERE mu.unternehmen_id = k.unternehmen_id AND mu.mitarbeiter_id = b.id))
          )
      ), '[]'::jsonb),
      'ansprechpartner', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', ap.id,
          'vorname', ap.vorname,
          'nachname', ap.nachname,
          'email', ap.email,
          'profile_image_url', ap.profile_image_url
        ))
        FROM ansprechpartner_kampagne ak
        JOIN ansprechpartner ap ON ap.id = ak.ansprechpartner_id
        WHERE ak.kampagne_id = k.id
      ), '[]'::jsonb),
      '_budgetUsed', COALESCE((
        SELECT SUM(kv.verkaufspreis_netto)
        FROM kooperationen ko
        JOIN kooperation_videos kv ON kv.kooperation_id = ko.id
        WHERE ko.kampagne_id = k.id
      ), 0),
      '_budgetTotal', COALESCE(a.creator_budget, a.gesamt_budget, a.nettobetrag, 0)
    ) AS row_data
    FROM kampagne k
    LEFT JOIN unternehmen u ON u.id = k.unternehmen_id
    LEFT JOIN marke m ON m.id = k.marke_id
    LEFT JOIN auftrag a ON a.id = k.auftrag_id
    WHERE
      (p_search IS NULL OR p_search = '' OR k.kampagnenname ILIKE '%' || p_search || '%' OR k.eigener_name ILIKE '%' || p_search || '%' OR u.firmenname ILIKE '%' || p_search || '%' OR m.markenname ILIKE '%' || p_search || '%')
      AND (NOT p_filters ? 'unternehmen_id' OR k.unternehmen_id = (p_filters->>'unternehmen_id')::uuid)
      AND (NOT p_filters ? 'marke_id' OR k.marke_id = (p_filters->>'marke_id')::uuid)
      AND (NOT p_filters ? 'art_der_kampagne' OR k.art_der_kampagne && ARRAY(SELECT jsonb_array_elements_text(p_filters->'art_der_kampagne')))
      AND (NOT p_filters ? 'start_from' OR k.start >= (p_filters->>'start_from')::date)
      AND (NOT p_filters ? 'start_to' OR k.start <= (p_filters->>'start_to')::date)
      AND (NOT p_filters ? 'deadline_from' OR k.deadline_post_produktion >= (p_filters->>'deadline_from')::date)
      AND (NOT p_filters ? 'deadline_to' OR k.deadline_post_produktion <= (p_filters->>'deadline_to')::date)
      AND (NOT p_filters ? 'is_overdue' OR (p_filters->>'is_overdue')::boolean = false OR k.deadline_post_produktion < CURRENT_DATE)
      AND (NOT p_filters ? 'has_briefing' OR CASE WHEN (p_filters->>'has_briefing')::boolean THEN k.briefing_id IS NOT NULL ELSE k.briefing_id IS NULL END)
      AND (NOT p_filters ? 'hide_completed' OR (p_filters->>'hide_completed')::boolean = false OR NOT k.is_completed)
    ORDER BY k.created_at DESC
    OFFSET v_offset LIMIT p_limit
  ) sub;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'total_count', v_total
  );
END;
$function$;
