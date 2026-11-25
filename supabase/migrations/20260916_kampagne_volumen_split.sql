begin;

alter table public.kampagne
  add column if not exists volumen numeric,
  add column if not exists creator_budget numeric;

alter table public.kampagne
  drop constraint if exists kampagne_volumen_nonnegative;
alter table public.kampagne
  add constraint kampagne_volumen_nonnegative
  check (volumen is null or volumen >= 0);

alter table public.kampagne
  drop constraint if exists kampagne_creator_budget_nonnegative;
alter table public.kampagne
  add constraint kampagne_creator_budget_nonnegative
  check (creator_budget is null or creator_budget >= 0);

-- Liste: Kampagnen-Slice statt volles Auftragsbudget
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
      '_budgetTotal', COALESCE(k.creator_budget, k.volumen, a.creator_budget, a.gesamt_budget, a.nettobetrag, 0)
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

commit;
