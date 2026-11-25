-- Altbestand-Linien (V1-Kampagnen in V2): Flag am Briefing und Backup-Tabelle fuer das
-- Migrationsskript scripts/legacy-linien-migration.js.
--
-- Rein additiv (docs/v2-parallelbetrieb.md): V1 liest die Spalte nicht, solange sein Hotfix
-- (.eq('ist_altbestand', false)) nicht live ist; mit dem Default false aendert sich fuer
-- bestehende Zeilen nichts. Reihenfolge beim Ausrollen:
--   1. diese Migration
--   2. V1-Hotfix live (Briefing-Listen filtern ist_altbestand = false)
--   3. Pilot, danach Wellen (scripts/legacy-linien-migration.js)

BEGIN;

ALTER TABLE public.campaign_briefings
  ADD COLUMN IF NOT EXISTS ist_altbestand boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaign_briefings.ist_altbestand IS
  'Altbestand-Linie: Linie ohne eigenes Briefing-Dokument, aus V1 uebernommen. Mit ist_altbestand = true sind Briefing-Formular, Liky und Casting-Vorschlaege gesperrt; "Briefing ausfuellen" setzt das Flag auf false.';

CREATE INDEX IF NOT EXISTS campaign_briefings_altbestand_idx
  ON public.campaign_briefings (produktion_id)
  WHERE ist_altbestand;

-- Backup und Protokoll des Migrationslaufs. Eine Zeile je geaenderter oder angelegter
-- Zeile. "alt" haelt die Werte vor dem Lauf (briefing_id, produktion_id, name), "aktion"
-- unterscheidet Aenderung von Neuanlage (Rollback loescht Neuanlagen, setzt Aenderungen zurueck).
CREATE TABLE IF NOT EXISTS public.legacy_linien_backup (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lauf_id     uuid NOT NULL,
  kampagne_id uuid,
  tabelle     text NOT NULL,
  zeilen_id   uuid NOT NULL,
  aktion      text NOT NULL CHECK (aktion IN ('geaendert', 'angelegt')),
  alt         jsonb NOT NULL DEFAULT '{}'::jsonb,
  regel       text,
  rueckgaengig_am timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS legacy_linien_backup_lauf_idx
  ON public.legacy_linien_backup (lauf_id);
CREATE INDEX IF NOT EXISTS legacy_linien_backup_kampagne_idx
  ON public.legacy_linien_backup (kampagne_id);

-- Nur der Service-Role-Key (Skript) liest und schreibt. Ohne Policy sieht kein Client etwas.
ALTER TABLE public.legacy_linien_backup ENABLE ROW LEVEL SECURITY;

COMMIT;
