-- Ein Zugang pro Creator und Kampagne.
-- Mitgliedschaft liegt in skript_paket_eintraege. Fällt der Status von
-- 'freigegeben' weg, fliegt die Zeile raus. Der Zugang selbst bleibt.

ALTER TABLE public.list_shares
  ADD COLUMN IF NOT EXISTS empfaenger_emails text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.list_shares
  DROP CONSTRAINT IF EXISTS list_shares_entity_type_check;
ALTER TABLE public.list_shares
  ADD CONSTRAINT list_shares_entity_type_check
  CHECK (entity_type IN ('kampagne', 'sourcing', 'strategie', 'skript', 'skript_paket'));

CREATE TABLE IF NOT EXISTS public.skript_pakete (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kampagne_id uuid NOT NULL REFERENCES public.kampagne(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.creator(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kampagne_id, creator_id)
);

CREATE TABLE IF NOT EXISTS public.skript_paket_eintraege (
  paket_id uuid NOT NULL REFERENCES public.skript_pakete(id) ON DELETE CASCADE,
  skript_id uuid NOT NULL REFERENCES public.skripte(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (paket_id, skript_id)
);

CREATE INDEX IF NOT EXISTS idx_skript_paket_eintraege_skript
  ON public.skript_paket_eintraege (skript_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_list_shares_active_skript_paket
  ON public.list_shares (entity_id)
  WHERE entity_type = 'skript_paket' AND revoked_at IS NULL;

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
    WHEN 'skript' THEN (SELECT kampagne_id FROM skripte WHERE id = p_entity_id)
    WHEN 'skript_paket' THEN (SELECT kampagne_id FROM skript_pakete WHERE id = p_entity_id)
    ELSE NULL
  END;
$$;

-- Bestehende Einzel- und Kampagnen-Zugänge bleiben. Dazu die Mitgliedschaft
-- eines Skript-Pakets, solange das Skript freigegeben ist.
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
    JOIN skripte s ON s.id = p_skript_id
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
      AND s.status = 'freigegeben'
  );
$$;

CREATE OR REPLACE FUNCTION public.skript_paket_bei_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'freigegeben' THEN
    DELETE FROM public.skript_paket_eintraege WHERE skript_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS skript_paket_status ON public.skripte;
CREATE TRIGGER skript_paket_status
  AFTER UPDATE OF status ON public.skripte
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.skript_paket_bei_status();

CREATE OR REPLACE FUNCTION public.wechsle_skript_version_gast(
  p_skript_id uuid,
  p_version_nr integer,
  p_sub_nr integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v public.skript_versionen%ROWTYPE;
BEGIN
  IF (SELECT can_gast_access_skript(p_skript_id, true)) IS NOT TRUE THEN
    RAISE EXCEPTION 'Kein Schreibzugriff auf dieses Skript';
  END IF;

  SELECT * INTO v
  FROM public.skript_versionen
  WHERE skript_id = p_skript_id
    AND version_nr = p_version_nr
    AND sub_nr = COALESCE(p_sub_nr, 0);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version nicht gefunden';
  END IF;

  UPDATE public.skripte SET
    titel = v.titel,
    hook = v.hook,
    hauptteil = v.hauptteil,
    cta = v.cta,
    hook_visuell = v.hook_visuell,
    hauptteil_visuell = v.hauptteil_visuell,
    cta_visuell = v.cta_visuell,
    hook_variante_1 = v.hook_variante_1,
    hook_variante_2 = v.hook_variante_2,
    hook_variante_3 = v.hook_variante_3,
    rezept = v.rezept,
    text_hook = v.text_hook,
    caption = v.caption,
    inhalt_md = v.inhalt_md,
    aktive_version_nr = v.version_nr,
    aktive_sub_nr = v.sub_nr
  WHERE id = p_skript_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wechsle_skript_version_gast(uuid, integer, integer) TO anon, authenticated, service_role;

ALTER TABLE public.skript_pakete ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skript_paket_eintraege ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skript_pakete_staff ON public.skript_pakete;
CREATE POLICY skript_pakete_staff ON public.skript_pakete
  FOR ALL TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

DROP POLICY IF EXISTS skript_paket_eintraege_staff ON public.skript_paket_eintraege;
CREATE POLICY skript_paket_eintraege_staff ON public.skript_paket_eintraege
  FOR ALL TO authenticated
  USING ((SELECT is_admin_or_mitarbeiter()))
  WITH CHECK ((SELECT is_admin_or_mitarbeiter()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skript_pakete TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skript_paket_eintraege TO authenticated;
