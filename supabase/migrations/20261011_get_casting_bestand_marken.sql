-- Casting-Bestand (ADR 0048): Brands, TikTok-Link und Standard-Sortierung.
--
-- Gegenueber 20261010 (ADR 0046):
--   * `marken`: je Zeile die eindeutigen Marken der Kooperationen des Creators
--     (kooperationen -> kampagne.marke), neueste Kooperation zuerst. Mehrere
--     Produktionen derselben Marke ergeben eine Marke. Zeilen ohne Creator: [].
--   * `tiktok`: bei Zeilen ohne Creator der juengste link_tiktok der Eintraege
--     (bisher immer null).
--   * p_sort-Default ist `produktionen` (meistgebuchte zuerst).
--
-- Alles andere (Gruppierung, Zaehler, Filter) bleibt wie in 20261010.

CREATE OR REPLACE FUNCTION public.get_casting_bestand(
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 25,
  p_sort text DEFAULT 'produktionen',
  p_ascending boolean DEFAULT false,
  p_filters jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer := (GREATEST(p_page, 1) - 1) * GREATEST(p_limit, 1);
  v_has_casting_filter boolean;
  v_has_creator_filter boolean;
  v_result jsonb;
BEGIN
  v_has_casting_filter :=
    p_filters ? 'feedback' OR p_filters ? 'status' OR p_filters ? 'unternehmen_id'
    OR p_filters ? 'marke_id' OR p_filters ? 'art_der_kampagne';

  -- Alles ausser Casting-Filtern und der Namenssuche gehoert nur Creatorn.
  v_has_creator_filter :=
    (p_filters - ARRAY['feedback', 'status', 'unternehmen_id', 'marke_id', 'art_der_kampagne', 'name']::text[])
      <> '{}'::jsonb;

  WITH eintrag_roh AS (
    SELECT
      i.creator_id,
      i.creator_auswahl_id,
      i.created_at,
      i.name,
      nullif(lower(btrim(i.name)), '') AS name_key,
      public.casting_handle(i.link_instagram) AS handle,
      i.link_tiktok,
      i.profile_image_thumb_url,
      i.profile_image_url,
      i.follower_instagram,
      i.follower_tiktok,
      i.wohnort,
      CASE
        WHEN i.abgelehnt THEN 'abgelehnt'
        WHEN i.prio_1 THEN 'prio_1'
        WHEN i.prio_2 THEN 'prio_2'
      END AS feedback,
      CASE
        WHEN i.absage THEN 'absage'
        WHEN i.gebucht THEN 'gebucht'
        WHEN i.on_hold THEN 'on_hold'
        WHEN i.zusage THEN 'zusage'
        WHEN i.preis_zugesagt THEN 'preis_zugesagt'
        WHEN i.in_verhandlung THEN 'in_verhandlung'
        WHEN i.angefragt THEN 'angefragt'
        ELSE 'offen'
      END AS status,
      c.unternehmen_id,
      c.marke_id,
      k.art_der_kampagne
    FROM creator_auswahl_items i
    JOIN creator_auswahl c ON c.id = i.creator_auswahl_id
    LEFT JOIN kampagne k ON k.id = c.kampagne_id
  ),
  -- Handle -> Creator: creator.instagram gewinnt vor den Handles verknuepfter Eintraege.
  handle_map AS (
    SELECT q.handle, (array_agg(q.creator_id ORDER BY q.prio, q.creator_id::text))[1] AS creator_id
    FROM (
      SELECT public.casting_handle(cr.instagram) AS handle, cr.id AS creator_id, 0 AS prio
      FROM creator cr
      UNION ALL
      SELECT r.handle, r.creator_id, 1
      FROM eintrag_roh r
      WHERE r.creator_id IS NOT NULL
    ) q
    WHERE q.handle IS NOT NULL
    GROUP BY q.handle
  ),
  eintrag AS (
    SELECT
      r.*,
      COALESCE(r.creator_id, hm.creator_id) AS cid,
      CASE
        WHEN COALESCE(r.creator_id, hm.creator_id) IS NOT NULL
          THEN 'c:' || COALESCE(r.creator_id, hm.creator_id)::text
        WHEN r.handle IS NOT NULL THEN 'h:' || r.handle
        WHEN r.name_key IS NOT NULL THEN 'n:' || r.name_key
      END AS pk
    FROM eintrag_roh r
    LEFT JOIN handle_map hm ON hm.handle = r.handle
  ),
  agg AS (
    SELECT
      e.pk,
      (array_agg(e.cid) FILTER (WHERE e.cid IS NOT NULL))[1] AS creator_id,
      count(DISTINCT e.creator_auswahl_id) AS castings,
      count(DISTINCT e.creator_auswahl_id) FILTER (WHERE e.feedback = 'prio_1') AS prio_1,
      count(DISTINCT e.creator_auswahl_id) FILTER (WHERE e.feedback = 'prio_2') AS prio_2,
      count(DISTINCT e.creator_auswahl_id) FILTER (WHERE e.feedback = 'abgelehnt') AS abgelehnt,
      max(e.created_at) AS zuletzt,
      (array_agg(btrim(e.name) ORDER BY e.created_at DESC)
        FILTER (WHERE nullif(btrim(e.name), '') IS NOT NULL))[1] AS anzeige_name,
      (array_agg(e.handle ORDER BY e.created_at DESC)
        FILTER (WHERE e.handle IS NOT NULL))[1] AS handle,
      (array_agg(btrim(e.link_tiktok) ORDER BY e.created_at DESC)
        FILTER (WHERE nullif(btrim(e.link_tiktok), '') IS NOT NULL))[1] AS tiktok_link,
      (array_agg(e.profile_image_thumb_url ORDER BY e.created_at DESC)
        FILTER (WHERE e.profile_image_thumb_url IS NOT NULL))[1] AS bild_thumb,
      (array_agg(e.profile_image_url ORDER BY e.created_at DESC)
        FILTER (WHERE e.profile_image_url IS NOT NULL))[1] AS bild,
      (array_agg(e.follower_instagram ORDER BY e.created_at DESC)
        FILTER (WHERE e.follower_instagram IS NOT NULL))[1] AS follower_ig,
      (array_agg(e.follower_tiktok ORDER BY e.created_at DESC)
        FILTER (WHERE e.follower_tiktok IS NOT NULL))[1] AS follower_tt,
      (array_agg(btrim(e.wohnort) ORDER BY e.created_at DESC)
        FILTER (WHERE nullif(btrim(e.wohnort), '') IS NOT NULL))[1] AS stadt
    FROM eintrag e
    WHERE e.pk IS NOT NULL
    GROUP BY e.pk
  ),
  koop AS (
    SELECT creator_id, count(*) AS produktionen
    FROM kooperationen
    WHERE creator_id IS NOT NULL
    GROUP BY creator_id
  ),
  treffer AS (
    SELECT DISTINCT e.pk
    FROM eintrag e
    WHERE v_has_casting_filter
      AND e.pk IS NOT NULL
      AND (NOT p_filters ? 'feedback'
           OR e.feedback = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filters->'feedback'))))
      AND (NOT p_filters ? 'status'
           OR e.status = ANY (ARRAY(SELECT jsonb_array_elements_text(p_filters->'status'))))
      AND (NOT p_filters ? 'unternehmen_id'
           OR e.unternehmen_id = (p_filters->>'unternehmen_id')::uuid)
      AND (NOT p_filters ? 'marke_id'
           OR e.marke_id = (p_filters->>'marke_id')::uuid)
      AND (NOT p_filters ? 'art_der_kampagne'
           OR e.art_der_kampagne && ARRAY(SELECT jsonb_array_elements_text(p_filters->'art_der_kampagne')))
  ),
  basis_creator AS (
    SELECT
      cr.id,
      cr.vorname::text AS vorname,
      cr.nachname::text AS nachname,
      cr.instagram::text AS instagram,
      cr.instagram_follower::bigint AS instagram_follower,
      cr.tiktok::text AS tiktok,
      cr.tiktok_follower::bigint AS tiktok_follower,
      cr.lieferadresse_stadt::text AS lieferadresse_stadt,
      cr.profilbild_url::text AS profilbild_url,
      cr.profilbild_thumb_url::text AS profilbild_thumb_url,
      true AS hat_creator,
      a.pk, a.castings, a.prio_1, a.prio_2, a.abgelehnt, a.zuletzt,
      COALESCE(ko.produktionen, 0) AS produktionen
    FROM agg a
    JOIN creator cr ON cr.id = a.creator_id
    LEFT JOIN koop ko ON ko.creator_id = a.creator_id
    WHERE (NOT v_has_casting_filter OR a.pk IN (SELECT pk FROM treffer))
      AND (NOT p_filters ? 'name' OR
           concat_ws(' ', cr.vorname, cr.nachname, cr.instagram, cr.tiktok, cr.mail)
             ILIKE '%' || (p_filters->>'name') || '%')
      AND (NOT p_filters ? 'creator_type_id' OR EXISTS (
            SELECT 1 FROM creator_creator_type x
            WHERE x.creator_id = cr.id AND x.creator_type_id = (p_filters->>'creator_type_id')::uuid))
      AND (NOT p_filters ? 'sprache_id' OR EXISTS (
            SELECT 1 FROM creator_sprachen x
            WHERE x.creator_id = cr.id AND x.sprache_id = (p_filters->>'sprache_id')::uuid))
      AND (NOT p_filters ? 'branche_id' OR EXISTS (
            SELECT 1 FROM creator_branchen x
            WHERE x.creator_id = cr.id AND x.branche_id = (p_filters->>'branche_id')::uuid))
      AND (NOT p_filters ? 'management_id' OR EXISTS (
            SELECT 1 FROM creator_management x
            WHERE x.creator_id = cr.id AND x.ist_aktiv
              AND x.management_id = (p_filters->>'management_id')::uuid))
      AND (NOT p_filters ? 'firma_id' OR EXISTS (
            SELECT 1 FROM creator_firma x
            WHERE x.creator_id = cr.id AND x.ist_aktiv
              AND x.firma_id = (p_filters->>'firma_id')::uuid))
      AND (NOT p_filters ? 'geschlecht' OR cr.geschlecht = p_filters->>'geschlecht')
      -- Alter: Spanne des Creators (alter_min/alter_max, Fallback alter_jahre) ueberlappt die Filterspanne
      AND (NOT p_filters ? 'alter_min'
           OR COALESCE(cr.alter_max, cr.alter_jahre, cr.alter_min) >= (p_filters->>'alter_min')::integer)
      AND (NOT p_filters ? 'alter_max'
           OR COALESCE(cr.alter_min, cr.alter_jahre, cr.alter_max) <= (p_filters->>'alter_max')::integer)
      AND (NOT p_filters ? 'instagram_follower_min'
           OR cr.instagram_follower >= (p_filters->>'instagram_follower_min')::bigint)
      AND (NOT p_filters ? 'instagram_follower_max'
           OR cr.instagram_follower <= (p_filters->>'instagram_follower_max')::bigint)
      AND (NOT p_filters ? 'tiktok_follower_min'
           OR cr.tiktok_follower >= (p_filters->>'tiktok_follower_min')::bigint)
      AND (NOT p_filters ? 'tiktok_follower_max'
           OR cr.tiktok_follower <= (p_filters->>'tiktok_follower_max')::bigint)
      AND (NOT p_filters ? 'lieferadresse_stadt'
           OR cr.lieferadresse_stadt ILIKE '%' || (p_filters->>'lieferadresse_stadt') || '%')
      AND (NOT p_filters ? 'lieferadresse_plz'
           OR cr.lieferadresse_plz ILIKE '%' || (p_filters->>'lieferadresse_plz') || '%')
      AND (NOT p_filters ? 'lieferadresse_land'
           OR cr.lieferadresse_land = p_filters->>'lieferadresse_land')
      AND (NOT p_filters ? 'has_email'
           OR (COALESCE(btrim(cr.mail), '') <> '') = (p_filters->>'has_email')::boolean)
      AND (NOT p_filters ? 'has_phone'
           OR (COALESCE(btrim(cr.telefonnummer), '') <> '') = (p_filters->>'has_phone')::boolean)
      AND (NOT p_filters ? 'has_portfolio'
           OR (COALESCE(btrim(cr.portfolio_link), '') <> '') = (p_filters->>'has_portfolio')::boolean)
      AND (NOT p_filters ? 'has_instagram'
           OR (COALESCE(btrim(cr.instagram), '') <> '') = (p_filters->>'has_instagram')::boolean)
      AND (NOT p_filters ? 'has_tiktok'
           OR (COALESCE(btrim(cr.tiktok), '') <> '') = (p_filters->>'has_tiktok')::boolean)
      AND (NOT p_filters ? 'hat_haustier'
           OR COALESCE(cr.hat_haustier, false) = (p_filters->>'hat_haustier')::boolean)
      AND (NOT p_filters ? 'hat_kinder'
           OR COALESCE(cr.hat_kinder, false) = (p_filters->>'hat_kinder')::boolean)
      AND (NOT p_filters ? 'spielt_instrument'
           OR COALESCE(cr.spielt_instrument, false) = (p_filters->>'spielt_instrument')::boolean)
      AND (NOT p_filters ? 'created_from' OR cr.created_at >= (p_filters->>'created_from')::date)
      AND (NOT p_filters ? 'created_to' OR cr.created_at < (p_filters->>'created_to')::date + 1)
      AND (NOT p_filters ? 'updated_from' OR cr.updated_at >= (p_filters->>'updated_from')::date)
      AND (NOT p_filters ? 'updated_to' OR cr.updated_at < (p_filters->>'updated_to')::date + 1)
  ),
  basis_ohne_creator AS (
    SELECT
      NULL::uuid AS id,
      CASE WHEN a.anzeige_name ~ ' ' THEN btrim(regexp_replace(a.anzeige_name, '\s*[^ ]+$', ''))
           ELSE NULL END AS vorname,
      CASE WHEN a.anzeige_name ~ ' ' THEN substring(a.anzeige_name from '[^ ]+$')
           ELSE COALESCE(a.anzeige_name, a.handle) END AS nachname,
      a.handle AS instagram,
      a.follower_ig::bigint AS instagram_follower,
      a.tiktok_link::text AS tiktok,
      a.follower_tt::bigint AS tiktok_follower,
      a.stadt AS lieferadresse_stadt,
      a.bild AS profilbild_url,
      a.bild_thumb AS profilbild_thumb_url,
      false AS hat_creator,
      a.pk, a.castings, a.prio_1, a.prio_2, a.abgelehnt, a.zuletzt,
      0::bigint AS produktionen
    FROM agg a
    WHERE a.creator_id IS NULL
      AND NOT v_has_creator_filter
      AND (NOT v_has_casting_filter OR a.pk IN (SELECT pk FROM treffer))
      AND (NOT p_filters ? 'name' OR
           concat_ws(' ', a.anzeige_name, a.handle)
             ILIKE '%' || (p_filters->>'name') || '%')
  ),
  basis AS (
    SELECT * FROM basis_creator
    UNION ALL
    SELECT * FROM basis_ohne_creator
  ),
  rangiert AS (
    SELECT
      b.*,
      count(*) OVER () AS total,
      row_number() OVER (
        ORDER BY
          CASE WHEN p_sort = 'name' AND p_ascending THEN lower(b.nachname) END ASC NULLS LAST,
          CASE WHEN p_sort = 'name' AND p_ascending THEN lower(b.vorname) END ASC NULLS LAST,
          CASE WHEN p_sort = 'name' AND NOT p_ascending THEN lower(b.nachname) END DESC NULLS LAST,
          CASE WHEN p_sort = 'name' AND NOT p_ascending THEN lower(b.vorname) END DESC NULLS LAST,
          CASE p_sort
            WHEN 'castings' THEN b.castings
            WHEN 'prio_1' THEN b.prio_1
            WHEN 'prio_2' THEN b.prio_2
            WHEN 'abgelehnt' THEN b.abgelehnt
            WHEN 'produktionen' THEN b.produktionen
          END * CASE WHEN p_ascending THEN 1 ELSE -1 END ASC NULLS LAST,
          -- 'zuletzt' sortiert nach Richtung, bei Zaehlern dient es als fester Tiebreaker (neueste zuerst)
          CASE WHEN p_sort NOT IN ('name', 'castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen')
                    AND p_ascending THEN b.zuletzt END ASC NULLS LAST,
          CASE WHEN p_sort NOT IN ('name', 'castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen')
                    AND NOT p_ascending THEN b.zuletzt END DESC NULLS LAST,
          CASE WHEN p_sort IN ('castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen')
               THEN b.zuletzt END DESC NULLS LAST,
          CASE WHEN p_sort IN ('castings', 'prio_1', 'prio_2', 'abgelehnt', 'produktionen')
               THEN lower(b.nachname) END ASC NULLS LAST,
          b.pk
      ) AS rn
    FROM basis b
  ),
  seite AS (
    SELECT * FROM rangiert
    ORDER BY rn
    OFFSET v_offset
    LIMIT GREATEST(p_limit, 1)
  )
  SELECT jsonb_build_object(
    'rows', COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'hat_creator', s.hat_creator,
          'vorname', s.vorname,
          'nachname', s.nachname,
          'instagram', s.instagram,
          'instagram_follower', s.instagram_follower,
          'tiktok', s.tiktok,
          'tiktok_follower', s.tiktok_follower,
          'lieferadresse_stadt', s.lieferadresse_stadt,
          'profilbild_url', s.profilbild_url,
          'profilbild_thumb_url', s.profilbild_thumb_url,
          'creator_types', (
            SELECT COALESCE(jsonb_agg(t.name ORDER BY t.name), '[]'::jsonb)
            FROM creator_creator_type cct
            JOIN creator_type t ON t.id = cct.creator_type_id
            WHERE cct.creator_id = s.id
          ),
          'branchen', (
            SELECT COALESCE(jsonb_agg(br.name ORDER BY br.name), '[]'::jsonb)
            FROM creator_branchen cb
            JOIN branchen_creator br ON br.id = cb.branche_id
            WHERE cb.creator_id = s.id
          ),
          'marken', (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', mk.id,
                  'markenname', mk.markenname,
                  'logo_url', mk.logo_url,
                  'logo_thumb_url', mk.logo_thumb_url
                ) ORDER BY mk.zuletzt DESC, mk.markenname
              ),
              '[]'::jsonb
            )
            FROM (
              SELECT m.id, m.markenname, m.logo_url, m.logo_thumb_url, max(ko.created_at) AS zuletzt
              FROM kooperationen ko
              JOIN kampagne k ON k.id = ko.kampagne_id
              JOIN marke m ON m.id = k.marke_id
              WHERE ko.creator_id = s.id
              GROUP BY m.id, m.markenname, m.logo_url, m.logo_thumb_url
            ) mk
          ),
          'castings', s.castings,
          'prio_1', s.prio_1,
          'prio_2', s.prio_2,
          'abgelehnt', s.abgelehnt,
          'produktionen', s.produktionen,
          'zuletzt', s.zuletzt
        )
        ORDER BY s.rn
      ),
      '[]'::jsonb
    ),
    'total_count', COALESCE(max(s.total), 0)
  )
  INTO v_result
  FROM seite s;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.get_casting_bestand(integer, integer, text, boolean, jsonb) IS
  'Casting-Bestand (ADR 0046, 0048): eine Zeile pro Person auf einem Casting, auch ohne Creator-Datensatz (hat_creator = false, id = null; gruppiert ueber Instagram-Handle, sonst Name). Zaehler ueber die ganze Historie, Casting-Filter treffen denselben Eintrag.';

GRANT EXECUTE ON FUNCTION public.get_casting_bestand(integer, integer, text, boolean, jsonb) TO authenticated;
