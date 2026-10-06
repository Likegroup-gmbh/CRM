-- Casting-Bestand (ADR 0044): eine Zeile pro Creator mit mindestens einem
-- Casting-Eintrag, der eine Stammdaten-Identitaet (creator_id) hat.
--
-- Zaehler (Castings, Prio 1, Prio 2, Abgelehnt) und "Zuletzt" zaehlen immer die
-- ganze Historie. Casting-Filter (Feedback, Status, Kunde, Marke, Kampagnenart)
-- entscheiden nur, wer in der Liste steht, und muessen von demselben Eintrag
-- gemeinsam erfuellt werden. Innerhalb eines Filters gilt oder.
--
-- Feedback und Status werden wie in sourcingStatusOptions.js abgeleitet:
--   Feedback: abgelehnt > prio_1 > prio_2
--   Status:   absage > gebucht > on_hold > zusage > preis_zugesagt
--             > in_verhandlung > angefragt, sonst offen
--
-- p_filters (jsonb), alle Schluessel optional:
--   Casting:  feedback[], status[], unternehmen_id, marke_id, art_der_kampagne[]
--   Creator:  name, creator_type_id, sprache_id, branche_id, management_id,
--             firma_id, geschlecht, alter_min, alter_max,
--             instagram_follower_min/max, tiktok_follower_min/max,
--             lieferadresse_stadt, lieferadresse_plz, lieferadresse_land,
--             has_email, has_phone, has_portfolio, has_instagram, has_tiktok,
--             hat_haustier, hat_kinder, spielt_instrument,
--             created_from/created_to, updated_from/updated_to
-- p_sort: 'zuletzt' (Default) | 'name'

CREATE OR REPLACE FUNCTION public.get_casting_bestand(
  p_page integer DEFAULT 1,
  p_limit integer DEFAULT 25,
  p_sort text DEFAULT 'zuletzt',
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
  v_result jsonb;
BEGIN
  v_has_casting_filter :=
    p_filters ? 'feedback' OR p_filters ? 'status' OR p_filters ? 'unternehmen_id'
    OR p_filters ? 'marke_id' OR p_filters ? 'art_der_kampagne';

  WITH eintrag AS (
    SELECT
      i.creator_id,
      i.creator_auswahl_id,
      i.created_at,
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
    WHERE i.creator_id IS NOT NULL
  ),
  agg AS (
    SELECT
      creator_id,
      count(DISTINCT creator_auswahl_id) AS castings,
      count(DISTINCT creator_auswahl_id) FILTER (WHERE feedback = 'prio_1') AS prio_1,
      count(DISTINCT creator_auswahl_id) FILTER (WHERE feedback = 'prio_2') AS prio_2,
      count(DISTINCT creator_auswahl_id) FILTER (WHERE feedback = 'abgelehnt') AS abgelehnt,
      max(created_at) AS zuletzt
    FROM eintrag
    GROUP BY creator_id
  ),
  treffer AS (
    SELECT DISTINCT e.creator_id
    FROM eintrag e
    WHERE v_has_casting_filter
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
  basis AS (
    SELECT cr.*, a.castings, a.prio_1, a.prio_2, a.abgelehnt, a.zuletzt
    FROM agg a
    JOIN creator cr ON cr.id = a.creator_id
    WHERE (NOT v_has_casting_filter OR a.creator_id IN (SELECT creator_id FROM treffer))
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
          CASE WHEN p_sort <> 'name' AND p_ascending THEN b.zuletzt END ASC NULLS LAST,
          CASE WHEN p_sort <> 'name' AND NOT p_ascending THEN b.zuletzt END DESC NULLS LAST,
          b.id
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
          'castings', s.castings,
          'prio_1', s.prio_1,
          'prio_2', s.prio_2,
          'abgelehnt', s.abgelehnt,
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
  'Casting-Bestand (ADR 0044): Creator mit Casting-Eintrag, Zaehler ueber die ganze Historie, Casting-Filter treffen denselben Eintrag.';
