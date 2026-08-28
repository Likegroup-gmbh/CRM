-- Listen-Sharing: Zugänge statt Gast-Accounts
-- Token + 6-stelliger Code + Name. Kein auth.users / benutzer für Gäste.
-- Gast-JWT (role=anon, Claim share_id) steuert RLS über share_claim_has_access.
-- Bestehende *_gast_* Policies bleiben; nur die Helper-Rümpfe ändern sich.

-- =====================================================================
-- 0) Cutover: Feedback von Gast-Autoren von benutzer-FK lösen
-- =====================================================================

UPDATE public.kooperation_video_comment c
SET author_benutzer_id = NULL
FROM public.benutzer b
WHERE c.author_benutzer_id = b.id
  AND (b.rolle = 'gast' OR b.id = '157e1d2c-36b1-4a7d-ba66-b391d8a59e6f');

UPDATE public.kooperation_still_comment c
SET author_benutzer_id = NULL
FROM public.benutzer b
WHERE c.author_benutzer_id = b.id
  AND (b.rolle = 'gast' OR b.id = '157e1d2c-36b1-4a7d-ba66-b391d8a59e6f');

UPDATE public.kooperation_video_comment c
SET deleted_by_benutzer_id = NULL
FROM public.benutzer b
WHERE c.deleted_by_benutzer_id = b.id
  AND (b.rolle = 'gast' OR b.id = '157e1d2c-36b1-4a7d-ba66-b391d8a59e6f');

UPDATE public.kooperation_still_comment c
SET deleted_by_benutzer_id = NULL
FROM public.benutzer b
WHERE c.deleted_by_benutzer_id = b.id
  AND (b.rolle = 'gast' OR b.id = '157e1d2c-36b1-4a7d-ba66-b391d8a59e6f');

-- =====================================================================
-- 1) list_shares umbauen
-- =====================================================================

ALTER TABLE public.list_shares
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS code_hash text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_with_kampagne boolean NOT NULL DEFAULT false;

UPDATE public.list_shares
SET
  label = COALESCE(NULLIF(label, ''), email, 'Zugang'),
  code_hash = COALESCE(code_hash, 'revoked'),
  revoked_at = COALESCE(revoked_at, now());

ALTER TABLE public.list_shares
  ALTER COLUMN label SET DEFAULT 'Zugang',
  ALTER COLUMN code_hash SET NOT NULL;

DROP INDEX IF EXISTS public.uq_list_shares_active;
DROP INDEX IF EXISTS public.idx_list_shares_gast;

DROP POLICY IF EXISTS list_shares_select ON public.list_shares;

ALTER TABLE public.list_shares
  DROP CONSTRAINT IF EXISTS list_shares_gast_benutzer_id_fkey;

ALTER TABLE public.list_shares
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS gast_benutzer_id;

-- =====================================================================
-- 2) Teilnehmer + Verify-Rate-Limit
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.share_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.list_shares(id) ON DELETE CASCADE,
  name text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_share_participants_name
  ON public.share_participants (share_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_share_participants_share
  ON public.share_participants (share_id);

ALTER TABLE public.share_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS share_participants_select ON public.share_participants;
CREATE POLICY share_participants_select ON public.share_participants
  FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));

CREATE TABLE IF NOT EXISTS public.share_verify_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.list_shares(id) ON DELETE CASCADE,
  ip text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_verify_attempts_window
  ON public.share_verify_attempts (share_id, attempted_at);

ALTER TABLE public.share_verify_attempts ENABLE ROW LEVEL SECURITY;
-- Keine Policies: nur Service Role (Edge Function) schreibt/liest.

-- list_shares SELECT: nur Staff (Gäste kommen über JWT-Claim, nicht über diese Tabelle)
DROP POLICY IF EXISTS list_shares_select ON public.list_shares;
CREATE POLICY list_shares_select ON public.list_shares
  FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));

-- =====================================================================
-- 3) RLS-Helper: Claim statt auth.uid()
-- =====================================================================

CREATE OR REPLACE FUNCTION public.current_role_is_gast()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(auth.jwt() ->> 'share_id', '') <> '';
$$;

CREATE OR REPLACE FUNCTION public.share_resolved_kampagne_id(p_entity_type text, p_entity_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE p_entity_type
    WHEN 'kampagne' THEN p_entity_id
    WHEN 'sourcing' THEN (SELECT kampagne_id FROM creator_auswahl WHERE id = p_entity_id)
    WHEN 'strategie' THEN (SELECT kampagne_id FROM strategie WHERE id = p_entity_id)
    ELSE NULL
  END;
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
      AND (NOT p_write OR ls.rechte = 'feedback')
  );
$$;

-- Bestehende Policies rufen gast_has_share auf — Rumpf umbiegen, Policies bleiben.
CREATE OR REPLACE FUNCTION public.gast_has_share(
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
  SELECT share_claim_has_access(p_entity_type, p_entity_id, p_write);
$$;

DROP FUNCTION IF EXISTS public.touch_list_share(text);

GRANT EXECUTE ON FUNCTION public.current_role_is_gast() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.share_resolved_kampagne_id(text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.share_claim_has_access(text, uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gast_has_share(text, uuid, boolean) TO anon, authenticated, service_role;

-- =====================================================================
-- 4) Gast-benutzer + Auth-User entfernen
-- =====================================================================

DO $$
DECLARE
  v_ids uuid[];
  v_auth_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]),
         COALESCE(array_agg(auth_user_id) FILTER (WHERE auth_user_id IS NOT NULL), ARRAY[]::uuid[])
    INTO v_ids, v_auth_ids
  FROM public.benutzer
  WHERE rolle = 'gast'
     OR id = '157e1d2c-36b1-4a7d-ba66-b391d8a59e6f';

  IF cardinality(v_ids) > 0 THEN
    DELETE FROM public.benutzer WHERE id = ANY (v_ids);
  END IF;

  IF cardinality(v_auth_ids) > 0 THEN
    DELETE FROM auth.users WHERE id = ANY (v_auth_ids);
  END IF;
END $$;
