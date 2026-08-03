-- =====================================================================
-- KI-Nutzungsprotokoll: eine Zeile pro Claude-API-Aufruf.
-- Geschrieben ausschliesslich von Netlify Functions (Service Role),
-- gelesen nur von Admins (Seite "KI-Nutzung").
-- Dient gleichzeitig als Zaehlbasis fuer die Frequenz-Limits in
-- netlify/functions/_shared/ki-log.js: die Zeile entsteht mit status
-- 'running' VOR dem API-Call, damit parallel abgefeuerte Anfragen
-- nicht am Zaehler vorbeirutschen.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ki_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- auth.users-ID (wie created_by in den uebrigen Function-Tabellen)
  created_by uuid,
  -- Aufrufstelle: skript_generierung, skript_rueckfragen, skript_editor,
  -- dna_destillat, pdf_briefing, site_extract_<entity>
  feature varchar NOT NULL,
  model varchar,
  input_tokens int,
  output_tokens int,
  cache_read_tokens int,
  cache_write_tokens int,
  cost_usd numeric(10, 6),
  cost_eur numeric(10, 6),
  status varchar NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ok', 'error', 'blocked')),
  error_message text,
  dauer_ms int
);

CREATE INDEX IF NOT EXISTS idx_ki_requests_user_zeit ON ki_requests(created_by, created_at);
CREATE INDEX IF NOT EXISTS idx_ki_requests_zeit ON ki_requests(created_at);

ALTER TABLE ki_requests ENABLE ROW LEVEL SECURITY;

-- Nur Admins duerfen lesen; Schreibzugriff laeuft ueber den Service-Key
-- der Functions (an RLS vorbei), Clients haben keine Schreib-Policies.
CREATE POLICY ki_requests_select ON ki_requests
  FOR SELECT USING ((SELECT is_admin()));
