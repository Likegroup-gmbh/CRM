-- Skript-Pakete enthalten Skripte in jedem Status, nicht nur 'freigegeben'.
-- Kunden geben am Paket Feedback und geben finale Skripte frei; ein Statuswechsel
-- darf ein Skript deshalb nicht mehr aus dem Paket werfen.
--
-- ROLLBACK: 20261016_skript_paket_sharing.sql (Trigger skript_paket_status und
-- can_gast_access_skript mit s.status = 'freigegeben') erneut einspielen.

DROP TRIGGER IF EXISTS skript_paket_status ON public.skripte;
DROP FUNCTION IF EXISTS public.skript_paket_bei_status();

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
      AND (NOT p_write OR ls.rechte = 'feedback')
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
      AND (NOT p_write OR ls.rechte = 'feedback')
  );
$$;
