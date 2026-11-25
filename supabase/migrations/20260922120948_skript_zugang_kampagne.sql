-- Skript-Zugang: ein Skript oder alle Skripte derselben Kampagne.
-- Bestehende Skript-Zugänge mit Kampagne werden auf 'kampagne' erweitert.
-- Dieselben Codes bleiben gültig. share_claim_has_access bleibt exakt
-- (Kampagne, Casting, Konzept). Nur can_gast_access_skript wird weiter.

ALTER TABLE public.list_shares
  ADD COLUMN IF NOT EXISTS skript_scope text NOT NULL DEFAULT 'einzeln';

ALTER TABLE public.list_shares
  DROP CONSTRAINT IF EXISTS list_shares_skript_scope_check;

ALTER TABLE public.list_shares
  ADD CONSTRAINT list_shares_skript_scope_check
  CHECK (skript_scope IN ('einzeln', 'kampagne'));

UPDATE public.list_shares ls
SET skript_scope = 'kampagne'
FROM public.skripte s
WHERE ls.entity_type = 'skript'
  AND ls.entity_id = s.id
  AND s.kampagne_id IS NOT NULL
  AND ls.revoked_at IS NULL;

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
  );
$$;

CREATE OR REPLACE FUNCTION public.gast_can_see_unternehmen(p_unternehmen_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM kampagne k
      WHERE k.unternehmen_id = p_unternehmen_id
        AND gast_has_share('kampagne', k.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM creator_auswahl ca
      WHERE ca.unternehmen_id = p_unternehmen_id
        AND gast_has_share('sourcing', ca.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM strategie s
      WHERE s.unternehmen_id = p_unternehmen_id
        AND gast_has_share('strategie', s.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM skripte sk
      WHERE sk.unternehmen_id = p_unternehmen_id
        AND can_gast_access_skript(sk.id, false)
    );
$$;

CREATE OR REPLACE FUNCTION public.gast_can_see_marke(p_marke_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM kampagne k
      WHERE k.marke_id = p_marke_id
        AND gast_has_share('kampagne', k.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM creator_auswahl ca
      WHERE ca.marke_id = p_marke_id
        AND gast_has_share('sourcing', ca.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM strategie s
      WHERE s.marke_id = p_marke_id
        AND gast_has_share('strategie', s.id, false)
    )
    OR EXISTS (
      SELECT 1 FROM skripte sk
      WHERE sk.marke_id = p_marke_id
        AND can_gast_access_skript(sk.id, false)
    );
$$;
