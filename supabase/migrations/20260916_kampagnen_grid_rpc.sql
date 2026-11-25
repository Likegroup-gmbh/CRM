-- Schlanker Counts-RPC für das Kampagnen-Ordnerblatt (nur CRM-v2).
-- Nicht auf die shared Prod-DB anwenden, solange v1 dort mitläuft.
-- Drei Ebenen: Unternehmen → Marken → Kampagnen. Kein SECURITY DEFINER — RLS bleibt Wahrheit.

CREATE OR REPLACE FUNCTION public.get_kampagnen_grid(
  p_unternehmen_id uuid DEFAULT NULL,
  p_marke_id uuid DEFAULT NULL,
  p_ohne_marke boolean DEFAULT false,
  p_hide_completed boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_completed_ok boolean := NOT COALESCE(p_hide_completed, true);
BEGIN
  -- Companies: p_unternehmen_id fehlt
  IF p_unternehmen_id IS NULL THEN
    RETURN jsonb_build_object(
      'ebene', 'companies',
      'unternehmen', COALESCE((
        SELECT jsonb_agg(row_data ORDER BY row_data->>'firmenname')
        FROM (
          SELECT jsonb_build_object(
            'id', u.id,
            'firmenname', u.firmenname,
            'internes_kuerzel', u.internes_kuerzel,
            'logo_url', u.logo_url,
            'count', COUNT(k.id)
          ) AS row_data
          FROM kampagne k
          JOIN unternehmen u ON u.id = k.unternehmen_id
          WHERE v_completed_ok OR NOT k.is_completed
          GROUP BY u.id, u.firmenname, u.internes_kuerzel, u.logo_url
        ) sub
      ), '[]'::jsonb)
    );
  END IF;

  -- Items: Marke gesetzt oder virtueller „Nur Unternehmen“-Ordner
  IF p_ohne_marke OR p_marke_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ebene', 'items',
      'kampagnen', COALESCE((
        SELECT jsonb_agg(row_data ORDER BY row_data->>'created_at' DESC)
        FROM (
          SELECT jsonb_build_object(
            'id', k.id,
            'kampagnenname', k.kampagnenname,
            'eigener_name', k.eigener_name,
            'start', k.start,
            'deadline_post_produktion', k.deadline_post_produktion,
            'volumen', k.volumen,
            'creatoranzahl', k.creatoranzahl,
            'videoanzahl', k.videoanzahl,
            'is_completed', k.is_completed,
            'created_at', k.created_at,
            'auftrag', CASE
              WHEN a.id IS NOT NULL THEN jsonb_build_object(
                'id', a.id,
                'auftragsname', a.auftragsname
              )
              ELSE NULL
            END
          ) AS row_data
          FROM kampagne k
          LEFT JOIN auftrag a ON a.id = k.auftrag_id
          WHERE k.unternehmen_id = p_unternehmen_id
            AND (v_completed_ok OR NOT k.is_completed)
            AND (
              CASE
                WHEN p_ohne_marke THEN k.marke_id IS NULL
                ELSE k.marke_id = p_marke_id
              END
            )
          ORDER BY k.created_at DESC
        ) sub
      ), '[]'::jsonb)
    );
  END IF;

  -- Brands: Unternehmen gesetzt, keine Marke
  RETURN jsonb_build_object(
    'ebene', 'brands',
    'marken', COALESCE((
      SELECT jsonb_agg(row_data ORDER BY row_data->>'markenname')
      FROM (
        SELECT jsonb_build_object(
          'id', m.id,
          'markenname', m.markenname,
          'logo_url', m.logo_url,
          'count', COUNT(k.id)
        ) AS row_data
        FROM kampagne k
        JOIN marke m ON m.id = k.marke_id
        WHERE k.unternehmen_id = p_unternehmen_id
          AND (v_completed_ok OR NOT k.is_completed)
        GROUP BY m.id, m.markenname, m.logo_url
      ) sub
    ), '[]'::jsonb),
    'ohne_marke_count', COALESCE((
      SELECT COUNT(*)::int
      FROM kampagne k
      WHERE k.unternehmen_id = p_unternehmen_id
        AND k.marke_id IS NULL
        AND (v_completed_ok OR NOT k.is_completed)
    ), 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_kampagnen_grid(uuid, uuid, boolean, boolean)
  TO anon, authenticated, service_role;
