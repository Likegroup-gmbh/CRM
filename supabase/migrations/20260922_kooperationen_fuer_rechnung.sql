-- Kooperationen fuer das Rechnungs-Dropdown.
-- Nur Zeilen ohne Rechnung, plus Kooperationen deren Vertrag
-- mehrere_rechnungen_erlaubt hat (direkt oder creator_id + kampagne_id).
-- security_invoker: RLS von kooperationen, rechnung und vertraege gilt.

CREATE OR REPLACE VIEW public.kooperationen_fuer_rechnung
WITH (security_invoker = true) AS
SELECT
  k.id,
  k.name,
  k.kampagne_id,
  k.creator_id,
  k.created_at,
  EXISTS (
    SELECT 1 FROM public.rechnung r WHERE r.kooperation_id = k.id
  ) AS hat_rechnung
FROM public.kooperationen k
WHERE NOT EXISTS (
  SELECT 1 FROM public.rechnung r WHERE r.kooperation_id = k.id
)
OR EXISTS (
  SELECT 1
  FROM public.vertraege v
  WHERE v.mehrere_rechnungen_erlaubt = true
    AND v.is_draft = false
    AND (
      v.kooperation_id = k.id
      OR (
        k.creator_id IS NOT NULL
        AND k.kampagne_id IS NOT NULL
        AND v.creator_id = k.creator_id
        AND v.kampagne_id = k.kampagne_id
      )
    )
);

GRANT SELECT ON public.kooperationen_fuer_rechnung TO authenticated, service_role;
