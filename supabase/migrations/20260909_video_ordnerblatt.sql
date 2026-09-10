-- Video-Ordnerblatt: eine Zeile pro Kampagne mit sichtbaren Kooperationsvideos.
-- SECURITY INVOKER: RLS auf kooperation_videos bleibt die Sichtbarkeits-Seam.

CREATE OR REPLACE FUNCTION public.get_video_ordnerblatt()
RETURNS TABLE (
  kampagne_id uuid,
  kampagnenname text,
  eigener_name text,
  unternehmen_id uuid,
  firmenname text,
  logo_url text,
  video_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    k.id AS kampagne_id,
    k.kampagnenname::text,
    k.eigener_name,
    u.id AS unternehmen_id,
    u.firmenname::text,
    u.logo_url,
    COUNT(kv.id)::bigint AS video_count
  FROM public.kooperation_videos kv
  JOIN public.kooperationen ko ON ko.id = kv.kooperation_id
  JOIN public.kampagne k ON k.id = ko.kampagne_id
  LEFT JOIN public.marke m ON m.id = k.marke_id
  LEFT JOIN public.unternehmen u ON u.id = COALESCE(m.unternehmen_id, k.unternehmen_id)
  GROUP BY k.id, k.kampagnenname, k.eigener_name, u.id, u.firmenname, u.logo_url
  HAVING u.id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_video_ordnerblatt() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_video_ordnerblatt() TO authenticated;

COMMENT ON FUNCTION public.get_video_ordnerblatt() IS
  'Video-Ordnerblatt: Kampagnen mit Video-Count. Unternehmen via Marke, sonst Kampagne.';
