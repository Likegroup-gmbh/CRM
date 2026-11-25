-- Mitarbeiter-Vorschau eines Zugangs (share-list Action preview): Gast-JWT mit Claim
-- vorschau = true, 1 Stunde gültig. Sie sieht genau, was der Gast sieht, schreibt aber nie,
-- auch nicht bei rechte = 'feedback'.
--
-- Alle Gast-Schreibwege laufen über share_claim_has_access (direkt oder über gast_has_share,
-- gast_can_access_video, gast_can_access_kooperation) oder can_gast_access_skript. Nur deren
-- Schreibzweig ändert sich; Lesen bleibt gleich.
--
-- Rein additiv: Normale Gast-JWTs tragen den Claim nicht, für sie ändert sich nichts.
--
-- ROLLBACK: share_claim_has_access aus 20260906_listen_sharing_zugaenge.sql und
-- can_gast_access_skript aus 20261206_skript_paket_alle_status.sql erneut einspielen,
-- danach DROP FUNCTION public.share_claim_ist_vorschau().

CREATE OR REPLACE FUNCTION public.share_claim_ist_vorschau()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(auth.jwt() ->> 'vorschau', '') = 'true';
$$;

CREATE OR REPLACE FUNCTION public.share_claim_has_access(
  p_entity_type text,
  p_entity_id uuid,
  p_write boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM list_shares ls
    WHERE ls.id::text = NULLIF(auth.jwt() ->> 'share_id', '')
      AND ls.entity_type = p_entity_type
      AND ls.entity_id = p_entity_id
      AND ls.revoked_at IS NULL
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
      AND (
        NOT ls.ends_with_kampagne
        OR share_resolved_kampagne_id(ls.entity_type, ls.entity_id) IS NULL
        OR NOT kampagne_is_completed(share_resolved_kampagne_id(ls.entity_type, ls.entity_id))
      )
      AND (NOT p_write OR (ls.rechte = 'feedback' AND NOT share_claim_ist_vorschau()))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_gast_access_skript(
  p_skript_id uuid,
  p_write boolean DEFAULT false
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM list_shares ls
    JOIN skripte target ON target.id = p_skript_id
    LEFT JOIN skripte shared ON shared.id = ls.entity_id
    WHERE ls.id::text = NULLIF(auth.jwt() ->> 'share_id', '')
      AND ls.entity_type = 'skript'
      AND ls.revoked_at IS NULL
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
      AND (
        NOT ls.ends_with_kampagne
        OR share_resolved_kampagne_id(ls.entity_type, ls.entity_id) IS NULL
        OR NOT kampagne_is_completed(share_resolved_kampagne_id(ls.entity_type, ls.entity_id))
      )
      AND (NOT p_write OR (ls.rechte = 'feedback' AND NOT share_claim_ist_vorschau()))
      AND (
        ls.entity_id = p_skript_id
        OR (
          ls.skript_scope = 'kampagne'
          AND shared.kampagne_id IS NOT NULL
          AND shared.kampagne_id = target.kampagne_id
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM list_shares ls
    JOIN skript_paket_eintraege e ON e.paket_id = ls.entity_id AND e.skript_id = p_skript_id
    WHERE ls.id::text = NULLIF(auth.jwt() ->> 'share_id', '')
      AND ls.entity_type = 'skript_paket'
      AND ls.revoked_at IS NULL
      AND (ls.expires_at IS NULL OR ls.expires_at > now())
      AND (
        NOT ls.ends_with_kampagne
        OR share_resolved_kampagne_id(ls.entity_type, ls.entity_id) IS NULL
        OR NOT kampagne_is_completed(share_resolved_kampagne_id(ls.entity_type, ls.entity_id))
      )
      AND (NOT p_write OR (ls.rechte = 'feedback' AND NOT share_claim_ist_vorschau()))
  );
$$;

GRANT EXECUTE ON FUNCTION public.share_claim_ist_vorschau() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.share_claim_has_access(text, uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_gast_access_skript(uuid, boolean) TO anon, authenticated, service_role;
