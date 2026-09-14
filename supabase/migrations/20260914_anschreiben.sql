-- Anschreiben: Mailvorlagen + Versandprotokoll
-- Das Anschreiben ist kein Zugang (list_shares): E-Mail mit Dokumentanhang an
-- adressierbare Empfänger (Creator.mail / Management.email), eine Mail pro Empfänger.
-- Siehe docs/adr/0012-anschreiben-nicht-zugang.md.

-- =====================================================================
-- 1) mailvorlage
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.mailvorlage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  betreff text NOT NULL,
  body text NOT NULL,
  empfaenger_typ text CHECK (empfaenger_typ IN ('creator', 'management')),
  is_standard boolean NOT NULL DEFAULT false,
  is_shared boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Genau ein Standard
CREATE UNIQUE INDEX IF NOT EXISTS uq_mailvorlage_standard
  ON public.mailvorlage (is_standard) WHERE is_standard;

CREATE INDEX IF NOT EXISTS idx_mailvorlage_created_by ON public.mailvorlage (created_by);

DROP TRIGGER IF EXISTS mailvorlage_updated_at ON public.mailvorlage;
CREATE TRIGGER mailvorlage_updated_at BEFORE UPDATE ON public.mailvorlage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.mailvorlage ENABLE ROW LEVEL SECURITY;

-- Lesen: Standard + geteilte + eigene
CREATE POLICY mailvorlage_select ON public.mailvorlage
  FOR SELECT USING (
    (SELECT is_admin_or_mitarbeiter())
    AND (
      is_standard
      OR is_shared
      OR created_by = (SELECT id FROM public.benutzer WHERE auth_user_id = auth.uid())
    )
  );

-- Schreiben: nur eigene, kein Standard
CREATE POLICY mailvorlage_insert ON public.mailvorlage
  FOR INSERT WITH CHECK (
    (SELECT is_admin_or_mitarbeiter())
    AND NOT is_standard
    AND created_by = (SELECT id FROM public.benutzer WHERE auth_user_id = auth.uid())
  );

CREATE POLICY mailvorlage_update ON public.mailvorlage
  FOR UPDATE USING (
    (SELECT is_admin_or_mitarbeiter())
    AND NOT is_standard
    AND created_by = (SELECT id FROM public.benutzer WHERE auth_user_id = auth.uid())
  );

CREATE POLICY mailvorlage_delete ON public.mailvorlage
  FOR DELETE USING (
    (SELECT is_admin_or_mitarbeiter())
    AND NOT is_standard
    AND created_by = (SELECT id FROM public.benutzer WHERE auth_user_id = auth.uid())
  );

-- Seed: ein Standard, nicht löschbar (is_standard sperrt update/delete über RLS)
INSERT INTO public.mailvorlage (name, betreff, body, empfaenger_typ, is_standard, is_shared)
SELECT
  'Standard',
  'Briefing: {{briefing}}',
  'Hallo {{vorname}},

anbei das Briefing „{{briefing}}"{{#unternehmen}} für {{unternehmen}}{{/unternehmen}} als PDF.

Bei Fragen antworte einfach auf diese E-Mail.

Viele Grüße',
  NULL,
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.mailvorlage WHERE is_standard);

-- =====================================================================
-- 2) anschreiben_log — eine Zeile pro Empfänger
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.anschreiben_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  dokument_typ text NOT NULL,
  dokument_id uuid NOT NULL,
  empfaenger_typ text NOT NULL CHECK (empfaenger_typ IN ('creator', 'management')),
  empfaenger_id uuid NOT NULL,
  email text NOT NULL,
  vorlage_id uuid REFERENCES public.mailvorlage(id) ON DELETE SET NULL,
  betreff text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'error')),
  resend_id text,
  error text,
  sent_at timestamptz,
  created_by uuid REFERENCES public.benutzer(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_anschreiben_log_dokument
  ON public.anschreiben_log (dokument_typ, dokument_id);
CREATE INDEX IF NOT EXISTS idx_anschreiben_log_empfaenger
  ON public.anschreiben_log (empfaenger_typ, empfaenger_id);
CREATE INDEX IF NOT EXISTS idx_anschreiben_log_batch
  ON public.anschreiben_log (batch_id);

ALTER TABLE public.anschreiben_log ENABLE ROW LEVEL SECURITY;

-- Nur Staff liest; geschrieben wird über die Service Role (Netlify Function)
CREATE POLICY anschreiben_log_select ON public.anschreiben_log
  FOR SELECT USING ((SELECT is_admin_or_mitarbeiter()));
