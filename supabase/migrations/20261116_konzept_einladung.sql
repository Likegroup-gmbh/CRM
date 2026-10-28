-- Konzept-Einladung (ADR 0059)
-- Dritte Einladungsart: pro Casting-Eintrag ein Link, über den der Creator das
-- Creator-Sheet ausfüllt. Die Einreichung wird beim Anlegen zu genau einer Videoidee
-- (strategie_items). Der Sheet-Text bleibt in einreichung.payload (staff-only per RLS,
-- unveränderlich per Trigger); die Videoidee verweist nur darauf.

BEGIN;

-- ---------------------------------------------------------------------
-- 1) einladung: Art 'konzept' und Casting-Eintrag
-- ---------------------------------------------------------------------

ALTER TABLE public.einladung DROP CONSTRAINT IF EXISTS einladung_art_check;
ALTER TABLE public.einladung ADD CONSTRAINT einladung_art_check
  CHECK (art IN ('produkt', 'briefing', 'konzept'));

ALTER TABLE public.einladung
  ADD COLUMN IF NOT EXISTS creator_auswahl_item_id uuid
    REFERENCES public.creator_auswahl_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.einladung.creator_auswahl_item_id IS
  'Nur Konzept-Einladung: der Casting-Eintrag, dessen Creator einreicht. Fällt der Eintrag weg (SET NULL), gilt die Einladung als widerrufen; offene Einreichungen bleiben.';

ALTER TABLE public.einladung DROP CONSTRAINT IF EXISTS einladung_art_felder;
ALTER TABLE public.einladung ADD CONSTRAINT einladung_art_felder CHECK (
  (art = 'briefing' AND produktion_id IS NOT NULL AND briefing_typ IS NOT NULL
     AND briefing_id IS NULL AND creator_auswahl_item_id IS NULL)
  OR
  (art = 'produkt' AND produktion_id IS NULL AND briefing_typ IS NULL
     AND creator_auswahl_item_id IS NULL)
  OR
  (art = 'konzept' AND produktion_id IS NULL AND briefing_typ IS NULL)
);

-- Höchstens eine aktive Konzept-Einladung pro Casting-Eintrag.
CREATE UNIQUE INDEX IF NOT EXISTS einladung_konzept_aktiv_je_eintrag
  ON public.einladung (creator_auswahl_item_id)
  WHERE art = 'konzept' AND revoked_at IS NULL AND creator_auswahl_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS einladung_eintrag_idx
  ON public.einladung (creator_auswahl_item_id) WHERE creator_auswahl_item_id IS NOT NULL;

GRANT SELECT (creator_auswahl_item_id) ON public.einladung TO authenticated;

-- ---------------------------------------------------------------------
-- 2) Ergebnis des Anlegens: einreichung <-> strategie_items
-- ---------------------------------------------------------------------

ALTER TABLE public.einreichung
  ADD COLUMN IF NOT EXISTS strategie_item_id uuid
    REFERENCES public.strategie_items(id) ON DELETE SET NULL;

ALTER TABLE public.strategie_items
  ADD COLUMN IF NOT EXISTS einreichung_id uuid
    REFERENCES public.einreichung(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.strategie_items.einreichung_id IS
  'Videoidee aus einer Konzept-Einreichung. Der Block Creator-Sheet liest daraus einreichung.payload (nur Staff, RLS).';

CREATE INDEX IF NOT EXISTS strategie_items_einreichung_idx
  ON public.strategie_items (einreichung_id) WHERE einreichung_id IS NOT NULL;

GRANT UPDATE (status, produkt_id, briefing_id, strategie_item_id, erledigt_am, erledigt_von)
  ON public.einreichung TO authenticated;

COMMIT;
